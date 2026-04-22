export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";

/* ── GET: Lista conversations da empresa ── */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresaId");
  if (!empresaId) {
    return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const authz = await requireRole(supabase, empresaId, "post.create");
  if (!authz.ok) return authz.response;

  const { data, error } = await supabase
    .from("creative_conversations")
    .select("id, title, created_at, updated_at")
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

/* ── POST: Cria nova conversation ── */
export async function POST(req: NextRequest) {
  let body: { empresaId: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.empresaId) {
    return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const authz = await requireRole(supabase, body.empresaId, "post.create");
  if (!authz.ok) return authz.response;

  // authz.user.id já disponível — sem necessidade de re-fetch
  const { data, error } = await supabase
    .from("creative_conversations")
    .insert({
      empresa_id: body.empresaId,
      user_id: authz.user.id,
      title: body.title ?? "",
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Falha ao criar conversa" },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversation: data }, { status: 201 });
}
