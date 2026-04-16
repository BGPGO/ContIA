import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
} from "@/lib/analytics/instagram-fetcher";

export const runtime = "nodejs";

/**
 * GET /api/cron/sync-snapshots
 *
 * Cron diario que busca dados live de TODAS as conexoes Instagram ativas
 * e persiste snapshots historicos no banco.
 *
 * Configuracao no Coolify:
 *   URL:       https://contia.bertuzzipatrimonial.com.br/api/cron/sync-snapshots
 *   Header:    Authorization: Bearer <CRON_SECRET>
 *   Frequencia: 0 4 * * *  (todo dia as 4h BRT)
 *
 * Idempotente: rodar 2x no mesmo dia nao duplica snapshots
 * (a tabela provider_snapshots tem constraint UNIQUE por empresa+conexao+data).
 */
export async function GET(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // Buscar todas conexoes Instagram ativas
  const { data: connections, error: connErr } = await admin
    .from("social_connections")
    .select("id, empresa_id, access_token, provider_user_id, username")
    .eq("provider", "instagram")
    .eq("is_active", true);

  if (connErr) {
    console.error("[sync-snapshots] Erro ao buscar conexoes:", connErr);
    return NextResponse.json(
      { error: "Erro ao buscar conexoes", details: connErr.message },
      { status: 500 }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: "Nenhuma conexao IG ativa", synced: 0 });
  }

  const results: Array<{
    empresa_id: string;
    username: string | null;
    status: "ok" | "error";
    error?: string;
  }> = [];

  for (const conn of connections) {
    if (!conn.access_token || !conn.provider_user_id) {
      results.push({
        empresa_id: conn.empresa_id,
        username: conn.username ?? null,
        status: "error",
        error: "access_token ou provider_user_id ausente",
      });
      continue;
    }

    try {
      const liveData = await fetchInstagramLive(
        conn.access_token,
        conn.provider_user_id,
        30
      );
      await persistInstagramSnapshot(conn.empresa_id, conn.id, liveData);
      results.push({
        empresa_id: conn.empresa_id,
        username: conn.username ?? null,
        status: "ok",
      });
    } catch (err) {
      results.push({
        empresa_id: conn.empresa_id,
        username: conn.username ?? null,
        status: "error",
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  const synced = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[sync-snapshots] Concluido: ${synced} ok, ${failed} erros`);

  return NextResponse.json({
    message: "Sync concluido",
    synced,
    failed,
    details: results,
  });
}
