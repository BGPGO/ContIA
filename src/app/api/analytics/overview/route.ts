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
  TimeSeriesDataPoint,
  RecentPost,
} from "@/types/analytics";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
  toOverviewKPIs,
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

  const [connectionsRes, snapshotsCurrentRes, snapshotsPrevRes, contentRes, empresaRes] =
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
        .from("empresas")
        .select("redes_sociais")
        .eq("id", empresaId)
        .single(),
    ]);

  let connections = connectionsRes.data ?? [];
  let currentSnapshots = snapshotsCurrentRes.data ?? [];
  const prevSnapshots = snapshotsPrevRes.data ?? [];
  let contentItems = contentRes.data ?? [];
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

  // ── LIVE FETCH: se Instagram conectado mas snapshots/content vazios, buscar ao vivo ──
  const igConnection = connections.find((c) => c.provider === "instagram");
  const igHasSnapshots = currentSnapshots.some((s) => s.provider === "instagram");
  const igHasContent = contentItems.some((c) => c.provider === "instagram");
  let igLiveKPIs: { followers: number; reach: number; engRate: number; postsCount: number } | null = null;

  if (igConnection && (!igHasSnapshots || !igHasContent)) {
    try {
      // Fetch access_token from social_connections (full record)
      const { data: igConn } = await admin
        .from("social_connections")
        .select("access_token, provider_user_id")
        .eq("id", igConnection.id)
        .single();

      // Also check legacy
      const accessToken = igConn?.access_token ?? legacyIg?.access_token;
      const providerUserId = igConn?.provider_user_id ?? legacyIg?.provider_user_id;

      if (accessToken && providerUserId) {
        const liveData = await fetchInstagramLive(accessToken, providerUserId, 30);
        igLiveKPIs = toOverviewKPIs(liveData);

        // Persistir snapshot em background
        persistInstagramSnapshot(empresaId, igConnection.id, liveData).catch((err) =>
          console.error("[overview] Falha ao persistir snapshot:", err)
        );

        // Inject live data as synthetic snapshots if missing
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

        // Inject live media as content items if missing
        if (!igHasContent) {
          const livePosts = toRecentPosts(liveData);
          const syntheticContent = livePosts
            .filter((p) => {
              // Only include posts within the requested period
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
    } catch (err) {
      console.error("[overview] Instagram live fetch failed:", err instanceof Error ? err.message : err);
      // Continue with whatever data we have — don't crash the endpoint
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
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "heart",
      suffix: "%",
    },
    {
      key: "posts",
      label: "Posts",
      value: postsCount,
      previousValue: 0,
      delta: postsCount,
      deltaPercent: 0,
      trend: postsCount > 0 ? "up" : "flat",
      icon: "file",
    },
  ];

  // --- Provider summaries ---
  const providers: ProviderSummary[] = PROVIDER_DISPLAY_ORDER.map((pk) => {
    const meta = METADATA_BY_PROVIDER[pk];
    const connected = connectedSet.has(pk);
    const provKpis: ProviderSummary["kpis"] = [];

    if (connected) {
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

      if (pk === "crm") {
        provKpis.push({ label: "Leads", value: "0", raw: 0 });
        provKpis.push({ label: "Conversao", value: "0%", raw: 0 });
      } else if (pk === "ga4") {
        provKpis.push({ label: "Sessoes", value: "0", raw: 0 });
        provKpis.push({ label: "Usuarios", value: "0", raw: 0 });
      } else if (pk === "google_ads" || pk === "meta_ads") {
        provKpis.push({ label: "Spend", value: "R$ 0", raw: 0 });
        provKpis.push({ label: "CTR", value: "0%", raw: 0 });
      } else {
        provKpis.push({
          label: "Seguidores",
          value: formatCompact(followers),
          raw: followers,
        });
        provKpis.push({
          label: "Engajamento",
          value: `${provEngRate}%`,
          raw: provEngRate,
        });
      }
    }

    return {
      provider: pk,
      displayName: meta.displayName,
      color: meta.color,
      connected,
      kpis: provKpis,
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

  return NextResponse.json({
    kpis,
    providers,
    timeSeries,
    recentPosts,
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
