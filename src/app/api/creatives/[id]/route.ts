export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";

/* ── GET: Detalhes de conversation + messages ── */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const empresaId = req.nextUrl.searchParams.get("empresaId");

  if (!empresaId) {
    return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const authz = await requireRole(supabase, empresaId, "post.create");
  if (!authz.ok) return authz.response;

  const { data: conv, error: convErr } = await supabase
    .from("creative_conversations")
    .select("id, title, created_at, updated_at, empresa_id")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();

  if (convErr || !conv) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const { data: messages, error: msgErr } = await supabase
    .from("creative_messages")
    .select(
      "id, role, content, html, png_url, model, tokens_in, tokens_out, created_at"
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: conv, messages: messages ?? [] });
}
