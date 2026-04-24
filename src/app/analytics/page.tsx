"use client";

import { Suspense } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { useConnections } from "@/hooks/useConnections";
import { PROVIDER_DISPLAY_ORDER } from "@/lib/drivers/metadata";
import { KPICard } from "@/components/insights/KPICard";
import { TimeSeriesChart } from "@/components/insights/TimeSeriesChart";
import { FollowersDeltaChart } from "@/components/insights/FollowersDeltaChart";
import { ContentRow } from "@/components/insights/ContentRow";
import { EmptyState } from "@/components/insights/EmptyState";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { ProviderSummaryRow } from "@/components/analytics/ProviderSummaryRow";
import type { ProviderKey } from "@/types/providers";

function AnalyticsContent() {
  const { empresa } = useEmpresa();
  const { isConnected, loading: connectionsLoading } = useConnections();
  const { preset, range, setPreset, setCustomRange, label } = usePeriodSelector();
  const { data, loading, error, refresh } = useAnalyticsOverview(range.start, range.end);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const connectedProviders = PROVIDER_DISPLAY_ORDER.filter((k) => isConnected(k));
  const hasConnections = connectedProviders.length > 0;

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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
              <BarChart3 size={18} className="text-accent" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                Analytics
              </h1>
              <p className="text-[13px] text-text-secondary">
                Desempenho das suas redes e canais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
              aria-label="Atualizar dados"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Period selector */}
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
      {(loading || connectionsLoading) && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-text-secondary">
            <RefreshCw size={18} className="animate-spin text-accent" />
            <span className="text-[14px]">Carregando analytics...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* No connections */}
      {!loading && !connectionsLoading && !hasConnections && (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma rede conectada"
          description="Conecte suas redes sociais para visualizar os dados de performance em tempo real."
          actionLabel="Conectar redes"
          actionHref="/conexoes"
        />
      )}

      {/* Dashboard content */}
      {data && hasConnections && (
        <>
          {/* KPIs */}
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

          {/* Provider summary rows */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-text-primary">
                Visao por Rede
              </h3>
              <span className="text-[11px] text-text-muted">
                {connectedProviders.length} conectada{connectedProviders.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {data.providers.map((summary, i) => (
                <ProviderSummaryRow key={summary.provider} summary={summary} index={i} />
              ))}
            </div>
          </motion.div>

          {/* Time series chart */}
          {data.timeSeries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <TimeSeriesChart
                data={data.timeSeries}
                providers={connectedProviders}
                height={320}
              />
            </motion.div>
          )}

          {/* Followers delta charts — one per connected provider with follower data */}
          {data.timeSeries.length > 0 &&
            connectedProviders
              .filter((provider) =>
                data.timeSeries.some(
                  (pt) => typeof pt[`${provider}_followers`] === "number"
                )
              )
              .map((provider, i) => {
                const series = data.timeSeries
                  .filter((pt) => typeof pt[`${provider}_followers`] === "number")
                  .map((pt) => ({
                    date: pt.date as string,
                    followers: pt[`${provider}_followers`] as number,
                  }));

                return (
                  <motion.div
                    key={`delta-${provider}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.05, duration: 0.4 }}
                  >
                    <FollowersDeltaChart
                      data={series}
                      provider={
                        connectedProviders.length > 1
                          ? provider.charAt(0).toUpperCase() + provider.slice(1)
                          : undefined
                      }
                      height={240}
                    />
                  </motion.div>
                );
              })}

          {/* Recent posts */}
          {data.recentPosts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-text-primary">
                  Posts Recentes
                </h3>
              </div>
              <div className="space-y-2">
                {data.recentPosts.slice(0, 8).map((post, i) => (
                  <ContentRow
                    key={post.id}
                    id={post.id}
                    provider={post.provider}
                    contentType={post.content_type}
                    title={post.title}
                    caption={post.caption}
                    thumbnailUrl={post.thumbnail_url}
                    url={post.url}
                    engagement={post.engagement}
                    metrics={post.metrics}
                    animationDelay={i * 0.05}
                  />
                ))}
              </div>
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
