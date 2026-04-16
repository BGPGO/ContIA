import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitForApproval } from "@/lib/approvals";

// POST /api/posts/[id]/submit-approval — Envia post para aprovação
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

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

    // Buscar empresa do usuário para verificar ownership
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!empresa) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou sem permissão." },
        { status: 403 }
      );
    }

    // Verificar que o post pertence à empresa do usuário
    const { data: post } = await supabase
      .from("posts")
      .select("id, empresa_id, status")
      .eq("id", postId)
      .eq("empresa_id", empresa.id)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    const result = await submitForApproval(supabase, {
      postId,
      empresaId: empresa.id,
      requestedBy: user.id,
      comment: body.comment,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("[posts/id/submit-approval] POST error:", errorMsg);

    if (
      errorMsg.includes("não encontrado") ||
      errorMsg.includes("não encontrada")
    ) {
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    if (
      errorMsg.includes("já está") ||
      errorMsg.includes("já foi publicado")
    ) {
      return NextResponse.json({ error: errorMsg }, { status: 409 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
