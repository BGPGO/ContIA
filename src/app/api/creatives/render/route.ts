export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { renderHtmlToPngs } from "@/lib/creatives/render";
import { uploadPng } from "@/lib/creatives/storage";

interface RenderBody {
  html: string;
  messageId: string;
  empresaId: string;
}

export async function POST(req: NextRequest) {
  let body: RenderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.html || !body.messageId || !body.empresaId) {
    return NextResponse.json(
      { error: "Campos obrigatórios: html, messageId, empresaId" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const authz = await requireRole(supabase, body.empresaId, "post.create");
  if (!authz.ok) return authz.response;

  // 1) Busca a mensagem
  const { data: message } = await supabase
    .from("creative_messages")
    .select("id, conversation_id")
    .eq("id", body.messageId)
    .single();

  if (!message) {
    return NextResponse.json(
      { error: "Mensagem não encontrada" },
      { status: 404 }
    );
  }

  // 2) Confirma que a conversa pertence à empresa
  const { data: conversation } = await supabase
    .from("creative_conversations")
    .select("id")
    .eq("id", message.conversation_id)
    .eq("empresa_id", body.empresaId)
    .single();

  if (!conversation) {
    return NextResponse.json(
      { error: "Mensagem não pertence a esta empresa" },
      { status: 404 }
    );
  }

  try {
    const buffers = await renderHtmlToPngs(body.html);

    const urls: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const buf = buffers[i];
      const path =
        buffers.length === 1
          ? `${body.empresaId}/${body.messageId}.png`
          : `${body.empresaId}/${body.messageId}-slide-${String(i + 1).padStart(2, "0")}.png`;
      const url = await uploadPng(supabase, "creatives", path, buf);
      urls.push(url);
    }

    const firstUrl = urls[0];

    // Atualiza message com png_url (primeiro slide, compat) + png_urls (array completo)
    await supabase
      .from("creative_messages")
      .update({ png_url: firstUrl, png_urls: urls } as Record<string, unknown>)
      .eq("id", body.messageId);

    return NextResponse.json({ url: firstUrl, urls });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao renderizar: ${msg}` },
      { status: 500 }
    );
  }
}
