export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { runProcessFullJob } from "@/lib/video/job-runner";

/**
 * POST /api/video/start-job
 *
 * Inicia o pipeline assíncrono de processamento para um projeto de vídeo
 * cujo upload já foi concluído pelo cliente.
 *
 * Body JSON:
 *   { project_id }
 *
 * Resposta 202 Accepted:
 *   { job_id, project_id, status: 'queued' }
 *
 * O processamento acontece in-process (fire-and-forget) — não aguarda conclusão.
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

    const { project_id } = body as { project_id?: string };
    if (!project_id || typeof project_id !== "string") {
      return NextResponse.json(
        { error: "project_id e obrigatorio" },
        { status: 400 }
      );
    }

    // 3. Buscar projeto e validar ownership
    const admin = getAdminSupabase();
    const { data: project, error: fetchError } = await admin
      .from("video_projects")
      .select("id, user_id, storage_path, status, empresa_id")
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

    // 4. Verificar que o upload foi concluído (storage_path existe)
    if (!project.storage_path) {
      return NextResponse.json(
        { error: "Upload ainda nao foi concluido para este projeto" },
        { status: 400 }
      );
    }

    // Verificar que o arquivo existe no storage
    const { data: fileList, error: storageCheckError } = await admin.storage
      .from("videos")
      .list(project.storage_path.split("/").slice(0, -1).join("/"), {
        search: project.storage_path.split("/").pop(),
      });

    if (storageCheckError || !fileList || fileList.length === 0) {
      return NextResponse.json(
        {
          error:
            "Arquivo de video nao encontrado no storage. Verifique se o upload foi concluido.",
        },
        { status: 400 }
      );
    }

    // 5. Criar registro em video_jobs
    const { data: job, error: jobError } = await admin
      .from("video_jobs")
      .insert({
        project_id,
        type: "process_full",
        status: "pending",
        current_step: "queued",
        progress: 0,
        attempts: 0,
        max_attempts: 3,
        payload: {
          storage_path: project.storage_path,
          empresa_id: project.empresa_id,
          user_id: user.id,
        },
        result: null,
        error: null,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      console.error("[start-job] Job insert error:", jobError);
      return NextResponse.json(
        { error: "Erro ao criar job de processamento" },
        { status: 500 }
      );
    }

    // 6. Atualizar video_projects: status='queued', processing_started_at=now()
    await admin
      .from("video_projects")
      .update({
        status: "queued",
        processing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", project_id);

    // 7. Disparar processamento async (fire-and-forget — sem await intencional)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcessFullJob(job.id);

    // 8. Retornar 202 imediatamente
    return NextResponse.json(
      {
        job_id: job.id,
        project_id,
        status: "queued",
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[start-job] Unexpected error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
