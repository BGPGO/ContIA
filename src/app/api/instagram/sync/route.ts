import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncInstagramData } from "@/lib/instagram-sync";

/**
 * POST /api/instagram/sync
 * Body: { empresa_id: string }
 *
 * Triggers a full Instagram data sync (profile + media + insights).
 * Requires authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const empresaId = body.empresa_id;

    if (!empresaId) {
      return NextResponse.json(
        { error: "empresa_id obrigatório" },
        { status: 400 }
      );
    }

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    // Verify user owns this empresa
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .single();

    if (!empresa) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 404 }
      );
    }

    // Run sync
    const result = await syncInstagramData(empresaId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, result },
        { status: 502 }
      );
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error("[api/instagram/sync] Error:", err);
    return NextResponse.json(
      { error: "Erro interno ao sincronizar dados do Instagram" },
      { status: 500 }
    );
  }
}
