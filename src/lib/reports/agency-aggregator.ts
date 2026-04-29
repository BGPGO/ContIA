/**
 * agency-aggregator.ts — helpers de agregação para o Relatório Agência ContIA.
 * Recebe dados já carregados (sem fazer queries) e retorna as secções do AgencyReportData.
 *
 * Wave 2, Squad D. Sem chamadas IA.
 */

import type { AgencyReportData, KpiValue } from "@/types/agency-report";

/* ── tipos de linha vindos do Supabase ──────────────────────────────────── */

export interface SnapshotRow {
  id?: string;
  empresa_id: string;
  connection_id?: string;
  provider: string;
  snapshot_date: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: Record<string, any>;
  created_at?: string;
}

export interface ContentRow {
  id: string;
  empresa_id: string;
  connection_id?: string;
  provider: string;
  provider_content_id: string;
  content_type: string;
  title?: string | null;
  caption?: string | null;
  url?: string | null;
  thumbnail_url?: string | null;
  published_at?: string | null;
  metrics: Record<string, number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: Record<string, any> | null;
  synced_at?: string;
}

/* ── buildKpi ────────────────────────────────────────────────────────────── */

/**
 * Constrói um KpiValue a partir de valor atual e anterior.
 * - deltaPercent = null quando previousValue === 0 (evitar divisão por zero)
 * - trend: 'flat' quando delta === 0 ou ambos nulos
 */
export function buildKpi(
  currentValue: number | null,
  previousValue: number | null,
  format?: KpiValue["format"]
): KpiValue {
  if (currentValue === null && previousValue === null) {
    return { value: null, previousValue: null, delta: null, deltaPercent: null, trend: "flat", format };
  }

  const delta =
    currentValue !== null && previousValue !== null
      ? currentValue - previousValue
      : null;

  let deltaPercent: number | null = null;
  if (delta !== null && previousValue !== null && previousValue !== 0) {
    deltaPercent = delta / previousValue; // proporção (-1 a +inf)
  }

  let trend: KpiValue["trend"] = "flat";
  if (delta !== null) {
    if (delta > 0) trend = "up";
    else if (delta < 0) trend = "down";
  }

  return {
    value: currentValue,
    previousValue,
    delta,
    deltaPercent,
    trend,
    format,
  };
}

/* ── helpers internos ────────────────────────────────────────────────────── */

/** Pega o snapshot mais recente de um array filtrado por provider */
function latestSnapshot(snapshots: SnapshotRow[], provider: string): SnapshotRow | null {
  const filtered = snapshots
    .filter((s) => s.provider === provider)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  return filtered[0] ?? null;
}

/** Soma uma métrica numérica nos snapshots do provider */
function sumMetric(snapshots: SnapshotRow[], provider: string, key: string): number {
  return snapshots
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => acc + (Number(s.metrics?.[key]) || 0), 0);
}

/** Pega um número de um snapshot, com fallback para 0 */
function n(snap: SnapshotRow | null, key: string): number {
  if (!snap) return 0;
  return Number(snap.metrics?.[key] ?? 0) || 0;
}

/** Soma a métrica em todos os content_items do content_type */
function sumContentMetric(items: ContentRow[], key: string): number {
  return items.reduce((acc, c) => acc + (Number(c.metrics?.[key]) || 0), 0);
}

/** Constrói série diária a partir dos snapshots ordenados */
function buildDailySeries(
  snapshots: SnapshotRow[],
  provider: string,
  metricKey: string
): Array<{ date: string; value: number }> {
  return snapshots
    .filter((s) => s.provider === provider && s.metrics?.[metricKey] != null)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map((s) => ({ date: s.snapshot_date, value: Number(s.metrics[metricKey]) || 0 }));
}

/** Extrai top N content_items por uma métrica calculada */
function topByMetric(
  items: ContentRow[],
  calcFn: (m: Record<string, number>) => number,
  limit = 5
): ContentRow[] {
  return [...items].sort((a, b) => calcFn(b.metrics) - calcFn(a.metrics)).slice(0, limit);
}

/** Calcula a "melhor hora" baseada em engajamento médio */
function computeBestTime(
  items: ContentRow[]
): Array<{ dayOfWeek: number; hour: number; engagementAvg: number }> {
  const map = new Map<string, { total: number; count: number }>();

  for (const item of items) {
    if (!item.published_at) continue;
    const d = new Date(item.published_at);
    const key = `${d.getDay()}-${d.getHours()}`;
    const eng =
      (item.metrics.likes ?? 0) +
      (item.metrics.comments ?? 0) +
      (item.metrics.saves ?? 0) +
      (item.metrics.shares ?? 0);
    const existing = map.get(key) ?? { total: 0, count: 0 };
    map.set(key, { total: existing.total + eng, count: existing.count + 1 });
  }

  return Array.from(map.entries())
    .map(([key, { total, count }]) => {
      const [day, hour] = key.split("-").map(Number);
      return { dayOfWeek: day, hour, engagementAvg: count > 0 ? total / count : 0 };
    })
    .sort((a, b) => b.engagementAvg - a.engagementAvg)
    .slice(0, 10);
}

/* ── aggregateInstagram ──────────────────────────────────────────────────── */

export function aggregateInstagram(
  snapshots: SnapshotRow[],
  previousSnapshots: SnapshotRow[],
  posts: ContentRow[],
  previousPosts: ContentRow[]
): AgencyReportData["instagram"] {
  const igSnaps = snapshots.filter((s) => s.provider === "instagram");
  const prevIgSnaps = previousSnapshots.filter((s) => s.provider === "instagram");

  const latest = latestSnapshot(igSnaps, "instagram");
  const prevLatest = latestSnapshot(prevIgSnaps, "instagram");

  // ── perfil ──────────────────────────────────────────────────────────────
  const followers = n(latest, "followers_count");
  const prevFollowers = n(prevLatest, "followers_count");
  const reach = n(latest, "reach");
  const prevReach = n(prevLatest, "reach");

  // audience_city é persistido como JSON array de [city, count] ou object
  const audienceCityRaw = latest?.metrics?.audience_city;
  let cities: Array<{ city: string; followers: number }> = [];
  if (audienceCityRaw) {
    try {
      const parsed = typeof audienceCityRaw === "string"
        ? JSON.parse(audienceCityRaw)
        : audienceCityRaw;
      if (Array.isArray(parsed)) {
        cities = parsed.map(([city, f]: [string, number]) => ({ city, followers: f }));
      } else if (typeof parsed === "object") {
        cities = Object.entries(parsed as Record<string, number>)
          .map(([city, f]) => ({ city, followers: f }))
          .sort((a, b) => b.followers - a.followers)
          .slice(0, 10);
      }
    } catch {
      // TODO(wave2-D): formato de audience_city inesperado — ignorar
    }
  }

  // audience_gender_age
  const genderAgeRaw = latest?.metrics?.audience_gender_age;
  let genderAge: Record<string, number> = {};
  if (genderAgeRaw) {
    if (typeof genderAgeRaw === "object" && !Array.isArray(genderAgeRaw)) {
      genderAge = genderAgeRaw as Record<string, number>;
    }
  }

  // profile_links_taps_breakdown
  const linkTapsBreakdownRaw = latest?.metrics?.profile_links_taps_breakdown;
  let profileLinkTapsBreakdown: Record<string, number> = {};
  if (linkTapsBreakdownRaw && typeof linkTapsBreakdownRaw === "object") {
    profileLinkTapsBreakdown = linkTapsBreakdownRaw as Record<string, number>;
  }

  // ── feed (posts + carousels) ────────────────────────────────────────────
  const feedItems = posts.filter(
    (p) => p.provider === "instagram" && (p.content_type === "post" || p.content_type === "carousel")
  );
  const prevFeedItems = previousPosts.filter(
    (p) => p.provider === "instagram" && (p.content_type === "post" || p.content_type === "carousel")
  );

  // ── reels ────────────────────────────────────────────────────────────────
  const reelItems = posts.filter(
    (p) => p.provider === "instagram" && p.content_type === "reel"
  );
  const prevReelItems = previousPosts.filter(
    (p) => p.provider === "instagram" && p.content_type === "reel"
  );

  // ── stories ──────────────────────────────────────────────────────────────
  const storyItems = posts.filter(
    (p) => p.provider === "instagram" && p.content_type === "story"
  );
  const prevStoryItems = previousPosts.filter(
    (p) => p.provider === "instagram" && p.content_type === "story"
  );

  // ── top posts (all types, by interactions) ────────────────────────────
  const allIgPosts = posts.filter((p) => p.provider === "instagram" && p.content_type !== "story");
  const topPostsRaw = topByMetric(
    allIgPosts,
    (m) => (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0),
    10
  );

  return {
    perfil: {
      followers: buildKpi(followers, prevFollowers, "integer"),
      reach: buildKpi(reach, prevReach, "integer"),
      profileVisits: buildKpi(
        n(latest, "profile_visits"),
        n(prevLatest, "profile_visits"),
        "integer"
      ),
      profileLinkTaps: buildKpi(
        n(latest, "profile_links_taps"),
        n(prevLatest, "profile_links_taps"),
        "integer"
      ),
      viewsTotal: buildKpi(
        n(latest, "views_total"),
        n(prevLatest, "views_total"),
        "integer"
      ),
      followersGrowth: buildDailySeries(igSnaps, "instagram", "followers_count"),
      reachDaily: buildDailySeries(igSnaps, "instagram", "reach"),
    },
    audience: {
      genderAge,
      cities,
      profileLinkTapsBreakdown,
    },
    feed: {
      interactions: buildKpi(
        sumContentMetric(feedItems, "likes") +
          sumContentMetric(feedItems, "comments") +
          sumContentMetric(feedItems, "saves") +
          sumContentMetric(feedItems, "shares"),
        sumContentMetric(prevFeedItems, "likes") +
          sumContentMetric(prevFeedItems, "comments") +
          sumContentMetric(prevFeedItems, "saves") +
          sumContentMetric(prevFeedItems, "shares"),
        "integer"
      ),
      postsCount: buildKpi(feedItems.length, prevFeedItems.length, "integer"),
      reach: buildKpi(
        sumContentMetric(feedItems, "reach"),
        sumContentMetric(prevFeedItems, "reach"),
        "integer"
      ),
      comments: buildKpi(
        sumContentMetric(feedItems, "comments"),
        sumContentMetric(prevFeedItems, "comments"),
        "integer"
      ),
      shares: buildKpi(
        sumContentMetric(feedItems, "shares"),
        sumContentMetric(prevFeedItems, "shares"),
        "integer"
      ),
      likes: buildKpi(
        sumContentMetric(feedItems, "likes"),
        sumContentMetric(prevFeedItems, "likes"),
        "integer"
      ),
      saves: buildKpi(
        sumContentMetric(feedItems, "saves"),
        sumContentMetric(prevFeedItems, "saves"),
        "integer"
      ),
    },
    reels: {
      reelsCount: buildKpi(reelItems.length, prevReelItems.length, "integer"),
      reach: buildKpi(
        sumContentMetric(reelItems, "reach"),
        sumContentMetric(prevReelItems, "reach"),
        "integer"
      ),
      views: buildKpi(
        // IG reels: prefer "video_views" then "plays" then "impressions"
        sumContentMetric(reelItems, "video_views") ||
          sumContentMetric(reelItems, "plays") ||
          sumContentMetric(reelItems, "impressions"),
        sumContentMetric(prevReelItems, "video_views") ||
          sumContentMetric(prevReelItems, "plays") ||
          sumContentMetric(prevReelItems, "impressions"),
        "integer"
      ),
      interactions: buildKpi(
        sumContentMetric(reelItems, "likes") +
          sumContentMetric(reelItems, "comments") +
          sumContentMetric(reelItems, "saves") +
          sumContentMetric(reelItems, "shares"),
        sumContentMetric(prevReelItems, "likes") +
          sumContentMetric(prevReelItems, "comments") +
          sumContentMetric(prevReelItems, "saves") +
          sumContentMetric(prevReelItems, "shares"),
        "integer"
      ),
      topReels: topByMetric(
        reelItems,
        (m) => (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0),
        5
      ).map((r) => ({
        id: r.provider_content_id,
        thumbnail: r.thumbnail_url ?? null,
        caption: r.caption ?? null,
        permalink: r.url ?? null,
        publishedAt: r.published_at ?? "",
        reach: r.metrics.reach ?? 0,
        views:
          r.metrics.video_views ??
          r.metrics.plays ??
          r.metrics.impressions ??
          0,
        likes: r.metrics.likes ?? 0,
        saves: r.metrics.saves ?? 0,
        comments: r.metrics.comments ?? 0,
        shares: r.metrics.shares ?? 0,
        interactions:
          (r.metrics.likes ?? 0) +
          (r.metrics.comments ?? 0) +
          (r.metrics.saves ?? 0) +
          (r.metrics.shares ?? 0),
      })),
    },
    stories: {
      storiesCount: buildKpi(storyItems.length, prevStoryItems.length, "integer"),
      // TODO(wave2-D): profile_visits e follows por stories não são persistidos por post — apenas a nível de conta
      profileVisits: buildKpi(null, null, "integer"),
      followsFromStories: buildKpi(null, null, "integer"),
      retention: buildKpi(null, null, "percent"),
      interactions: buildKpi(
        sumContentMetric(storyItems, "replies") + sumContentMetric(storyItems, "taps_back") + sumContentMetric(storyItems, "taps_forward"),
        sumContentMetric(prevStoryItems, "replies") + sumContentMetric(prevStoryItems, "taps_back") + sumContentMetric(prevStoryItems, "taps_forward"),
        "integer"
      ),
      individuals: storyItems
        .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
        .slice(0, 20)
        .map((s) => ({
          id: s.provider_content_id,
          thumbnail: s.thumbnail_url ?? null,
          publishedAt: s.published_at ?? "",
          impressions: s.metrics.impressions ?? 0,
          reach: s.metrics.reach ?? 0,
          replies: s.metrics.replies ?? 0,
          exits: s.metrics.exits ?? 0,
          tapsForward: s.metrics.taps_forward ?? 0,
          tapsBack: s.metrics.taps_back ?? 0,
          nextStory: s.metrics.navigation_next_story ?? s.metrics.swipe_forward ?? 0,
        })),
    },
    bestTime: computeBestTime(allIgPosts),
    topPosts: topPostsRaw.map((p) => ({
      id: p.provider_content_id,
      type: (p.content_type as "post" | "carousel" | "reel") ?? "post",
      thumbnail: p.thumbnail_url ?? null,
      caption: p.caption ?? null,
      permalink: p.url ?? null,
      publishedAt: p.published_at ?? "",
      reach: p.metrics.reach ?? 0,
      likes: p.metrics.likes ?? 0,
      comments: p.metrics.comments ?? 0,
      saves: p.metrics.saves ?? 0,
      shares: p.metrics.shares ?? 0,
      interactions:
        (p.metrics.likes ?? 0) +
        (p.metrics.comments ?? 0) +
        (p.metrics.saves ?? 0) +
        (p.metrics.shares ?? 0),
    })),
  };
}

/* ── aggregateFacebook ───────────────────────────────────────────────────── */

export function aggregateFacebook(
  snapshots: SnapshotRow[],
  previousSnapshots: SnapshotRow[],
  posts: ContentRow[],
  previousPosts: ContentRow[]
): AgencyReportData["facebook"] {
  const fbSnaps = snapshots.filter((s) => s.provider === "facebook");
  const prevFbSnaps = previousSnapshots.filter((s) => s.provider === "facebook");

  const latest = latestSnapshot(fbSnaps, "facebook");
  const prevLatest = latestSnapshot(prevFbSnaps, "facebook");

  const fbPosts = posts.filter(
    (p) => p.provider === "facebook" && p.content_type === "post"
  );
  const prevFbPosts = previousPosts.filter(
    (p) => p.provider === "facebook" && p.content_type === "post"
  );
  const fbReels = posts.filter(
    (p) => p.provider === "facebook" && p.content_type === "reel"
  );
  const prevFbReels = previousPosts.filter(
    (p) => p.provider === "facebook" && p.content_type === "reel"
  );

  // audience_city stored as JSON string in page_fans_city_json
  const cityJson = latest?.metrics?.page_fans_city_json;
  let fbCities: Array<{ city: string; followers: number }> = [];
  if (cityJson) {
    try {
      const parsed = typeof cityJson === "string" ? JSON.parse(cityJson) : cityJson;
      if (Array.isArray(parsed)) {
        fbCities = parsed.map(([city, followers]: [string, number]) => ({ city, followers }));
      }
    } catch {
      // TODO(wave2-D): formato de page_fans_city_json inesperado
    }
  }

  // gender_age as JSON string
  const genderAgeJson = latest?.metrics?.page_fans_gender_age_json;
  let fbGenderAge: Record<string, number> = {};
  if (genderAgeJson) {
    try {
      const parsed = typeof genderAgeJson === "string" ? JSON.parse(genderAgeJson) : genderAgeJson;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        fbGenderAge = parsed as Record<string, number>;
      }
    } catch {
      // TODO(wave2-D): formato de page_fans_gender_age_json inesperado
    }
  }

  // Top posts por total_reach = organic_reach + paid_reach (fallback: impressions)
  const topFbPosts = topByMetric(
    [...fbPosts, ...fbReels],
    (m) => {
      const totalReach = (m.organic_reach ?? 0) + (m.paid_reach ?? 0);
      return totalReach > 0 ? totalReach : (m.impressions ?? 0);
    },
    5
  );

  return {
    perfil: {
      pageFollowers: buildKpi(
        n(latest, "followers_count") || n(latest, "fan_count"),
        n(prevLatest, "followers_count") || n(prevLatest, "fan_count"),
        "integer"
      ),
      newFollowers: buildKpi(
        n(latest, "page_fan_adds"),
        n(prevLatest, "page_fan_adds"),
        "integer"
      ),
      pageReach: buildKpi(
        n(latest, "page_impressions_unique"),
        n(prevLatest, "page_impressions_unique"),
        "integer"
      ),
      pageViews: buildKpi(
        n(latest, "page_views_total"),
        n(prevLatest, "page_views_total"),
        "integer"
      ),
      pageMessagesNew: buildKpi(
        n(latest, "page_messages_new_conversations"),
        n(prevLatest, "page_messages_new_conversations"),
        "integer"
      ),
      followersGrowth: buildDailySeries(fbSnaps, "facebook", "followers_count"),
      reachDaily: buildDailySeries(fbSnaps, "facebook", "page_impressions_unique"),
    },
    audience: {
      cities: fbCities,
      genderAge: fbGenderAge,
    },
    posts: {
      postsCount: buildKpi(fbPosts.length, prevFbPosts.length, "integer"),
      totalReach: buildKpi(
        sumContentMetric(fbPosts, "organic_reach") + sumContentMetric(fbPosts, "paid_reach") || sumContentMetric(fbPosts, "impressions"),
        sumContentMetric(prevFbPosts, "organic_reach") + sumContentMetric(prevFbPosts, "paid_reach") || sumContentMetric(prevFbPosts, "impressions"),
        "integer"
      ),
      organicReach: buildKpi(
        sumContentMetric(fbPosts, "organic_reach"),
        sumContentMetric(prevFbPosts, "organic_reach"),
        "integer"
      ),
      paidReach: buildKpi(
        sumContentMetric(fbPosts, "paid_reach"),
        sumContentMetric(prevFbPosts, "paid_reach"),
        "integer"
      ),
      reactions: buildKpi(
        sumContentMetric(fbPosts, "reactions"),
        sumContentMetric(prevFbPosts, "reactions"),
        "integer"
      ),
      comments: buildKpi(
        sumContentMetric(fbPosts, "comments"),
        sumContentMetric(prevFbPosts, "comments"),
        "integer"
      ),
      shares: buildKpi(
        sumContentMetric(fbPosts, "shares"),
        sumContentMetric(prevFbPosts, "shares"),
        "integer"
      ),
      topPosts: topFbPosts.map((p) => ({
        id: p.provider_content_id,
        thumbnail: p.thumbnail_url ?? null,
        caption: p.caption ?? null,
        permalink: p.url ?? null,
        publishedAt: p.published_at ?? "",
        type: (p.content_type === "reel" ? "reel" : "post") as "post" | "reel",
        totalReach: (() => {
          const tr = (p.metrics.organic_reach ?? 0) + (p.metrics.paid_reach ?? 0);
          return tr > 0 ? tr : (p.metrics.impressions ?? 0);
        })(),
        organicReach: p.metrics.organic_reach ?? 0,
        paidReach: p.metrics.paid_reach ?? 0,
        reactions: p.metrics.reactions ?? 0,
        comments: p.metrics.comments ?? 0,
        shares: p.metrics.shares ?? 0,
        clicks: p.metrics.clicks ?? p.metrics.post_clicks ?? 0,
      })),
    },
    reels: {
      reelsCount: buildKpi(fbReels.length, prevFbReels.length, "integer"),
      views: buildKpi(
        sumContentMetric(fbReels, "views") || sumContentMetric(fbReels, "total_video_views"),
        sumContentMetric(prevFbReels, "views") || sumContentMetric(prevFbReels, "total_video_views"),
        "integer"
      ),
      reach: buildKpi(
        sumContentMetric(fbReels, "impressions") || sumContentMetric(fbReels, "total_video_impressions"),
        sumContentMetric(prevFbReels, "impressions") || sumContentMetric(prevFbReels, "total_video_impressions"),
        "integer"
      ),
      avgWatchTime: buildKpi(
        fbReels.length > 0
          ? sumContentMetric(fbReels, "avg_watch_time") / fbReels.length
          : null,
        prevFbReels.length > 0
          ? sumContentMetric(prevFbReels, "avg_watch_time") / prevFbReels.length
          : null,
        "decimal"
      ),
      topReels: topByMetric(fbReels, (m) => m.views ?? m.total_video_views ?? 0, 5).map((r) => ({
        id: r.provider_content_id,
        thumbnail: r.thumbnail_url ?? null,
        title: r.title ?? null,
        permalink: r.url ?? null,
        publishedAt: r.published_at ?? "",
        views: r.metrics.views ?? r.metrics.total_video_views ?? 0,
        reach: r.metrics.impressions ?? r.metrics.total_video_impressions ?? 0,
        avgWatchTime: r.metrics.avg_watch_time ?? 0,
        completeViews: r.metrics.complete_views ?? r.metrics.total_video_complete_views ?? 0,
      })),
    },
  };
}

/* ── aggregateMetaAds ────────────────────────────────────────────────────── */

export function aggregateMetaAds(
  snapshots: SnapshotRow[],
  previousSnapshots: SnapshotRow[],
  campaigns: ContentRow[],
  previousCampaigns: ContentRow[],
  ads: ContentRow[],
  previousAds: ContentRow[]
): AgencyReportData["metaAds"] {
  const adsSnaps = snapshots.filter((s) => s.provider === "meta_ads");
  const prevAdsSnaps = previousSnapshots.filter((s) => s.provider === "meta_ads");

  // Aggregate totals across all daily snapshots in the period
  const totalSpend = sumMetric(adsSnaps, "meta_ads", "spend");
  const prevSpend = sumMetric(prevAdsSnaps, "meta_ads", "spend");
  const totalReach = sumMetric(adsSnaps, "meta_ads", "reach");
  const prevReach = sumMetric(prevAdsSnaps, "meta_ads", "reach");
  const totalImpressions = sumMetric(adsSnaps, "meta_ads", "impressions");
  const prevImpressions = sumMetric(prevAdsSnaps, "meta_ads", "impressions");
  const totalLeads = sumMetric(adsSnaps, "meta_ads", "leads");
  const prevLeads = sumMetric(prevAdsSnaps, "meta_ads", "leads");
  const totalLinkClicks = sumMetric(adsSnaps, "meta_ads", "link_clicks");
  const prevLinkClicks = sumMetric(prevAdsSnaps, "meta_ads", "link_clicks");
  const totalClicks = sumMetric(adsSnaps, "meta_ads", "clicks");
  const prevClicks = sumMetric(prevAdsSnaps, "meta_ads", "clicks");

  // Weighted averages for rates
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const prevAvgCtr =
    prevImpressions > 0 ? prevClicks / prevImpressions : 0;
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const prevAvgCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const prevAvgCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
  const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const prevCostPerLead = prevLeads > 0 ? prevSpend / prevLeads : 0;

  // byPlatform: usar o snapshot mais recente que contenha o campo byPlatform
  const snapsWithPlatform = adsSnaps
    .filter((s) => s.metrics?.byPlatform != null)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  const prevSnapsWithPlatform = prevAdsSnaps
    .filter((s) => s.metrics?.byPlatform != null)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));

  const byPlatformCurr = snapsWithPlatform[0]?.metrics?.byPlatform ?? {};
  const byPlatformPrev = prevSnapsWithPlatform[0]?.metrics?.byPlatform ?? {};

  function platformKpi(
    curr: Record<string, number> | undefined,
    prev: Record<string, number> | undefined,
    key: string
  ): KpiValue {
    return buildKpi(
      curr ? (curr[key] ?? null) : null,
      prev ? (prev[key] ?? null) : null,
      "integer"
    );
  }

  const fbPlatformCurr = byPlatformCurr?.facebook ?? {};
  const fbPlatformPrev = byPlatformPrev?.facebook ?? {};
  const igPlatformCurr = byPlatformCurr?.instagram ?? {};
  const igPlatformPrev = byPlatformPrev?.instagram ?? {};

  // spend timeline
  const spendTimeline = adsSnaps
    .filter((s) => s.metrics?.spend != null)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map((s) => ({ date: s.snapshot_date, value: Number(s.metrics.spend) || 0 }));

  // top campaigns by spend
  const topCampaigns = topByMetric(campaigns, (m) => m.spend ?? 0, 10).map((c) => {
    const results = c.metrics.leads ?? c.metrics.conversions ?? 0;
    const spend = c.metrics.spend ?? 0;
    return {
      id: c.provider_content_id,
      name: c.title ?? c.caption ?? c.provider_content_id,
      objective: (c.raw?.objective as string | null) ?? null,
      reach: c.metrics.reach ?? 0,
      impressions: c.metrics.impressions ?? 0,
      cpm: c.metrics.cpm ?? 0,
      frequency: c.metrics.frequency ?? 0,
      spend,
      results,
      costPerResult: results > 0 ? spend / results : 0,
    };
  });

  // top ads by spend
  const topAds = topByMetric(ads, (m) => m.spend ?? 0, 10).map((a) => {
    const results = a.metrics.leads ?? a.metrics.conversions ?? 0;
    const spend = a.metrics.spend ?? 0;
    return {
      id: a.provider_content_id,
      name: a.title ?? a.caption ?? a.provider_content_id,
      thumbnail: a.thumbnail_url ?? null,
      campaignId: (a.raw?.campaign_id as string | null) ?? null,
      reach: a.metrics.reach ?? 0,
      impressions: a.metrics.impressions ?? 0,
      clicks: a.metrics.clicks ?? a.metrics.link_clicks ?? 0,
      cpm: a.metrics.cpm ?? 0,
      cpc: a.metrics.cpc ?? 0,
      spend,
      results,
      costPerResult: results > 0 ? spend / results : 0,
    };
  });

  return {
    overview: {
      spend: buildKpi(totalSpend, prevSpend, "currency_brl"),
      leads: buildKpi(totalLeads, prevLeads, "integer"),
      costPerLead: buildKpi(costPerLead, prevCostPerLead, "currency_brl"),
      reach: buildKpi(totalReach, prevReach, "integer"),
      impressions: buildKpi(totalImpressions, prevImpressions, "integer"),
      linkClicks: buildKpi(totalLinkClicks, prevLinkClicks, "integer"),
      ctr: buildKpi(avgCtr, prevAvgCtr, "percent"),
      cpm: buildKpi(avgCpm, prevAvgCpm, "currency_brl"),
      cpc: buildKpi(avgCpc, prevAvgCpc, "currency_brl"),
      frequency: buildKpi(
        sumMetric(adsSnaps, "meta_ads", "frequency") / Math.max(adsSnaps.length, 1),
        sumMetric(prevAdsSnaps, "meta_ads", "frequency") / Math.max(prevAdsSnaps.length, 1),
        "decimal"
      ),
    },
    byPlatform: {
      facebook: {
        reach: platformKpi(fbPlatformCurr, fbPlatformPrev, "reach"),
        impressions: platformKpi(fbPlatformCurr, fbPlatformPrev, "impressions"),
        clicks: platformKpi(fbPlatformCurr, fbPlatformPrev, "clicks"),
        spend: buildKpi(
          fbPlatformCurr?.spend ?? null,
          fbPlatformPrev?.spend ?? null,
          "currency_brl"
        ),
      },
      instagram: {
        reach: platformKpi(igPlatformCurr, igPlatformPrev, "reach"),
        impressions: platformKpi(igPlatformCurr, igPlatformPrev, "impressions"),
        clicks: platformKpi(igPlatformCurr, igPlatformPrev, "clicks"),
        spend: buildKpi(
          igPlatformCurr?.spend ?? null,
          igPlatformPrev?.spend ?? null,
          "currency_brl"
        ),
      },
    },
    spendTimeline,
    topCampaigns,
    topAds,
  };
}

/* ── aggregatePanorama ───────────────────────────────────────────────────── */

export function aggregatePanorama(
  snapshots: SnapshotRow[],
  previousSnapshots: SnapshotRow[],
  allPosts: ContentRow[],
  previousPosts: ContentRow[]
): AgencyReportData["panorama"] {
  // reach total: IG reach + FB page reach + Meta Ads reach
  const igSnap = latestSnapshot(
    snapshots.filter((s) => s.provider === "instagram"),
    "instagram"
  );
  const prevIgSnap = latestSnapshot(
    previousSnapshots.filter((s) => s.provider === "instagram"),
    "instagram"
  );
  const fbSnap = latestSnapshot(
    snapshots.filter((s) => s.provider === "facebook"),
    "facebook"
  );
  const prevFbSnap = latestSnapshot(
    previousSnapshots.filter((s) => s.provider === "facebook"),
    "facebook"
  );

  const igReach = n(igSnap, "reach");
  const prevIgReach = n(prevIgSnap, "reach");
  const fbReach = n(fbSnap, "page_impressions_unique");
  const prevFbReach = n(prevFbSnap, "page_impressions_unique");
  const adsReach = sumMetric(
    snapshots.filter((s) => s.provider === "meta_ads"),
    "meta_ads",
    "reach"
  );
  const prevAdsReach = sumMetric(
    previousSnapshots.filter((s) => s.provider === "meta_ads"),
    "meta_ads",
    "reach"
  );

  const totalReach = igReach + fbReach + adsReach;
  const prevTotalReach = prevIgReach + prevFbReach + prevAdsReach;

  // engagement total: IG posts + FB posts
  const igPosts = allPosts.filter(
    (p) => p.provider === "instagram" && p.content_type !== "story"
  );
  const prevIgPosts = previousPosts.filter(
    (p) => p.provider === "instagram" && p.content_type !== "story"
  );
  const fbPosts = allPosts.filter((p) => p.provider === "facebook");
  const prevFbPosts = previousPosts.filter((p) => p.provider === "facebook");

  const igEng =
    sumContentMetric(igPosts, "likes") +
    sumContentMetric(igPosts, "comments") +
    sumContentMetric(igPosts, "saves") +
    sumContentMetric(igPosts, "shares");
  const prevIgEng =
    sumContentMetric(prevIgPosts, "likes") +
    sumContentMetric(prevIgPosts, "comments") +
    sumContentMetric(prevIgPosts, "saves") +
    sumContentMetric(prevIgPosts, "shares");
  const fbEng =
    sumContentMetric(fbPosts, "reactions") +
    sumContentMetric(fbPosts, "comments") +
    sumContentMetric(fbPosts, "shares");
  const prevFbEng =
    sumContentMetric(prevFbPosts, "reactions") +
    sumContentMetric(prevFbPosts, "comments") +
    sumContentMetric(prevFbPosts, "shares");

  const totalEngagement = igEng + fbEng;
  const prevTotalEngagement = prevIgEng + prevFbEng;

  // spend + leads from meta_ads
  const totalSpend = sumMetric(
    snapshots.filter((s) => s.provider === "meta_ads"),
    "meta_ads",
    "spend"
  );
  const prevSpend = sumMetric(
    previousSnapshots.filter((s) => s.provider === "meta_ads"),
    "meta_ads",
    "spend"
  );
  const totalLeads = sumMetric(
    snapshots.filter((s) => s.provider === "meta_ads"),
    "meta_ads",
    "leads"
  );
  const prevLeads = sumMetric(
    previousSnapshots.filter((s) => s.provider === "meta_ads"),
    "meta_ads",
    "leads"
  );
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : 0;

  return {
    totalReach: buildKpi(totalReach, prevTotalReach, "integer"),
    totalEngagement: buildKpi(totalEngagement, prevTotalEngagement, "integer"),
    totalSpend: buildKpi(totalSpend, prevSpend, "currency_brl"),
    totalLeads: buildKpi(totalLeads, prevLeads, "integer"),
    costPerLead: buildKpi(cpl, prevCpl, "currency_brl"),
    byNetwork: [
      {
        provider: "instagram",
        label: "Instagram",
        reach: buildKpi(igReach, prevIgReach, "integer"),
        engagement: buildKpi(igEng, prevIgEng, "integer"),
      },
      {
        provider: "facebook",
        label: "Facebook",
        reach: buildKpi(fbReach, prevFbReach, "integer"),
        engagement: buildKpi(fbEng, prevFbEng, "integer"),
      },
      {
        provider: "meta_ads",
        label: "Meta Ads",
        reach: buildKpi(adsReach, prevAdsReach, "integer"),
        engagement: buildKpi(0, 0, "integer"),
      },
    ],
  };
}
