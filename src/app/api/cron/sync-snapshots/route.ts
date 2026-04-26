import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
} from "@/lib/analytics/instagram-fetcher";
import { facebookDriver } from "@/lib/drivers/facebook";
import { metaAdsDriver } from "@/lib/drivers/meta_ads";
import { crmDriver } from "@/lib/drivers/crm";
import type { Connection } from "@/types/providers";
import type { ConnectionSyncResult, CronSyncResponse } from "@/types/sync";

export const runtime = "nodejs";
// Timeout maximo da funcao (Coolify/Node — Vercel usa maxDuration)
export const maxDuration = 300; // 5 minutos

const TIMEOUT_PER_CONNECTION_MS = 90_000; // 90s (meta_ads c/ backfill 30d + insights pode levar mais)

/**
 * GET /api/cron/sync-snapshots
 *
 * Cron diario que busca dados live de TODAS as conexoes ativas
 * e persiste snapshots historicos no banco.
 *
 * Providers suportados: instagram, facebook, meta_ads, crm
 * Providers ignorados (driver ainda nao existe): linkedin, youtube, ga4, google_ads
 *
 * Configuracao no Coolify:
 *   URL:       https://contia.bertuzzipatrimonial.com.br/api/cron/sync-snapshots
 *   Header:    Authorization: Bearer <CRON_SECRET>
 *   Frequencia: 0 4 * * *  (todo dia as 4h BRT)
 *
 * Idempotente: rodar 2x no mesmo dia nao duplica snapshots
 * (a tabela provider_snapshots tem constraint UNIQUE por conexao+data).
 */
export async function GET(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // Buscar TODAS as conexoes ativas (todos os providers)
  const { data: connections, error: connErr } = await admin
    .from("social_connections")
    .select("*")
    .eq("is_active", true)
    .order("provider", { ascending: true });

  if (connErr) {
    console.error("[sync-snapshots] Erro ao buscar conexoes:", connErr);
    return NextResponse.json(
      { error: "Erro ao buscar conexoes", details: connErr.message },
      { status: 500 }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      message: "Nenhuma conexao ativa",
      synced: 0,
      failed: 0,
      skipped: 0,
      details: [],
    } satisfies CronSyncResponse);
  }

  const results: ConnectionSyncResult[] = [];

  for (const conn of connections as Connection[]) {
    const baseResult = {
      connection_id: conn.id,
      empresa_id: conn.empresa_id,
      provider: conn.provider,
      username: conn.username ?? null,
    };

    // Providers sem driver: pular silenciosamente
    const SUPPORTED_PROVIDERS = ["instagram", "facebook", "meta_ads", "crm"] as const;
    type Supported = (typeof SUPPORTED_PROVIDERS)[number];

    if (!SUPPORTED_PROVIDERS.includes(conn.provider as Supported)) {
      results.push({ ...baseResult, status: "skipped" });
      continue;
    }

    // CRM autentica via API key do ambiente (CRM_ANALYTICS_API_KEY) — access_token é vazio por design
    if (!conn.access_token && conn.provider !== "crm") {
      results.push({
        ...baseResult,
        status: "error",
        error: "access_token ausente",
      });
      await writeSyncJob(admin, conn, "failed", "access_token ausente");
      continue;
    }

    const started_at = new Date().toISOString();
    await writeSyncJob(admin, conn, "running", null, started_at);

    try {
      let snapshotCount = 0;

      const syncPromise: Promise<number> = (async () => {
        if (conn.provider === "instagram") {
          if (!conn.provider_user_id) throw new Error("provider_user_id ausente");
          const liveData = await fetchInstagramLive(
            conn.access_token,
            conn.provider_user_id,
            30
          );
          await persistInstagramSnapshot(conn.empresa_id, conn.id, liveData);
          return 1; // 1 snapshot gravado
        }

        if (conn.provider === "facebook") {
          const [profile, content, metrics] = await Promise.all([
            facebookDriver.syncProfile(conn),
            facebookDriver.syncContent(conn),
            facebookDriver.syncMetrics(conn),
          ]);
          void profile; void metrics;
          return 1 + content.length;
        }

        if (conn.provider === "meta_ads") {
          // Fix 5: passar dateRange dos últimos 30 dias para o driver Meta Ads.
          // Isso garante que snapshots históricos sejam criados (backfill) na primeira execução
          // e que execuções subsequentes cubram o range completo — não apenas o dia corrente.
          const metaAdsToday = new Date();
          const metaAdsSince = new Date(metaAdsToday);
          metaAdsSince.setDate(metaAdsSince.getDate() - 30);

          const metaAdsDateRange = {
            since: metaAdsSince,
            until: metaAdsToday,
          };

          const [profile, content, metrics] = await Promise.all([
            metaAdsDriver.syncProfile(conn),
            metaAdsDriver.syncContent(conn, { since: metaAdsDateRange.since, until: metaAdsDateRange.until }),
            metaAdsDriver.syncMetrics(conn, { since: metaAdsDateRange.since, until: metaAdsDateRange.until }),
          ]);
          // syncInsights para as campanhas coletadas
          const campaignIds = content.map((c) => c.provider_content_id);
          const insights = campaignIds.length > 0 && metaAdsDriver.syncInsights
            ? await metaAdsDriver.syncInsights(conn, campaignIds, {
                since: metaAdsDateRange.since,
                until: metaAdsDateRange.until,
              })
            : [];
          void profile; void metrics;
          return 1 + content.length + insights.length;
        }

        if (conn.provider === "crm") {
          // crmDriver.syncMetrics persiste em metric_events internamente.
          // Fazemos também upsert em provider_snapshots para que a rota
          // /api/analytics/[provider] (case "crm") encontre dados.
          //
          // Mapeamento de chaves: o driver gera nomes "verbosos" (leads_total,
          // funnel_won, funnel_revenue, funnel_conversion_rate), mas o endpoint
          // /api/analytics/[provider] (case "crm") e o time series leem chaves
          // "canônicas" (leads_new, deals_won, pipeline_value, conversion_rate).
          // Mantemos as originais E adicionamos os aliases pra não regredir
          // nada que já consuma os nomes verbosos.
          const metricSet = await crmDriver.syncMetrics(conn);
          const m = metricSet.metrics;
          const aliasedMetrics: Record<string, number> = {
            ...m,
            // KPIs esperados pelo endpoint analytics (case "crm")
            leads_new: m.leads_total ?? 0,
            deals_won: m.funnel_won ?? 0,
            pipeline_value: m.funnel_revenue ?? 0,
            conversion_rate: m.funnel_conversion_rate ?? 0,
          };
          await admin.from("provider_snapshots").upsert(
            {
              empresa_id: conn.empresa_id,
              connection_id: conn.id,
              provider: "crm",
              snapshot_date: metricSet.snapshot_date,
              metrics: aliasedMetrics,
            },
            { onConflict: "connection_id,snapshot_date" }
          );
          return 1; // 1 snapshot gravado
        }

        return 0;
      })();

      snapshotCount = await Promise.race([
        syncPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout: sincronizacao excedeu ${TIMEOUT_PER_CONNECTION_MS / 1000}s`)),
            TIMEOUT_PER_CONNECTION_MS
          )
        ),
      ]);

      const synced_at = new Date().toISOString();
      results.push({
        ...baseResult,
        status: "ok",
        snapshot_count: snapshotCount,
        synced_at,
      });

      await writeSyncJob(admin, conn, "completed", null, started_at, synced_at, {
        snapshot_count: snapshotCount,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(
        `[sync-snapshots] Falha em ${conn.provider}/${conn.username ?? conn.id}: ${errorMsg}`
      );
      results.push({ ...baseResult, status: "error", error: errorMsg });
      await writeSyncJob(admin, conn, "failed", errorMsg, started_at, new Date().toISOString());
    }
  }

  const synced = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log(
    `[sync-snapshots] Concluido: ${synced} ok, ${failed} erros, ${skipped} ignorados`
  );

  return NextResponse.json({
    message: "Sync concluido",
    synced,
    failed,
    skipped,
    details: results,
  } satisfies CronSyncResponse);
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

async function writeSyncJob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof getAdminSupabase>,
  conn: Connection,
  status: "running" | "completed" | "failed",
  errorMsg: string | null,
  started_at?: string,
  completed_at?: string,
  result?: Record<string, unknown>
): Promise<void> {
  try {
    if (status === "running") {
      await admin.from("sync_jobs").insert({
        empresa_id: conn.empresa_id,
        connection_id: conn.id,
        provider: conn.provider,
        job_type: "profile_sync",
        status: "running",
        started_at: started_at ?? new Date().toISOString(),
        payload: {},
      });
    } else {
      // Update de todos os jobs running para esta conexao (idempotente — normalmente apenas 1)
      await admin
        .from("sync_jobs")
        .update({
          status,
          last_error: errorMsg ?? null,
          completed_at: completed_at ?? new Date().toISOString(),
          result: result ?? null,
        })
        .eq("connection_id", conn.id)
        .eq("status", "running");
    }
  } catch (e) {
    // writeSyncJob falha gracefully — nao deve interromper o sync
    console.error("[sync-snapshots] Falha ao escrever sync_job:", e instanceof Error ? e.message : e);
  }
}
