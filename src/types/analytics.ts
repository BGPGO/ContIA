/**
 * Types for the Analytics section (quantitative data dashboards).
 * Separate from /insights which is qualitative AI analysis.
 */

import type { ProviderKey, ContentType } from "./providers";

/* ── Overview (multi-provider) ─────────────────────────────────── */

export interface AnalyticsKPI {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "flat";
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
  [key: string]: string | number;
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
