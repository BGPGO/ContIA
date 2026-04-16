import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approvePost } from "@/lib/approvals";

// POST /api/post-approvals/[id]/approve — Aprova um post
// [id] = id do APPROVAL (não do post)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: approvalId } = await params;

    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Body opcional
    let body: { comment?: string } = {};
    try {
      body = await request.json();
    } catch {
      // body pode ser vazio — ok
    }

    // Buscar o approval para verificar ownership via empresa_id
    const { data: approval } = await supabase
      .from("post_approvals")
      .select("id, post_id, empresa_id, status")
      .eq("id", approvalId)
      .maybeSingle();

    if (!approval) {
      return NextResponse.json(
        { error: "Aprovação não encontrada." },
        { status: 404 }
      );
    }

    // Verificar que o usuário tem acesso à empresa desta aprovação
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", approval.empresa_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!empresa) {
      return NextResponse.json(
        { error: "Sem permissão para aprovar este post." },
        { status: 403 }
      );
    }

    const result = await approvePost(supabase, {
      postId: approval.post_id as string,
      approvalId,
      reviewedBy: user.id,
      comment: body.comment,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("[post-approvals/id/approve] POST error:", errorMsg);

    if (
      errorMsg.includes("não encontrad")
    ) {
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    if (errorMsg.includes("já foi processada")) {
      return NextResponse.json({ error: errorMsg }, { status: 409 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
