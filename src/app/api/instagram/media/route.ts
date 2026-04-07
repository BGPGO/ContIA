import { NextRequest, NextResponse } from "next/server";
import { getMedia } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/instagram/media?empresa_id=xxx&limit=12
 * Retorna as mídias recentes do Instagram
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "12");

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
    const media = await getMedia(connection.provider_user_id, connection.access_token, limit);
    return NextResponse.json({ media });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao buscar mídias" },
      { status: 502 }
    );
  }
}
