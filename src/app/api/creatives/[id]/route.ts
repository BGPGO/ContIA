export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { toPublicUrl } from "@/lib/creatives/storage";

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
      "id, role, content, html, png_url, png_urls, model, tokens_in, tokens_out, created_at"
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  const normalizedMessages = (messages ?? []).map((m) => ({
    ...m,
    png_url: toPublicUrl(m.png_url),
    png_urls: Array.isArray(m.png_urls)
      ? m.png_urls.map((u: string) => toPublicUrl(u)).filter((u): u is string => Boolean(u))
      : [],
  }));

  return NextResponse.json({ conversation: conv, messages: normalizedMessages });
}

/* ── DELETE: Apaga conversa por ID ── */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // RLS já garante ownership — só member da empresa consegue deletar
  const { error } = await supabase
    .from("creative_conversations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[creatives/[id]] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/* ── PATCH: Renomeia título da conversa ── */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : null;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "title obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("creative_conversations")
    .update({ title: title.trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[creatives/[id]] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}
