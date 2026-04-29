"use client";

import { Suspense, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  RefreshCw,
  Cable,
  Camera,
  Users,
  Globe,
  Music2,
  Play,
  Share2,
  DollarSign,
  Heart,
  MessageCircle,
  Bookmark,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useProviderAnalytics } from "@/hooks/useProviderAnalytics";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";

/* ── Componentes insights ── */
import { KPICard } from "@/components/insights/KPICard";
import { TimeSeriesChart } from "@/components/insights/TimeSeriesChart";
import { FollowersDeltaChart } from "@/components/insights/FollowersDeltaChart";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { BestTimeHeatmap } from "@/components/insights/BestTimeHeatmap";
import { ContentTypePerformance } from "@/components/insights/ContentTypePerformance";
import { AnomalyBadge } from "@/components/insights/AnomalyBadge";
import { EmptyState } from "@/components/insights/EmptyState";
import { StrategicInsightsCard } from "@/components/insights/StrategicInsightsCard";
import { SectionHeader } from "@/components/insights/SectionHeader";

/* ── Componentes analytics ── */
import { BreakdownPie } from "@/components/analytics/BreakdownPie";
import { PostsTable } from "@/components/analytics/PostsTable";
import { SaveRateCard } from "@/components/analytics/SaveRateCard";
import { EngagementBreakdown } from "@/components/analytics/EngagementBreakdown";
import { FormatPerformanceCards } from "@/components/analytics/FormatPerformanceCards";
import { SpendTimelineChart } from "@/components/analytics/SpendTimelineChart";
import { CampaignsTable } from "@/components/analytics/CampaignsTable";
import { AdsKPIHero } from "@/components/analytics/AdsKPIHero";
import { SalesFunnelChart } from "@/components/analytics/SalesFunnelChart";
import { LeadsByOriginCard } from "@/components/analytics/LeadsByOriginCard";
import { LeadTemperatureGauge } from "@/components/analytics/LeadTemperatureGauge";
import { EmailEngagementCard } from "@/components/analytics/EmailEngagementCard";
import { WhatsAppEngagementCard } from "@/components/analytics/WhatsAppEngagementCard";
import {
  ExportReportButton,
  type ExportScope,
} from "@/components/analytics/ExportReportButton";

/* ── Tipos ── */
import type { ProviderKey } from "@/types/providers";
import type { AnalyticsKPI, ProviderPost, AdCampaignSummary, CrmAdvanced } from "@/types/analytics";
import type { Anomaly } from "@/components/insights/AnomalyBadge";
import type { HeatmapCell } from "@/components/insights/BestTimeHeatmap";
import type { PostsTableRow } from "@/components/analytics/PostsTable";
import type { FormatItem } from "@/components/analytics/FormatPerformanceCards";
import type { ContentTypeData } from "@/components/insights/ContentTypePerformance";
import type { BreakdownPieItem } from "@/components/analytics/BreakdownPie";

/* ── Layout type ── */
type LayoutType = "crm" | "paid" | "social" | "default";

/* ── Label mapeamento de tipo de conteúdo ── */
const CONTENT_TYPE_LABELS: Record<string, string> = {
  reel: "Reels",
  post: "Posts",
  carousel: "Carrossel",
  story: "Stories",
  video: "Videos",
  image: "Imagens",
  photo: "Fotos",
};

function getContentTypeLabel(type: string): string {
  return CONTENT_TYPE_LABELS[type.toLowerCase()] ?? type;
}

/* ── Ícone do provider ── */
function getProviderIcon(provider: string): LucideIcon {
  switch (provider) {
    case "instagram":
      return Camera;
    case "linkedin":
      return Users;
    case "facebook":
      return Share2;
    case "youtube":
      return Play;
    case "tiktok":
      return Music2;
    case "meta_ads":
    case "google_ads":
      return DollarSign;
    default:
      return Globe;
  }
}

/* ── Título do provider ── */
function getProviderTitle(provider: string, meta: { displayName: string } | undefined): string {
  switch (provider) {
    case "meta_ads":
      return "Analytics — Meta Ads";
    case "google_ads":
      return "Analytics — Google Ads";
    case "facebook":
      return "Analytics — Facebook";
    case "instagram":
      return "Analytics — Instagram";
    default:
      return meta ? `Analytics — ${meta.displayName}` : "Analytics";
  }
}

/* ── Skeleton de loading ── */
function ProviderSkeleton() {
  return (
    <div className="space-y-5 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-bg-card border border-border rounded-xl" />
      <div className="h-60 bg-bg-card border border-border rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-52 bg-bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-bg-card border border-border rounded-xl" />
    </div>
  );
}

/* ── Animação helper ── */
function sectionAnim(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  } as const;
}

/* ── Cálculos client-side ── */

function computeAnomalies(kpis: AnalyticsKPI[]): Anomaly[] {
  const detected: Anomaly[] = [];
  const now = new Date().toISOString();

  for (const kpi of kpis) {
    if (kpi.deltaPercent === null || kpi.value === null || kpi.previousValue === null)
      continue;
    const absDelta = Math.abs(kpi.deltaPercent);
    if (absDelta <= 30) continue;

    const direction: "spike" | "drop" = kpi.deltaPercent > 0 ? "spike" : "drop";
    const severity: "high" | "medium" | "low" =
      absDelta > 50 ? "high" : absDelta > 30 ? "medium" : "low";

    detected.push({
      metric: kpi.key,
      metricLabel: kpi.label,
      direction,
      severity,
      currentValue: kpi.value,
      expectedValue: kpi.previousValue,
      deviationPercent: kpi.deltaPercent,
      detectedAt: now,
    });
  }

  const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
  detected.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return detected.slice(0, 3);
}

function computeBreakdownPieData(posts: ProviderPost[]): BreakdownPieItem[] {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const key = (p.content_type ?? "post").toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([type, value]) => ({
    label: getContentTypeLabel(type),
    value,
  }));
}

function computeEngagementTotals(posts: ProviderPost[]) {
  let likes = 0;
  let comments = 0;
  let saves = 0;
  let shares = 0;
  for (const p of posts) {
    const m = p.metrics ?? {};
    likes += m.likes ?? m.like_count ?? 0;
    comments += m.comments ?? m.comments_count ?? 0;
    saves += m.saves ?? 0;
    shares += m.shares ?? m.share_count ?? 0;
  }
  return { likes, comments, saves, shares };
}

function computeFormatItems(posts: ProviderPost[]): FormatItem[] {
  const groups: Record<
    string,
    { engSum: number; reachSum: number; count: number }
  > = {};

  for (const p of posts) {
    const type = (p.content_type ?? "post").toLowerCase();
    const m = p.metrics ?? {};
    const likes = m.likes ?? m.like_count ?? 0;
    const comments = m.comments ?? m.comments_count ?? 0;
    const saves = m.saves ?? 0;
    const shares = m.shares ?? m.share_count ?? 0;
    const reach = m.reach ?? 0;
    const eng = likes + comments + saves + shares;
    const engRate = reach > 0 ? eng / reach : 0;

    if (!groups[type]) groups[type] = { engSum: 0, reachSum: 0, count: 0 };
    groups[type].engSum += engRate;
    groups[type].reachSum += reach;
    groups[type].count += 1;
  }

  return Object.entries(groups).map(([type, g]) => ({
    type,
    label: getContentTypeLabel(type),
    count: g.count,
    avgEngagement: g.count > 0 ? g.engSum / g.count : 0,
    avgReach: g.count > 0 ? Math.round(g.reachSum / g.count) : 0,
  }));
}

function computeContentTypeData(posts: ProviderPost[]): ContentTypeData[] {
  const groups: Record<
    string,
    { engRateSum: number; reachSum: number; count: number }
  > = {};

  for (const p of posts) {
    const type = (p.content_type ?? "post").toLowerCase();
    const m = p.metrics ?? {};
    const likes = m.likes ?? m.like_count ?? 0;
    const comments = m.comments ?? m.comments_count ?? 0;
    const saves = m.saves ?? 0;
    const shares = m.shares ?? m.share_count ?? 0;
    const reach = m.reach ?? 0;
    const eng = likes + comments + saves + shares;
    const engRate = reach > 0 ? eng / reach : 0;

    if (!groups[type]) groups[type] = { engRateSum: 0, reachSum: 0, count: 0 };
    groups[type].engRateSum += engRate;
    groups[type].reachSum += reach;
    groups[type].count += 1;
  }

  return Object.entries(groups).map(([type, g]) => ({
    type,
    label: getContentTypeLabel(type),
    avgEngagementRate: g.count > 0 ? g.engRateSum / g.count : 0,
    avgReach: g.count > 0 ? Math.round(g.reachSum / g.count) : 0,
    count: g.count,
  }));
}

function computeHeatmapCells(posts: ProviderPost[]): HeatmapCell[] {
  if (posts.length < 7) return [];

  const cellMap = new Map<
    string,
    { dayOfWeek: number; hour: number; engagement: number; postCount: number }
  >();

  for (const p of posts) {
    if (!p.published_at) continue;
    const dt = new Date(p.published_at);
    if (isNaN(dt.getTime())) continue;

    const dayOfWeek = dt.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const hour = dt.getHours();
    const key = `${dayOfWeek}-${hour}`;

    const m = p.metrics ?? {};
    const likes = m.likes ?? m.like_count ?? 0;
    const comments = m.comments ?? m.comments_count ?? 0;
    const saves = m.saves ?? 0;
    const shares = m.shares ?? m.share_count ?? 0;
    const engagement = likes + comments + saves + shares;

    const existing = cellMap.get(key);
    if (existing) {
      existing.engagement += engagement;
      existing.postCount += 1;
    } else {
      cellMap.set(key, { dayOfWeek, hour, engagement, postCount: 1 });
    }
  }

  return Array.from(cellMap.values()) as HeatmapCell[];
}

function computePostsTableRows(posts: ProviderPost[], provider: string): PostsTableRow[] {
  return posts.map((p) => {
    const m = p.metrics ?? {};
    const likes = m.likes ?? m.like_count ?? 0;
    const comments = m.comments ?? m.comments_count ?? 0;
    const saves = m.saves ?? 0;
    const shares = m.shares ?? m.share_count ?? 0;
    const reach = m.reach ?? 0;
    const eng = likes + comments + saves + shares;
    const engagementRate = reach > 0 ? eng / reach : undefined;

    return {
      id: p.id,
      thumbnail: p.thumbnail_url ?? undefined,
      caption: p.caption ?? p.title ?? "",
      provider,
      publishedAt: p.published_at ?? new Date().toISOString(),
      metrics: { likes, comments, saves, shares, reach },
      engagementRate,
    };
  });
}

/* ── Campaign highlight card ── */

function CampaignHighlightCard({
  campaign,
  variant,
}: {
  campaign: AdCampaignSummary;
  variant: "top" | "worst";
}) {
  const isTop = variant === "top";
  const borderClass = isTop ? "border-success/30" : "border-danger/30";
  const badgeClass = isTop
    ? "bg-success/15 text-success"
    : "bg-danger/15 text-danger";
  const badgeLabel = isTop ? "Melhor ROAS" : "Pior ROAS";

  return (
    <div
      className={`bg-bg-card border ${borderClass} rounded-xl p-4 flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${badgeClass}`}
        >
          {badgeLabel}
        </span>
        <span className="text-[10px] text-text-muted">{campaign.status}</span>
      </div>
      <p
        className="text-[13px] font-semibold text-text-primary truncate"
        title={campaign.name}
      >
        {campaign.name}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
        <div>
          <p className="text-[10px] text-text-muted">Gasto</p>
          <p className="text-[12px] font-semibold text-text-primary tabular-nums">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(campaign.spend)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">ROAS</p>
          <p
            className={`text-[12px] font-semibold tabular-nums ${
              campaign.roas !== null && campaign.roas >= 2
                ? "text-success"
                : campaign.roas !== null && campaign.roas >= 1
                ? "text-warning"
                : "text-danger"
            }`}
          >
            {campaign.roas !== null ? `${campaign.roas.toFixed(2)}×` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Conv.</p>
          <p className="text-[12px] font-semibold text-text-primary tabular-nums">
            {campaign.conversions.toLocaleString("pt-BR")}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">CTR</p>
          <p className="text-[12px] font-semibold text-text-primary tabular-nums">
            {(campaign.ctr * 100).toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Top 3 posts em destaque (cards visuais) ── */

function TopPostsHighlight({ posts }: { posts: PostsTableRow[] }) {
  if (posts.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 flex items-center justify-center text-[13px] text-text-muted">
        Top posts aparecem aqui quando houver dados
      </div>
    );
  }

  const top3 = [...posts]
    .sort((a, b) => {
      const engA = a.metrics.likes + a.metrics.comments + a.metrics.saves + a.metrics.shares;
      const engB = b.metrics.likes + b.metrics.comments + b.metrics.saves + b.metrics.shares;
      return engB - engA;
    })
    .slice(0, 3);

  function formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {top3.map((post) => {
        const totalEng = post.metrics.likes + post.metrics.comments + post.metrics.saves + post.metrics.shares;
        const captionPreview = post.caption.length > 60 ? post.caption.slice(0, 60) + "…" : post.caption;
        return (
          <a
            key={post.id}
            href={`#post-${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-all duration-200"
            onClick={(e) => e.preventDefault()}
          >
            {/* Thumbnail 16:9 */}
            <div className="relative aspect-video bg-bg-elevated overflow-hidden">
              {post.thumbnail ? (
                <img
                  src={post.thumbnail}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Heart size={28} className="text-text-muted/30" />
                </div>
              )}

              {/* Engagement badge — canto superior direito */}
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                <Heart size={10} className="text-red-400 fill-red-400" />
                <span className="text-[11px] font-semibold text-white tabular-nums">
                  {formatNum(totalEng)}
                </span>
              </div>

              {/* Caption overlay — canto inferior */}
              {captionPreview && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2">
                  <p className="text-[11px] text-white/90 leading-snug line-clamp-2">
                    {captionPreview}
                  </p>
                </div>
              )}
            </div>

            {/* Mini stats */}
            <div className="flex items-center justify-around px-3 py-2.5 border-t border-border/60">
              <div className="flex items-center gap-1">
                <Heart size={11} className="text-red-400" />
                <span className="text-[11px] text-text-muted tabular-nums">{formatNum(post.metrics.likes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle size={11} className="text-blue-400" />
                <span className="text-[11px] text-text-muted tabular-nums">{formatNum(post.metrics.comments)}</span>
              </div>
              {post.metrics.reach > 0 && (
                <div className="flex items-center gap-1">
                  <Bookmark size={11} className="text-text-muted" />
                  <span className="text-[11px] text-text-muted tabular-nums">{formatNum(post.metrics.reach)}</span>
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}

/* ── Main content ── */

function ProviderAnalyticsContent() {
  const params = useParams();
  const provider = params.provider as ProviderKey;
  const meta = METADATA_BY_PROVIDER[provider];

  const { empresa } = useEmpresa();
  const { preset, range, setPreset, setCustomRange, label } = usePeriodSelector();
  const { data, loading, error, refresh } = useProviderAnalytics(
    provider,
    range.start,
    range.end
  );

  /* Estado de anomalias descartadas */
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const handleDismissAnomaly = useCallback((metric: string) => {
    setDismissedAnomalies((prev) => new Set([...prev, metric]));
  }, []);

  /* Ícone e título do provider */
  const ProviderIcon: LucideIcon = getProviderIcon(provider);
  const pageTitle = getProviderTitle(provider, meta);

  /* Layout type */
  const layoutType = useMemo<LayoutType>(() => {
    if (provider === "crm") return "crm";
    if (provider === "meta_ads" || provider === "google_ads") return "paid";
    if (
      provider === "instagram" ||
      provider === "facebook" ||
      provider === "linkedin"
    )
      return "social";
    return "default";
  }, [provider]);

  /* ── Cálculos memoizados ── */
  const posts = data?.posts ?? [];

  const anomalies = useMemo(() => {
    if (!data?.kpis) return [];
    return computeAnomalies(data.kpis).filter((a) => !dismissedAnomalies.has(a.metric));
  }, [data?.kpis, dismissedAnomalies]);

  const breakdownPieData = useMemo(() => computeBreakdownPieData(posts), [posts]);

  const engagementTotals = useMemo(() => computeEngagementTotals(posts), [posts]);

  const formatItems = useMemo(() => {
    const igFP = data?.instagramAdvanced?.formatPerformance;
    if (igFP && igFP.length > 0) {
      return igFP.map((f) => ({
        type: f.format.toLowerCase(),
        label: f.label,
        count: f.count,
        avgEngagement: f.avgEngagement > 1 ? f.avgEngagement / 100 : f.avgEngagement,
        avgReach: f.avgReach,
        bestPostId: f.bestPost?.permalink,
      }));
    }
    return computeFormatItems(posts);
  }, [data?.instagramAdvanced?.formatPerformance, posts]);

  const contentTypeData = useMemo(() => computeContentTypeData(posts), [posts]);

  const heatmapCells = useMemo(() => computeHeatmapCells(posts), [posts]);

  const postsTableRows = useMemo(
    () => computePostsTableRows(posts, provider),
    [posts, provider]
  );

  const saveRate = useMemo(() => {
    const igSR = data?.instagramAdvanced?.saveRateAnalysis?.avgSaveRate;
    if (igSR != null) return igSR > 1 ? igSR / 100 : igSR;
    let totalSaves = 0;
    let totalReach = 0;
    for (const p of posts) {
      const m = p.metrics ?? {};
      totalSaves += m.saves ?? 0;
      totalReach += m.reach ?? 0;
    }
    return totalReach > 0 ? totalSaves / totalReach : 0;
  }, [data?.instagramAdvanced?.saveRateAnalysis?.avgSaveRate, posts]);

  /* Share rate (Facebook): shares / reach — substitui SaveRate para FB */
  const shareRate = useMemo(() => {
    let totalShares = 0;
    let totalReach = 0;
    for (const p of posts) {
      const m = p.metrics ?? {};
      totalShares += m.shares ?? m.share_count ?? 0;
      totalReach += m.reach ?? 0;
    }
    return totalReach > 0 ? totalShares / totalReach : 0;
  }, [posts]);

  const engBreakdown = useMemo(() => {
    const ig = data?.instagramAdvanced?.engagementBreakdown;
    if (ig) {
      return {
        likes: ig.avgLikes,
        comments: ig.avgComments,
        saves: ig.avgSaves,
        shares: ig.avgShares,
      };
    }
    return engagementTotals;
  }, [data?.instagramAdvanced?.engagementBreakdown, engagementTotals]);

  const followersSeries = useMemo(() => {
    if (!data?.timeSeries?.length) return [];
    return data.timeSeries
      .filter((pt) => {
        const v = pt[`${provider}_followers`] ?? pt["followers"];
        return typeof v === "number";
      })
      .map((pt) => ({
        date: pt.date as string,
        followers: (pt[`${provider}_followers`] ?? pt["followers"]) as number,
      }));
  }, [data?.timeSeries, provider]);

  /* ── Paid layout memos ── */
  const adsCampaigns = useMemo<AdCampaignSummary[]>(
    () => data?.metaAdsAdvanced?.campaigns ?? [],
    [data?.metaAdsAdvanced?.campaigns]
  );

  const spendData = useMemo(
    () => data?.metaAdsAdvanced?.spendByDay ?? [],
    [data?.metaAdsAdvanced?.spendByDay]
  );

  const topPerf = useMemo(
    () => data?.metaAdsAdvanced?.topPerformingCampaign ?? null,
    [data?.metaAdsAdvanced?.topPerformingCampaign]
  );

  const worstPerf = useMemo(
    () => data?.metaAdsAdvanced?.worstPerformingCampaign ?? null,
    [data?.metaAdsAdvanced?.worstPerformingCampaign]
  );

  /* ── CRM Advanced memos ── */
  const crmAdvanced = useMemo<CrmAdvanced | null>(
    () => data?.crmAdvanced ?? null,
    [data?.crmAdvanced]
  );

  /* ── Guards ── */
  if (!meta) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Provider desconhecido.
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="space-y-5 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── SEÇÃO 0: HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Lado esquerdo: voltar + ícone + título */}
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
              aria-label="Voltar para Analytics"
            >
              <ChevronLeft size={18} className="text-text-muted" />
            </Link>

            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${meta.color}20` }}
            >
              <ProviderIcon size={18} style={{ color: meta.color }} />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                  {pageTitle}
                </h1>
                {layoutType === "paid" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                    Mídia Paga
                  </span>
                )}
              </div>
              <p className="text-[13px] text-text-secondary">
                {label ? `Periodo: ${label}` : "Analytics detalhado"}
              </p>
            </div>
          </div>

          {/* Lado direito: PeriodSelector + Atualizar + Exportar */}
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              {empresa &&
                (provider === "instagram" ||
                  provider === "facebook" ||
                  provider === "meta_ads") && (
                  <ExportReportButton
                    empresaId={empresa.id}
                    periodStart={range.start.toISOString().split("T")[0]}
                    periodEnd={range.end.toISOString().split("T")[0]}
                    scope={provider as ExportScope}
                  />
                )}
              <button
                onClick={refresh}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
                aria-label="Atualizar dados"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Atualizar
              </button>
            </div>
            <PeriodSelector
              preset={preset}
              onPresetChange={setPreset}
              onCustomRange={setCustomRange}
              label={label}
            />
          </div>
        </div>
      </motion.div>

      {/* ── LOADING ── */}
      {loading && !data && <ProviderSkeleton />}

      {/* ── ERROR ── */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-danger/10 border border-danger/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-danger mb-1">
              Erro ao carregar analytics
            </p>
            <p className="text-[13px] text-danger/80">{error}</p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger text-[13px] font-medium transition-all shrink-0"
          >
            Tentar novamente
          </button>
        </motion.div>
      )}

      {/* ── NÃO CONECTADO ── */}
      {data && !data.connected && (
        <EmptyState
          icon={Cable}
          title={`${meta.displayName} nao conectado`}
          description={
            meta.status === "coming_soon"
              ? `A integracao com ${meta.displayName} estara disponivel em breve.`
              : `Conecte sua conta ${meta.displayName} para visualizar analytics detalhados.`
          }
          actionLabel={meta.status !== "coming_soon" ? "Conectar agora" : undefined}
          actionHref={meta.status !== "coming_soon" ? "/conexoes" : undefined}
        />
      )}

      {/* ── DASHBOARD — LAYOUT CRM ── */}
      {data && data.connected && layoutType === "crm" && (
        <>
          {/* SEÇÃO 1: ANOMALIAS */}
          <AnimatePresence>
            {anomalies.length > 0 && (
              <motion.div {...sectionAnim(0)}>
                <AnomalyBadge anomalies={anomalies} onDismiss={handleDismissAnomaly} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* SEÇÃO 2: INSIGHTS ESTRATÉGICOS */}
          <motion.div {...sectionAnim(0.05)}>
            <SectionHeader
              title="Insights Estrategicos"
              subtitle="O que os dados do CRM revelam sobre seu funil de vendas"
            />
            <StrategicInsightsCard
              insights={data.insightsSummary?.insights ?? []}
              title="Inteligencia de Vendas"
              subtitle="Analise automatica baseada nos dados do periodo selecionado"
              emptyMessage="Aguardando dados suficientes para gerar insights. Expanda o periodo ou aguarde a sincronizacao do CRM."
            />
          </motion.div>

          {/* SEÇÃO 3: HERO KPIs */}
          {data.kpis.length > 0 && (
            <motion.div
              {...sectionAnim(0.1)}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {data.kpis.map((kpi, i) => (
                <KPICard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  previousValue={kpi.previousValue}
                  delta={kpi.delta}
                  deltaPercent={kpi.deltaPercent}
                  trend={kpi.trend}
                  icon={kpi.icon}
                  animationDelay={i * 0.07}
                />
              ))}
            </motion.div>
          )}

          {/* SEÇÃO 4: FUNIL */}
          {crmAdvanced && (
            <motion.div {...sectionAnim(0.15)}>
              <SectionHeader
                title="Funil de Vendas"
                subtitle="Quantos leads passaram por cada etapa"
              />
              <SalesFunnelChart funnel={crmAdvanced.funnel} lostStage={crmAdvanced.lostStage} />
            </motion.div>
          )}

          {/* SEÇÃO 5: ORIGENS + TEMPERATURA */}
          {crmAdvanced && (
            <motion.div {...sectionAnim(0.2)} className="space-y-4">
              <SectionHeader
                title="Perfil dos Leads"
                subtitle="De onde vem e qual e a temperatura dos seus leads"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LeadsByOriginCard data={crmAdvanced.leadsByOrigin} />
                <LeadTemperatureGauge
                  hot={crmAdvanced.leadsByTemperature.hot}
                  warm={crmAdvanced.leadsByTemperature.warm}
                  cold={crmAdvanced.leadsByTemperature.cold}
                />
              </div>
            </motion.div>
          )}

          {/* SEÇÃO 6: ENGAJAMENTO (Email + WhatsApp) */}
          {crmAdvanced && (
            <motion.div {...sectionAnim(0.25)} className="space-y-4">
              <SectionHeader
                title="Engajamento"
                subtitle="Performance de email marketing e cadencias de WhatsApp"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EmailEngagementCard email={crmAdvanced.email} />
                <WhatsAppEngagementCard whatsapp={crmAdvanced.whatsapp} />
              </div>
            </motion.div>
          )}

          {/* SEÇÃO 7: GREATPAGES (condicional) */}
          {crmAdvanced && crmAdvanced.greatpages.leads > 0 && (
            <motion.div {...sectionAnim(0.3)}>
              <SectionHeader
                title="Landing Pages"
                subtitle="Leads captados pelas paginas de conversao"
              />
              <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] text-text-muted">Leads via GreatPages</p>
                  <p className="text-[32px] font-bold text-accent tabular-nums leading-none mt-1">
                    {crmAdvanced.greatpages.leads.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[13px] text-text-muted">Landing Pages ativas</p>
                  <p className="text-[32px] font-bold text-text-primary tabular-nums leading-none mt-1">
                    {crmAdvanced.greatpages.landingPages}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Empty state CRM específico */}
          {(!crmAdvanced || (crmAdvanced.funnel.length === 0)) && data.kpis.length === 0 && (
            <motion.div {...sectionAnim(0.1)}>
              <div className="bg-bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
                  <Cable size={18} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-text-primary mb-1">
                    Sem dados do CRM ainda
                  </p>
                  <p className="text-[13px] text-text-muted leading-relaxed max-w-md">
                    O GO Studio puxa dados do CRM diariamente. Se acabou de conectar, espere o proximo sync
                    (4h BRT) ou dispare manualmente em{" "}
                    <a href="/conexoes" className="text-accent hover:underline">
                      Conexoes &gt; CRM &gt; Sincronizar agora
                    </a>
                    .
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── DASHBOARD — LAYOUT PAGO ── */}
      {data && data.connected && layoutType === "paid" && (
        <>
          {/* SEÇÃO 1: ANOMALIAS */}
          <AnimatePresence>
            {anomalies.length > 0 && (
              <motion.div {...sectionAnim(0)}>
                <AnomalyBadge anomalies={anomalies} onDismiss={handleDismissAnomaly} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* SEÇÃO 2: ADS KPI HERO */}
          {data.metaAdsAdvanced && (
            <motion.div {...sectionAnim(0.05)}>
              <SectionHeader
                title="Metricas de Midia Paga"
                subtitle="Investimento, retorno e eficiencia das campanhas"
              />
              <AdsKPIHero
                totalSpend={data.metaAdsAdvanced.totalSpend}
                totalSpendDelta={data.kpis.find((k) => k.key === "spend")?.delta ?? null}
                totalSpendDeltaPct={data.kpis.find((k) => k.key === "spend")?.deltaPercent ?? null}
                avgROAS={data.metaAdsAdvanced.avgROAS}
                avgROASDelta={data.kpis.find((k) => k.key === "roas")?.delta ?? null}
                avgROASDeltaPct={data.kpis.find((k) => k.key === "roas")?.deltaPercent ?? null}
                totalConversions={data.metaAdsAdvanced.totalConversions}
                totalConversionsDelta={data.kpis.find((k) => k.key === "conversions")?.delta ?? null}
                totalConversionsDeltaPct={data.kpis.find((k) => k.key === "conversions")?.deltaPercent ?? null}
                avgCPC={data.metaAdsAdvanced.avgCPC}
                avgCPCDelta={data.kpis.find((k) => k.key === "cpc")?.delta ?? null}
                avgCPCDeltaPct={data.kpis.find((k) => k.key === "cpc")?.deltaPercent ?? null}
              />
            </motion.div>
          )}

          {/* SEÇÃO 3: INSIGHTS ESTRATÉGICOS */}
          <motion.div {...sectionAnim(0.1)}>
            <SectionHeader
              title="Insights Estrategicos"
              subtitle="O que esses numeros dizem sobre suas campanhas"
            />
            <StrategicInsightsCard
              insights={data.insightsSummary?.insights ?? []}
              title="Inteligencia de Campanhas"
              subtitle="Analise automatica baseada nos dados do periodo selecionado"
              emptyMessage="Aguardando dados suficientes para gerar insights. Expanda o periodo ou aguarde mais dados de campanhas."
            />
          </motion.div>

          {/* SEÇÃO 4: EVOLUÇÃO DE SPEND */}
          <motion.div {...sectionAnim(0.15)} className="space-y-4">
            <SectionHeader
              title="Evolucao de Gasto"
              subtitle="Distribuicao de investimento e conversoes ao longo do periodo"
            />

            <SpendTimelineChart
              data={spendData}
              title="Gasto por dia"
            />

            {/* TimeSeriesChart só faz sentido se há followers/reach > 0;
                ads (meta_ads, google_ads) não têm followers, então escondemos quando todos zero. */}
            {data.timeSeries.length > 0 &&
              data.timeSeries.some((pt) => {
                const f = pt[`${provider}_followers`];
                const r = pt[`${provider}_reach`];
                return (typeof f === "number" && f > 0) || (typeof r === "number" && r > 0);
              }) && (
              <TimeSeriesChart
                data={data.timeSeries}
                providers={[provider]}
                singleProvider={provider}
                height={280}
              />
            )}
          </motion.div>

          {/* SEÇÃO 5: CAMPANHAS */}
          <motion.div {...sectionAnim(0.2)} className="space-y-4">
            <SectionHeader
              title="Campanhas"
              subtitle="Desempenho detalhado de cada campanha no periodo"
            />

            <CampaignsTable campaigns={adsCampaigns} pageSize={10} />

            {/* Top / Worst highlights */}
            {(topPerf || worstPerf) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topPerf && (
                  <CampaignHighlightCard campaign={topPerf} variant="top" />
                )}
                {worstPerf && (
                  <CampaignHighlightCard campaign={worstPerf} variant="worst" />
                )}
              </div>
            )}
          </motion.div>

          {/* Empty fallback quando não há metaAdsAdvanced */}
          {!data.metaAdsAdvanced && data.kpis.length === 0 && (
            <EmptyState
              title="Sem dados de campanhas"
              description="Nenhum dado de midia paga encontrado para o periodo selecionado. Tente expandir o intervalo de datas."
            />
          )}
        </>
      )}

      {/* ── DASHBOARD — LAYOUT SOCIAL (Instagram / Facebook / LinkedIn) ── */}
      {data && data.connected && layoutType === "social" && (
        <>
          {/* SEÇÃO 1: ANOMALIAS (condicional) */}
          <AnimatePresence>
            {anomalies.length > 0 && (
              <motion.div {...sectionAnim(0)}>
                <AnomalyBadge anomalies={anomalies} onDismiss={handleDismissAnomaly} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* SEÇÃO 2: INSIGHTS ESTRATÉGICOS */}
          <motion.div {...sectionAnim(0.05)}>
            <SectionHeader
              title="Insights Estrategicos"
              subtitle="O que esses numeros dizem sobre o seu conteudo"
            />
            <StrategicInsightsCard
              insights={data.insightsSummary?.insights ?? []}
              title="Inteligencia da conta"
              subtitle="Analise automatica baseada nos dados do periodo selecionado"
              emptyMessage="Aguardando dados suficientes para gerar insights. Expanda o periodo ou publique mais conteudo."
            />
          </motion.div>

          {/* SEÇÃO 3: HERO KPIs */}
          {data.kpis.length > 0 && (
            <motion.div
              {...sectionAnim(0.1)}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {data.kpis.map((kpi, i) => (
                <KPICard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  previousValue={kpi.previousValue}
                  delta={kpi.delta}
                  deltaPercent={kpi.deltaPercent}
                  trend={kpi.trend}
                  icon={kpi.icon}
                  animationDelay={i * 0.07}
                />
              ))}
            </motion.div>
          )}

          {/* SEÇÃO 4: EVOLUÇÃO */}
          {data.timeSeries.length > 0 && (
            <motion.div {...sectionAnim(0.15)} className="space-y-4">
              <SectionHeader
                title="Evolucao"
                subtitle="Crescimento de seguidores, alcance e engajamento ao longo do periodo"
              />

              <TimeSeriesChart
                data={data.timeSeries}
                providers={[provider]}
                singleProvider={provider}
                height={320}
              />

              {followersSeries.length >= 2 && (
                <motion.div {...sectionAnim(0.2)}>
                  <FollowersDeltaChart
                    data={followersSeries}
                    provider={meta.displayName}
                    height={240}
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* SEÇÃO 5: PERFORMANCE DE CONTEÚDO */}
          <motion.div {...sectionAnim(0.25)} className="space-y-4">
            <SectionHeader
              title="Performance de Conteudo"
              subtitle="Taxa de salvamentos, distribuicao de engajamento e formatos com melhor resultado"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {provider === "facebook" ? (
                <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: "#1877F220" }}
                    >
                      <Share2 size={16} style={{ color: "#1877F2" }} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-text-primary">
                        Taxa de Compartilhamento
                      </h3>
                      <p className="text-[11px] text-text-muted">Shares / Alcance</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-text-primary tabular-nums">
                    {(shareRate * 100).toFixed(2)}%
                  </p>
                  {data.facebookAdvanced && (
                    <p className="text-[11px] text-text-muted mt-2">
                      {data.facebookAdvanced.totalShares.toLocaleString("pt-BR")} compartilhamentos
                      {data.facebookAdvanced.pageNewFans > 0 && (
                        <> · +{data.facebookAdvanced.pageNewFans.toLocaleString("pt-BR")} novos fãs</>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <SaveRateCard saveRate={saveRate} benchmark={0.02} />
              )}
              <EngagementBreakdown
                likes={engBreakdown.likes}
                comments={engBreakdown.comments}
                saves={engBreakdown.saves}
                shares={engBreakdown.shares}
                title={
                  data.instagramAdvanced
                    ? "Quebra do engajamento (media por post)"
                    : "Quebra do engajamento"
                }
              />
              <BreakdownPie
                title="Distribuicao por tipo"
                subtitle="Posts, fotos, videos e carrosseis"
                data={breakdownPieData.length > 0 ? breakdownPieData : []}
                centerLabel={posts.length > 0 ? `${posts.length} posts` : undefined}
                emptyMessage="Nenhum post no periodo"
              />
            </div>

            {formatItems.length > 0 && (
              <FormatPerformanceCards formats={formatItems} />
            )}

            {contentTypeData.length > 0 && (
              <ContentTypePerformance
                data={contentTypeData}
                metric="engagement"
                title="Performance por tipo de conteudo"
              />
            )}
          </motion.div>

          {/* SEÇÃO 6: MELHOR MOMENTO */}
          <motion.div {...sectionAnim(0.3)}>
            <SectionHeader
              title="Melhor Momento"
              subtitle="Horarios e dias com maior engajamento com base nos posts publicados"
            />
            <BestTimeHeatmap
              data={heatmapCells}
              title="Melhores horarios para postar"
              metric="engagement"
            />
          </motion.div>

          {/* SEÇÃO 7: HASHTAGS (condicional) */}
          {data.topHashtags && data.topHashtags.length > 0 && (
            <motion.div
              {...sectionAnim(0.35)}
              className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
            >
              <div className="mb-4">
                <h2 className="text-[14px] font-semibold text-text-primary">
                  Top hashtags
                </h2>
                <p className="text-[12px] text-text-muted mt-0.5">
                  As mais usadas e que geraram engajamento
                </p>
              </div>
              {(() => {
                /* Enriquecer com dados do captionAnalysis quando disponível */
                const captionTags = data.instagramAdvanced?.captionAnalysis?.topHashtags ?? [];
                const captionMap = new Map(captionTags.map((t) => [t.tag, t]));
                const maxCount = Math.max(...data.topHashtags.map((t) => t.count), 1);
                /* Tags presentes em posts de alto engajamento (top 25%) */
                const topEng = [...postsTableRows]
                  .sort((a, b) => {
                    const ea = a.metrics.likes + a.metrics.comments + a.metrics.saves + a.metrics.shares;
                    const eb = b.metrics.likes + b.metrics.comments + b.metrics.saves + b.metrics.shares;
                    return eb - ea;
                  })
                  .slice(0, Math.max(1, Math.ceil(postsTableRows.length * 0.25)));
                const topEngCaptions = new Set(topEng.map((p) => p.caption.toLowerCase()));
                const isTopEng = (tag: string) =>
                  Array.from(topEngCaptions).some((c) => c.includes(tag.toLowerCase()));

                return (
                  <div className="space-y-2">
                    {data.topHashtags.slice(0, 15).map((tag) => {
                      const pct = (tag.count / maxCount) * 100;
                      const enriched = captionMap.get(tag.tag);
                      const topEngaged = isTopEng(tag.tag);

                      return (
                        <div
                          key={tag.tag}
                          className="group relative"
                          title={
                            enriched
                              ? `Usada ${tag.count}x — engagement médio ${(enriched.avgEngagement * 100).toFixed(2)}%`
                              : `Usada ${tag.count}x`
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-accent font-medium text-[12px] w-40 shrink-0 truncate">
                              {tag.tag}
                            </span>
                            <div className="flex-1 relative h-5 bg-bg-elevated rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${topEngaged ? "bg-success/60" : "bg-border"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-text-muted tabular-nums w-10 text-right shrink-0">
                              {tag.count}×
                            </span>
                            {topEngaged && (
                              <span className="text-[9px] font-semibold text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full shrink-0">
                                top
                              </span>
                            )}
                          </div>
                          {enriched && (
                            <p className="text-[10px] text-text-muted mt-0.5 pl-44 hidden group-hover:block">
                              Eng. médio: {(enriched.avgEngagement * 100).toFixed(2)}%
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* SEÇÃO 8: TOP POSTS */}
          {provider === "facebook" && data.facebookAdvanced && data.facebookAdvanced.topPosts.length > 0 ? (
            <motion.div {...sectionAnim(0.4)}>
              <SectionHeader
                title="Top Posts do Facebook"
                subtitle="Publicacoes com maior engajamento (reacoes + comentarios + compartilhamentos)"
              />
              <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
                {data.facebookAdvanced.topPosts.map((p, idx) => {
                  const total = p.reactions + p.comments + p.shares;
                  return (
                    <div key={p.id} className="flex items-start gap-3 p-4">
                      <div className="w-7 h-7 shrink-0 rounded-full bg-bg-elevated flex items-center justify-center text-[11px] font-semibold text-text-secondary">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-text-primary line-clamp-2">
                          {p.message || "(sem texto)"}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-text-muted tabular-nums">
                          <span>{p.reactions.toLocaleString("pt-BR")} reacoes</span>
                          <span>{p.comments.toLocaleString("pt-BR")} comentarios</span>
                          <span>{p.shares.toLocaleString("pt-BR")} shares</span>
                          {p.reach > 0 && <span>{p.reach.toLocaleString("pt-BR")} alcance</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-semibold text-text-primary tabular-nums">
                          {total.toLocaleString("pt-BR")}
                        </p>
                        <p className="text-[10px] text-text-muted">eng. total</p>
                        {p.permalink && (
                          <a
                            href={p.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent hover:underline"
                          >
                            Abrir
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : postsTableRows.length > 0 ? (
            <>
              {/* Posts em destaque — Top 3 cards */}
              <motion.div {...sectionAnim(0.38)}>
                <SectionHeader
                  title="Posts em Destaque"
                  subtitle="Os 3 posts com maior engajamento no periodo"
                />
                <TopPostsHighlight posts={postsTableRows} />
              </motion.div>

              {/* Tabela completa */}
              <motion.div {...sectionAnim(0.4)}>
                <SectionHeader
                  title="Top Posts"
                  subtitle="Publicacoes do periodo ordenadas por data, curtidas ou taxa de engajamento"
                />
                <PostsTable
                  posts={postsTableRows}
                  limit={10}
                  emptyMessage="Nenhum post no periodo selecionado"
                />
              </motion.div>
            </>
          ) : (
            !loading && (
              <motion.div {...sectionAnim(0.4)}>
                <SectionHeader title="Top Posts" />
                <div className="bg-bg-card border border-border rounded-xl p-8 flex items-center justify-center">
                  <p className="text-[13px] text-text-muted text-center">
                    Nenhum post encontrado no periodo selecionado.
                  </p>
                </div>
              </motion.div>
            )
          )}

          {/* Empty state global */}
          {data.kpis.length === 0 &&
            posts.length === 0 &&
            data.timeSeries.length === 0 && (
              <EmptyState
                title="Sem dados no periodo"
                description={`Nenhum dado encontrado para ${meta.displayName} no periodo selecionado. Tente expandir o intervalo de datas.`}
              />
            )}
        </>
      )}

      {/* ── DASHBOARD — LAYOUT DEFAULT ── */}
      {data && data.connected && layoutType === "default" && (
        <>
          {/* SEÇÃO 1: ANOMALIAS */}
          <AnimatePresence>
            {anomalies.length > 0 && (
              <motion.div {...sectionAnim(0)}>
                <AnomalyBadge anomalies={anomalies} onDismiss={handleDismissAnomaly} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* SEÇÃO 2: INSIGHTS */}
          <motion.div {...sectionAnim(0.05)}>
            <SectionHeader title="Insights Estrategicos" />
            <StrategicInsightsCard
              insights={data.insightsSummary?.insights ?? []}
              title="Inteligencia da conta"
              emptyMessage="Aguardando dados suficientes para gerar insights."
            />
          </motion.div>

          {/* SEÇÃO 3: KPIs */}
          {data.kpis.length > 0 && (
            <motion.div
              {...sectionAnim(0.1)}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {data.kpis.map((kpi, i) => (
                <KPICard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  previousValue={kpi.previousValue}
                  delta={kpi.delta}
                  deltaPercent={kpi.deltaPercent}
                  trend={kpi.trend}
                  icon={kpi.icon}
                  animationDelay={i * 0.07}
                />
              ))}
            </motion.div>
          )}

          {/* SEÇÃO 4: TIME SERIES */}
          {data.timeSeries.length > 0 && (
            <motion.div {...sectionAnim(0.15)}>
              <SectionHeader title="Evolucao" />
              <TimeSeriesChart
                data={data.timeSeries}
                providers={[provider]}
                singleProvider={provider}
                height={320}
              />
            </motion.div>
          )}

          {/* SEÇÃO 5: POSTS */}
          {postsTableRows.length > 0 && (
            <motion.div {...sectionAnim(0.2)}>
              <SectionHeader title="Top Posts" />
              <PostsTable
                posts={postsTableRows}
                limit={10}
                emptyMessage="Nenhum post no periodo selecionado"
              />
            </motion.div>
          )}

          {/* Empty state global */}
          {data.kpis.length === 0 &&
            posts.length === 0 &&
            data.timeSeries.length === 0 && (
              <EmptyState
                title="Sem dados no periodo"
                description={`Nenhum dado encontrado para ${meta.displayName} no periodo selecionado. Tente expandir o intervalo de datas.`}
              />
            )}
        </>
      )}
    </div>
  );
}

export default function ProviderAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={18} className="animate-spin text-accent" />
        </div>
      }
    >
      <ProviderAnalyticsContent />
    </Suspense>
  );
}
