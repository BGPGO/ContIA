import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCopySession,
  updateCopySession,
  deleteCopySession,
} from "@/lib/copy-sessions-db";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET: Full session with messages ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Session ID e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const session = await getCopySession(supabase, id);
    return NextResponse.json(session);
  } catch (error: unknown) {
    console.error("[copy-sessions/id] GET error:", error);
    const msg = (error as Error).message || "";
    if (msg.includes("No rows") || msg.includes("not found") || msg.includes("PGRST116")) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(
      { error: msg || "Falha ao buscar sessao." },
      { status: 500 }
    );
  }
}

// ── PATCH: Update session ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Session ID e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const body = await request.json();

    // Whitelist updatable fields
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.status !== undefined) updates.status = body.status;
    if (body.current_copy !== undefined) updates.current_copy = body.current_copy;
    if (body.messages !== undefined) updates.messages = body.messages;
    if (body.format !== undefined) updates.format = body.format;
    if (body.tone !== undefined) updates.tone = body.tone;
    if (body.platforms !== undefined) updates.platforms = body.platforms;
    if (body.topic !== undefined) updates.topic = body.topic;
    if (body.dna_context !== undefined) updates.dna_context = body.dna_context;
    if (body.style_profile !== undefined) updates.style_profile = body.style_profile;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar." },
        { status: 400 }
      );
    }

    const session = await updateCopySession(supabase, id, updates);
    return NextResponse.json(session);
  } catch (error: unknown) {
    console.error("[copy-sessions/id] PATCH error:", error);
    const msg = (error as Error).message || "";
    if (msg.includes("No rows") || msg.includes("not found") || msg.includes("PGRST116")) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(
      { error: msg || "Falha ao atualizar sessao." },
      { status: 500 }
    );
  }
}

// ── DELETE: Delete session ──────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Session ID e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    await deleteCopySession(supabase, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[copy-sessions/id] DELETE error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Falha ao deletar sessao." },
      { status: 500 }
    );
  }
}
