export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/video/rerender-clips
 *
 * Solicita re-renderização de todos os cortes de um projeto com um novo estilo de legenda.
 *
 * Body JSON:
 *   { project_id: string, caption_style_id: string }
 *
 * ⚠️  STUB — Wave 6.1 implementa o processamento real.
 * Por ora, registra intenção mas retorna 501 com mensagem amigável.
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
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 2. Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const { project_id, caption_style_id } = body as {
      project_id?: string;
      caption_style_id?: string;
    };

    if (!project_id || typeof project_id !== "string") {
      return NextResponse.json(
        { error: "project_id é obrigatório" },
        { status: 400 }
      );
    }
    if (!caption_style_id || typeof caption_style_id !== "string") {
      return NextResponse.json(
        { error: "caption_style_id é obrigatório" },
        { status: 400 }
      );
    }

    // 3. Validar ownership
    const admin = getAdminSupabase();
    const { data: project, error: fetchError } = await admin
      .from("video_projects")
      .select("id, user_id")
      .eq("id", project_id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: "Projeto não encontrado" },
        { status: 404 }
      );
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    // 4. Registrar intenção — atualizar estilo selecionado + marcar cortes como pending
    // (Mesmo sendo stub, persistimos a seleção do estilo para UX consistente)
    await admin
      .from("video_projects")
      .update({
        selected_style_id: caption_style_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project_id);

    // Criar registro de job para auditoria (status cancelled imediatamente — stub)
    await admin
      .from("video_jobs")
      .insert({
        project_id,
        type: "rerender_clip",
        status: "cancelled",
        current_step: "queued",
        progress: 0,
        attempts: 0,
        max_attempts: 1,
        payload: {
          caption_style_id,
          user_id: user.id,
          note: "stub — wave 6.1",
        },
        result: null,
        error: "Funcionalidade em implementação (Wave 6.1)",
      });

    // 5. Retornar 501 com mensagem amigável
    return NextResponse.json(
      {
        message:
          "Re-render em breve. Por enquanto, suba o vídeo de novo com o estilo desejado.",
        note: "Funcionalidade completa disponível na Wave 6.1",
        project_id,
        caption_style_id,
      },
      { status: 501 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[rerender-clips] Unexpected error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
