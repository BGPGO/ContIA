import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCopySessions, createCopySession } from "@/lib/copy-sessions-db";
import type { ContentFormat, ContentTone } from "@/types/ai";

// ── GET: List sessions for empresa ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const empresaId = request.nextUrl.searchParams.get("empresa_id");
    if (!empresaId) {
      return NextResponse.json(
        { error: "Query param 'empresa_id' e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user has access (RLS handles this, but let's also get user)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const sessions = await listCopySessions(supabase, empresaId);

    // Return lightweight list (no full messages/copy)
    const list = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      format: s.format,
      tone: s.tone,
      topic: s.topic,
      status: s.status,
      platforms: s.platforms,
      updated_at: s.updated_at,
      created_at: s.created_at,
      message_count: s.messages?.length || 0,
      has_copy: !!s.current_copy,
    }));

    return NextResponse.json(list);
  } catch (error: unknown) {
    console.error("[copy-sessions] GET error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Falha ao listar sessoes." },
      { status: 500 }
    );
  }
}

// ── POST: Create new session ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresa_id, format, tone, platforms, topic, title } = body as {
      empresa_id?: string;
      format?: ContentFormat;
      tone?: ContentTone;
      platforms?: string[];
      topic?: string;
      title?: string;
    };

    if (!empresa_id) {
      return NextResponse.json(
        { error: "Campo 'empresa_id' e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    // Auto-generate title from topic if not provided
    const sessionTitle = title || (topic ? `Copy: ${topic.slice(0, 50)}` : "Nova copy");

    const session = await createCopySession(supabase, {
      empresa_id,
      user_id: user.id,
      title: sessionTitle,
      format: format || "post",
      tone: tone || "casual",
      platforms: platforms || [],
      topic: topic || "",
      current_copy: null,
      messages: [],
      dna_context: null,
      style_profile: null,
      status: "draft",
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: unknown) {
    console.error("[copy-sessions] POST error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Falha ao criar sessao." },
      { status: 500 }
    );
  }
}
