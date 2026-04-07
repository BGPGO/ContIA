import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/instagram/profile?empresa_id=xxx
 * Retorna o perfil completo do Instagram conectado
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
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
      { error: "Instagram não conectado para esta empresa" },
      { status: 404 }
    );
  }

  try {
    const profile = await getProfile(connection.provider_user_id, connection.access_token);
    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao buscar perfil. Token pode ter expirado." },
      { status: 502 }
    );
  }
}
