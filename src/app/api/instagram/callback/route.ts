import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getProfile,
} from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/instagram/callback?code=xxx&state=xxx
 * Callback do Business Login for Instagram
 * Troca code por token e salva a conexão
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  // Usuário negou acesso
  if (errorParam) {
    return NextResponse.redirect(
      new URL("/conexoes?error=access_denied", req.nextUrl.origin)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/conexoes?error=missing_params", req.nextUrl.origin)
    );
  }

  // Decodificar state
  let state: { empresa_id: string; user_id: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      new URL("/conexoes?error=invalid_state", req.nextUrl.origin)
    );
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  // Em produção atrás de proxy reverso, usar headers reais
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/instagram/callback`;

  try {
    // O code do Instagram vem com #_ no final — remover
    const cleanCode = code.replace(/#_$/, "");

    // 1. Trocar code por short-lived token + user_id
    const tokenData = await exchangeCodeForToken(cleanCode, appId, appSecret, redirectUri);

    // 2. Trocar por long-lived token (~60 dias)
    const longToken = await exchangeForLongLivedToken(
      tokenData.access_token,
      appSecret
    );

    // 3. Buscar perfil do Instagram
    const profile = await getProfile(tokenData.user_id, longToken.access_token);

    // 4. Salvar no Supabase
    const supabase = await createClient();

    const { error: dbError } = await supabase
      .from("social_connections")
      .upsert(
        {
          empresa_id: state.empresa_id,
          user_id: state.user_id,
          provider: "instagram",
          provider_user_id: tokenData.user_id,
          username: profile.username,
          display_name: profile.name,
          profile_picture_url: profile.profile_picture_url,
          access_token: longToken.access_token,
          token_expires_at: new Date(
            Date.now() + longToken.expires_in * 1000
          ).toISOString(),
          app_id: appId,
          scopes: [
            "instagram_business_basic",
            "instagram_business_content_publish",
            "instagram_business_manage_messages",
            "instagram_business_manage_comments",
            "instagram_business_manage_insights",
          ],
          is_active: true,
          last_verified_at: new Date().toISOString(),
          metadata: {
            followers_count: profile.followers_count,
            media_count: profile.media_count,
          },
        },
        { onConflict: "empresa_id,provider" }
      );

    if (dbError) {
      console.error("Erro ao salvar conexão:", dbError);
      return NextResponse.redirect(
        new URL("/conexoes?error=db_error", req.nextUrl.origin)
      );
    }

    // 5. Atualizar redes_sociais na empresa
    await supabase
      .from("empresas")
      .update({
        redes_sociais: {
          instagram: {
            conectado: true,
            username: profile.username,
            provider_user_id: tokenData.user_id,
          },
        },
      })
      .eq("id", state.empresa_id);

    // Sucesso
    return NextResponse.redirect(
      new URL(
        `/conexoes?success=instagram&username=${profile.username}`,
        req.nextUrl.origin
      )
    );
  } catch (err) {
    console.error("Erro no callback Instagram:", err);
    return NextResponse.redirect(
      new URL("/conexoes?error=auth_failed", req.nextUrl.origin)
    );
  }
}
