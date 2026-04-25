import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { facebookDriver } from "@/lib/drivers/facebook";
import { metaAdsDriver } from "@/lib/drivers/meta_ads";
import type { Connection } from "@/types/providers";
import type { TokenRefreshResult, TokenRefreshResponse } from "@/types/sync";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutos — refresh e rapido

/**
 * GET /api/cron/refresh-tokens
 *
 * Renova preventivamente tokens Meta que expiram nos proximos 14 dias.
 * Marcam is_active=false + last_error quando o token esta invalido (HTTP 400).
 *
 * Configuracao no Coolify (rodar 3x/semana):
 *   URL:       https://contia.bertuzzipatrimonial.com.br/api/cron/refresh-tokens
 *   Header:    Authorization: Bearer <CRON_SECRET>
 *   Frequencia: 0 5 * * 1,3,5   (seg/qua/sex as 5h BRT)
 *
 * Idempotente: tokens ja renovados nao sao afetados (token_expires_at sera futuro).
 *
 * Nota sobre Facebook Pages:
 *   Page access tokens nao expiram — o driver do Facebook trata isso
 *   renovando o user_token guardado em metadata.
 */
export async function GET(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // Buscar conexoes Meta com token expirando nos proximos 14 dias
  // Inclui tambem conexoes sem token_expires_at (ex: Facebook Pages — tratamos no driver)
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: connections, error: connErr } = await admin
    .from("social_connections")
    .select("*")
    .eq("is_active", true)
    .in("provider", ["instagram", "facebook", "meta_ads"])
    .or(`token_expires_at.lt.${in14days},token_expires_at.is.null`);

  if (connErr) {
    console.error("[refresh-tokens] Erro ao buscar conexoes:", connErr);
    return NextResponse.json(
      { error: "Erro ao buscar conexoes", details: connErr.message },
      { status: 500 }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      message: "Nenhum token precisando de renovacao",
      refreshed: 0,
      deactivated: 0,
      skipped: 0,
      details: [],
    } satisfies TokenRefreshResponse);
  }

  const results: TokenRefreshResult[] = [];

  for (const conn of connections as Connection[]) {
    const baseResult = {
      connection_id: conn.id,
      empresa_id: conn.empresa_id,
      provider: conn.provider,
      username: conn.username ?? null,
    };

    // Se token_expires_at e nulo e provider e facebook (page token nao expira),
    // pular — apenas verificamos integridade, nao ha renovacao necessaria.
    if (!conn.token_expires_at && conn.provider === "facebook") {
      results.push({ ...baseResult, status: "skipped" });
      continue;
    }

    try {
      if (conn.provider === "instagram") {
        await refreshMetaToken(admin, conn);
      } else if (conn.provider === "facebook") {
        await facebookDriver.refreshToken(conn);
      } else if (conn.provider === "meta_ads") {
        await metaAdsDriver.refreshToken(conn);
      }

      results.push({ ...baseResult, status: "refreshed" });
      console.log(`[refresh-tokens] Token renovado: ${conn.provider}/${conn.username ?? conn.id}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      const isInvalid = /invalid|expired|400|OAuthException/i.test(errorMsg);

      if (isInvalid) {
        // Token invalido — desativar conexao para evitar loops de erro
        await admin
          .from("social_connections")
          .update({
            is_active: false,
            last_error: "Token expirado ou invalido. Reconecte a conta.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        results.push({ ...baseResult, status: "deactivated", error: errorMsg });
        console.warn(
          `[refresh-tokens] Token invalido — conexao desativada: ${conn.provider}/${conn.username ?? conn.id}`
        );
      } else {
        // Erro transitorio — nao desativar, tentar na proxima rodada
        results.push({ ...baseResult, status: "error", error: errorMsg });
        console.error(
          `[refresh-tokens] Erro ao renovar ${conn.provider}/${conn.username ?? conn.id}: ${errorMsg}`
        );

        // Registrar last_error sem desativar
        await admin
          .from("social_connections")
          .update({
            last_error: `refresh-tokens: ${errorMsg}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);
      }
    }
  }

  const refreshed = results.filter((r) => r.status === "refreshed").length;
  const deactivated = results.filter((r) => r.status === "deactivated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log(
    `[refresh-tokens] Concluido: ${refreshed} renovados, ${deactivated} desativados, ${skipped} ignorados`
  );

  return NextResponse.json({
    message: "Refresh de tokens concluido",
    refreshed,
    deactivated,
    skipped,
    details: results,
  } satisfies TokenRefreshResponse);
}

/* ── Instagram token refresh ────────────────────────────────────────────────── */

/**
 * Renova um long-lived Instagram token via fb_exchange_token.
 * O endpoint padrao da Graph API aceita o proprio long-lived token como input.
 * Ref: https://developers.facebook.com/docs/instagram-basic-display-api/guides/long-lived-access-tokens
 */
async function refreshMetaToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof getAdminSupabase>,
  conn: Connection
): Promise<void> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID ou META_APP_SECRET nao configurados");
  }

  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", conn.access_token);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string; code: number; type: string };
  };

  if (!res.ok || data.error) {
    throw new Error(
      `Meta API [${data.error?.code ?? res.status}] ${data.error?.type ?? ""}: ${data.error?.message ?? "resposta invalida"}`
    );
  }

  if (!data.access_token) {
    throw new Error("Meta API retornou resposta sem access_token");
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  const { error: updateErr } = await admin
    .from("social_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: expiresAt,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  if (updateErr) {
    throw new Error(`Erro ao salvar token renovado: ${updateErr.message}`);
  }
}
