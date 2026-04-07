import { NextRequest, NextResponse } from "next/server";
import { getInsights } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/instagram/insights?empresa_id=xxx&period=day
 * Retorna métricas do Instagram (impressões, alcance, views, seguidores)
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  const period = (req.nextUrl.searchParams.get("period") ?? "day") as "day" | "week" | "days_28";

  if (!empresaId) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, provider_user_id")
    .eq("empresa_id", empresaId)
    .eq("provider", "instagram")
    .eq("is_active", true)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "Instagram não conectado" },
      { status: 404 }
    );
  }

  try {
    const insights = await getInsights(connection.provider_user_id, connection.access_token, period);
    return NextResponse.json({ insights });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao buscar insights. Conta pode precisar ser Business/Creator." },
      { status: 502 }
    );
  }
}
