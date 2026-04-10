import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCopySession } from "@/lib/copy-sessions-db";

// ── POST: Beacon-compatible save endpoint ──────────────────────────────────
// Used by navigator.sendBeacon on page unload to persist draft state.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, format, tone, platforms, topic, currentCopy, messages, status } = body;

    if (!sessionId) {
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

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (format !== undefined) updates.format = format;
    if (tone !== undefined) updates.tone = tone;
    if (platforms !== undefined) updates.platforms = platforms;
    if (topic !== undefined) updates.topic = topic;
    if (currentCopy !== undefined) updates.current_copy = currentCopy;
    if (messages !== undefined) updates.messages = messages;
    if (status !== undefined) updates.status = status;

    await updateCopySession(supabase, sessionId, updates);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[copy-sessions/save] POST error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Falha ao salvar sessao." },
      { status: 500 }
    );
  }
}
