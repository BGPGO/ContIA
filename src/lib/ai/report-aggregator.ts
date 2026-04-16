/**
 * Helpers de pre-processamento para relatorios — sem IA, TypeScript puro.
 * Agrega metricas, calcula deltas, identifica outliers, computa hash.
 * Inclui analises enriquecidas: performance por tipo, captions/CTAs, frequencia, engagement.
 */

import { createHash } from "crypto";
import type { ContentItem, ProviderKey, ProviderSnapshot } from "@/types/providers";
import type { Comparison, ReportType } from "@/types/reports";

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface AggregatedProvider {
  totalEngagement: number;
  avgEngagement: number;
  contentCount: number;
  followers?: number;
  topMetrics: Record<string, number>;
}

export interface ReportInputForHash {
  empresaId: string;
  periodStart: Date;
  periodEnd: Date;
  providers: ProviderKey[];
  reportType: ReportType;
  contentIds: string[];
  snapshotIds: string[];
}

/* ── Enriched Analysis Types ─────────────────────────────────────────────── */

export interface ContentPerformanceByType {
  type: string;
  count: number;
  avgEngagement: number;
  bestPost: string | null;
}

export interface ContentPerformanceByTime {
  key: string | number;
  avgEngagement: number;
  postCount: number;
}

export interface ContentPerformance {
  byType: ContentPerformanceByType[];
  byDayOfWeek: { day: string; avgEngagement: number; postCount: number }[];
  byHour: { hour: number; avgEngagement: number; postCount: number }[];
}

export interface CaptionAnalysis {
  avgLength: number;
  withCTA: number;
  withoutCTA: number;
  ctaEngagementAvg: number;
  noCtaEngagementAvg: number;
  withHashtags: number;
  avgHashtagCount: number;
  topHashtags: { tag: string; count: number; avgEngagement: number }[];
}

export interface EngagementBreakdown {
  avgLikes: number;
  avgComments: number;
  avgSaves: number;
  avgShares: number;
  engagementRate: number;
  likesToCommentsRatio: number;
}

export interface PostingFrequency {
  postsPerWeek: number;
  longestGap: { days: number; from: string; to: string } | null;
  mostActiveDay: string;
  leastActiveDay: string;
}

export interface GrowthMetrics {
  followerGrowthRate: number;
  projectedFollowers30d: number;
}

export interface EnrichedAnalysis {
  aggregated: Record<string, AggregatedProvider>;
  deltas: Comparison[];
  topContent: ContentItem[];
  outliers: { high: ContentItem[]; low: ContentItem[] };
  contentPerformance: ContentPerformance;
  captionAnalysis: CaptionAnalysis;
  engagementBreakdown: EngagementBreakdown;
  postingFrequency: PostingFrequency;
  growthMetrics: GrowthMetrics;
}

/* ── Engagement helper ───────────────────────────────────────────────────── */

function getEngagement(item: ContentItem): number {
  const m = item.metrics;
  return (
    (m.likes ?? m.like_count ?? 0) +
    (m.comments ?? m.comments_count ?? 0) +
    (m.shares ?? m.share_count ?? 0) +
    (m.saves ?? m.saved ?? 0)
  );
}

/* ── aggregateByProvider ─────────────────────────────────────────────────── */

export function aggregateByProvider(
  content: ContentItem[],
  snapshots: ProviderSnapshot[]
): Record<string, AggregatedProvider> {
  const result: Record<string, AggregatedProvider> = {};

  // Group content by provider
  const byProvider = new Map<string, ContentItem[]>();
  for (const item of content) {
    const list = byProvider.get(item.provider) ?? [];
    list.push(item);
    byProvider.set(item.provider, list);
  }

  for (const [provider, items] of byProvider) {
    const engagements = items.map(getEngagement);
    const totalEngagement = engagements.reduce((a, b) => a + b, 0);

    // Aggregate all metric keys
    const topMetrics: Record<string, number> = {};
    for (const item of items) {
      for (const [key, val] of Object.entries(item.metrics)) {
        topMetrics[key] = (topMetrics[key] ?? 0) + val;
      }
    }

    // Get latest snapshot for follower count
    const providerSnapshots = snapshots
      .filter((s) => s.provider === provider)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
    const latestSnapshot = providerSnapshots[0];

    result[provider] = {
      totalEngagement,
      avgEngagement: items.length > 0 ? totalEngagement / items.length : 0,
      contentCount: items.length,
      followers: latestSnapshot?.metrics?.followers ?? latestSnapshot?.metrics?.followers_count,
      topMetrics,
    };
  }

  return result;
}

/* ── calculateDeltas ─────────────────────────────────────────────────────── */

export function calculateDeltas(
  currentAgg: Record<string, AggregatedProvider>,
  previousAgg: Record<string, AggregatedProvider>
): Comparison[] {
  const comparisons: Comparison[] = [];

  // Collect all providers
  const allProviders = new Set([
    ...Object.keys(currentAgg),
    ...Object.keys(previousAgg),
  ]);

  for (const provider of allProviders) {
    const curr = currentAgg[provider];
    const prev = previousAgg[provider];
    if (!curr || !prev) continue;

    // Compare key aggregate metrics
    const metricsToCompare: Array<{ metric: string; current: number; previous: number }> = [
      {
        metric: `${provider}_engagement_total`,
        current: curr.totalEngagement,
        previous: prev.totalEngagement,
      },
      {
        metric: `${provider}_engagement_avg`,
        current: curr.avgEngagement,
        previous: prev.avgEngagement,
      },
      {
        metric: `${provider}_content_count`,
        current: curr.contentCount,
        previous: prev.contentCount,
      },
    ];

    // Followers
    if (curr.followers != null && prev.followers != null) {
      metricsToCompare.push({
        metric: `${provider}_followers`,
        current: curr.followers,
        previous: prev.followers,
      });
    }

    // Compare individual top metrics
    const allMetricKeys = new Set([
      ...Object.keys(curr.topMetrics),
      ...Object.keys(prev.topMetrics),
    ]);
    for (const key of allMetricKeys) {
      const c = curr.topMetrics[key] ?? 0;
      const p = prev.topMetrics[key] ?? 0;
      if (c === 0 && p === 0) continue;
      metricsToCompare.push({
        metric: `${provider}_${key}`,
        current: c,
        previous: p,
      });
    }

    for (const { metric, current, previous } of metricsToCompare) {
      const delta = current - previous;
      const deltaPercent = previous !== 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
      const trend: "up" | "down" | "flat" =
        Math.abs(deltaPercent) < 3 ? "flat" : delta > 0 ? "up" : "down";

      comparisons.push({
        metric,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        deltaPercent: Math.round(deltaPercent * 100) / 100,
        trend,
      });
    }
  }

  return comparisons;
}

/* ── findTopContent ──────────────────────────────────────────────────────── */

export function findTopContent(content: ContentItem[], limit: number = 5): ContentItem[] {
  return [...content].sort((a, b) => getEngagement(b) - getEngagement(a)).slice(0, limit);
}

/* ── findOutliers ────────────────────────────────────────────────────────── */

export function findOutliers(content: ContentItem[]): {
  high: ContentItem[];
  low: ContentItem[];
} {
  if (content.length < 3) return { high: [], low: [] };

  const engagements = content.map(getEngagement);
  const mean = engagements.reduce((a, b) => a + b, 0) / engagements.length;
  const variance =
    engagements.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / engagements.length;
  const stdDev = Math.sqrt(variance);

  const threshold = 1.5; // 1.5 standard deviations
  const highThreshold = mean + stdDev * threshold;
  const lowThreshold = mean - stdDev * threshold;

  const high: ContentItem[] = [];
  const low: ContentItem[] = [];

  for (let i = 0; i < content.length; i++) {
    if (engagements[i] > highThreshold) high.push(content[i]);
    else if (engagements[i] < lowThreshold) low.push(content[i]);
  }

  return {
    high: high.sort((a, b) => getEngagement(b) - getEngagement(a)).slice(0, 5),
    low: low.sort((a, b) => getEngagement(a) - getEngagement(b)).slice(0, 5),
  };
}

/* ── computeInputsHash ──────────────────────────────────────────────────── */

export function computeInputsHash(input: ReportInputForHash): string {
  const payload = JSON.stringify({
    empresaId: input.empresaId,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    providers: [...input.providers].sort(),
    reportType: input.reportType,
    contentIds: [...input.contentIds].sort(),
    snapshotIds: [...input.snapshotIds].sort(),
  });

  return createHash("sha256").update(payload).digest("hex");
}

/* ── CTA Detection ──────────────────────────────────────────────────────── */

const CTA_PATTERNS: RegExp[] = [
  /link\s*(na|in)\s*bio/i,
  /acesse/i,
  /clique/i,
  /confira/i,
  /saiba\s+mais/i,
  /conhe[cç]a/i,
  /cadastr[eo]/i,
  /inscreva/i,
  /baixe/i,
  /download/i,
  /compre/i,
  /garanta/i,
  /aproveite/i,
  /mande\s+(uma\s+)?mensagem/i,
  /chama\s+no\s+dm/i,
  /\bdm\b/i,
  /fale\s+conosco/i,
  /entre\s+em\s+contato/i,
  /coment[ea]/i,
  /compartilh[ea]/i,
  /salv[ea]/i,
  /arrast[ea]\s+(pra|para)\s+cima/i,
  /swipe\s+up/i,
  /https?:\/\//i,
  /[👆👇🔗🔽⬇️➡️]/u,
];

export function detectCTA(caption: string): boolean {
  if (!caption) return false;
  return CTA_PATTERNS.some((pattern) => pattern.test(caption));
}

/* ── Hashtag extraction ─────────────────────────────────────────────────── */

function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map((h) => h.toLowerCase()) : [];
}

/* ── Metric accessors (safe) ────────────────────────────────────────────── */

function getLikes(m: Record<string, number>): number {
  return m.likes ?? m.like_count ?? 0;
}

function getComments(m: Record<string, number>): number {
  return m.comments ?? m.comments_count ?? 0;
}

function getShares(m: Record<string, number>): number {
  return m.shares ?? m.share_count ?? 0;
}

function getSaves(m: Record<string, number>): number {
  return m.saves ?? m.saved ?? 0;
}

/* ── analyzeContentPerformance ──────────────────────────────────────────── */

const DAY_NAMES = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

export function analyzeContentPerformance(content: ContentItem[]): ContentPerformance {
  // By type
  const typeMap = new Map<string, { engagements: number[]; bestPost: string | null; bestEng: number }>();
  for (const item of content) {
    const eng = getEngagement(item);
    const entry = typeMap.get(item.content_type) ?? { engagements: [], bestPost: null, bestEng: 0 };
    entry.engagements.push(eng);
    if (eng > entry.bestEng) {
      entry.bestEng = eng;
      entry.bestPost = item.title ?? item.caption?.slice(0, 60) ?? item.id;
    }
    typeMap.set(item.content_type, entry);
  }

  const byType: ContentPerformanceByType[] = [];
  for (const [type, data] of typeMap) {
    const sum = data.engagements.reduce((a, b) => a + b, 0);
    byType.push({
      type,
      count: data.engagements.length,
      avgEngagement: data.engagements.length > 0 ? Math.round(sum / data.engagements.length) : 0,
      bestPost: data.bestPost,
    });
  }
  byType.sort((a, b) => b.avgEngagement - a.avgEngagement);

  // By day of week
  const dayMap = new Map<number, number[]>();
  for (const item of content) {
    if (!item.published_at) continue;
    const day = new Date(item.published_at).getDay();
    const list = dayMap.get(day) ?? [];
    list.push(getEngagement(item));
    dayMap.set(day, list);
  }

  const byDayOfWeek: { day: string; avgEngagement: number; postCount: number }[] = [];
  for (let d = 0; d < 7; d++) {
    const engs = dayMap.get(d) ?? [];
    const sum = engs.reduce((a, b) => a + b, 0);
    byDayOfWeek.push({
      day: DAY_NAMES[d],
      avgEngagement: engs.length > 0 ? Math.round(sum / engs.length) : 0,
      postCount: engs.length,
    });
  }

  // By hour
  const hourMap = new Map<number, number[]>();
  for (const item of content) {
    if (!item.published_at) continue;
    const hour = new Date(item.published_at).getHours();
    const list = hourMap.get(hour) ?? [];
    list.push(getEngagement(item));
    hourMap.set(hour, list);
  }

  const byHour: { hour: number; avgEngagement: number; postCount: number }[] = [];
  for (const [hour, engs] of hourMap) {
    const sum = engs.reduce((a, b) => a + b, 0);
    byHour.push({
      hour,
      avgEngagement: engs.length > 0 ? Math.round(sum / engs.length) : 0,
      postCount: engs.length,
    });
  }
  byHour.sort((a, b) => b.avgEngagement - a.avgEngagement);

  return { byType, byDayOfWeek, byHour };
}

/* ── analyzeCaptions ────────────────────────────────────────────────────── */

export function analyzeCaptions(content: ContentItem[]): CaptionAnalysis {
  const captions = content.filter((c) => c.caption && c.caption.length > 0);

  const totalLength = captions.reduce((sum, c) => sum + (c.caption?.length ?? 0), 0);
  const avgLength = captions.length > 0 ? Math.round(totalLength / captions.length) : 0;

  let withCTA = 0;
  let withoutCTA = 0;
  let ctaEngSum = 0;
  let noCtaEngSum = 0;

  for (const item of content) {
    const hasCta = detectCTA(item.caption ?? "");
    const eng = getEngagement(item);
    if (hasCta) {
      withCTA++;
      ctaEngSum += eng;
    } else {
      withoutCTA++;
      noCtaEngSum += eng;
    }
  }

  // Hashtag analysis
  const hashtagEngMap = new Map<string, { count: number; totalEng: number }>();
  let withHashtags = 0;
  let totalHashtagCount = 0;

  for (const item of content) {
    const tags = extractHashtags(item.caption);
    if (tags.length > 0) {
      withHashtags++;
      totalHashtagCount += tags.length;
      const eng = getEngagement(item);
      for (const tag of tags) {
        const entry = hashtagEngMap.get(tag) ?? { count: 0, totalEng: 0 };
        entry.count++;
        entry.totalEng += eng;
        hashtagEngMap.set(tag, entry);
      }
    }
  }

  const topHashtags: { tag: string; count: number; avgEngagement: number }[] = [];
  for (const [tag, data] of hashtagEngMap) {
    topHashtags.push({
      tag,
      count: data.count,
      avgEngagement: data.count > 0 ? Math.round(data.totalEng / data.count) : 0,
    });
  }
  topHashtags.sort((a, b) => b.avgEngagement - a.avgEngagement);

  return {
    avgLength,
    withCTA,
    withoutCTA,
    ctaEngagementAvg: withCTA > 0 ? Math.round(ctaEngSum / withCTA) : 0,
    noCtaEngagementAvg: withoutCTA > 0 ? Math.round(noCtaEngSum / withoutCTA) : 0,
    withHashtags,
    avgHashtagCount: withHashtags > 0 ? Math.round((totalHashtagCount / withHashtags) * 10) / 10 : 0,
    topHashtags: topHashtags.slice(0, 15),
  };
}

/* ── analyzeEngagement ──────────────────────────────────────────────────── */

export function analyzeEngagement(content: ContentItem[], followers: number): EngagementBreakdown {
  if (content.length === 0) {
    return {
      avgLikes: 0,
      avgComments: 0,
      avgSaves: 0,
      avgShares: 0,
      engagementRate: 0,
      likesToCommentsRatio: 0,
    };
  }

  let totalLikes = 0;
  let totalComments = 0;
  let totalSaves = 0;
  let totalShares = 0;

  for (const item of content) {
    totalLikes += getLikes(item.metrics);
    totalComments += getComments(item.metrics);
    totalSaves += getSaves(item.metrics);
    totalShares += getShares(item.metrics);
  }

  const n = content.length;
  const avgLikes = Math.round(totalLikes / n);
  const avgComments = Math.round(totalComments / n);
  const avgSaves = Math.round(totalSaves / n);
  const avgShares = Math.round(totalShares / n);

  const totalEngagement = totalLikes + totalComments + totalSaves + totalShares;
  const engagementRate =
    followers > 0 ? Math.round(((totalEngagement / n) / followers) * 10000) / 100 : 0;

  const likesToCommentsRatio =
    totalComments > 0 ? Math.round((totalLikes / totalComments) * 10) / 10 : 0;

  return {
    avgLikes,
    avgComments,
    avgSaves,
    avgShares,
    engagementRate,
    likesToCommentsRatio,
  };
}

/* ── analyzePostingFrequency ────────────────────────────────────────────── */

export function analyzePostingFrequency(content: ContentItem[]): PostingFrequency {
  const dated = content
    .filter((c) => c.published_at)
    .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime());

  if (dated.length === 0) {
    return {
      postsPerWeek: 0,
      longestGap: null,
      mostActiveDay: "N/A",
      leastActiveDay: "N/A",
    };
  }

  const firstDate = new Date(dated[0].published_at!);
  const lastDate = new Date(dated[dated.length - 1].published_at!);
  const spanDays = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const postsPerWeek = Math.round((dated.length / spanDays) * 7 * 10) / 10;

  // Longest gap
  let longestGap: { days: number; from: string; to: string } | null = null;
  for (let i = 1; i < dated.length; i++) {
    const prev = new Date(dated[i - 1].published_at!);
    const curr = new Date(dated[i].published_at!);
    const gapDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (!longestGap || gapDays > longestGap.days) {
      longestGap = {
        days: gapDays,
        from: prev.toISOString().split("T")[0],
        to: curr.toISOString().split("T")[0],
      };
    }
  }

  // Day counts
  const dayCounts = new Array<number>(7).fill(0);
  for (const item of dated) {
    dayCounts[new Date(item.published_at!).getDay()]++;
  }

  let mostIdx = 0;
  let leastIdx = 0;
  for (let d = 0; d < 7; d++) {
    if (dayCounts[d] > dayCounts[mostIdx]) mostIdx = d;
    if (dayCounts[d] < dayCounts[leastIdx]) leastIdx = d;
  }

  return {
    postsPerWeek,
    longestGap,
    mostActiveDay: DAY_NAMES[mostIdx],
    leastActiveDay: DAY_NAMES[leastIdx],
  };
}

/* ── analyzeGrowth ──────────────────────────────────────────────────────── */

export function analyzeGrowth(
  snapshots: ProviderSnapshot[],
  provider: string
): GrowthMetrics {
  const sorted = snapshots
    .filter((s) => s.provider === provider)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (sorted.length < 2) {
    const current = sorted[0]?.metrics?.followers ?? sorted[0]?.metrics?.followers_count ?? 0;
    return { followerGrowthRate: 0, projectedFollowers30d: current };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const followersFirst = first.metrics.followers ?? first.metrics.followers_count ?? 0;
  const followersLast = last.metrics.followers ?? last.metrics.followers_count ?? 0;

  const daySpan = Math.max(
    1,
    (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const growthRate =
    followersFirst > 0
      ? Math.round(((followersLast - followersFirst) / followersFirst) * 10000) / 100
      : 0;

  const dailyGrowth = (followersLast - followersFirst) / daySpan;
  const projectedFollowers30d = Math.round(followersLast + dailyGrowth * 30);

  return { followerGrowthRate: growthRate, projectedFollowers30d };
}

/* ── buildEnrichedAnalysis — compila tudo ────────────────────────────────── */

export function buildEnrichedAnalysis(
  content: ContentItem[],
  snapshots: ProviderSnapshot[],
  previousContent: ContentItem[] | undefined,
  previousSnapshots: ProviderSnapshot[] | undefined
): EnrichedAnalysis {
  const aggregated = aggregateByProvider(content, snapshots);

  // Get total followers across providers
  let totalFollowers = 0;
  let primaryProvider = "";
  for (const [prov, agg] of Object.entries(aggregated)) {
    if (agg.followers && agg.followers > totalFollowers) {
      totalFollowers = agg.followers;
      primaryProvider = prov;
    }
  }

  const previousAgg =
    previousContent && previousContent.length > 0
      ? aggregateByProvider(previousContent, previousSnapshots ?? [])
      : undefined;

  const deltas = previousAgg ? calculateDeltas(aggregated, previousAgg) : [];

  return {
    aggregated,
    deltas,
    topContent: findTopContent(content, 5),
    outliers: findOutliers(content),
    contentPerformance: analyzeContentPerformance(content),
    captionAnalysis: analyzeCaptions(content),
    engagementBreakdown: analyzeEngagement(content, totalFollowers),
    postingFrequency: analyzePostingFrequency(content),
    growthMetrics: primaryProvider
      ? analyzeGrowth(snapshots, primaryProvider)
      : { followerGrowthRate: 0, projectedFollowers30d: 0 },
  };
}
