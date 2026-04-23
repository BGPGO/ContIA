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
    .select(`
      id, title, created_at, updated_at,
      creative_messages ( id, png_url, png_urls, role, created_at )
    `)
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type RawMessage = {
    id: string;
    png_url: string | null;
    png_urls: string[] | null;
    role: string;
    created_at: string;
  };

  const conversations = (data ?? []).map((conv) => {
    const messages: RawMessage[] = Array.isArray(conv.creative_messages)
      ? (conv.creative_messages as RawMessage[])
      : [];

    const firstWithImage = messages
      .filter(
        (m) =>
          m.role === "assistant" &&
          (m.png_url || (Array.isArray(m.png_urls) && m.png_urls.length > 0))
      )
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0];

    const thumbUrl: string | null =
      firstWithImage?.png_url ??
      (Array.isArray(firstWithImage?.png_urls) && firstWithImage!.png_urls!.length > 0
        ? firstWithImage!.png_urls![0]
        : null);

    return {
      id: conv.id,
      title: conv.title,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      thumb_url: thumbUrl,
    };
  });

  return NextResponse.json({ conversations });
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
