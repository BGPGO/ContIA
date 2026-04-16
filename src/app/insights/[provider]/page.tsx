"use client";

import { Suspense } from "react";
import { use } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useProviderInsights } from "@/hooks/useProviderInsights";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import { ProviderIcon } from "@/components/conexoes/ProviderIcon";
import { KPICard } from "@/components/insights/KPICard";
import { TimeSeriesChart } from "@/components/insights/TimeSeriesChart";
import { ContentRow } from "@/components/insights/ContentRow";
import { AnalysisCard } from "@/components/insights/AnalysisCard";
import { EmptyState } from "@/components/insights/EmptyState";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import type { ProviderKey } from "@/types/providers";

function ProviderInsightsContent({ provider }: { provider: ProviderKey }) {
  const { empresa } = useEmpresa();
  const { preset, range, setPreset, setCustomRange, label } = usePeriodSelector();
  const {
    data,
    loading,
    error,
    refresh,
    syncing,
    syncNow,
    loadMore,
    hasMore,
  } = useProviderInsights(provider, range.start, range.end);

  const meta = METADATA_BY_PROVIDER[provider];

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  if (!meta) {
    return (
      <EmptyState
        title="Provider nao encontrado"
        description="Este provider nao existe na plataforma."
        actionLabel="Voltar para Inteligencia"
        actionHref="/insights"
      />
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/insights"
          className="inline-flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar para Inteligencia
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${meta.color}18` }}
          >
            <ProviderIcon name={meta.iconName} color={meta.color} size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">{meta.displayName}</h1>
              {data?.connected && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} />
                  Conectado
                </span>
              )}
            </div>
            <p className="text-[13px] text-text-secondary mt-0.5">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
            aria-label="Sincronizar agora"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
      </motion.div>

      {/* Period selector */}
      <PeriodSelector
        preset={preset}
        onPresetChange={setPreset}
        onCustomRange={setCustomRange}
        label={label}
      />

      {/* Not connected empty state */}
      {data && !data.connected && (
        <EmptyState
          title={`${meta.displayName} nao conectado`}
          description={`Conecte sua conta do ${meta.displayName} para visualizar metricas e insights detalhados.`}
          actionLabel="Ir para Conexoes"
          actionHref="/conexoes"
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-bg-card border border-border rounded-xl p-5 animate-pulse"
            >
              <div className="w-9 h-9 rounded-lg bg-bg-elevated mb-3" />
              <div className="h-8 w-24 bg-bg-elevated rounded mb-2" />
              <div className="h-3 w-16 bg-bg-elevated rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[13px]">
          {error}
        </div>
      )}

      {/* Data */}
      {data && data.connected && !loading && (
        <>
          {/* KPIs */}
          {data.kpis.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data.kpis.map((kpi, i) => (
                <KPICard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  previousValue={kpi.previousValue}
                  delta={kpi.delta}
                  deltaPercent={kpi.deltaPercent}
                  trend={kpi.trend}
                  icon={kpi.icon}
                  animationDelay={i * 0.05}
                />
              ))}
            </div>
          )}

          {/* Time Series */}
          {data.timeSeries.length > 0 && (
            <TimeSeriesChart
              data={data.timeSeries}
              providers={[provider]}
              singleProvider={provider}
            />
          )}

          {/* Content list */}
          {data.content.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-text-primary">
                  Conteudos ({data.totalContent})
                </h2>
              </div>
              <div className="space-y-2">
                {data.content.map((item, i) => (
                  <ContentRow
                    key={item.id}
                    id={item.id}
                    provider={item.provider}
                    contentType={item.content_type}
                    title={item.title}
                    caption={item.caption}
                    thumbnailUrl={item.thumbnail_url}
                    url={item.url}
                    engagement={item.engagement}
                    metrics={item.metrics}
                    animationDelay={i * 0.02}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full py-3 rounded-xl text-[13px] font-medium text-accent hover:bg-accent/5 border border-border hover:border-accent/30 transition-all"
                >
                  Carregar mais
                </button>
              )}
            </motion.div>
          )}

          {/* No content */}
          {data.content.length === 0 && data.timeSeries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[14px] text-text-muted">
                Nenhum dado encontrado para este periodo.
              </p>
            </div>
          )}

          {/* AI Analysis */}
          <AnalysisCard
            analysis={data.analysis}
            showGenerateButton
            generateHref={`/relatorios/novo?provider=${provider}`}
          />
        </>
      )}
    </div>
  );
}

export default function ProviderInsightsPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 text-text-muted">
          Carregando...
        </div>
      }
    >
      <ProviderInsightsContent provider={provider as ProviderKey} />
    </Suspense>
  );
}
