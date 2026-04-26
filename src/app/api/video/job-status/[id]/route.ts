export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { JobStatusResponse, VideoProjectStatusV2, ProcessingStep } from "@/types/video-pipeline";

/**
 * GET /api/video/job-status/[id]
 *
 * Retorna o status atual do pipeline para um projeto de vídeo.
 * [id] = project_id (o cliente conhece o project_id, não o job_id).
 *
 * Busca o último job associado ao projeto e retorna JobStatusResponse.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { error: "project_id e obrigatorio" },
        { status: 400 }
      );
    }

    const admin = getAdminSupabase();

    // 2. Buscar projeto e validar ownership
    const { data: project, error: projectError } = await admin
      .from("video_projects")
      .select(
        "id, user_id, status, processing_step, processing_progress, duration_seconds, cost_estimate_cents, cuts"
      )
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Projeto nao encontrado" },
        { status: 404 }
      );
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
    }

    // 3. Buscar último job desse projeto
    const { data: job, error: jobError } = await admin
      .from("video_jobs")
      .select(
        "id, status, current_step, progress, error, created_at, started_at, completed_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Job pode não existir se o projeto ainda está em 'uploading'
    const hasJob = !jobError && job;

    // 4. Calcular cuts_count
    const cutsCount = Array.isArray(project.cuts) ? project.cuts.length : 0;

    // 5. Montar resposta
    const response: JobStatusResponse = {
      project_id: projectId,
      job_id: hasJob ? job.id : "",
      status: (project.status as VideoProjectStatusV2) ?? "queued",
      step: hasJob
        ? (job.current_step as ProcessingStep | null)
        : (project.processing_step as ProcessingStep | null) ?? null,
      progress: hasJob ? (job.progress ?? 0) : (project.processing_progress ?? 0),
      cuts_count: cutsCount,
      duration_seconds: project.duration_seconds ?? null,
      cost_estimate_cents: project.cost_estimate_cents ?? null,
    };

    // Adicionar info de erro se job falhou
    if (hasJob && job.status === "failed" && job.error) {
      response.error_step = job.current_step ?? undefined;
      response.error_message = job.error;
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[job-status] Unexpected error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
