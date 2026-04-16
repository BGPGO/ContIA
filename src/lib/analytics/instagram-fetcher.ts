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
} from "@/types/analytics";

/* ── Types ── */

export interface InstagramLiveKPIs {
  followers: number;
  reach: number;
  engagement: number;
  engagementRate: number;
  posts: number;
  impressions: number;
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

export async function fetchInstagramLive(
  accessToken: string,
  providerUserId: string,
  mediaLimit = 30
): Promise<InstagramLiveData> {
  // Fetch profile + media + insights in parallel
  let insightsResult: IGInsight[] = [];

  const [profile, media] = await Promise.all([
    getProfile(providerUserId, accessToken),
    getMedia(providerUserId, accessToken, mediaLimit),
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

  const kpis: InstagramLiveKPIs = {
    followers: profile.followers_count,
    reach: totalReach,
    engagement: totalLikes + totalComments + totalSaves + totalShares,
    engagementRate,
    posts: media.length,
    impressions: 0, // Not reliably available from Instagram Login API
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
      content_type: m.media_type === "VIDEO" ? "reel" : "post",
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
  const { kpis } = data;
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
      key: "reach",
      label: "Alcance",
      value: kpis.reach,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "eye",
    },
    {
      key: "impressions",
      label: "Impressoes",
      value: kpis.impressions,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "trending",
    },
    {
      key: "engagement",
      label: "Engajamento",
      value: kpis.engagementRate,
      previousValue: 0,
      delta: 0,
      deltaPercent: 0,
      trend: "flat",
      icon: "heart",
      suffix: "%",
    },
  ];
}

export function toProviderPosts(data: InstagramLiveData): ProviderPost[] {
  return data.media.map((m) => {
    const mi = data.mediaInsightsMap.get(m.id);
    return {
      id: m.id,
      content_type: m.media_type === "VIDEO" ? "reel" : "post",
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
    const t = m.media_type === "VIDEO" ? "reel" : "post";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  const total = data.media.length || 1;
  const COLORS: Record<string, string> = {
    post: "#6c5ce7",
    reel: "#fbbf24",
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
      impressions: 0,
      engagement: metrics.likes + metrics.comments,
      sessions: 0,
      users: 0,
      spend: 0,
      clicks: 0,
      leads: 0,
    }));
}

/* ── Persist snapshot to DB (background, non-blocking) ── */

export async function persistInstagramSnapshot(
  empresaId: string,
  connectionId: string,
  liveData: InstagramLiveData
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
        ...(liveData.kpis.impressions > 0
          ? { impressions: liveData.kpis.impressions }
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
        content_type: media.media_type === "VIDEO" ? "reel" : "post",
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
