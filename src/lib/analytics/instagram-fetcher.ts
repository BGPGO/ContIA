/**
 * Instagram Live Fetcher — busca dados LIVE da API Instagram
 * Reutiliza funções de @/lib/instagram para evitar duplicação.
 *
 * Usado pelo overview e pelo [provider] route quando provider=instagram
 * e as tabelas de cache (content_items, provider_snapshots) estão vazias.
 */

import {
  getProfile,
  getMedia,
  getInsights,
  getMediaInsights,
} from "@/lib/instagram";
import type { IGMedia, IGInsight, IGProfile } from "@/lib/instagram";

/* ── Instagram Graph API (Facebook) base URL para insights de conta ── */
const FB_GRAPH_URL = "https://graph.facebook.com/v21.0";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { ProviderKey } from "@/types/providers";
import type {
  AnalyticsKPI,
  TimeSeriesDataPoint,
  ProviderPost,
  BreakdownItem,
  HeatmapData,
  HashtagStat,
  RecentPost,
  InstagramAdvancedAnalytics,
  InstagramFormatPerformance,
  InstagramTopPost,
} from "@/types/analytics";

/* ── Types ── */

export interface InstagramLiveKPIs {
  followers: number;
  reach: number;
  engagement: number;
  engagementRate: number;
  posts: number;
  /** null = conta não suporta insights de impressões (Instagram Login API sem permissão de Business/Creator) */
  impressions: number | null;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalShares: number;
}

export interface InstagramLiveData {
  profile: IGProfile;
  media: IGMedia[];
  insights: IGInsight[];
  mediaInsightsMap: Map<string, Record<string, number>>;
  kpis: InstagramLiveKPIs;
}

/* ── Main fetcher ── */

/**
 * Detecta o tipo de conta Instagram via Facebook Graph API.
 * Retorna "BUSINESS" | "CREATOR" | "PERSONAL" | null (se falhar).
 * Apenas contas BUSINESS e CREATOR têm acesso a insights de impressões.
 */
async function detectAccountType(
  igUserId: string,
  accessToken: string
): Promise<"BUSINESS" | "CREATOR" | "PERSONAL" | null> {
  try {
    const url = new URL(`${FB_GRAPH_URL}/${igUserId}`);
    url.searchParams.set("fields", "account_type");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = (await res.json()) as { account_type?: string; error?: unknown };
    if (data.error) return null;

    const t = data.account_type;
    if (t === "BUSINESS" || t === "CREATOR" || t === "PERSONAL") return t;
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca total de impressões via endpoint de insights da conta.
 * Só funciona para contas BUSINESS ou CREATOR.
 * Retorna null em caso de erro ou falta de permissão.
 */
async function fetchAccountImpressions(
  igUserId: string,
  accessToken: string
): Promise<number | null> {
  try {
    // Período: últimos 28 dias (máximo suportado sem período customizado)
    const until = Math.floor(Date.now() / 1000);
    const since = until - 28 * 24 * 60 * 60;

    const url = new URL(`${FB_GRAPH_URL}/${igUserId}/insights`);
    url.searchParams.set("metric", "impressions");
    url.searchParams.set("period", "day");
    url.searchParams.set("since", String(since));
    url.searchParams.set("until", String(until));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.warn(`[IG impressions] HTTP ${res.status} — conta pode não suportar insights`);
      return null;
    }

    const data = (await res.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
      error?: { code: number; message: string };
    };

    if (data.error) {
      console.warn(`[IG impressions] Erro API ${data.error.code}: ${data.error.message}`);
      return null;
    }

    const impressionsMetric = data.data?.find((d) => d.name === "impressions");
    if (!impressionsMetric) return null;

    const total = impressionsMetric.values.reduce((s, v) => s + (v.value ?? 0), 0);
    return total;
  } catch (err) {
    console.warn("[IG impressions] Exceção ao buscar impressões:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchInstagramLive(
  accessToken: string,
  providerUserId: string,
  mediaLimit = 30
): Promise<InstagramLiveData> {
  // Fetch profile + media + account type em paralelo
  let insightsResult: IGInsight[] = [];

  const [profile, media, accountType] = await Promise.all([
    getProfile(providerUserId, accessToken),
    getMedia(providerUserId, accessToken, mediaLimit),
    detectAccountType(providerUserId, accessToken),
  ]);

  // Insights can fail (requires 100+ followers, etc.)
  try {
    insightsResult = await getInsights(providerUserId, accessToken, "day");
    if (insightsResult.length === 0) {
      insightsResult = await getInsights(providerUserId, accessToken, "days_28");
    }
  } catch {
    // Insights optional
  }

  // Fetch per-post insights (reach, saves, shares, views)
  const mediaInsightsMap = new Map<string, Record<string, number>>();

  const mediaInsightsResults = await Promise.allSettled(
    media.map((m) =>
      getMediaInsights(
        m.id,
        accessToken,
        m.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"
      ).then((insights) => ({ id: m.id, insights }))
    )
  );

  for (const result of mediaInsightsResults) {
    if (
      result.status === "fulfilled" &&
      Object.keys(result.value.insights).length > 0
    ) {
      mediaInsightsMap.set(result.value.id, result.value.insights);
    }
  }

  // Compute KPIs
  const totalLikes = media.reduce((s, m) => s + (m.like_count ?? 0), 0);
  const totalComments = media.reduce((s, m) => s + (m.comments_count ?? 0), 0);

  const postsWithInsights = media.filter((m) => mediaInsightsMap.has(m.id));
  const totalSaves = postsWithInsights.reduce(
    (s, m) => s + (mediaInsightsMap.get(m.id)?.saved ?? 0),
    0
  );
  const totalShares = postsWithInsights.reduce(
    (s, m) => s + (mediaInsightsMap.get(m.id)?.shares ?? 0),
    0
  );
  const totalReach = postsWithInsights.reduce(
    (s, m) => s + (mediaInsightsMap.get(m.id)?.reach ?? 0),
    0
  );

  const engagementRate =
    profile.followers_count > 0 && media.length > 0
      ? Math.round(
          (((totalLikes + totalComments) / media.length / profile.followers_count) *
            100) *
            100
        ) / 100
      : 0;

  // Buscar impressões apenas para contas Business ou Creator
  let impressionsValue: number | null = null;
  if (accountType === "BUSINESS" || accountType === "CREATOR") {
    impressionsValue = await fetchAccountImpressions(providerUserId, accessToken);
  }
  // accountType === "PERSONAL" ou null: mantém null (indisponível)

  const kpis: InstagramLiveKPIs = {
    followers: profile.followers_count,
    reach: totalReach,
    engagement: totalLikes + totalComments + totalSaves + totalShares,
    engagementRate,
    posts: media.length,
    impressions: impressionsValue,
    totalLikes,
    totalComments,
    totalSaves,
    totalShares,
  };

  // Try to get reach from account insights
  const reachInsight = insightsResult.find((i) => i.name === "reach");
  if (reachInsight && reachInsight.values.length > 0) {
    const insightReach = reachInsight.values.reduce((s, v) => s + v.value, 0);
    if (insightReach > kpis.reach) {
      kpis.reach = insightReach;
    }
  }

  return { profile, media, insights: insightsResult, mediaInsightsMap, kpis };
}

/* ── Converters for overview endpoint ── */

export function toOverviewKPIs(data: InstagramLiveData): {
  followers: number;
  reach: number;
  engRate: number;
  postsCount: number;
} {
  return {
    followers: data.kpis.followers,
    reach: data.kpis.reach,
    engRate: data.kpis.engagementRate,
    postsCount: data.kpis.posts,
  };
}

export function toRecentPosts(data: InstagramLiveData): RecentPost[] {
  return data.media.map((m) => {
    const mi = data.mediaInsightsMap.get(m.id);
    const likes = m.like_count ?? 0;
    const comments = m.comments_count ?? 0;
    const saves = mi?.saved ?? 0;
    const shares = mi?.shares ?? 0;
    const engagement = likes + comments + saves + shares;

    return {
      id: m.id,
      provider: "instagram" as ProviderKey,
      content_type: m.media_type === "VIDEO" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "post",
      title: null,
      caption: m.caption ?? null,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      url: m.permalink ?? null,
      published_at: m.timestamp ?? null,
      metrics: {
        likes,
        comments,
        saves,
        shares,
        reach: mi?.reach ?? 0,
        views: mi?.views ?? 0,
      },
      engagement,
    };
  });
}

/* ── Converters for [provider] endpoint ── */

export function toProviderKPIs(data: InstagramLiveData): AnalyticsKPI[] {
  const { kpis, media, mediaInsightsMap } = data;
  const followers = data.profile.followers_count || 1;

  // Engagement rate with all metrics (likes+comments+saves+shares)
  const totalEng = kpis.totalLikes + kpis.totalComments + kpis.totalSaves + kpis.totalShares;
  const fullEngRate = media.length > 0
    ? Math.round(((totalEng / media.length / followers) * 100) * 100) / 100
    : 0;

  // Average reach per post
  const postsWithReach = media.filter((m) => mediaInsightsMap.has(m.id));
  const totalReach = postsWithReach.reduce((s, m) => s + (mediaInsightsMap.get(m.id)?.reach ?? 0), 0);
  const avgReach = postsWithReach.length > 0 ? Math.round(totalReach / postsWithReach.length) : 0;

  // Impressions: preserva null se conta não suporta (Personal)
  const impressionsKPI: AnalyticsKPI =
    kpis.impressions === null
      ? {
          key: "impressions",
          label: "Impressoes",
          value: null,
          previousValue: null,
          delta: null,
          deltaPercent: null,
          trend: "unknown",
          icon: "trending",
        }
      : {
          key: "impressions",
          label: "Impressoes",
          value: kpis.impressions,
          previousValue: 0,
          delta: 0,
          deltaPercent: 0,
          trend: "flat",
          icon: "trending",
        };

  return [
    {
      key: "followers",
      label: "Seguidores",
      value: kpis.followers,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "users",
    },
    {
      key: "engagement",
      label: "Engagement Rate",
      value: fullEngRate,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "heart",
      suffix: "%",
    },
    {
      key: "reach",
      label: "Alcance Medio/Post",
      value: avgReach,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "eye",
    },
    impressionsKPI,
    {
      key: "posts",
      label: "Posts no Periodo",
      value: kpis.posts,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "file",
    },
  ];
}

export function toProviderPosts(data: InstagramLiveData): ProviderPost[] {
  return data.media.map((m) => {
    const mi = data.mediaInsightsMap.get(m.id);
    return {
      id: m.id,
      content_type: m.media_type === "VIDEO" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "post",
      title: null,
      caption: m.caption ?? null,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      url: m.permalink ?? null,
      published_at: m.timestamp ?? null,
      metrics: {
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        saves: mi?.saved ?? 0,
        shares: mi?.shares ?? 0,
        reach: mi?.reach ?? 0,
        views: mi?.views ?? 0,
      },
    };
  });
}

export function toProviderBreakdown(data: InstagramLiveData): BreakdownItem[] {
  const typeCounts = new Map<string, number>();
  for (const m of data.media) {
    const t = m.media_type === "VIDEO" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "post";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  const total = data.media.length || 1;
  const COLORS: Record<string, string> = {
    post: "#6c5ce7",
    reel: "#fbbf24",
    carousel: "#4ecdc4",
  };

  return Array.from(typeCounts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
      color: COLORS[label] ?? "#4ecdc4",
    }))
    .sort((a, b) => b.value - a.value);
}

export function toProviderHeatmap(data: InstagramLiveData): HeatmapData {
  const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`);
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  for (const m of data.media) {
    const d = new Date(m.timestamp);
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour] += (m.like_count ?? 0) + (m.comments_count ?? 0);
  }

  return { grid, dayLabels: DAY_LABELS, hourLabels: HOUR_LABELS };
}

export function toProviderHashtags(data: InstagramLiveData): HashtagStat[] {
  const tagCounts = new Map<string, number>();
  for (const m of data.media) {
    const caption = m.caption ?? "";
    const tags = caption.match(/#[\w\u00C0-\u017F]+/g) ?? [];
    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export function toProviderTimeSeries(data: InstagramLiveData): TimeSeriesDataPoint[] {
  // Group media by date for a basic time series
  const dateMap = new Map<string, { likes: number; comments: number; posts: number }>();

  for (const m of data.media) {
    const date = m.timestamp.split("T")[0];
    const entry = dateMap.get(date) ?? { likes: 0, comments: 0, posts: 0 };
    entry.likes += m.like_count ?? 0;
    entry.comments += m.comments_count ?? 0;
    entry.posts += 1;
    dateMap.set(date, entry);
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => ({
      date,
      followers: data.kpis.followers,
      reach: 0,
      // null preservado se conta não suporta impressões
      ...(data.kpis.impressions !== null ? { impressions: data.kpis.impressions } : {}),
      engagement: metrics.likes + metrics.comments,
      sessions: 0,
      users: 0,
      spend: 0,
      clicks: 0,
      leads: 0,
    }));
}

/* ── Instagram Advanced Analytics ── */

const FORMAT_LABELS: Record<string, string> = {
  IMAGE: "Post",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carrossel",
};

const CTA_REGEX = /link\s*na\s*bio|acesse|clique|saiba\s*mais|confira|arrast[ae]|coment[ea]|salv[ea]|compartilh[ea]|https?:\/\/|[\u{1F446}\u{1F447}\u{1F517}]/giu;

function extractHashtags(caption: string): string[] {
  return (caption.match(/#[\w\u00C0-\u017F]+/g) ?? []).map((t) => t.toLowerCase());
}

export function toInstagramAdvanced(data: InstagramLiveData): InstagramAdvancedAnalytics {
  const { media, mediaInsightsMap, kpis } = data;
  const totalPosts = media.length || 1;
  const followers = data.profile.followers_count || 1;

  // ── Engagement Breakdown ──
  const engagementBreakdown = {
    avgLikes: Math.round((kpis.totalLikes / totalPosts) * 10) / 10,
    avgComments: Math.round((kpis.totalComments / totalPosts) * 10) / 10,
    avgSaves: Math.round((kpis.totalSaves / totalPosts) * 10) / 10,
    avgShares: Math.round((kpis.totalShares / totalPosts) * 10) / 10,
  };

  // ── Format Performance ──
  const formatGroups = new Map<string, { posts: typeof media; totalEng: number; totalReach: number }>();
  for (const m of media) {
    const fmt = m.media_type;
    const group = formatGroups.get(fmt) ?? { posts: [], totalEng: 0, totalReach: 0 };
    const mi = mediaInsightsMap.get(m.id);
    const likes = m.like_count ?? 0;
    const comments = m.comments_count ?? 0;
    const saves = mi?.saved ?? 0;
    const shares = mi?.shares ?? 0;
    const reach = mi?.reach ?? 0;
    const eng = likes + comments + saves + shares;

    group.posts.push(m);
    group.totalEng += eng;
    group.totalReach += reach;
    formatGroups.set(fmt, group);
  }

  const formatPerformance: InstagramFormatPerformance[] = Array.from(formatGroups.entries()).map(([fmt, group]) => {
    const count = group.posts.length;
    const avgEngagement = count > 0 ? Math.round((group.totalEng / count / followers) * 10000) / 100 : 0;
    const avgReach = count > 0 ? Math.round(group.totalReach / count) : 0;

    // Find best post by engagement
    let bestPost: InstagramFormatPerformance["bestPost"] = null;
    let bestEng = 0;
    for (const m of group.posts) {
      const mi = mediaInsightsMap.get(m.id);
      const eng = (m.like_count ?? 0) + (m.comments_count ?? 0) + (mi?.saved ?? 0) + (mi?.shares ?? 0);
      if (eng > bestEng) {
        bestEng = eng;
        bestPost = {
          thumbnail: m.thumbnail_url ?? m.media_url ?? "",
          engagement: eng,
          permalink: m.permalink ?? "",
        };
      }
    }

    return {
      format: fmt,
      label: FORMAT_LABELS[fmt] ?? fmt,
      count,
      avgEngagement,
      avgReach,
      bestPost,
    };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);

  // ── Top Posts (by engagement) ──
  const postsWithMetrics = media.map((m) => {
    const mi = mediaInsightsMap.get(m.id);
    const likes = m.like_count ?? 0;
    const comments = m.comments_count ?? 0;
    const saves = mi?.saved ?? 0;
    const shares = mi?.shares ?? 0;
    const reach = mi?.reach ?? 0;
    const totalEng = likes + comments + saves + shares;
    const engagementRate = followers > 0 ? Math.round((totalEng / followers) * 10000) / 100 : 0;

    return {
      id: m.id,
      thumbnail: m.thumbnail_url ?? m.media_url ?? "",
      caption: m.caption ?? "",
      format: m.media_type,
      label: FORMAT_LABELS[m.media_type] ?? m.media_type,
      likes,
      comments,
      saves,
      shares,
      reach,
      engagementRate,
      date: m.timestamp,
      permalink: m.permalink ?? "",
    } satisfies InstagramTopPost;
  });

  const topPosts = [...postsWithMetrics]
    .sort((a, b) => (b.likes + b.comments + b.saves + b.shares) - (a.likes + a.comments + a.saves + a.shares))
    .slice(0, 6);

  // ── Save Rate Analysis ──
  const postsWithReach = postsWithMetrics.filter((p) => p.reach > 0);
  const avgSaveRate = postsWithReach.length > 0
    ? Math.round((postsWithReach.reduce((s, p) => s + (p.saves / p.reach), 0) / postsWithReach.length) * 10000) / 100
    : 0;

  const bestSaveRatePosts = [...postsWithReach]
    .map((p) => ({
      thumbnail: p.thumbnail,
      saveRate: Math.round((p.saves / p.reach) * 10000) / 100,
      caption: p.caption.slice(0, 100),
      permalink: p.permalink,
    }))
    .sort((a, b) => b.saveRate - a.saveRate)
    .slice(0, 5);

  // ── Caption & CTA Analysis ──
  let withCTA = 0;
  let withoutCTA = 0;
  let ctaEngTotal = 0;
  let noCtaEngTotal = 0;
  let totalCaptionLength = 0;
  const hashtagEngMap = new Map<string, { count: number; totalEng: number }>();

  for (const p of postsWithMetrics) {
    const caption = p.caption;
    totalCaptionLength += caption.length;
    const eng = p.likes + p.comments + p.saves + p.shares;
    const hasCTA = CTA_REGEX.test(caption);
    // Reset lastIndex since we use global flag
    CTA_REGEX.lastIndex = 0;

    if (hasCTA) {
      withCTA++;
      ctaEngTotal += eng;
    } else {
      withoutCTA++;
      noCtaEngTotal += eng;
    }

    // Hashtag analysis
    const tags = extractHashtags(caption);
    for (const tag of tags) {
      const entry = hashtagEngMap.get(tag) ?? { count: 0, totalEng: 0 };
      entry.count++;
      entry.totalEng += eng;
      hashtagEngMap.set(tag, entry);
    }
  }

  const topHashtags = Array.from(hashtagEngMap.entries())
    .map(([tag, { count, totalEng }]) => ({
      tag,
      count,
      avgEngagement: count > 0 ? Math.round(totalEng / count) : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);

  const captionAnalysis = {
    avgLength: Math.round(totalCaptionLength / totalPosts),
    withCTA,
    withoutCTA,
    ctaEngagement: withCTA > 0 ? Math.round(ctaEngTotal / withCTA) : 0,
    noCtaEngagement: withoutCTA > 0 ? Math.round(noCtaEngTotal / withoutCTA) : 0,
    topHashtags,
  };

  return {
    engagementBreakdown,
    formatPerformance,
    topPosts,
    saveRateAnalysis: { avgSaveRate, bestSaveRatePosts },
    captionAnalysis,
  };
}

/* ── Persist snapshot to DB (background, non-blocking) ── */

export async function persistInstagramSnapshot(
  empresaId: string,
  connectionId: string,
  liveData: InstagramLiveData,
  extraMetrics?: {
    accountMetrics?: InstagramAccountMetrics;
    demographics?: InstagramAudienceDemographics;
  }
): Promise<void> {
  const admin = getAdminSupabase();
  const today = new Date().toISOString().split("T")[0];

  // Upsert provider_snapshot do dia
  await admin.from("provider_snapshots").upsert(
    {
      empresa_id: empresaId,
      connection_id: connectionId,
      provider: "instagram",
      snapshot_date: today,
      metrics: {
        followers_count: liveData.profile.followers_count,
        follows_count: liveData.profile.follows_count,
        media_count: liveData.profile.media_count,
        ...(liveData.kpis.reach > 0 ? { reach: liveData.kpis.reach } : {}),
        // null = indisponível para esse tipo de conta; preservar null no JSONB (não converter para 0)
        impressions: liveData.kpis.impressions,
        // Métricas adicionais de conta (apenas se fornecidas e não nulas)
        ...(extraMetrics?.accountMetrics?.profile_visits != null
          ? { profile_visits: extraMetrics.accountMetrics.profile_visits }
          : {}),
        ...(extraMetrics?.accountMetrics?.profile_links_taps != null
          ? {
              profile_links_taps: extraMetrics.accountMetrics.profile_links_taps,
              ...(extraMetrics.accountMetrics.profile_links_taps_breakdown
                ? { profile_links_taps_breakdown: extraMetrics.accountMetrics.profile_links_taps_breakdown }
                : {}),
            }
          : {}),
        ...(extraMetrics?.accountMetrics?.views_total != null
          ? { views_total: extraMetrics.accountMetrics.views_total }
          : {}),
        // Audience demographics (semanal - só persiste se fornecido)
        ...(extraMetrics?.demographics?.audience_gender_age
          ? { audience_gender_age: extraMetrics.demographics.audience_gender_age }
          : {}),
        ...(extraMetrics?.demographics?.audience_city
          ? { audience_city: extraMetrics.demographics.audience_city }
          : {}),
      },
    },
    { onConflict: "connection_id,snapshot_date" }
  );

  // Upsert content_items (batch — nao faz um por um)
  if (liveData.media.length > 0) {
    const rows = liveData.media.map((media) => {
      const mi = liveData.mediaInsightsMap.get(media.id);
      return {
        empresa_id: empresaId,
        connection_id: connectionId,
        provider: "instagram",
        provider_content_id: media.id,
        content_type: media.media_type === "VIDEO" ? "reel" : media.media_type === "CAROUSEL_ALBUM" ? "carousel" : "post",
        caption: media.caption ?? null,
        url: media.permalink ?? null,
        thumbnail_url: media.thumbnail_url ?? media.media_url ?? null,
        published_at: media.timestamp ?? null,
        metrics: {
          likes: media.like_count ?? 0,
          comments: media.comments_count ?? 0,
          ...(mi ?? {}),
        },
        synced_at: new Date().toISOString(),
      };
    });

    await admin
      .from("content_items")
      .upsert(rows, { onConflict: "connection_id,provider_content_id" });
  }
}

/* ── Métricas de conta adicionais (profile_visits, profile_links_taps, views_total) ── */

export interface InstagramAccountMetrics {
  profile_visits: number | null;
  /** Total de cliques no perfil (soma de todos os tipos de link) */
  profile_links_taps: number | null;
  /** Breakdown por tipo: email_contacts, call_button_clicks, direction_button_clicks, website_clicks */
  profile_links_taps_breakdown: Record<string, number> | null;
  /** Total de visualizações (orgânico + pago) */
  views_total: number | null;
}

/**
 * Busca métricas de conta do Instagram via account_insights.
 * Requer conta BUSINESS ou CREATOR.
 * Retorna null nos campos quando a conta não suporta.
 */
export async function fetchAccountMetrics(
  igUserId: string,
  accessToken: string
): Promise<InstagramAccountMetrics> {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 24 * 60 * 60; // últimos 28 dias

  const metricsToFetch = [
    "profile_visits",
    "profile_links_taps",
    "views",
  ].join(",");

  const result: InstagramAccountMetrics = {
    profile_visits: null,
    profile_links_taps: null,
    profile_links_taps_breakdown: null,
    views_total: null,
  };

  try {
    const url = new URL(`${FB_GRAPH_URL}/${igUserId}/insights`);
    url.searchParams.set("metric", metricsToFetch);
    url.searchParams.set("period", "day");
    url.searchParams.set("since", String(since));
    url.searchParams.set("until", String(until));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`[IG account_metrics] HTTP ${res.status}`);
      return result;
    }

    const data = (await res.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }>;
      error?: { code: number; message: string };
    };

    if (data.error) {
      console.warn(`[IG account_metrics] Erro API ${data.error.code}: ${data.error.message}`);
      return result;
    }

    for (const metric of data.data ?? []) {
      const total = metric.values.reduce((s, v) => {
        if (typeof v.value === "number") return s + v.value;
        // breakdown object: soma todos os valores
        return s + Object.values(v.value as Record<string, number>).reduce((a, b) => a + b, 0);
      }, 0);

      if (metric.name === "profile_visits") {
        result.profile_visits = total;
      } else if (metric.name === "profile_links_taps") {
        result.profile_links_taps = total;
        // IMPORTANTE 3: Somar todos os valores por chave (email, call, directions, website)
        // para obter o total acumulado do período, não apenas o último valor
        const breakdown: Record<string, number> = {};
        for (const v of metric.values) {
          if (v.value && typeof v.value === "object") {
            for (const [key, val] of Object.entries(v.value as Record<string, number>)) {
              breakdown[key] = (breakdown[key] ?? 0) + (typeof val === "number" ? val : 0);
            }
          }
        }
        if (Object.keys(breakdown).length > 0) {
          result.profile_links_taps_breakdown = breakdown;
        }
      } else if (metric.name === "views") {
        result.views_total = total;
      }
    }
  } catch (err) {
    console.warn("[IG account_metrics] Exceção:", err instanceof Error ? err.message : err);
  }

  return result;
}

/* ── Audience Demographics (follower_demographics — Graph API v22+) ── */

export interface InstagramAudienceDemographics {
  /**
   * Mapa de "F.25-34", "M.18-24", etc. → contagem.
   * Chaves combinadas são aproximadas: construídas a partir de chamadas separadas
   * por age e gender. A API v22+ não suporta breakdown composto numa única chamada.
   * Decisão: retornar chaves somente por idade ("25-34" → count) e por gênero
   * ("F" → count, "M" → count) para maior precisão, mais chave composta "gender.age"
   * estimada quando ambas disponíveis.
   */
  audience_gender_age: Record<string, number> | null;
  /** Top 10 cidades → contagem (ex: "São Paulo, Brazil" → 1234) */
  audience_city: Record<string, number> | null;
}

/**
 * Resposta da Graph API v22+ para follower_demographics.
 * Estrutura: metric.total_value.breakdowns[0].results[{ dimension_values, value }]
 */
interface FollowerDemographicsResponse {
  data?: Array<{
    name: string;
    total_value?: {
      breakdowns?: Array<{
        dimension_keys: string[];
        results: Array<{
          dimension_values: string[];
          value: number;
        }>;
      }>;
    };
  }>;
  error?: { code: number; message: string };
}

/**
 * Faz uma chamada follower_demographics com um único breakdown.
 * Retorna mapa dimensionValue → count.
 */
async function fetchFollowerDemographicsBreakdown(
  igUserId: string,
  accessToken: string,
  breakdown: "age" | "gender" | "city"
): Promise<Record<string, number> | null> {
  try {
    const url = new URL(`${FB_GRAPH_URL}/${igUserId}/insights`);
    url.searchParams.set("metric", "follower_demographics");
    url.searchParams.set("period", "lifetime");
    url.searchParams.set("metric_type", "total_value");
    url.searchParams.set("breakdown", breakdown);
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`[IG demographics/${breakdown}] HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as FollowerDemographicsResponse;

    if (data.error) {
      console.warn(`[IG demographics/${breakdown}] API error ${data.error.code}: ${data.error.message}`);
      return null;
    }

    const metric = data.data?.[0];
    if (!metric?.total_value?.breakdowns?.length) return null;

    const results = metric.total_value.breakdowns[0].results ?? [];
    const out: Record<string, number> = {};
    for (const r of results) {
      const key = r.dimension_values[0] ?? "";
      if (key) out[key] = (out[key] ?? 0) + r.value;
    }
    return out;
  } catch (err) {
    console.warn(`[IG demographics/${breakdown}] Exceção:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Busca demographics de audiência via Instagram Graph API v22+.
 * Usa follower_demographics (substituta de audience_gender_age/audience_city).
 * Faz 3 chamadas separadas (age, gender, city) e combina os resultados.
 *
 * audience_gender_age retorna chaves:
 *   - Por gênero: "F" → count, "M" → count, "U" → count
 *   - Por idade: "18-24" → count, "25-34" → count, etc.
 *   - Combinadas estimadas: "F.25-34" → count (produto de proporções, não exato)
 *     NÃO retornamos combinadas para evitar dados enganosos — apenas gênero e idade puros.
 *     O aggregator e o frontend devem tratar chaves puras de gênero (F/M/U) e de faixa etária.
 */
export async function fetchAudienceDemographics(
  igUserId: string,
  accessToken: string
): Promise<InstagramAudienceDemographics> {
  const result: InstagramAudienceDemographics = {
    audience_gender_age: null,
    audience_city: null,
  };

  // Tentar novo endpoint follower_demographics (v22+)
  const [ageData, genderData, cityData] = await Promise.all([
    fetchFollowerDemographicsBreakdown(igUserId, accessToken, "age"),
    fetchFollowerDemographicsBreakdown(igUserId, accessToken, "gender"),
    fetchFollowerDemographicsBreakdown(igUserId, accessToken, "city"),
  ]);

  // Combinar age + gender num único mapa (chaves puras sem composto — ver docstring)
  const genderAge: Record<string, number> = {};
  if (ageData) {
    for (const [key, val] of Object.entries(ageData)) {
      genderAge[key] = val; // ex: "25-34" → 1234
    }
  }
  if (genderData) {
    for (const [key, val] of Object.entries(genderData)) {
      genderAge[key] = val; // ex: "F" → 5678
    }
  }
  if (Object.keys(genderAge).length > 0) {
    result.audience_gender_age = genderAge;
  }

  // Manter top 10 cidades por contagem
  if (cityData) {
    const sorted = Object.entries(cityData)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    result.audience_city = Object.fromEntries(sorted);
  }

  // Fallback: se o novo endpoint falhar completamente, tentar API legada (v21 e anterior)
  if (!result.audience_gender_age && !result.audience_city) {
    console.warn("[IG demographics] follower_demographics falhou — tentando API legada");
    try {
      const url = new URL(`${FB_GRAPH_URL}/${igUserId}/insights`);
      url.searchParams.set("metric", "audience_gender_age,audience_city");
      url.searchParams.set("period", "lifetime");
      url.searchParams.set("access_token", accessToken);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{ name: string; values: Array<{ value: Record<string, number> }> }>;
          error?: { code: number; message: string };
        };

        if (!data.error) {
          for (const metric of data.data ?? []) {
            const lastValue = metric.values[0]?.value ?? metric.values[metric.values.length - 1]?.value;
            if (!lastValue) continue;
            if (metric.name === "audience_gender_age") {
              result.audience_gender_age = lastValue as Record<string, number>;
            } else if (metric.name === "audience_city") {
              const sorted = Object.entries(lastValue as Record<string, number>)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10);
              result.audience_city = Object.fromEntries(sorted);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[IG demographics] Fallback legado também falhou:", err instanceof Error ? err.message : err);
    }
  }

  return result;
}

/* ── Stories Sync ── */

export interface IGStory {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink?: string;
}

export interface IGStoryInsights {
  impressions: number;
  reach: number;
  replies: number;
  exits: number;
  taps_forward: number;
  taps_back: number;
  /** Métricas de navigation (taps_forward, taps_back, exits, swipe_away) */
  navigation: number;
}

/**
 * Busca stories ativos do usuário IG.
 * Stories expiram em 24h — deve ser chamado diariamente.
 * Retorna lista de stories com suas métricas (se disponíveis).
 */
export async function fetchActiveStories(
  igUserId: string,
  accessToken: string
): Promise<Array<IGStory & { insights: Partial<IGStoryInsights> }>> {
  const results: Array<IGStory & { insights: Partial<IGStoryInsights> }> = [];

  try {
    const url = new URL(`${FB_GRAPH_URL}/${igUserId}/stories`);
    url.searchParams.set("fields", "id,media_type,media_url,thumbnail_url,timestamp,permalink");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`[IG stories] HTTP ${res.status}`);
      return results;
    }

    const data = (await res.json()) as {
      data?: IGStory[];
      error?: { code: number; message: string };
    };

    if (data.error) {
      console.warn(`[IG stories] Erro API ${data.error.code}: ${data.error.message}`);
      return results;
    }

    const stories = data.data ?? [];

    if (stories.length === 0) return results;

    // Buscar insights de cada story em paralelo — CRÍTICO 2: contar falhas
    let successCount = 0;
    let failedCount = 0;

    const insightPromises = stories.map(async (story) => {
      try {
        const insights = await fetchStoryInsights(story.id, accessToken);
        successCount++;
        return { ...story, insights };
      } catch (err) {
        failedCount++;
        console.warn(
          `[IG stories] Falha ao buscar insights story_id=${story.id}:`,
          err instanceof Error ? err.message : err
        );
        // Retorna story com insights vazios para não perder o story em si
        return { ...story, insights: {} as Partial<IGStoryInsights> };
      }
    });

    const resolved = await Promise.all(insightPromises);

    // Se >50% dos stories falharam, lançar erro para o caller
    const totalStories = stories.length;
    if (totalStories > 0 && failedCount / totalStories > 0.5) {
      const errorMsg = `[IG stories] ${failedCount}/${totalStories} insights falharam (>${Math.round(failedCount / totalStories * 100)}%)`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (failedCount > 0) {
      console.warn(`[IG stories] ${failedCount}/${totalStories} insights falharam, ${successCount} com sucesso`);
    }

    results.push(...resolved);
  } catch (err) {
    console.warn("[IG stories] Exceção:", err instanceof Error ? err.message : err);
    // Re-lança apenas se for o erro de >50% falhas (para o caller tratar)
    if (err instanceof Error && err.message.includes("insights falharam")) {
      throw err;
    }
  }

  return results;
}

/**
 * Busca insights de um story individual.
 * Métricas disponíveis: impressions, reach, replies, exits, taps_forward, taps_back, navigation.
 * Lança erro em caso de falha para permitir contagem de successCount/failedCount no caller.
 */
async function fetchStoryInsights(
  storyId: string,
  accessToken: string
): Promise<Partial<IGStoryInsights>> {
  const insights: Partial<IGStoryInsights> = {};

  const url = new URL(`${FB_GRAPH_URL}/${storyId}/insights`);
  url.searchParams.set("metric", "impressions,reach,replies,exits,taps_forward,taps_back,navigation");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ name: string; values: Array<{ value: number }> }>;
    error?: { code: number; message: string };
  };

  if (data.error) {
    throw new Error(`API error ${data.error.code}: ${data.error.message}`);
  }

  for (const metric of data.data ?? []) {
    const value = metric.values?.[0]?.value ?? 0;
    (insights as Record<string, number>)[metric.name] = typeof value === "number" ? value : 0;
  }

  return insights;
}

/**
 * Persiste stories ativos no banco como content_items com content_type='story'.
 * Idempotente via UNIQUE(connection_id, provider_content_id).
 */
export async function persistActiveStories(
  empresaId: string,
  connectionId: string,
  stories: Array<IGStory & { insights: Partial<IGStoryInsights> }>
): Promise<void> {
  if (stories.length === 0) return;

  const admin = getAdminSupabase();
  const now = new Date().toISOString();

  const rows = stories.map((story) => ({
    empresa_id: empresaId,
    connection_id: connectionId,
    provider: "instagram",
    provider_content_id: story.id,
    content_type: "story" as const,
    caption: null,
    url: story.permalink ?? null,
    thumbnail_url: story.thumbnail_url ?? story.media_url ?? null,
    published_at: story.timestamp ?? null,
    metrics: {
      impressions: story.insights.impressions ?? 0,
      reach: story.insights.reach ?? 0,
      replies: story.insights.replies ?? 0,
      exits: story.insights.exits ?? 0,
      taps_forward: story.insights.taps_forward ?? 0,
      taps_back: story.insights.taps_back ?? 0,
      navigation: story.insights.navigation ?? 0,
    },
    raw: { media_type: story.media_type, ...story.insights } as Record<string, unknown>,
    synced_at: now,
  }));

  const { error } = await admin
    .from("content_items")
    .upsert(rows, { onConflict: "connection_id,provider_content_id" });

  if (error) {
    console.error("[IG stories persist] Erro ao upsert stories:", error.message);
  }
}
