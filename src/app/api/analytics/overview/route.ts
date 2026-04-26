import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  METADATA_BY_PROVIDER,
  PROVIDER_DISPLAY_ORDER,
} from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";
import type {
  AnalyticsKPI,
  ProviderSummary,
  ProviderKPI,
  TimeSeriesDataPoint,
  RecentPost,
} from "@/types/analytics";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
  toRecentPosts,
} from "@/lib/analytics/instagram-fetcher";

/**
 * GET /api/analytics/overview?empresa_id=xxx&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 *
 * Returns aggregated analytics overview across all connected providers.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresa_id");
  const periodStart = searchParams.get("period_start");
  const periodEnd = searchParams.get("period_end");

  if (!empresaId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "empresa_id, period_start e period_end sao obrigatorios" },
      { status: 400 }
    );
  }

  // Auth check com session client
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Verificar que empresa pertence ao user
  const { data: empresaCheck } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .single();
  if (!empresaCheck) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 403 });
  }

  // QUERIES DE DADOS usam admin client (bypass RLS)
  const admin = getAdminSupabase();

  // Previous period computation
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  const prevStartISO = prevStart.toISOString().split("T")[0];
  const prevEndISO = prevEnd.toISOString().split("T")[0];

  const [connectionsRes, snapshotsCurrentRes, snapshotsPrevRes, contentRes, contentPrevRes, empresaRes] =
    await Promise.all([
      admin
        .from("social_connections")
        .select("id, provider, username, display_name")
        .eq("empresa_id", empresaId)
        .eq("is_active", true),
      admin
        .from("provider_snapshots")
        .select("*")
        .eq("empresa_id", empresaId)
        .gte("snapshot_date", periodStart)
        .lte("snapshot_date", periodEnd)
        .order("snapshot_date", { ascending: true }),
      admin
        .from("provider_snapshots")
        .select("*")
        .eq("empresa_id", empresaId)
        .gte("snapshot_date", prevStartISO)
        .lte("snapshot_date", prevEndISO)
        .order("snapshot_date", { ascending: true }),
      admin
        .from("content_items")
        .select("*")
        .eq("empresa_id", empresaId)
        .gte("published_at", periodStart)
        .lte("published_at", periodEnd)
        .order("published_at", { ascending: false })
        .limit(200),
      admin
        .from("content_items")
        .select("id, metrics, published_at")
        .eq("empresa_id", empresaId)
        .gte("published_at", prevStartISO)
        .lte("published_at", prevEndISO)
        .limit(200),
      admin
        .from("empresas")
        .select("redes_sociais")
        .eq("id", empresaId)
        .single(),
    ]);

  let connections = connectionsRes.data ?? [];
  let currentSnapshots = snapshotsCurrentRes.data ?? [];
  const prevSnapshots = snapshotsPrevRes.data ?? [];
  let contentItems = contentRes.data ?? [];
  const prevContentItems = contentPrevRes.data ?? [];
  const empresa = empresaRes.data as { redes_sociais: Record<string, unknown> } | null;

  // ── FALLBACK: se social_connections nao tem instagram mas legado tem ──
  const hasIgConnection = connections.some((c) => c.provider === "instagram");
  const legacyIg = empresa?.redes_sociais?.instagram as
    | { conectado?: boolean; username?: string; access_token?: string; followers_count?: number; provider_user_id?: string }
    | undefined;

  if (!hasIgConnection && legacyIg?.conectado && legacyIg.access_token) {
    // Inject a synthetic connection from legacy data
    const syntheticId = `legacy-ig-${empresaId}`;
    connections = [
      ...connections,
      {
        id: syntheticId,
        provider: "instagram" as const,
        username: legacyIg.username ?? null,
        display_name: legacyIg.username ?? null,
      },
    ];

    // Fallback: build snapshot from legacy profile cache
    const { data: legacyProfiles } = await admin
      .from("instagram_profile_cache")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("snapshot_date", periodStart)
      .lte("snapshot_date", periodEnd)
      .order("snapshot_date", { ascending: true });

    if (legacyProfiles && legacyProfiles.length > 0) {
      const syntheticSnapshots = legacyProfiles.map((p) => ({
        id: `legacy-snap-${p.id}`,
        empresa_id: empresaId,
        connection_id: syntheticId,
        provider: "instagram",
        snapshot_date: p.snapshot_date,
        metrics: {
          followers_count: p.followers_count ?? 0,
          follows_count: p.follows_count ?? 0,
          media_count: p.media_count ?? 0,
        },
        created_at: p.created_at,
      }));
      currentSnapshots = [...currentSnapshots, ...syntheticSnapshots];
    } else if (legacyIg.followers_count) {
      // No profile cache — use the static followers_count from empresa
      currentSnapshots = [
        ...currentSnapshots,
        {
          id: `legacy-snap-static`,
          empresa_id: empresaId,
          connection_id: syntheticId,
          provider: "instagram",
          snapshot_date: periodEnd,
          metrics: { followers_count: legacyIg.followers_count },
          created_at: new Date().toISOString(),
        },
      ];
    }

    // Fallback: content from legacy media cache
    const { data: legacyMedia } = await admin
      .from("instagram_media_cache")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("timestamp", periodStart)
      .lte("timestamp", periodEnd)
      .order("timestamp", { ascending: false })
      .limit(200);

    if (legacyMedia && legacyMedia.length > 0) {
      const syntheticContent = legacyMedia.map((m) => ({
        id: m.id,
        empresa_id: empresaId,
        connection_id: syntheticId,
        provider: "instagram",
        provider_content_id: m.ig_media_id,
        content_type: m.media_type === "VIDEO" ? "reel" : "post",
        title: null,
        caption: m.caption,
        url: m.permalink,
        thumbnail_url: m.thumbnail_url ?? m.media_url,
        published_at: m.timestamp,
        metrics: {
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
          ...(m.insights ?? {}),
        },
        raw: { media_type: m.media_type, media_url: m.media_url },
        synced_at: m.synced_at,
      }));
      contentItems = [...contentItems, ...syntheticContent];
    }
  }

  // ── LIVE BOOTSTRAP: se Instagram conectado e sem snapshot recente (últimas 24h), buscar ao vivo e persistir ──
  const igConnection = connections.find((c) => c.provider === "instagram");

  // Verifica se já há snapshot recente (< 24h) para o Instagram
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const igHasRecentSnapshot = currentSnapshots.some(
    (s) => s.provider === "instagram" && s.created_at >= twentyFourHoursAgo
  );
  const igHasSnapshots = currentSnapshots.some((s) => s.provider === "instagram");
  const igHasContent = contentItems.some((c) => c.provider === "instagram");

  let syncStatus: "ok" | "pending" | "error" = "ok";
  let lastSyncedAt: string | null = null;

  // Definir lastSyncedAt a partir do snapshot mais recente já existente
  if (igHasSnapshots) {
    const latestSnap = currentSnapshots
      .filter((s) => s.provider === "instagram")
      .sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string))[0];
    if (latestSnap) lastSyncedAt = latestSnap.created_at as string;
  }

  // Disparar live fetch se: há conexão ativa E (sem snapshot recente OU sem conteúdo)
  if (igConnection && (!igHasRecentSnapshot || !igHasContent)) {
    try {
      // Buscar access_token do registro completo
      const { data: igConn } = await admin
        .from("social_connections")
        .select("access_token, provider_user_id")
        .eq("id", igConnection.id)
        .single();

      // Fallback para legado
      const accessToken = igConn?.access_token ?? legacyIg?.access_token;
      const providerUserId = igConn?.provider_user_id ?? legacyIg?.provider_user_id;

      if (accessToken && providerUserId) {
        // Timeout de 8s: se a API do Instagram estiver lenta, retorna com "pending"
        const TIMEOUT_MS = 8_000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
        );

        let liveData: Awaited<ReturnType<typeof fetchInstagramLive>> | null = null;

        try {
          liveData = await Promise.race([
            fetchInstagramLive(accessToken, providerUserId, 30),
            timeoutPromise,
          ]);
        } catch (raceErr) {
          if (raceErr instanceof Error && raceErr.message === "timeout") {
            console.warn("[overview] Instagram live fetch timeout (>8s) — respondendo com dados antigos");
            syncStatus = "pending";
          } else {
            throw raceErr; // propaga para o catch externo
          }
        }

        if (liveData) {
          // Aguardar persistência (await) antes de retornar — garante que próxima visita já encontra snapshot
          try {
            await persistInstagramSnapshot(empresaId, igConnection.id, liveData);
            lastSyncedAt = new Date().toISOString();
            syncStatus = "ok";
          } catch (persistErr) {
            console.error("[overview] Falha ao persistir snapshot:", persistErr);
            // Dados ao vivo disponíveis, mas persistência falhou — não travar a resposta
            syncStatus = "error";
            lastSyncedAt = null;
          }

          // Injetar dados ao vivo como snapshots sintéticos se ainda não há snapshot no período
          if (!igHasSnapshots) {
            currentSnapshots = [
              ...currentSnapshots,
              {
                id: `live-ig-snap-${Date.now()}`,
                empresa_id: empresaId,
                connection_id: igConnection.id,
                provider: "instagram",
                snapshot_date: periodEnd,
                metrics: {
                  followers_count: liveData.kpis.followers,
                  reach: liveData.kpis.reach,
                  impressions: liveData.kpis.impressions,
                },
                created_at: new Date().toISOString(),
              },
            ];
          }

          // Injetar posts ao vivo como content items se ainda não há conteúdo no período
          if (!igHasContent) {
            const livePosts = toRecentPosts(liveData);
            const syntheticContent = livePosts
              .filter((p) => {
                if (!p.published_at) return true;
                return p.published_at >= periodStart && p.published_at <= periodEnd + "T23:59:59";
              })
              .map((p) => ({
                id: p.id,
                empresa_id: empresaId,
                connection_id: igConnection.id,
                provider: "instagram",
                provider_content_id: p.id,
                content_type: p.content_type,
                title: p.title,
                caption: p.caption,
                url: p.url,
                thumbnail_url: p.thumbnail_url,
                published_at: p.published_at,
                metrics: p.metrics,
                raw: {},
                synced_at: new Date().toISOString(),
              }));
            contentItems = [...contentItems, ...syntheticContent];
          }
        }
      }
    } catch (err) {
      console.error("[overview] Instagram live fetch failed:", err instanceof Error ? err.message : err);
      syncStatus = "error";
      // Continua com os dados disponíveis — não derruba o endpoint
    }
  }

  const connectedSet = new Set(connections.map((c) => c.provider as ProviderKey));

  // --- helpers ---
  function latestMetricByProvider(
    snapshots: typeof currentSnapshots,
    key: string
  ): Map<string, number> {
    const latest = new Map<string, { date: string; val: number }>();
    for (const s of snapshots) {
      const p = s.provider as string;
      const m = s.metrics as Record<string, number>;
      const v = m[key] ?? 0;
      const existing = latest.get(p);
      if (!existing || s.snapshot_date > existing.date) {
        latest.set(p, { date: s.snapshot_date as string, val: v });
      }
    }
    const result = new Map<string, number>();
    for (const [p, entry] of latest) result.set(p, entry.val);
    return result;
  }

  function sumLatestMetric(snapshots: typeof currentSnapshots, key: string): number {
    const byProvider = latestMetricByProvider(snapshots, key);
    let total = 0;
    for (const v of byProvider.values()) total += v;
    return total;
  }

  function computeDelta(
    current: number | null,
    previous: number | null
  ): { delta: number | null; deltaPercent: number | null; trend: "up" | "down" | "flat" | "unknown" } {
    if (current === null || previous === null) {
      return { delta: null, deltaPercent: null, trend: "unknown" };
    }
    const delta = current - previous;
    const deltaPercent =
      previous > 0 ? Math.round(((delta / previous) * 100) * 10) / 10 : current > 0 ? 100 : 0;
    const trend: "up" | "down" | "flat" =
      delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { delta, deltaPercent, trend };
  }

  // --- KPIs ---
  const currentFollowers = sumLatestMetric(currentSnapshots, "followers_count");
  const prevFollowers = sumLatestMetric(prevSnapshots, "followers_count");
  const currentReach = sumLatestMetric(currentSnapshots, "reach");
  const prevReach = sumLatestMetric(prevSnapshots, "reach");

  const totalEngagement = contentItems.reduce((acc, item) => {
    const m = item.metrics as Record<string, number>;
    return (
      acc +
      (m.likes ?? m.like_count ?? 0) +
      (m.comments ?? m.comments_count ?? 0) +
      (m.shares ?? m.share_count ?? 0) +
      (m.saves ?? 0)
    );
  }, 0);
  const engRate =
    currentFollowers > 0 && contentItems.length > 0
      ? Math.round(((totalEngagement / contentItems.length / currentFollowers) * 100) * 100) / 100
      : 0;

  const followersD = computeDelta(currentFollowers, prevFollowers);
  const reachD = computeDelta(currentReach, prevReach);
  const postsCount = contentItems.length;

  // Engajamento e Posts: computar delta real usando prevContentItems
  const prevTotalEngagement = prevContentItems.reduce((acc, item) => {
    const m = item.metrics as Record<string, number>;
    return (
      acc +
      (m.likes ?? m.like_count ?? 0) +
      (m.comments ?? m.comments_count ?? 0) +
      (m.shares ?? m.share_count ?? 0) +
      (m.saves ?? 0)
    );
  }, 0);
  // engRate prev: total engagement / posts / followers (mesma fórmula)
  const prevEngRate =
    prevFollowers > 0 && prevContentItems.length > 0
      ? Math.round(((prevTotalEngagement / prevContentItems.length / prevFollowers) * 100) * 100) / 100
      : 0;
  const kpiEngD = computeDelta(engRate, prevEngRate);
  const prevPostsCount = prevContentItems.length;
  const kpiPostsD = computeDelta(postsCount, prevPostsCount);

  const kpis: AnalyticsKPI[] = [
    {
      key: "followers",
      label: "Seguidores",
      value: currentFollowers,
      previousValue: prevFollowers,
      ...followersD,
      icon: "users",
    },
    {
      key: "reach",
      label: "Alcance",
      value: currentReach,
      previousValue: prevReach,
      ...reachD,
      icon: "eye",
    },
    {
      key: "engagement",
      label: "Engajamento",
      value: engRate,
      previousValue: prevEngRate,
      ...kpiEngD,
      icon: "heart",
      suffix: "%",
    },
    {
      key: "posts",
      label: "Posts",
      value: postsCount,
      previousValue: prevPostsCount,
      ...kpiPostsD,
      icon: "file",
    },
  ];

  // --- Mês corrente: do dia 1 até hoje ---
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().split("T")[0]; // hoje

  // Snapshots do mês corrente (subconjunto de currentSnapshots se period inclui o mês, senão busca separado)
  // Para simplicidade e confiabilidade, usamos currentSnapshots filtrados por [monthStart, monthEnd]
  // quando o period já cobre o mês; caso o usuário tenha escolhido um período diferente, re-filtramos.
  const monthlySnapshotsRaw = currentSnapshots.filter((s) => {
    const d = s.snapshot_date as string;
    return d >= monthStart && d <= monthEnd;
  });

  // Se o período selecionado pelo user não inclui o mês corrente, precisamos buscar separado.
  // Verificamos se monthStart < periodStart (mês começou antes do período escolhido).
  let monthlySnapshots = monthlySnapshotsRaw;
  if (monthStart < periodStart) {
    // Período escolhido é menor que o mês — buscar snapshots do mês complementar
    const { data: extraSnaps } = await admin
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("snapshot_date", monthStart)
      .lt("snapshot_date", periodStart)
      .order("snapshot_date", { ascending: true });
    if (extraSnaps && extraSnaps.length > 0) {
      monthlySnapshots = [...(extraSnaps as typeof currentSnapshots), ...monthlySnapshotsRaw];
    }
  }

  /**
   * Soma todos os snapshots do mês para um provider e uma chave de métrica.
   * Usado para métricas de FLUXO como spend, impressions, clicks (que são acumuladas por dia).
   */
  function sumMonthlyMetricForProvider(pk: string, key: string): number {
    return monthlySnapshots
      .filter((s) => (s.provider as string) === pk)
      .reduce((acc, s) => {
        const m = s.metrics as Record<string, number>;
        return acc + (m[key] ?? 0);
      }, 0);
  }

  /**
   * Retorna o valor mais recente de uma métrica de ESTADO (ex: followers_count, fan_count).
   * Pega o snapshot com snapshot_date mais alto dentro do mês.
   */
  function latestMonthlyMetricForProvider(pk: string, key: string): number {
    const snaps = monthlySnapshots
      .filter((s) => (s.provider as string) === pk)
      .sort((a, b) => (b.snapshot_date as string).localeCompare(a.snapshot_date as string));
    if (snaps.length === 0) return 0;
    const m = snaps[0].metrics as Record<string, number>;
    return m[key] ?? 0;
  }

  /**
   * Retorna o snapshot mais recente de um provider no mês.
   */
  function latestSnapshotForProvider(pk: string): string | undefined {
    const snaps = monthlySnapshots
      .filter((s) => (s.provider as string) === pk)
      .sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string));
    return snaps.length > 0 ? (snaps[0].created_at as string) : undefined;
  }

  // --- Provider summaries ---
  const providers: ProviderSummary[] = PROVIDER_DISPLAY_ORDER.map((pk) => {
    const meta = METADATA_BY_PROVIDER[pk];
    const connected = connectedSet.has(pk);
    const legacyKpis: ProviderKPI[] = [];
    const monthlyKpis: ProviderKPI[] = [];

    const hasMonthlyData = monthlySnapshots.some((s) => (s.provider as string) === pk);
    const lastSnapshotAt = latestSnapshotForProvider(pk);

    if (connected) {
      // ── KPIs legados (para compatibilidade) ──
      const byProvider = latestMetricByProvider(currentSnapshots, "followers_count");
      const followers = byProvider.get(pk) ?? 0;
      const provContent = contentItems.filter(
        (c) => (c.provider as ProviderKey) === pk
      );
      const provEng = provContent.reduce((acc, item) => {
        const m = item.metrics as Record<string, number>;
        return (
          acc +
          (m.likes ?? m.like_count ?? 0) +
          (m.comments ?? m.comments_count ?? 0)
        );
      }, 0);
      const provEngRate =
        followers > 0 && provContent.length > 0
          ? Math.round(((provEng / provContent.length / followers) * 100) * 100) / 100
          : 0;

      if (pk === "ga4") {
        legacyKpis.push({ label: "Sessoes", value: "0", raw: 0 });
        legacyKpis.push({ label: "Usuarios", value: "0", raw: 0 });
      } else if (pk === "google_ads" || pk === "meta_ads") {
        // Legado mantém 0 pois será substituído pelos monthlyKpis
        legacyKpis.push({ label: "Spend", value: "R$ 0", raw: 0 });
        legacyKpis.push({ label: "CTR", value: "0%", raw: 0 });
      } else {
        legacyKpis.push({
          label: "Seguidores",
          value: formatCompact(followers),
          raw: followers,
          icon: "users",
        });
        legacyKpis.push({
          label: "Engajamento",
          value: `${provEngRate}%`,
          raw: provEngRate,
          icon: "heart",
        });
      }

      // ── KPIs do mês corrente por tipo de provider ──
      if (hasMonthlyData) {
        if (pk === "instagram" || pk === "facebook" || pk === "linkedin") {
          // Métricas de estado: pegar o mais recente
          const monthFollowers = latestMonthlyMetricForProvider(
            pk,
            pk === "facebook" ? "fan_count" : "followers_count"
          );
          // Engajamento: somar do período para o mês
          const monthProvContent = contentItems.filter(
            (c) => (c.provider as ProviderKey) === pk
          );
          const monthEng = monthProvContent.reduce((acc, item) => {
            const m = item.metrics as Record<string, number>;
            return (
              acc +
              (m.likes ?? m.like_count ?? 0) +
              (m.comments ?? m.comments_count ?? 0) +
              (m.saves ?? 0)
            );
          }, 0);
          const monthEngRate =
            monthFollowers > 0 && monthProvContent.length > 0
              ? Math.round(((monthEng / monthProvContent.length / monthFollowers) * 100) * 100) / 100
              : 0;
          const monthReach = monthProvContent.reduce((acc, item) => {
            const m = item.metrics as Record<string, number>;
            return acc + (m.reach ?? 0);
          }, 0);

          monthlyKpis.push({
            label: "Seguidores",
            value: formatCompact(monthFollowers),
            raw: monthFollowers,
            icon: "users",
          });
          monthlyKpis.push({
            label: "Engajamento",
            value: `${monthEngRate}%`,
            raw: monthEngRate,
            icon: "heart",
          });
          monthlyKpis.push({
            label: "Posts",
            value: monthProvContent.length.toString(),
            raw: monthProvContent.length,
            icon: "image",
          });
          if (monthReach > 0) {
            monthlyKpis.push({
              label: "Alcance",
              value: formatCompact(monthReach),
              raw: monthReach,
              icon: "eye",
            });
          }
        } else if (pk === "meta_ads" || pk === "google_ads") {
          // Métricas de FLUXO: somar TODOS os snapshots do mês
          // O syncMetrics do Meta Ads salva spend/impressions/clicks/conversions por dia
          const monthSpend = sumMonthlyMetricForProvider(pk, "spend");
          const monthImpressions = sumMonthlyMetricForProvider(pk, "impressions");
          const monthClicks = sumMonthlyMetricForProvider(pk, "clicks");
          const monthConversions = sumMonthlyMetricForProvider(pk, "conversions");
          const monthCtr =
            monthImpressions > 0
              ? Math.round((monthClicks / monthImpressions) * 10000) / 100
              : 0;
          const monthRoas =
            monthSpend > 0 && monthConversions > 0
              ? Math.round((monthConversions / monthSpend) * 100) / 100
              : null;

          monthlyKpis.push({
            label: "Investimento",
            value: `R$ ${monthSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            raw: monthSpend,
            icon: "dollar-sign",
          });
          monthlyKpis.push({
            label: "Cliques",
            value: formatCompact(monthClicks),
            raw: monthClicks,
            icon: "mouse-pointer-click",
          });
          monthlyKpis.push({
            label: "Conversoes",
            value: monthConversions.toString(),
            raw: monthConversions,
            icon: "target",
          });
          if (monthRoas !== null) {
            monthlyKpis.push({
              label: "ROAS",
              value: `${monthRoas}x`,
              raw: monthRoas,
              icon: "trending-up",
            });
          } else {
            monthlyKpis.push({
              label: "CTR",
              value: `${monthCtr}%`,
              raw: monthCtr,
              icon: "percent",
            });
          }
        } else if (pk === "ga4") {
          const monthSessions = sumMonthlyMetricForProvider(pk, "sessions");
          const monthUsers = latestMonthlyMetricForProvider(pk, "users");
          monthlyKpis.push({
            label: "Sessoes",
            value: formatCompact(monthSessions),
            raw: monthSessions,
            icon: "activity",
          });
          monthlyKpis.push({
            label: "Usuarios",
            value: formatCompact(monthUsers),
            raw: monthUsers,
            icon: "users",
          });
        } else if (pk === "crm") {
          // CRM: pegar métricas do snapshot mais recente (agregadas pelo CRM endpoint)
          const monthLeads = latestMonthlyMetricForProvider(pk, "new_leads");
          const monthDeals = latestMonthlyMetricForProvider(pk, "deals_closed");
          const monthPipeline = latestMonthlyMetricForProvider(pk, "pipeline_value");
          const monthConvRate = latestMonthlyMetricForProvider(pk, "conversion_rate");

          monthlyKpis.push({
            label: "Leads novos",
            value: formatCompact(monthLeads),
            raw: monthLeads,
            icon: "user-plus",
          });
          monthlyKpis.push({
            label: "Vendas",
            value: monthDeals.toString(),
            raw: monthDeals,
            icon: "handshake",
          });
          if (monthPipeline > 0) {
            monthlyKpis.push({
              label: "Pipeline",
              value: `R$ ${formatCompact(monthPipeline)}`,
              raw: monthPipeline,
              icon: "dollar-sign",
            });
          }
          if (monthConvRate > 0) {
            monthlyKpis.push({
              label: "Conversao",
              value: `${Math.round(monthConvRate * 10) / 10}%`,
              raw: monthConvRate,
              icon: "percent",
            });
          }
        } else if (pk === "youtube") {
          const monthSubscribers = latestMonthlyMetricForProvider(pk, "subscribers");
          const monthViews = sumMonthlyMetricForProvider(pk, "views");
          monthlyKpis.push({
            label: "Inscritos",
            value: formatCompact(monthSubscribers),
            raw: monthSubscribers,
            icon: "users",
          });
          monthlyKpis.push({
            label: "Views",
            value: formatCompact(monthViews),
            raw: monthViews,
            icon: "eye",
          });
          monthlyKpis.push({
            label: "Tempo assistido",
            value: "—",
            raw: 0,
            icon: "clock",
          });
        }
      }
    }

    return {
      provider: pk,
      displayName: meta.displayName,
      color: meta.color,
      connected,
      kpis: legacyKpis,
      monthlyKpis,
      lastSnapshotAt,
      awaitingFirstSync: connected && !hasMonthlyData,
    };
  });

  // --- Time Series ---
  // Usamos Record<string, number | null> para preservar null de impressions
  const dateMap = new Map<string, Record<string, number | null>>();
  for (const s of currentSnapshots) {
    const date = s.snapshot_date as string;
    if (!dateMap.has(date)) dateMap.set(date, {});
    const entry = dateMap.get(date)!;
    const m = s.metrics as Record<string, number | null>;
    const p = s.provider as string;

    entry[`${p}_followers`] = (entry[`${p}_followers`] ?? 0) + (m.followers_count ?? 0);
    entry[`${p}_reach`] = (entry[`${p}_reach`] ?? 0) + (m.reach ?? 0);
    entry[`${p}_engagement`] = (entry[`${p}_engagement`] ?? 0) + (m.engagement_rate ?? 0);

    // Impressions: null significa indisponível — NÃO somar como 0
    const impressionsRaw = m.impressions;
    if (impressionsRaw !== null && impressionsRaw !== undefined) {
      entry[`${p}_impressions`] = (entry[`${p}_impressions`] ?? 0) + impressionsRaw;
    } else if (!(`${p}_impressions` in entry)) {
      // Marca como null apenas se ainda não temos nenhum dado
      entry[`${p}_impressions`] = null;
    }
    // Se já temos um número acumulado, mantemos (não sobrescreve com null)
  }

  const timeSeries: TimeSeriesDataPoint[] = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => ({ date, ...metrics }));

  // --- Recent posts ---
  const recentPosts: RecentPost[] = contentItems.slice(0, 20).map((item) => {
    const m = item.metrics as Record<string, number>;
    const engagement =
      (m.likes ?? m.like_count ?? 0) +
      (m.comments ?? m.comments_count ?? 0) +
      (m.shares ?? m.share_count ?? 0);
    return {
      id: item.id as string,
      provider: item.provider as ProviderKey,
      content_type: item.content_type as string,
      title: item.title as string | null,
      caption: item.caption as string | null,
      thumbnail_url: item.thumbnail_url as string | null,
      url: item.url as string | null,
      published_at: item.published_at as string | null,
      metrics: m,
      engagement,
    };
  });

  // --- Content Performance (agregado de content_items) ---
  function aggregateContentMetrics(items: { metrics: unknown }[]): {
    postsCount: number;
    totalEngagement: number;
    totalReach: number;
    saveRate: number | null;
    engagementRate: number | null;
  } {
    let totalEngagement = 0;
    let totalReach = 0;
    let saveRateSum = 0;
    let saveRateCount = 0;
    let engRateSum = 0;
    let engRateCount = 0;

    for (const item of items) {
      const m = item.metrics as Record<string, number>;
      const likes = m.likes ?? m.like_count ?? 0;
      const comments = m.comments ?? m.comments_count ?? 0;
      const saves = m.saves ?? 0;
      const shares = m.shares ?? m.share_count ?? 0;
      const reach = m.reach ?? 0;
      const eng = likes + comments + saves + shares;

      totalEngagement += eng;
      totalReach += reach;

      if (reach > 0) {
        saveRateSum += saves / reach;
        saveRateCount += 1;
        engRateSum += eng / reach;
        engRateCount += 1;
      }
    }

    return {
      postsCount: items.length,
      totalEngagement,
      totalReach,
      saveRate: saveRateCount > 0 ? saveRateSum / saveRateCount : null,
      engagementRate: engRateCount > 0 ? engRateSum / engRateCount : null,
    };
  }

  const currContent = aggregateContentMetrics(contentItems);
  const prevContent = aggregateContentMetrics(prevContentItems);

  const postsD = computeDelta(currContent.postsCount, prevContent.postsCount);
  const engD = computeDelta(currContent.totalEngagement, prevContent.totalEngagement);
  const reachContentD = computeDelta(currContent.totalReach, prevContent.totalReach);
  const saveRateD = computeDelta(
    currContent.saveRate !== null ? Math.round(currContent.saveRate * 10000) / 10000 : null,
    prevContent.saveRate !== null ? Math.round(prevContent.saveRate * 10000) / 10000 : null
  );
  const engRateD = computeDelta(
    currContent.engagementRate !== null ? Math.round(currContent.engagementRate * 10000) / 10000 : null,
    prevContent.engagementRate !== null ? Math.round(prevContent.engagementRate * 10000) / 10000 : null
  );

  const saveRatePct =
    currContent.saveRate !== null
      ? `${(currContent.saveRate * 100).toFixed(1)}%`
      : "—";
  const engRatePct =
    currContent.engagementRate !== null
      ? `${(currContent.engagementRate * 100).toFixed(1)}%`
      : "—";

  const contentPerformance = {
    provider: "content" as const,
    label: "Performance de Conteúdo",
    kpis: [
      {
        key: "posts_count",
        label: "Posts publicados",
        value: currContent.postsCount,
        raw: currContent.postsCount,
        ...postsD,
      },
      {
        key: "engagement_total",
        label: "Engajamento",
        value: currContent.totalEngagement,
        raw: currContent.totalEngagement,
        ...engD,
      },
      {
        key: "reach_total",
        label: "Alcance",
        value: currContent.totalReach,
        raw: currContent.totalReach,
        ...reachContentD,
      },
      {
        key: "save_rate",
        label: "Save rate",
        value: saveRatePct,
        raw: currContent.saveRate ?? 0,
        ...saveRateD,
      },
      {
        key: "engagement_rate",
        label: "Taxa de engajamento",
        value: engRatePct,
        raw: currContent.engagementRate ?? 0,
        ...engRateD,
      },
    ],
  };

  return NextResponse.json({
    kpis,
    providers,
    timeSeries,
    recentPosts,
    contentPerformance,
    syncStatus,
    lastSyncedAt,
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
