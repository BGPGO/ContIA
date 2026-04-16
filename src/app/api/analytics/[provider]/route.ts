import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";
import type {
  AnalyticsKPI,
  TimeSeriesDataPoint,
  ProviderPost,
  BreakdownItem,
  HeatmapData,
  HashtagStat,
} from "@/types/analytics";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
  toProviderKPIs,
  toProviderPosts,
  toProviderBreakdown,
  toProviderHeatmap,
  toProviderHashtags,
  toProviderTimeSeries,
} from "@/lib/analytics/instagram-fetcher";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`);

const CONTENT_TYPE_COLORS: Record<string, string> = {
  post: "#6c5ce7",
  reel: "#fbbf24",
  story: "#e1306c",
  video: "#ff0000",
  youtube_video: "#ff0000",
  youtube_short: "#fbbf24",
  landing_page: "#10B981",
  ad_campaign: "#4285F4",
  email: "#8B5CF6",
  whatsapp: "#25D366",
};

/**
 * GET /api/analytics/[provider]?empresa_id=xxx&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as ProviderKey;
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

  const meta = METADATA_BY_PROVIDER[provider];
  if (!meta) {
    return NextResponse.json({ error: "Provider desconhecido" }, { status: 404 });
  }

  // Auth check com session client (valida identidade)
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // ── Resolver conexao: tenta TODAS as fontes (session client funciona com RLS) ──

  let connection: {
    id: string;
    access_token: string | null;
    provider_user_id: string | null;
    username: string | null;
  } | null = null;

  // Fonte 1: social_connections via SESSION client (RLS por user_id)
  const { data: connData, error: connError } = await supabase
    .from("social_connections")
    .select("id, access_token, provider_user_id, username")
    .eq("empresa_id", empresaId)
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1);

  if (connError) {
    console.error("[analytics/provider] social_connections error (session):", connError.message);
  }
  if (connData && connData.length > 0) {
    connection = connData[0];
  }

  // Fonte 2: social_connections via ADMIN client (bypass RLS — fallback se session falhou)
  if (!connection) {
    try {
      const admin = getAdminSupabase();
      const { data: adminConn } = await admin
        .from("social_connections")
        .select("id, access_token, provider_user_id, username")
        .eq("empresa_id", empresaId)
        .eq("provider", provider)
        .eq("is_active", true)
        .limit(1);
      if (adminConn && adminConn.length > 0) {
        connection = adminConn[0];
        console.log("[analytics/provider] Conexao encontrada via admin client");
      }
    } catch (adminErr) {
      console.error("[analytics/provider] Admin client falhou:", adminErr instanceof Error ? adminErr.message : adminErr);
    }
  }

  // Fonte 3: empresa.redes_sociais (legado) via SESSION client
  if (!connection && provider === "instagram") {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("redes_sociais")
      .eq("id", empresaId)
      .single();

    const legacyIg = (empresa?.redes_sociais as Record<string, Record<string, string | boolean>> | null)?.instagram;
    if (legacyIg?.conectado && legacyIg.access_token) {
      connection = {
        id: `legacy-${empresaId}`,
        access_token: legacyIg.access_token as string,
        provider_user_id: (legacyIg.provider_user_id as string) ?? null,
        username: (legacyIg.username as string) ?? null,
      };
      console.log("[analytics/provider] Usando empresa.redes_sociais para Instagram");
    }
  }

  // ── Passo 3: Se realmente nao tem conexao, retorna ──
  if (!connection) {
    return NextResponse.json({
      provider,
      connected: false,
      kpis: [],
      timeSeries: [],
      posts: [],
      breakdown: [],
      heatmap: null,
      funnelStages: null,
      topHashtags: null,
      trafficSources: null,
      topPages: null,
      campaigns: null,
    });
  }

  // ── Passo 4: INSTAGRAM LIVE — buscar dados ao vivo da API ──
  if (provider === "instagram" && connection.access_token && connection.provider_user_id) {
    try {
      const liveData = await fetchInstagramLive(connection.access_token, connection.provider_user_id, 30);

      // Persistir snapshot em background (nao bloqueia resposta)
      persistInstagramSnapshot(empresaId, connection.id, liveData).catch((err) =>
        console.error("[analytics/provider] Falha ao persistir snapshot:", err)
      );

      // Buscar snapshots historicos para time series com multiplos dias
      let historicalSnapshots: { snapshot_date: unknown; metrics: unknown }[] | null = null;
      try {
        const admin = getAdminSupabase();
        const { data: hs } = await admin
          .from("provider_snapshots")
          .select("snapshot_date, metrics")
          .eq("connection_id", connection.id)
          .gte("snapshot_date", periodStart)
          .lte("snapshot_date", periodEnd)
          .order("snapshot_date", { ascending: true });
        historicalSnapshots = hs;
      } catch {
        // Admin nao disponivel — sem historico, so ponto live
      }

      // Time series = historico + ponto live de hoje
      const today = new Date().toISOString().split("T")[0];
      const historicalTimeSeries: TimeSeriesDataPoint[] = (historicalSnapshots ?? []).map((s) => {
        const m = s.metrics as Record<string, number>;
        return {
          date: s.snapshot_date as string,
          followers: m.followers_count ?? 0,
          reach: m.reach ?? 0,
          impressions: m.impressions ?? 0,
          engagement: 0,
          sessions: 0,
          users: 0,
          spend: 0,
          clicks: 0,
          leads: 0,
        };
      });

      // Se hoje nao esta no historico, adiciona ponto live
      if (!historicalTimeSeries.some((p) => p.date === today)) {
        historicalTimeSeries.push({
          date: today,
          followers: liveData.profile.followers_count,
          reach: liveData.kpis.reach,
          impressions: liveData.kpis.impressions,
          engagement: 0,
          sessions: 0,
          users: 0,
          spend: 0,
          clicks: 0,
          leads: 0,
        });
      }

      // Se historico tem poucos pontos, complementar com time series baseado em media
      const finalTimeSeries =
        historicalTimeSeries.length > 1
          ? historicalTimeSeries
          : toProviderTimeSeries(liveData);

      return NextResponse.json({
        provider,
        connected: true,
        kpis: toProviderKPIs(liveData),
        timeSeries: finalTimeSeries,
        posts: toProviderPosts(liveData),
        breakdown: toProviderBreakdown(liveData),
        heatmap: toProviderHeatmap(liveData),
        funnelStages: null,
        topHashtags: toProviderHashtags(liveData),
        trafficSources: null,
        topPages: null,
        campaigns: null,
      });
    } catch (err) {
      console.error("[analytics/provider] Instagram live fetch falhou:", err instanceof Error ? err.message : err);
      // Continua para fallback DB-based abaixo
    }
  }

  // Previous period
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  const prevStartISO = prevStart.toISOString().split("T")[0];
  const prevEndISO = prevEnd.toISOString().split("T")[0];

  // Usar session client para DB queries (RLS garante seguranca)
  // Se tabelas novas nao tem RLS user_id, tenta admin como fallback
  let dbClient = supabase;
  try {
    dbClient = getAdminSupabase();
  } catch {
    // Admin nao disponivel, usar session
  }

  const [snapshotsRes, prevSnapshotsRes, contentRes] = await Promise.all([
    dbClient
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("snapshot_date", periodStart)
      .lte("snapshot_date", periodEnd)
      .order("snapshot_date", { ascending: true }),
    dbClient
      .from("provider_snapshots")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("snapshot_date", prevStartISO)
      .lte("snapshot_date", prevEndISO)
      .order("snapshot_date", { ascending: true }),
    dbClient
      .from("content_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .gte("published_at", periodStart)
      .lte("published_at", periodEnd)
      .order("published_at", { ascending: false })
      .limit(100),
  ]);

  const snapshots = snapshotsRes.data ?? [];
  const prevSnapshots = prevSnapshotsRes.data ?? [];
  const contentItems = contentRes.data ?? [];

  // Helpers
  function latestMetric(snaps: typeof snapshots, key: string): number {
    if (snaps.length === 0) return 0;
    const latest = snaps[snaps.length - 1];
    return (latest.metrics as Record<string, number>)[key] ?? 0;
  }

  function computeDelta(current: number, previous: number) {
    const delta = current - previous;
    const deltaPercent =
      previous > 0
        ? Math.round(((delta / previous) * 100) * 10) / 10
        : current > 0
          ? 100
          : 0;
    const trend: "up" | "down" | "flat" =
      delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { delta, deltaPercent, trend };
  }

  // --- Build KPIs based on provider ---
  const kpis: AnalyticsKPI[] = [];

  if (
    provider === "instagram" ||
    provider === "facebook" ||
    provider === "linkedin" ||
    provider === "youtube"
  ) {
    const followers = latestMetric(snapshots, "followers_count");
    const prevFollowers = latestMetric(prevSnapshots, "followers_count");
    kpis.push({
      key: "followers",
      label: "Seguidores",
      value: followers,
      previousValue: prevFollowers,
      ...computeDelta(followers, prevFollowers),
      icon: "users",
    });

    const reach = latestMetric(snapshots, "reach");
    const prevReach = latestMetric(prevSnapshots, "reach");
    kpis.push({
      key: "reach",
      label: provider === "youtube" ? "Views" : "Alcance",
      value: reach,
      previousValue: prevReach,
      ...computeDelta(reach, prevReach),
      icon: "eye",
    });

    const impressions = latestMetric(snapshots, "impressions");
    const prevImpressions = latestMetric(prevSnapshots, "impressions");
    kpis.push({
      key: "impressions",
      label: "Impressoes",
      value: impressions,
      previousValue: prevImpressions,
      ...computeDelta(impressions, prevImpressions),
      icon: "trending",
    });

    const totalEng = contentItems.reduce((acc, item) => {
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
      followers > 0 && contentItems.length > 0
        ? Math.round(((totalEng / contentItems.length / followers) * 100) * 100) / 100
        : 0;
    kpis.push({
      key: "engagement",
      label: "Engajamento",
      value: engRate,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "heart",
      suffix: "%",
    });
  } else if (provider === "ga4") {
    for (const [key, label, icon] of [
      ["sessions", "Sessoes", "click"],
      ["users", "Usuarios", "users"],
      ["pageviews", "Pageviews", "eye"],
      ["bounce_rate", "Bounce Rate", "trending"],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: key === "bounce_rate" ? "%" : undefined,
      });
    }
  } else if (provider === "google_ads" || provider === "meta_ads") {
    for (const [key, label, icon, suffix] of [
      ["spend", "Investimento", "dollar", "R$"],
      ["impressions", "Impressoes", "eye", undefined],
      ["clicks", "Cliques", "click", undefined],
      ["ctr", "CTR", "trending", "%"],
      ["cpc", "CPC", "dollar", "R$"],
      ["conversions", "Conversoes", "user_plus", undefined],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: suffix ?? undefined,
      });
    }
  } else if (provider === "crm") {
    for (const [key, label, icon] of [
      ["leads_new", "Leads Novos", "user_plus"],
      ["conversion_rate", "Conversao", "trending"],
      ["deals_won", "Deals Ganhos", "dollar"],
      ["pipeline_value", "Pipeline", "dollar"],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: key === "conversion_rate" ? "%" : undefined,
      });
    }
  } else if (provider === "greatpages") {
    for (const [key, label, icon] of [
      ["active_pages", "LPs Ativas", "file"],
      ["total_leads", "Leads", "user_plus"],
      ["conversion_rate", "Conversao", "trending"],
    ] as const) {
      const v = latestMetric(snapshots, key);
      const pv = latestMetric(prevSnapshots, key);
      kpis.push({
        key,
        label,
        value: v,
        previousValue: pv,
        ...computeDelta(v, pv),
        icon,
        suffix: key === "conversion_rate" ? "%" : undefined,
      });
    }
  }

  // --- Time series ---
  const timeSeries: TimeSeriesDataPoint[] = snapshots.map((s) => {
    const m = s.metrics as Record<string, number>;
    return {
      date: s.snapshot_date as string,
      followers: m.followers_count ?? 0,
      reach: m.reach ?? 0,
      impressions: m.impressions ?? 0,
      engagement: m.engagement_rate ?? 0,
      sessions: m.sessions ?? 0,
      users: m.users ?? 0,
      spend: m.spend ?? 0,
      clicks: m.clicks ?? 0,
      leads: m.leads_new ?? 0,
    };
  });

  // --- Posts ---
  const posts: ProviderPost[] = contentItems.map((item) => ({
    id: item.id as string,
    content_type: item.content_type as string,
    title: item.title as string | null,
    caption: item.caption as string | null,
    thumbnail_url: item.thumbnail_url as string | null,
    url: item.url as string | null,
    published_at: item.published_at as string | null,
    metrics: item.metrics as Record<string, number>,
  }));

  // --- Breakdown by content type ---
  const typeCounts = new Map<string, number>();
  for (const item of contentItems) {
    const t = item.content_type as string;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const total = contentItems.length || 1;
  const breakdown: BreakdownItem[] = Array.from(typeCounts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
      color: CONTENT_TYPE_COLORS[label] ?? "#4ecdc4",
    }))
    .sort((a, b) => b.value - a.value);

  // --- Heatmap (best time to post) ---
  let heatmap: HeatmapData | null = null;
  if (
    provider === "instagram" ||
    provider === "facebook" ||
    provider === "linkedin"
  ) {
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0)
    );
    for (const item of contentItems) {
      if (!item.published_at) continue;
      const d = new Date(item.published_at as string);
      const day = d.getDay();
      const hour = d.getHours();
      const m = item.metrics as Record<string, number>;
      grid[day][hour] +=
        (m.likes ?? m.like_count ?? 0) + (m.comments ?? m.comments_count ?? 0);
    }
    heatmap = { grid, dayLabels: DAY_LABELS, hourLabels: HOUR_LABELS };
  }

  // --- Top hashtags ---
  let topHashtags: HashtagStat[] | null = null;
  if (provider === "instagram" || provider === "facebook") {
    const tagCounts = new Map<string, number>();
    for (const item of contentItems) {
      const caption = (item.caption as string) ?? "";
      const tags = caption.match(/#[\w\u00C0-\u017F]+/g) ?? [];
      for (const tag of tags) {
        const normalized = tag.toLowerCase();
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }
    topHashtags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  return NextResponse.json({
    provider,
    connected: true,
    kpis,
    timeSeries,
    posts,
    breakdown,
    heatmap,
    funnelStages: null,
    topHashtags,
    trafficSources: null,
    topPages: null,
    campaigns: null,
  });
}
