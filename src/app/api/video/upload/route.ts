export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "videos";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const empresaId = formData.get("empresa_id") as string | null;
    const title = (formData.get("title") as string) || "Video sem titulo";

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo de video e obrigatorio" },
        { status: 400 }
      );
    }
    if (!empresaId) {
      return NextResponse.json(
        { error: "empresa_id e obrigatorio" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo excede o limite de 500MB" },
        { status: 400 }
      );
    }

    // Validate mime type
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/mpeg",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Formato nao suportado: ${file.type}. Use MP4, WebM, MOV ou AVI.`,
        },
        { status: 400 }
      );
    }

    // Ensure bucket exists (ignore error if already exists)
    await supabase.storage
      .createBucket(BUCKET_NAME, { public: false })
      .catch(() => {});

    // Generate unique storage path
    const ext = file.name.split(".").pop() || "mp4";
    const storagePath = `${user.id}/${empresaId}/${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[video/upload] Storage error:", uploadError);
      return NextResponse.json(
        { error: `Erro no upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create video_project record
    const { data: project, error: dbError } = await supabase
      .from("video_projects")
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        title,
        original_url: file.name,
        storage_path: storagePath,
        status: "uploading",
      })
      .select("id, status, created_at")
      .single();

    if (dbError) {
      // Cleanup storage on DB failure
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      console.error("[video/upload] DB error:", dbError);
      return NextResponse.json(
        { error: `Erro ao salvar projeto: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      project_id: project.id,
      status: project.status,
      storage_path: storagePath,
      created_at: project.created_at,
    });
  } catch (error: any) {
    console.error("[video/upload] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no upload" },
      { status: 500 }
    );
  }
}
