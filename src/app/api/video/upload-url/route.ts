export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { VIDEO_LIMITS, STORAGE_BUCKETS } from "@/lib/video/constants";

/**
 * POST /api/video/upload-url
 *
 * Gera uma signed upload URL para o bucket de vídeos brutos.
 * O cliente faz o upload direto para o Supabase Storage (bypass do Next.js —
 * sem OOM para arquivos grandes).
 *
 * Body JSON:
 *   { empresa_id, file_name, content_type, file_size, title? }
 *
 * Resposta 200:
 *   { project_id, storage_path, upload_url, upload_token }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    // 2. Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body JSON invalido" },
        { status: 400 }
      );
    }

    const { empresa_id, file_name, content_type, file_size, title } = body as {
      empresa_id?: string;
      file_name?: string;
      content_type?: string;
      file_size?: number;
      title?: string;
    };

    // 3. Validações
    if (!empresa_id || typeof empresa_id !== "string") {
      return NextResponse.json(
        { error: "empresa_id e obrigatorio" },
        { status: 400 }
      );
    }
    if (!file_name || typeof file_name !== "string") {
      return NextResponse.json(
        { error: "file_name e obrigatorio" },
        { status: 400 }
      );
    }
    if (!content_type || typeof content_type !== "string") {
      return NextResponse.json(
        { error: "content_type e obrigatorio" },
        { status: 400 }
      );
    }
    if (typeof file_size !== "number" || file_size <= 0) {
      return NextResponse.json(
        { error: "file_size deve ser um numero positivo" },
        { status: 400 }
      );
    }
    if (!content_type.startsWith("video/")) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo invalido: ${content_type}. Apenas videos sao aceitos.`,
        },
        { status: 400 }
      );
    }
    if (file_size > VIDEO_LIMITS.MAX_FILE_SIZE_BYTES) {
      const limitGb = (VIDEO_LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024 / 1024).toFixed(0);
      return NextResponse.json(
        { error: `Arquivo excede o limite de ${limitGb} GB` },
        { status: 400 }
      );
    }

    // 4. Gerar storage_path
    const timestamp = Date.now();
    const ext = file_name.split(".").pop()?.toLowerCase() || "mp4";
    const slug = file_name
      .replace(/\.[^/.]+$/, "") // remove extensão
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 60);
    const storage_path = `${user.id}/${empresa_id}/${timestamp}-${slug}.${ext}`;

    // 5. Criar registro no banco com status='uploading'
    const admin = getAdminSupabase();
    const { data: project, error: dbError } = await admin
      .from("video_projects")
      .insert({
        empresa_id,
        user_id: user.id,
        title: title || file_name,
        original_url: file_name,
        storage_path,
        status: "uploading",
      })
      .select("id")
      .single();

    if (dbError || !project) {
      console.error("[upload-url] DB insert error:", dbError);
      return NextResponse.json(
        { error: "Erro ao criar projeto de video" },
        { status: 500 }
      );
    }

    // 6. Criar signed upload URL (válida por 24h = 86400s)
    const { data: signedData, error: storageError } = await admin.storage
      .from(STORAGE_BUCKETS.RAW)
      .createSignedUploadUrl(storage_path);

    if (storageError || !signedData) {
      // Rollback: remove registro criado
      await admin.from("video_projects").delete().eq("id", project.id);
      console.error("[upload-url] Storage signed URL error:", storageError);
      return NextResponse.json(
        { error: "Erro ao gerar URL de upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      project_id: project.id,
      storage_path,
      upload_url: signedData.signedUrl,
      upload_token: signedData.token,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[upload-url] Unexpected error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
