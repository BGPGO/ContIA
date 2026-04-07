export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeVideoContent } from "@/lib/video/gemini-video";
import { transcribeVideo } from "@/lib/video/whisper-transcription";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BUCKET_NAME = "videos";

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { project_id } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id e obrigatorio" },
        { status: 400 }
      );
    }

    // Fetch project
    const { data: project, error: fetchError } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: "Projeto nao encontrado" },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
    }

    if (!project.storage_path) {
      return NextResponse.json(
        { error: "Nenhum video associado a este projeto" },
        { status: 400 }
      );
    }

    // Update status to processing
    await supabase
      .from("video_projects")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", project_id);

    // Download video from Supabase Storage to temp file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(project.storage_path);

    if (downloadError || !fileData) {
      await updateError(supabase, project_id, "Erro ao baixar video do storage");
      return NextResponse.json(
        { error: "Erro ao baixar video do storage" },
        { status: 500 }
      );
    }

    // Write to temp file (Gemini File API requires a file path)
    const ext = project.storage_path.split(".").pop() || "mp4";
    tempFilePath = path.join(os.tmpdir(), `contia-video-${project_id}.${ext}`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);

    // Determine mime type
    const mimeType = getMimeType(ext);

    // Run Gemini analysis and Whisper transcription in parallel
    const [geminiResult, whisperResult] = await Promise.allSettled([
      analyzeVideoContent(tempFilePath, mimeType),
      transcribeVideo(buffer, `video.${ext}`),
    ]);

    const geminiAnalysis =
      geminiResult.status === "fulfilled" ? geminiResult.value : null;
    const transcription =
      whisperResult.status === "fulfilled" ? whisperResult.value : null;

    const errors: string[] = [];
    if (geminiResult.status === "rejected") {
      errors.push(`Gemini: ${geminiResult.reason?.message || geminiResult.reason}`);
    }
    if (whisperResult.status === "rejected") {
      errors.push(`Whisper: ${whisperResult.reason?.message || whisperResult.reason}`);
    }

    // If both failed, mark as error
    if (!geminiAnalysis && !transcription) {
      await updateError(supabase, project_id, errors.join("; "));
      return NextResponse.json(
        { error: "Falha no processamento", details: errors },
        { status: 500 }
      );
    }

    // Update project with results
    const updateData: Record<string, any> = {
      status: "analyzed",
      updated_at: new Date().toISOString(),
    };
    if (geminiAnalysis) {
      updateData.gemini_analysis = geminiAnalysis;
      if (geminiAnalysis.duration_estimate_seconds) {
        updateData.duration_seconds = geminiAnalysis.duration_estimate_seconds;
      }
    }
    if (transcription) {
      updateData.transcription = transcription;
      if (transcription.duration && !updateData.duration_seconds) {
        updateData.duration_seconds = transcription.duration;
      }
    }
    if (errors.length > 0) {
      updateData.error = errors.join("; ");
    }

    await supabase
      .from("video_projects")
      .update(updateData)
      .eq("id", project_id);

    return NextResponse.json({
      project_id,
      status: "analyzed",
      gemini_analysis: geminiAnalysis,
      transcription: transcription
        ? {
            fullText: transcription.fullText,
            segmentCount: transcription.segments.length,
            wordCount: transcription.words.length,
            language: transcription.language,
            duration: transcription.duration,
          }
        : null,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[video/process] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no processamento" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp file
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

async function updateError(
  supabase: any,
  projectId: string,
  error: string
) {
  await supabase
    .from("video_projects")
    .update({
      status: "error",
      error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
  };
  return mimeTypes[ext] || "video/mp4";
}
