/**
 * Types for the Analytics section (quantitative data dashboards).
 * Separate from /insights which is qualitative AI analysis.
 */

import type { ProviderKey, ContentType } from "./providers";

/* ── Overview (multi-provider) ─────────────────────────────────── */

export interface AnalyticsKPI {
  key: string;
  label: string;
  /** null quando a métrica é indisponível para o tipo de conta (ex: impressões em conta pessoal) */
  value: number | null;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  trend: "up" | "down" | "flat" | "unknown";
  icon: string;
  suffix?: string;
}

export interface ProviderSummary {
  provider: ProviderKey;
  displayName: string;
  color: string;
  connected: boolean;
  kpis: { label: string; value: string; raw: number }[];
}

export interface RecentPost {
  id: string;
  provider: ProviderKey;
  content_type: ContentType | string;
  title: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  url: string | null;
  published_at: string | null;
  metrics: Record<string, number>;
  engagement: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  [key: string]: string | number | null;
}

export interface AnalyticsOverviewData {
  kpis: AnalyticsKPI[];
  providers: ProviderSummary[];
  timeSeries: TimeSeriesDataPoint[];
  recentPosts: RecentPost[];
}

/* ── Provider deep dive ────────────────────────────────────────── */

export interface ProviderAnalyticsData {
  provider: ProviderKey;
  connected: boolean;
  kpis: AnalyticsKPI[];
  timeSeries: TimeSeriesDataPoint[];
  posts: ProviderPost[];
  breakdown: BreakdownItem[];
  heatmap: HeatmapData | null;
  funnelStages: FunnelStage[] | null;
  topHashtags: HashtagStat[] | null;
  trafficSources: BreakdownItem[] | null;
  topPages: TopPageItem[] | null;
  campaigns: CampaignRow[] | null;
}

export interface ProviderPost {
  id: string;
  content_type: ContentType | string;
  title: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  url: string | null;
  published_at: string | null;
  metrics: Record<string, number>;
}

export interface BreakdownItem {
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface HeatmapData {
  /** 7 rows (days) x 24 cols (hours) */
  grid: number[][];
  dayLabels: string[];
  hourLabels: string[];
}

export interface FunnelStage {
  name: string;
  count: number;
  color: string;
}

export interface HashtagStat {
  tag: string;
  count: number;
}

export interface TopPageItem {
  path: string;
  views: number;
  avgDuration: number;
}

export interface CampaignRow {
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

/* ── Instagram Advanced Analytics ─────────────────────────────── */

export interface InstagramEngagementBreakdown {
  avgLikes: number;
  avgComments: number;
  avgSaves: number;
  avgShares: number;
}

export interface InstagramFormatPerformance {
  format: string;
  label: string;
  count: number;
  avgEngagement: number;
  avgReach: number;
  bestPost: { thumbnail: string; engagement: number; permalink: string } | null;
}

export interface InstagramTopPost {
  id: string;
  thumbnail: string;
  caption: string;
  format: string;
  label: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  engagementRate: number;
  date: string;
  permalink: string;
}

export interface InstagramSaveRateAnalysis {
  avgSaveRate: number;
  bestSaveRatePosts: Array<{
    thumbnail: string;
    saveRate: number;
    caption: string;
    permalink: string;
  }>;
}

export interface InstagramCaptionAnalysis {
  avgLength: number;
  withCTA: number;
  withoutCTA: number;
  ctaEngagement: number;
  noCtaEngagement: number;
  topHashtags: Array<{ tag: string; count: number; avgEngagement: number }>;
}

export interface InstagramAdvancedAnalytics {
  engagementBreakdown: InstagramEngagementBreakdown;
  formatPerformance: InstagramFormatPerformance[];
  topPosts: InstagramTopPost[];
  saveRateAnalysis: InstagramSaveRateAnalysis;
  captionAnalysis: InstagramCaptionAnalysis;
}

export interface ProviderAnalyticsDataWithInstagram extends ProviderAnalyticsData {
  instagramAdvanced?: InstagramAdvancedAnalytics;
}
