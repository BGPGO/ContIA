import { NextRequest, NextResponse } from "next/server";
import { getOAuthURL } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * GET /api/instagram/auth?empresa_id=xxx
 * Inicia o fluxo OAuth — redireciona o usuário para o Facebook Login
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  // Instagram Login usa o "Instagram App ID" (diferente do Facebook App ID).
  // Fallback para META_APP_ID mantém retrocompatibilidade.
  const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID não configurado no servidor" },
      { status: 500 }
    );
  }

  // Verificar autenticação
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // State para CSRF protection — inclui empresa_id para saber qual empresa conectar
  const state = Buffer.from(
    JSON.stringify({
      empresa_id: empresaId,
      user_id: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  // APP_URL garante que o redirect URI seja sempre o correto em produção
  const origin = process.env.APP_URL
    || `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host}`;
  const redirectUri = `${origin}/api/instagram/callback`;
  const oauthUrl = getOAuthURL(appId, redirectUri, state);

  return NextResponse.redirect(oauthUrl);
}
