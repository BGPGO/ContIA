import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/connections/list?empresa_id=xxx
 *
 * Returns all active social_connections for the given empresa.
 * Auth required — user must own or have access to the empresa.
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) {
    return NextResponse.json(
      { error: "empresa_id obrigatório" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Fetch active connections for this empresa belonging to this user
  const { data, error } = await supabase
    .from("social_connections")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[connections/list] DB error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar conexões" },
      { status: 500 }
    );
  }

  return NextResponse.json({ connections: data ?? [] });
}
