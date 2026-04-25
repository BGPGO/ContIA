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

/* ── Componentes analytics ── */
import { BreakdownPie } from "@/components/analytics/BreakdownPie";
import { PostsTable } from "@/components/analytics/PostsTable";
import { SaveRateCard } from "@/components/analytics/SaveRateCard";
import { EngagementBreakdown } from "@/components/analytics/EngagementBreakdown";
import { FormatPerformanceCards } from "@/components/analytics/FormatPerformanceCards";

/* ── Tipos ── */
import type { ProviderKey } from "@/types/providers";
import type { AnalyticsKPI, ProviderPost } from "@/types/analytics";
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
  video: "Videos",
  image: "Imagens",
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
    default:
      return Globe;
  }
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

  /* Ícone do provider */
  const ProviderIcon: LucideIcon = meta ? getProviderIcon(provider) : Globe;

  /* Título dinâmico */
  const pageTitle = meta ? `Analytics — ${meta.displayName}` : "Analytics";

  /* ── Cálculos memoizados ── */
  const posts = data?.posts ?? [];

  const anomalies = useMemo(() => {
    if (!data?.kpis) return [];
    return computeAnomalies(data.kpis).filter((a) => !dismissedAnomalies.has(a.metric));
  }, [data?.kpis, dismissedAnomalies]);

  const breakdownPieData = useMemo(() => computeBreakdownPieData(posts), [posts]);

  const engagementTotals = useMemo(() => computeEngagementTotals(posts), [posts]);

  const formatItems = useMemo(() => {
    /* Se há instagramAdvanced com formatPerformance, usar ele (já agregado) */
    const igFP = data?.instagramAdvanced?.formatPerformance;
    if (igFP && igFP.length > 0) {
      return igFP.map((f) => ({
        type: f.format.toLowerCase(),
        label: f.label,
        count: f.count,
        /* avgEngagement já vem em 0..100 na API — normalizar para 0..1 */
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

  /* SaveRate — preferir igAdvanced, senão calcular dos posts */
  const saveRate = useMemo(() => {
    const igSR = data?.instagramAdvanced?.saveRateAnalysis?.avgSaveRate;
    if (igSR != null) return igSR > 1 ? igSR / 100 : igSR;
    /* Calcular dos posts: sum(saves)/sum(reach) */
    let totalSaves = 0;
    let totalReach = 0;
    for (const p of posts) {
      const m = p.metrics ?? {};
      totalSaves += m.saves ?? 0;
      totalReach += m.reach ?? 0;
    }
    return totalReach > 0 ? totalSaves / totalReach : 0;
  }, [data?.instagramAdvanced?.saveRateAnalysis?.avgSaveRate, posts]);

  /* EngagementBreakdown — preferir igAdvanced se disponível */
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

  /* Série de seguidores para FollowersDeltaChart */
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
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                {pageTitle}
              </h1>
              <p className="text-[13px] text-text-secondary">
                {label ? `Periodo: ${label}` : "Analytics detalhado"}
              </p>
            </div>
          </div>

          {/* Lado direito: PeriodSelector + Atualizar */}
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
              aria-label="Atualizar dados"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
            <PeriodSelector
              preset={preset}
              onPresetChange={setPreset}
              onCustomRange={setCustomRange}
              label={label}
            />
          </div>
        </div>

        {/* SyncStatusBadge: removido até backend popular syncStatus/lastSyncedAt no response */}
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

      {/* ── DASHBOARD ── */}
      {data && data.connected && (
        <>
          {/* ── SEÇÃO 1: ANOMALIAS (condicional) ── */}
          <AnimatePresence>
            {anomalies.length > 0 && (
              <motion.div {...sectionAnim(0)}>
                <AnomalyBadge anomalies={anomalies} onDismiss={handleDismissAnomaly} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SEÇÃO 2: INSIGHTS ESTRATÉGICOS ── */}
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

          {/* ── SEÇÃO 3: HERO KPIs ── */}
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

          {/* ── SEÇÃO 4: EVOLUÇÃO ── */}
          {data.timeSeries.length > 0 && (
            <motion.div {...sectionAnim(0.15)} className="space-y-4">
              <SectionHeader
                title="Evolucao"
                subtitle="Crescimento de seguidores, alcance e engajamento ao longo do periodo"
              />

              {/* TimeSeriesChart — full width, métricas toggláveis */}
              <TimeSeriesChart
                data={data.timeSeries}
                providers={[provider]}
                singleProvider={provider}
                height={320}
              />

              {/* FollowersDeltaChart — variação diária */}
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

          {/* ── SEÇÃO 5: PERFORMANCE DE CONTEÚDO ── */}
          <motion.div {...sectionAnim(0.25)} className="space-y-4">
            <SectionHeader
              title="Performance de Conteudo"
              subtitle="Taxa de salvamentos, distribuicao de engajamento e formatos com melhor resultado"
            />

            {/* Row: SaveRateCard | EngagementBreakdown | BreakdownPie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SaveRateCard saveRate={saveRate} benchmark={0.02} />
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
                subtitle="Reels, posts, carrosseis e stories"
                data={breakdownPieData.length > 0 ? breakdownPieData : []}
                centerLabel={posts.length > 0 ? `${posts.length} posts` : undefined}
                emptyMessage="Nenhum post no periodo"
              />
            </div>

            {/* FormatPerformanceCards */}
            {formatItems.length > 0 && (
              <FormatPerformanceCards formats={formatItems} />
            )}

            {/* ContentTypePerformance — Radar chart */}
            {contentTypeData.length > 0 && (
              <ContentTypePerformance
                data={contentTypeData}
                metric="engagement"
                title="Performance por tipo de conteudo"
              />
            )}
          </motion.div>

          {/* ── SEÇÃO 6: MELHOR MOMENTO ── */}
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

          {/* ── SEÇÃO 7: HASHTAGS ── */}
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
              <div className="flex flex-wrap gap-2">
                {data.topHashtags.slice(0, 15).map((tag) => (
                  <span
                    key={tag.tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-elevated text-[12px] text-text-secondary border border-border/50"
                  >
                    <span className="text-accent font-medium">{tag.tag}</span>
                    <span className="text-text-muted">({tag.count})</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── SEÇÃO 8: TOP POSTS ── */}
          {postsTableRows.length > 0 ? (
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

          {/* Empty state global — sem KPIs, posts e timeSeries */}
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
