import { NextRequest, NextResponse } from "next/server";
import { getProfile, InstagramAPIError } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/instagram/verify
 * Verifica se a conexão ainda é válida (token não expirou)
 *
 * Body: { empresa_id: string }
 *
 * Também aceita credenciais manuais:
 * Body: { empresa_id: string, access_token: string, ig_user_id: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { empresa_id, access_token, ig_user_id } = body;

  if (!empresa_id) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let token = access_token;
  let igId = ig_user_id;

  // Se não veio token manual, buscar do banco
  if (!token || !igId) {
    const { data: connection } = await supabase
      .from("social_connections")
      .select("access_token, provider_user_id")
      .eq("empresa_id", empresa_id)
      .eq("provider", "instagram")
      .single();

    if (!connection) {
      return NextResponse.json(
        { valid: false, error: "Nenhuma conexão encontrada" },
        { status: 404 }
      );
    }

    token = connection.access_token;
    igId = connection.provider_user_id;
  }

  try {
    const profile = await getProfile(igId, token);

    // Atualizar last_verified_at
    await supabase
      .from("social_connections")
      .update({
        last_verified_at: new Date().toISOString(),
        last_error: null,
        metadata: {
          followers_count: profile.followers_count,
          media_count: profile.media_count,
        },
      })
      .eq("empresa_id", empresa_id)
      .eq("provider", "instagram");

    return NextResponse.json({
      valid: true,
      profile: {
        username: profile.username,
        name: profile.name,
        followers_count: profile.followers_count,
        media_count: profile.media_count,
        profile_picture_url: profile.profile_picture_url,
      },
    });
  } catch (err) {
    const message = err instanceof InstagramAPIError ? err.message : "Token inválido ou expirado";

    // Registrar erro
    await supabase
      .from("social_connections")
      .update({ last_error: message })
      .eq("empresa_id", empresa_id)
      .eq("provider", "instagram");

    return NextResponse.json(
      { valid: false, error: message },
      { status: 401 }
    );
  }
}
