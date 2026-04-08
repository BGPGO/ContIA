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
  // APP_URL garante consistência entre auth e callback (evita redirect_uri mismatch)
  const origin = process.env.APP_URL
    || `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host}`;

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  // Usuário negou acesso
  if (errorParam) {
    return NextResponse.redirect(new URL("/conexoes?error=access_denied", origin));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/conexoes?error=missing_params", origin));
  }

  // Decodificar state
  let state: { empresa_id: string; user_id: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(new URL("/conexoes?error=invalid_state", origin));
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${origin}/api/instagram/callback`;

  try {
    // O code do Instagram vem com #_ no final — remover
    const cleanCode = code.replace(/#_$/, "");
    console.log("[IG Callback] Step 1: exchanging code for token, redirectUri:", redirectUri);

    // 1. Trocar code por short-lived token + user_id
    let tokenData;
    try {
      tokenData = await exchangeCodeForToken(cleanCode, appId, appSecret, redirectUri);
      console.log("[IG Callback] Step 1 OK: user_id=", tokenData.user_id);
    } catch (e: any) {
      const detail = `Step 1 (token exchange): ${e.message || e}`;
      console.error("[IG Callback]", detail);
      return NextResponse.redirect(new URL(`/conexoes?error=auth_failed&detail=${encodeURIComponent(detail)}`, origin));
    }

    // 2. Trocar por long-lived token (~60 dias)
    let longToken;
    try {
      longToken = await exchangeForLongLivedToken(tokenData.access_token, appSecret);
      console.log("[IG Callback] Step 2 OK: long-lived token obtained");
    } catch (e: any) {
      const detail = `Step 2 (long-lived token): ${e.message || e}`;
      console.error("[IG Callback]", detail);
      return NextResponse.redirect(new URL(`/conexoes?error=auth_failed&detail=${encodeURIComponent(detail)}`, origin));
    }

    // 3. Buscar perfil do Instagram
    let profile;
    try {
      profile = await getProfile(tokenData.user_id, longToken.access_token);
      console.log("[IG Callback] Step 3 OK: profile=", profile.username);
    } catch (e: any) {
      const detail = `Step 3 (profile fetch): ${e.message || e}`;
      console.error("[IG Callback]", detail);
      return NextResponse.redirect(new URL(`/conexoes?error=auth_failed&detail=${encodeURIComponent(detail)}`, origin));
    }

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
        new URL("/conexoes?error=db_error", origin)
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
        origin
      )
    );
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("Erro no callback Instagram:", msg, err);
    const errorDetail = encodeURIComponent(msg.slice(0, 200));
    return NextResponse.redirect(
      new URL(`/conexoes?error=auth_failed&detail=${errorDetail}`, origin)
    );
  }
}
