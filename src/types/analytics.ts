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

export interface ProviderKPI {
  label: string;
  value: string;
  raw: number;
  /** Ícone lucide (nome string) — opcional */
  icon?: string;
}

export interface ProviderSummary {
  provider: ProviderKey;
  displayName: string;
  color: string;
  connected: boolean;
  /** KPIs legados (compat) */
  kpis: ProviderKPI[];
  /**
   * KPIs do mês corrente (do dia 1 até hoje) agrupados por provider.
   * Substitui os kpis genéricos na Visão por Rede.
   */
  monthlyKpis: ProviderKPI[];
  /** ISO string do snapshot mais recente do mês (undefined = sem dados) */
  lastSnapshotAt?: string;
  /** true quando a conexão existe mas ainda não há snapshot no mês corrente */
  awaitingFirstSync?: boolean;
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

export interface ContentPerformanceKPI {
  /** Chave estável usada por consumidores (ex: "save_rate", "posts_count"). */
  key?: string;
  label: string;
  value: number | string;
  raw: number;
  delta: number | null;
  deltaPercent: number | null;
  trend: "up" | "down" | "flat" | "unknown";
}

export interface ContentPerformanceSummary {
  provider: "content";
  label: string;
  kpis: ContentPerformanceKPI[];
}

export interface AnalyticsOverviewData {
  kpis: AnalyticsKPI[];
  providers: ProviderSummary[];
  timeSeries: TimeSeriesDataPoint[];
  recentPosts: RecentPost[];
  contentPerformance: ContentPerformanceSummary;
  syncStatus: "ok" | "pending" | "error";
  lastSyncedAt: string | null;
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
  insightsSummary: InsightsSummary | null;
  /** Bloco avançado disponível só para provider="instagram" */
  instagramAdvanced?: InstagramAdvancedAnalytics;
  /** Bloco avançado disponível só para provider="meta_ads" */
  metaAdsAdvanced?: MetaAdsAdvanced;
  /** Bloco avançado disponível só para provider="facebook" */
  facebookAdvanced?: FacebookAdvanced;
  /** Bloco avançado disponível só para provider="crm" */
  crmAdvanced?: CrmAdvanced;
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

/** @deprecated Use ProviderAnalyticsData diretamente — instagramAdvanced é campo opcional. Mantido como alias por backwards-compat. */
export type ProviderAnalyticsDataWithInstagram = ProviderAnalyticsData;

/* ── Meta Ads Advanced Analytics ──────────────────────────────── */

export interface AdCampaignSummary {
  campaignId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  cpc: number; // R$ por clique
  cpm: number; // R$ por mil impressões
  conversions: number;
  costPerConversion: number | null;
  roas: number | null; // valor de conversão / spend
  reach: number;
  frequency: number;
  startDate: string | null;
  endDate: string | null;
}

export interface MetaAdsAdvanced {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgCTR: number; // weighted by impressions
  avgCPC: number; // weighted by clicks
  avgCPM: number; // weighted by impressions
  totalConversions: number;
  totalConversionValue: number;
  avgROAS: number | null;
  campaigns: AdCampaignSummary[]; // top 10 do período por spend
  spendByDay: Array<{ date: string; spend: number; conversions: number }>;
  topPerformingCampaign: AdCampaignSummary | null; // maior ROAS, pelo menos 5 conversões
  worstPerformingCampaign: AdCampaignSummary | null; // menor ROAS, pelo menos 100 R$ spend
}

/* ── Facebook Advanced Analytics ──────────────────────────────── */

export interface FacebookAdvanced {
  totalLikes: number;
  totalReactions: number;
  totalComments: number;
  totalShares: number;
  pageImpressions: number;
  pageEngagedUsers: number;
  pageFans: number;
  pageNewFans: number;
  postsByType: Record<string, number>;
  topPosts: Array<{
    id: string;
    message: string;
    permalink: string | null;
    publishedAt: string;
    reactions: number;
    comments: number;
    shares: number;
    reach: number;
  }>;
}

/* ── CRM Advanced Analytics ───────────────────────────────────── */

export interface CrmFunnelStage {
  stage: string;
  label: string;
  count: number;
  color: string;
}

export interface CrmLeadOrigin {
  origin: string;
  label: string;
  count: number;
  pct: number;
}

export interface CrmAdvanced {
  funnel: CrmFunnelStage[];
  leadsByOrigin: CrmLeadOrigin[];
  leadsByTemperature: { hot: number; warm: number; cold: number };
  conversion: {
    rate: number;
    won: number;
    revenue: number;
    /** null quando won = 0 para evitar divisão por zero */
    avgTicket: number | null;
  };
  email: {
    campaigns: number;
    sent: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  whatsapp: {
    sent: number;
    delivered: number;
    deliveryRate: number;
    replies: number;
    replyRate: number;
    conversions: number;
  };
  greatpages: { leads: number; landingPages: number };
}

/* ── Strategic Insights ────────────────────────────────────────── */

export interface StrategicInsight {
  id: string;
  category: "growth" | "engagement" | "content" | "timing" | "anomaly";
  severity: "positive" | "neutral" | "warning" | "critical";
  title: string;
  description: string;
  metric?: string;
  actionable?: string;
}

export interface InsightsSummary {
  bestPostingDay: number | null;
  bestPostingHour: number | null;
  formatWinner: { type: string; label: string; engagementRate: number } | null;
  growthRate: number | null;
  engagementTrend: "accelerating" | "stable" | "decelerating" | null;
  avgPostingFrequency: number | null;
  topCTAs: string[];
  insights: StrategicInsight[];
}
