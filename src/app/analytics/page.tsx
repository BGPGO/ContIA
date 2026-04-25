"use client";

import { Suspense, useMemo, useState, useCallback } from "react";
import { motion } from "motion/react";
import { BarChart3, RefreshCw } from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { useConnections } from "@/hooks/useConnections";
import { useMetaAdsSummary } from "@/hooks/useMetaAdsSummary";
import { PROVIDER_DISPLAY_ORDER } from "@/lib/drivers/metadata";

/* ── Componentes compartilhados ── */
import { KPICard } from "@/components/insights/KPICard";
import { TimeSeriesChart } from "@/components/insights/TimeSeriesChart";
import { FollowersDeltaChart } from "@/components/insights/FollowersDeltaChart";
import { EmptyState } from "@/components/insights/EmptyState";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { SyncStatusBadge } from "@/components/insights/SyncStatusBadge";
import { BestTimeHeatmap } from "@/components/insights/BestTimeHeatmap";
import { ContentTypePerformance } from "@/components/insights/ContentTypePerformance";
import { AnomalyBadge } from "@/components/insights/AnomalyBadge";

/* ── Componentes analytics ── */
import { AdsSummarySection } from "@/components/analytics/AdsSummarySection";
import { ProviderSummaryRow } from "@/components/analytics/ProviderSummaryRow";
import { BreakdownPie } from "@/components/analytics/BreakdownPie";
import { PostsTable } from "@/components/analytics/PostsTable";
import { SaveRateCard } from "@/components/analytics/SaveRateCard";
import { EngagementBreakdown } from "@/components/analytics/EngagementBreakdown";
import { FormatPerformanceCards } from "@/components/analytics/FormatPerformanceCards";

/* ── Tipos ── */
import type { ProviderKey } from "@/types/providers";
import type { RecentPost, AnalyticsKPI } from "@/types/analytics";
import type { Anomaly } from "@/components/insights/AnomalyBadge";
import type { HeatmapCell } from "@/components/insights/BestTimeHeatmap";
import type { PostsTableRow } from "@/components/analytics/PostsTable";
import type { FormatItem } from "@/components/analytics/FormatPerformanceCards";
import type { ContentTypeData } from "@/components/insights/ContentTypePerformance";
import type { BreakdownPieItem } from "@/components/analytics/BreakdownPie";

/* ── Label mapeamento de tipo de conteúdo ── */
const CONTENT_TYPE_LABELS: Record<string, string> = {
  reel: "Reels",
  post: "Posts",
  carousel: "Carrossel",
  story: "Stories",
  video: "Vídeos",
  image: "Imagens",
};

function getContentTypeLabel(type: string): string {
  return CONTENT_TYPE_LABELS[type.toLowerCase()] ?? type;
}

/* ── Seção helper ── */
function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-px flex-1 bg-border/60" />
        <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-widest whitespace-nowrap">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {subtitle && (
        <p className="text-center text-[12px] text-text-muted/70 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

/* ── Skeleton de loading ── */
function AnalyticsSkeleton() {
  return (
    <div className="space-y-5 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto animate-pulse">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-bg-card border border-border rounded-xl" />
        ))}
      </div>
      {/* Chart */}
      <div className="h-72 bg-bg-card border border-border rounded-xl" />
      {/* Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-52 bg-bg-card border border-border rounded-xl" />
        ))}
      </div>
      {/* Table */}
      <div className="h-64 bg-bg-card border border-border rounded-xl" />
    </div>
  );
}

/* ── Cálculos client-side ── */

function computeContentTypeBreakdown(posts: RecentPost[]): BreakdownPieItem[] {
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

function computeEngagementTotals(posts: RecentPost[]) {
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

function computeFormatItems(posts: RecentPost[]): FormatItem[] {
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

function computeContentTypeData(posts: RecentPost[]): ContentTypeData[] {
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

function computeHeatmapCells(posts: RecentPost[]): HeatmapCell[] {
  if (posts.length < 7) return [];

  const cellMap: Map<
    string,
    { dayOfWeek: number; hour: number; engagement: number; postCount: number }
  > = new Map();

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

  // Sort: high first, then medium, then low; max 3
  const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
  detected.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return detected.slice(0, 3);
}

function computePostsTableRows(posts: RecentPost[]): PostsTableRow[] {
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
      caption: p.caption ?? "",
      provider: p.provider,
      publishedAt: p.published_at ?? new Date().toISOString(),
      metrics: { likes, comments, saves, shares, reach },
      engagementRate,
    };
  });
}

/* ── Animação helper ── */

function sectionAnim(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay },
  } as const;
}

function AnalyticsContent() {
  const { empresa } = useEmpresa();
  const { isConnected, loading: connectionsLoading } = useConnections();
  const { preset, range, setPreset, setCustomRange, label } = usePeriodSelector();
  const { data, loading, error, refresh } = useAnalyticsOverview(
    range.start,
    range.end
  );

  const hasMetaAds = isConnected("meta_ads");
  const {
    data: metaAdsData,
    loading: metaAdsLoading,
    error: metaAdsError,
  } = useMetaAdsSummary(range.start, range.end, hasMetaAds);

  /* Estado local de anomalias (para dismiss) */
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(
    new Set()
  );

  const handleDismissAnomaly = useCallback((metric: string) => {
    setDismissedAnomalies((prev) => new Set([...prev, metric]));
  }, []);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const connectedProviders = PROVIDER_DISPLAY_ORDER.filter((k) =>
    isConnected(k)
  );
  const hasConnections = connectedProviders.length > 0;

  /* ── Dados derivados (memoizados) ── */
  const recentPosts = data?.recentPosts ?? [];

  const pieData = useMemo(
    () => computeContentTypeBreakdown(recentPosts),
    [recentPosts]
  );

  const engTotals = useMemo(
    () => computeEngagementTotals(recentPosts),
    [recentPosts]
  );

  const formatItems = useMemo(
    () => computeFormatItems(recentPosts),
    [recentPosts]
  );

  const contentTypeData = useMemo(
    () => computeContentTypeData(recentPosts),
    [recentPosts]
  );

  const heatmapCells = useMemo(
    () => computeHeatmapCells(recentPosts),
    [recentPosts]
  );

  const postsTableRows = useMemo(
    () => computePostsTableRows(recentPosts),
    [recentPosts]
  );

  const anomalies = useMemo(() => {
    if (!data?.kpis) return [];
    return computeAnomalies(data.kpis).filter(
      (a) => !dismissedAnomalies.has(a.metric)
    );
  }, [data?.kpis, dismissedAnomalies]);

  /* SaveRate */
  const saveRateKpi = data?.contentPerformance?.kpis?.find(
    (k) => k.label === "Save rate"
  );
  const saveRate = saveRateKpi?.raw ?? 0;
  const saveRatePrevious =
    saveRateKpi?.delta != null ? saveRate - saveRateKpi.delta : undefined;

  /* Providers com dados de seguidores para FollowersDeltaChart */
  const providersWithFollowers = useMemo(() => {
    if (!data?.timeSeries?.length) return [] as ProviderKey[];
    return connectedProviders.filter((provider) =>
      data.timeSeries.some(
        (pt) => typeof pt[`${provider}_followers`] === "number"
      )
    );
  }, [connectedProviders, data?.timeSeries]);

  /* ── Render ── */

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* ─────────────────── HEADER ─────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center shrink-0">
              <BarChart3 size={20} className="text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Analytics
              </h1>
              <p className="text-[13px] text-text-secondary">
                {label
                  ? `Desempenho das redes — ${label}`
                  : "Desempenho das suas redes e canais"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
                aria-label="Atualizar dados"
              >
                <RefreshCw
                  size={13}
                  className={loading ? "animate-spin" : ""}
                />
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

        {data && (
          <div className="mt-3">
            <SyncStatusBadge
              syncStatus={data.syncStatus}
              lastSyncedAt={data.lastSyncedAt}
            />
          </div>
        )}
      </motion.div>

      {/* ─────────────────── LOADING ─────────────────── */}
      {(loading || connectionsLoading) && !data && <AnalyticsSkeleton />}

      {/* ─────────────────── ERROR ─────────────────── */}
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

      {/* ─────────────────── SEM CONEXÕES ─────────────────── */}
      {!loading && !connectionsLoading && !hasConnections && (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma rede conectada"
          description="Conecte suas redes sociais para visualizar os dados de performance em tempo real."
          actionLabel="Conectar redes"
          actionHref="/conexoes"
        />
      )}

      {/* ─────────────────── DASHBOARD ─────────────────── */}
      {data && hasConnections && (
        <>
          {/* ── ANOMALIAS ── */}
          {anomalies.length > 0 && (
            <motion.div {...sectionAnim(0)}>
              <AnomalyBadge
                anomalies={anomalies}
                onDismiss={handleDismissAnomaly}
              />
            </motion.div>
          )}

          {/* ── HERO KPIs ── */}
          <motion.div
            {...sectionAnim(0.05)}
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

          {/* ── SEÇÃO 0: VISÃO POR REDE ── */}
          <motion.div {...sectionAnim(0.15)}>
            <SectionHeader
              title="Visão por Rede"
              subtitle="Comparativo de seguidores e engajamento por canal conectado"
            />
            <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-text-primary">
                  Canais ativos
                </h3>
                <span className="text-[11px] text-text-muted">
                  {connectedProviders.length} conectada
                  {connectedProviders.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {data.providers.map((summary, i) => (
                  <ProviderSummaryRow
                    key={summary.provider}
                    summary={summary}
                    index={i}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── SEÇÃO META ADS: INVESTIMENTO EM MÍDIA PAGA ── */}
          {hasMetaAds && (
            <motion.div {...sectionAnim(0.2)}>
              <SectionHeader
                title="Investimento em Mídia Paga"
                subtitle="Resumo do que você está gastando em ads"
              />
              <AdsSummarySection
                data={metaAdsData}
                loading={metaAdsLoading}
                error={metaAdsError}
                hasMetaAdsConnection={hasMetaAds}
              />
            </motion.div>
          )}

          {/* ── SEÇÃO 1: EVOLUÇÃO ── */}
          {data.timeSeries.length > 0 && (
            <motion.div {...sectionAnim(0.22)} className="space-y-4">
              <SectionHeader
                title="Evolução"
                subtitle="Crescimento de seguidores, alcance e engajamento ao longo do período"
              />

              {/* Time series full width */}
              <TimeSeriesChart
                data={data.timeSeries}
                providers={connectedProviders}
                height={320}
              />

              {/* FollowersDelta — grid 2 col */}
              {providersWithFollowers.length > 0 && (
                <div
                  className={`grid gap-4 ${
                    providersWithFollowers.length > 1
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1"
                  }`}
                >
                  {providersWithFollowers.map((provider, i) => {
                    const series = data.timeSeries
                      .filter(
                        (pt) =>
                          typeof pt[`${provider}_followers`] === "number"
                      )
                      .map((pt) => ({
                        date: pt.date as string,
                        followers: pt[`${provider}_followers`] as number,
                      }));

                    return (
                      <motion.div
                        key={`delta-${provider}`}
                        {...sectionAnim(0.27 + i * 0.05)}
                      >
                        <FollowersDeltaChart
                          data={series}
                          provider={
                            connectedProviders.length > 1
                              ? provider.charAt(0).toUpperCase() +
                                provider.slice(1)
                              : undefined
                          }
                          height={240}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── SEÇÃO 2: PERFORMANCE DE CONTEÚDO ── */}
          <motion.div {...sectionAnim(0.35)} className="space-y-4">
            <SectionHeader
              title="Performance de Conteúdo"
              subtitle="Taxa de salvamentos, distribuição de engajamento e formatos com melhor resultado"
            />

            {/* Row: SaveRateCard + EngagementBreakdown + BreakdownPie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SaveRateCard
                saveRate={saveRate}
                previous={saveRatePrevious}
                benchmark={0.02}
              />
              <EngagementBreakdown
                likes={engTotals.likes}
                comments={engTotals.comments}
                saves={engTotals.saves}
                shares={engTotals.shares}
                title="Quebra do engajamento"
              />
              <BreakdownPie
                title="Distribuição por tipo"
                subtitle="Reels, posts, carrosseis e stories"
                data={pieData}
                centerLabel={
                  recentPosts.length > 0
                    ? `${recentPosts.length} posts`
                    : undefined
                }
                emptyMessage="Nenhum post no período"
              />
            </div>

            {/* FormatPerformanceCards */}
            <FormatPerformanceCards formats={formatItems} />

            {/* ContentTypePerformance */}
            <ContentTypePerformance
              data={contentTypeData}
              metric="engagement"
              title="Performance por tipo de conteúdo"
            />
          </motion.div>

          {/* ── SEÇÃO 3: MELHOR MOMENTO ── */}
          <motion.div {...sectionAnim(0.45)}>
            <SectionHeader
              title="Melhor Momento"
              subtitle="Horários e dias com maior engajamento com base nos posts publicados"
            />
            <BestTimeHeatmap
              data={heatmapCells}
              title="Melhores horários para postar"
              metric="engagement"
            />
          </motion.div>

          {/* ── SEÇÃO 4: TOP POSTS ── */}
          {recentPosts.length > 0 && (
            <motion.div {...sectionAnim(0.55)}>
              <SectionHeader
                title="Top Posts"
                subtitle="Publicações do período ordenadas por data, curtidas ou taxa de engajamento"
              />
              <PostsTable
                posts={postsTableRows}
                limit={10}
                emptyMessage="Nenhum post no período selecionado"
              />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={18} className="animate-spin text-accent" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
