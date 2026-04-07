export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestViralCuts, type CutPreferences } from "@/lib/video/gemini-video";
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
    const { project_id, preferences } = body;

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

    // Download video from Supabase Storage to temp file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(project.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Erro ao baixar video do storage" },
        { status: 500 }
      );
    }

    const ext = project.storage_path.split(".").pop() || "mp4";
    tempFilePath = path.join(os.tmpdir(), `contia-cuts-${project_id}.${ext}`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);

    const mimeType = getMimeType(ext);

    // Build preferences
    const cutPreferences: CutPreferences = {
      style: preferences?.style || "viral",
      maxLengthSeconds: preferences?.maxLengthSeconds || 60,
      minLengthSeconds: preferences?.minLengthSeconds || 15,
      count: preferences?.count || 5,
      targetPlatform: preferences?.targetPlatform || "Instagram Reels, TikTok, YouTube Shorts",
    };

    // Get cut suggestions from Gemini
    const cuts = await suggestViralCuts(tempFilePath, mimeType, cutPreferences);

    // Save cut suggestions to project
    await supabase
      .from("video_projects")
      .update({
        cut_suggestions: cuts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project_id);

    return NextResponse.json({
      project_id,
      cuts,
      count: cuts.length,
    });
  } catch (error: any) {
    console.error("[video/cuts] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao gerar cortes" },
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
