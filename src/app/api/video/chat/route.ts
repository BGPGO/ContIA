import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai/config";
import {
  processAgentMessage,
  VideoProject,
  ChatMessage,
  AgentAction,
} from "@/lib/video/video-agent";
import {
  loadVideoProject,
  saveEdits,
  saveChatMessages,
  addCut,
  adjustCut,
  removeCut,
  addSubtitles,
  addLogo,
  removeLogo,
} from "@/lib/video/edit-commands";
import { DNASintetizado } from "@/types/index";

interface ChatRequest {
  project_id: string;
  message: string;
  history?: ChatMessage[];
}

/**
 * Apply an agent action to the project edits and persist to Supabase.
 * Returns the updated project (or the original if no action).
 */
async function applyAction(
  project: VideoProject,
  action: AgentAction
): Promise<VideoProject> {
  let newEdits = project.edits;

  switch (action.type) {
    case "ADD_CUT": {
      const { start, end, label } = action.payload || {};
      if (typeof start === "number" && typeof end === "number") {
        newEdits = addCut(project, start, end, label);
      }
      break;
    }
    case "ADJUST_CUT": {
      const { cutIndex, newStart, newEnd } = action.payload || {};
      if (typeof cutIndex === "number") {
        newEdits = adjustCut(project, cutIndex, newStart, newEnd);
      }
      break;
    }
    case "REMOVE_CUT": {
      const { cutIndex } = action.payload || {};
      if (typeof cutIndex === "number") {
        newEdits = removeCut(project, cutIndex);
      }
      break;
    }
    case "ADD_SUBTITLES":
      newEdits = addSubtitles(project, true);
      break;
    case "REMOVE_SUBTITLES":
      newEdits = addSubtitles(project, false);
      break;
    case "ADD_LOGO": {
      const { position, logoUrl } = action.payload || {};
      if (position) {
        newEdits = addLogo(project, position, logoUrl || "");
      }
      break;
    }
    case "REMOVE_LOGO":
      newEdits = removeLogo(project);
      break;
    case "SUGGEST_CUTS":
    case "EXPORT":
    case "NONE":
      // These don't modify edits directly
      return project;
    default:
      return project;
  }

  // Persist
  await saveEdits(project.id, newEdits);

  return {
    ...project,
    edits: newEdits,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Validate AI config
    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: "OpenAI API key nao configurada" },
        { status: 500 }
      );
    }

    const body: ChatRequest = await request.json();
    const { project_id, message, history = [] } = body;

    if (!project_id || !message) {
      return NextResponse.json(
        { error: "project_id e message sao obrigatorios" },
        { status: 400 }
      );
    }

    // Load project
    const project = await loadVideoProject(project_id);
    if (!project) {
      return NextResponse.json(
        { error: "Projeto de video nao encontrado" },
        { status: 404 }
      );
    }

    // Optionally load brand DNA
    let dna: DNASintetizado | undefined;
    try {
      const supabase = await createClient();
      const { data: marcaData } = await supabase
        .from("marca_dna")
        .select("dna_sintetizado")
        .eq("empresa_id", project.empresa_id)
        .eq("status", "completo")
        .single();

      if (marcaData?.dna_sintetizado) {
        dna = marcaData.dna_sintetizado as DNASintetizado;
      }
    } catch {
      // DNA not available — that's fine, proceed without it
    }

    // Process message through agent
    const agentResponse = await processAgentMessage(
      project,
      message,
      history,
      dna
    );

    // Apply action to project if present
    let updatedProject = project;
    if (agentResponse.action) {
      updatedProject = await applyAction(project, agentResponse.action);
    }

    // Save chat history
    const updatedMessages: ChatMessage[] = [
      ...history,
      {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: agentResponse.message,
        action: agentResponse.action,
        timestamp: new Date().toISOString(),
      },
    ];

    await saveChatMessages(project_id, updatedMessages);

    return NextResponse.json({
      message: agentResponse.message,
      action: agentResponse.action || null,
      suggestions: agentResponse.suggestions || [],
      edits: updatedProject.edits,
    });
  } catch (error) {
    console.error("[video/chat] Error:", error);
    return NextResponse.json(
      {
        error: "Erro ao processar mensagem do chat",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
