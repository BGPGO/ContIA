export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/creatives/[id]/send-to-approval
// Cria um post em pendente_aprovacao a partir de uma mensagem de criativo
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await ctx.params;

    const supabase = await createClient();

    // Autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Body: messageId, caption, plataformas?
    let body: { messageId?: string; caption?: string; plataformas?: string[] } = {};
    try {
      body = await req.json();
    } catch {
      // body vazio tratado abaixo
    }

    const { messageId, caption, plataformas } = body;

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json(
        { error: "messageId obrigatório." },
        { status: 400 }
      );
    }

    if (!caption || typeof caption !== "string" || !caption.trim()) {
      return NextResponse.json(
        { error: "caption obrigatório." },
        { status: 400 }
      );
    }

    // Buscar a conversa e verificar que o usuário pertence à empresa
    const { data: conversation, error: convErr } = await supabase
      .from("creative_conversations")
      .select("id, title, empresa_id, user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr || !conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    // Verificar que o usuário é membro da empresa
    const { data: membership } = await supabase
      .from("empresa_members")
      .select("id")
      .eq("empresa_id", conversation.empresa_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Sem permissão para acessar esta empresa." },
        { status: 403 }
      );
    }

    // Buscar a mensagem e verificar que pertence à conversa
    const { data: message, error: msgErr } = await supabase
      .from("creative_messages")
      .select("id, html, png_url, png_urls, role")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (msgErr || !message) {
      return NextResponse.json(
        { error: "Mensagem não encontrada nesta conversa." },
        { status: 404 }
      );
    }

    // Validar que a mensagem tem PNG gerado
    const pngUrls: string[] = Array.isArray(message.png_urls) && message.png_urls.length > 0
      ? (message.png_urls as string[])
      : message.png_url
      ? [message.png_url as string]
      : [];

    if (pngUrls.length === 0) {
      return NextResponse.json(
        { error: "Mensagem sem PNG gerado. Gere o criativo antes de enviar para aprovação." },
        { status: 422 }
      );
    }

    if (!message.html) {
      return NextResponse.json(
        { error: "Mensagem sem HTML gerado. Gere o criativo antes de enviar para aprovação." },
        { status: 422 }
      );
    }

    // Criar post em pendente_aprovacao
    const { data: newPost, error: postErr } = await supabase
      .from("posts")
      .insert({
        empresa_id: conversation.empresa_id,
        user_id: user.id,
        titulo: conversation.title || "Criativo sem título",
        conteudo: caption.trim(),
        midia_url: pngUrls[0],
        midia_urls: pngUrls,
        plataformas: plataformas ?? ["instagram"],
        status: "pendente_aprovacao",
        approval_required: true,
        creative_message_id: messageId,
      })
      .select("*")
      .single();

    if (postErr || !newPost) {
      console.error("[creatives/[id]/send-to-approval] POST insert post error:", postErr);
      return NextResponse.json(
        { error: `Erro ao criar post: ${postErr?.message ?? "Falha desconhecida"}` },
        { status: 500 }
      );
    }

    // Criar registro em post_approvals
    const { data: approval, error: approvalErr } = await supabase
      .from("post_approvals")
      .insert({
        post_id: newPost.id,
        empresa_id: conversation.empresa_id,
        requested_by: user.id,
        status: "pending",
      })
      .select("*")
      .single();

    if (approvalErr || !approval) {
      console.error("[creatives/[id]/send-to-approval] POST insert approval error:", approvalErr);
      // Rollback: remover o post criado
      await supabase.from("posts").delete().eq("id", newPost.id);
      return NextResponse.json(
        { error: `Erro ao criar aprovação: ${approvalErr?.message ?? "Falha desconhecida"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ post: newPost, approval }, { status: 201 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("[creatives/[id]/send-to-approval] POST error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
