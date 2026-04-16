import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listPendingApprovals } from "@/lib/approvals";

// GET /api/post-approvals/pending — Lista aprovações pendentes de uma empresa
// Query param opcional: ?empresaId=xxx
// Se não vier, usa a primeira empresa do usuário autenticado
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Resolver empresaId: do query param ou da primeira empresa do usuário
    const { searchParams } = new URL(request.url);
    let empresaId = searchParams.get("empresaId");

    if (!empresaId) {
      // Buscar a primeira empresa do usuário
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!empresa) {
        return NextResponse.json(
          { error: "Nenhuma empresa encontrada para este usuário." },
          { status: 404 }
        );
      }

      empresaId = empresa.id as string;
    } else {
      // Verificar que o usuário tem acesso à empresa informada
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("id", empresaId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!empresa) {
        return NextResponse.json(
          { error: "Empresa não encontrada ou sem permissão." },
          { status: 403 }
        );
      }
    }

    const items = await listPendingApprovals(supabase, { empresaId });

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("[post-approvals/pending] GET error:", errorMsg);

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
