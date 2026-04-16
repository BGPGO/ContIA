"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  RefreshCw,
  Cable,
} from "lucide-react";
import Link from "next/link";
import { useProviderAnalytics } from "@/hooks/useProviderAnalytics";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import { KPICard } from "@/components/insights/KPICard";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { EmptyState } from "@/components/insights/EmptyState";
import { MetricChart } from "@/components/analytics/MetricChart";
import { PostsTable } from "@/components/analytics/PostsTable";
import { HeatmapChart } from "@/components/analytics/HeatmapChart";
import { BreakdownPie } from "@/components/analytics/BreakdownPie";
import { FunnelChart } from "@/components/analytics/FunnelChart";
import type { ProviderKey } from "@/types/providers";

/* ── Metric config per provider category ───────────────────────── */

interface ChartConfig {
  dataKey: string;
  label: string;
  color: string;
}

function getChartConfigs(provider: ProviderKey, providerColor: string): ChartConfig[] {
  if (
    provider === "instagram" ||
    provider === "facebook" ||
    provider === "linkedin" ||
    provider === "youtube"
  ) {
    return [
      { dataKey: "followers", label: "Seguidores", color: providerColor },
      { dataKey: "reach", label: provider === "youtube" ? "Views" : "Alcance", color: "#fbbf24" },
      { dataKey: "impressions", label: "Impressoes", color: "#6c5ce7" },
    ];
  }
  if (provider === "ga4") {
    return [
      { dataKey: "sessions", label: "Sessoes", color: providerColor },
      { dataKey: "users", label: "Usuarios", color: "#6c5ce7" },
    ];
  }
  if (provider === "google_ads" || provider === "meta_ads") {
    return [
      { dataKey: "spend", label: "Investimento", color: providerColor },
      { dataKey: "clicks", label: "Cliques", color: "#fbbf24" },
    ];
  }
  if (provider === "crm") {
    return [
      { dataKey: "leads", label: "Leads Novos", color: providerColor },
    ];
  }
  return [
    { dataKey: "followers", label: "Seguidores", color: providerColor },
  ];
}

/* ── Main ──────────────────────────────────────────────────────── */

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

  const chartConfigs = getChartConfigs(provider, meta.color);
  const isSocial = meta.category === "social";
  const isAds = meta.category === "ads";

  return (
    <div className="space-y-5 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
              aria-label="Voltar para Analytics"
            >
              <ArrowLeft size={18} className="text-text-muted" />
            </Link>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${meta.color}20` }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                {meta.displayName}
              </h1>
              <p className="text-[13px] text-text-secondary">
                Analytics detalhado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4">
          <PeriodSelector
            preset={preset}
            onPresetChange={setPreset}
            onCustomRange={setCustomRange}
            label={label}
          />
        </div>
      </motion.div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-text-secondary">
            <RefreshCw size={18} className="animate-spin text-accent" />
            <span className="text-[14px]">Carregando dados de {meta.displayName}...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Not connected */}
      {data && !data.connected && (
        <EmptyState
          icon={Cable}
          title={`${meta.displayName} nao conectado`}
          description={
            meta.status === "coming_soon"
              ? `A integracao com ${meta.displayName} estara disponivel em breve.`
              : `Conecte sua conta ${meta.displayName} para visualizar analytics detalhados.`
          }
          actionLabel={meta.status !== "coming_soon" ? "Conectar" : undefined}
          actionHref={meta.status !== "coming_soon" ? "/conexoes" : undefined}
        />
      )}

      {/* Connected content */}
      {data && data.connected && (
        <>
          {/* KPIs */}
          {data.kpis.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  animationDelay={i * 0.08}
                />
              ))}
            </div>
          )}

          {/* Charts */}
          {data.timeSeries.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {chartConfigs.map((cfg) => (
                <motion.div
                  key={cfg.dataKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
                >
                  <h3 className="text-[14px] font-semibold text-text-primary mb-3">
                    {cfg.label}
                  </h3>
                  <MetricChart
                    data={data.timeSeries}
                    dataKey={cfg.dataKey}
                    label={cfg.label}
                    color={cfg.color}
                    variant="area"
                    height={220}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Breakdown pie + Heatmap side by side */}
          {(data.breakdown.length > 0 || data.heatmap) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.breakdown.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <BreakdownPie
                    items={data.breakdown}
                    title="Breakdown por Formato"
                    height={280}
                  />
                </motion.div>
              )}

              {data.heatmap && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                >
                  <HeatmapChart data={data.heatmap} />
                </motion.div>
              )}
            </div>
          )}

          {/* Funnel (CRM) */}
          {data.funnelStages && data.funnelStages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <FunnelChart stages={data.funnelStages} />
            </motion.div>
          )}

          {/* Top Hashtags */}
          {data.topHashtags && data.topHashtags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
            >
              <h3 className="text-[14px] font-semibold text-text-primary mb-3">
                Top Hashtags
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.topHashtags.map((tag) => (
                  <span
                    key={tag.tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-elevated text-[12px] text-text-secondary"
                  >
                    <span className="text-accent font-medium">{tag.tag}</span>
                    <span className="text-text-muted">({tag.count})</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Posts table */}
          {data.posts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="space-y-3"
            >
              <h3 className="text-[14px] font-semibold text-text-primary">
                Posts no Periodo
              </h3>
              <PostsTable posts={data.posts} />
            </motion.div>
          )}

          {/* LinkedIn CMA notice */}
          {provider === "linkedin" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-[#0A66C2]/10 border border-[#0A66C2]/20 rounded-xl p-4 text-[13px] text-text-secondary"
            >
              <strong className="text-text-primary">Nota:</strong> Analytics completo do LinkedIn
              requer aprovacao da Community Management API (CMA). Sem ela, apenas publicacao
              e dados basicos estao disponiveis.
            </motion.div>
          )}

          {/* No data state */}
          {data.kpis.length === 0 && data.posts.length === 0 && data.timeSeries.length === 0 && (
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
