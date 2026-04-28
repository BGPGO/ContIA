import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { schedulePost, cancelSchedule } from "@/lib/scheduler";

// POST /api/posts/schedule — Agendar um post
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { postId, empresaId, scheduledFor, platforms, instagram_collaborators: rawCollaborators } = body;

    // Sanitize collaborators: remover "@", lowercase, trim, descartar vazios, limitar a 3
    const instagram_collaborators: string[] = Array.isArray(rawCollaborators)
      ? rawCollaborators
          .map((u: unknown) => String(u).trim().toLowerCase().replace(/^@/, ""))
          .filter((u: string) => u.length > 0)
          .slice(0, 3)
      : [];

    // Validacoes basicas
    if (!postId || !empresaId || !scheduledFor || !platforms) {
      return NextResponse.json(
        {
          error:
            "Campos obrigatorios: postId, empresaId, scheduledFor, platforms.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "platforms deve ser um array com ao menos uma plataforma." },
        { status: 400 }
      );
    }

    // Validar formato de data ISO
    const date = new Date(scheduledFor);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "scheduledFor deve ser uma data ISO valida." },
        { status: 400 }
      );
    }

    // Verificar que a empresa pertence ao usuario
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!empresa) {
      return NextResponse.json(
        { error: "Empresa nao encontrada ou sem permissao." },
        { status: 403 }
      );
    }

    // Verificar que o post pertence a empresa
    const { data: post } = await supabase
      .from("posts")
      .select("id, status")
      .eq("id", postId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json(
        { error: "Post nao encontrado." },
        { status: 404 }
      );
    }

    if (post.status === "publicado") {
      return NextResponse.json(
        { error: "Post ja foi publicado." },
        { status: 409 }
      );
    }

    // Persistir collaborators no post antes de agendar (campo adicionado em 022)
    if (instagram_collaborators.length > 0) {
      await supabase
        .from("posts")
        .update({ instagram_collaborators })
        .eq("id", postId);
    }

    const result = await schedulePost(
      supabase,
      postId,
      empresaId,
      scheduledFor,
      platforms
    );

    return NextResponse.json(
      {
        message: "Post agendado com sucesso.",
        jobId: result.jobId,
        scheduledFor,
        platforms,
      },
      { status: 201 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("Schedule POST error:", errorMsg);

    // Erros de validacao do scheduler
    if (
      errorMsg.includes("futuro") ||
      errorMsg.includes("plataforma") ||
      errorMsg.includes("pendente")
    ) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// DELETE /api/posts/schedule — Cancelar agendamento
export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Campo obrigatorio: jobId." },
        { status: 400 }
      );
    }

    // Verificar que o job pertence ao usuario (via empresa)
    const { data: job } = await supabase
      .from("scheduled_jobs")
      .select("id, empresa_id")
      .eq("id", jobId)
      .maybeSingle();

    if (!job) {
      return NextResponse.json(
        { error: "Agendamento nao encontrado." },
        { status: 404 }
      );
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", job.empresa_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!empresa) {
      return NextResponse.json(
        { error: "Sem permissao para cancelar este agendamento." },
        { status: 403 }
      );
    }

    await cancelSchedule(supabase, jobId);

    return NextResponse.json({
      message: "Agendamento cancelado com sucesso.",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("Schedule DELETE error:", errorMsg);

    if (errorMsg.includes("status")) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
