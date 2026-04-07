import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScheduleStatus } from "@/lib/scheduler";

// GET /api/posts/schedule/status?postId=xxx
// Retorna status do agendamento + historico de publicacoes de um post
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticacao
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Nao autenticado." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Query param obrigatorio: postId." },
        { status: 400 }
      );
    }

    // Verificar que o post pertence ao usuario (via empresa)
    const { data: post } = await supabase
      .from("posts")
      .select("id, empresa_id, status, agendado_para, publicado_em")
      .eq("id", postId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json(
        { error: "Post nao encontrado." },
        { status: 404 }
      );
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", post.empresa_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!empresa) {
      return NextResponse.json(
        { error: "Sem permissao para visualizar este post." },
        { status: 403 }
      );
    }

    const { job, publishes } = await getScheduleStatus(supabase, postId);

    return NextResponse.json({
      post: {
        id: post.id,
        status: post.status,
        agendado_para: post.agendado_para,
        publicado_em: post.publicado_em,
      },
      schedule: job
        ? {
            jobId: job.id,
            status: job.status,
            scheduledFor: job.scheduled_for,
            platforms: job.platforms,
            attempts: job.attempts,
            lastError: job.last_error,
            publishedAt: job.published_at,
            createdAt: job.created_at,
          }
        : null,
      publishes: publishes.map((p) => ({
        id: p.id,
        plataforma: p.plataforma,
        status: p.status,
        platformPostId: p.plataforma_post_id,
        errorMessage: p.error_message,
        publishedAt: p.published_at,
        createdAt: p.created_at,
      })),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("Schedule status error:", errorMsg);

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
