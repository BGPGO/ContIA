"use client";

import { Suspense } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  RefreshCw,
  FileText,
  Cable,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useInsights } from "@/hooks/useInsights";
import { useConnections } from "@/hooks/useConnections";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { PROVIDER_DISPLAY_ORDER } from "@/lib/drivers/metadata";
import { KPICard } from "@/components/insights/KPICard";
import { TimeSeriesChart } from "@/components/insights/TimeSeriesChart";
import { ContentRow } from "@/components/insights/ContentRow";
import { AnalysisCard } from "@/components/insights/AnalysisCard";
import { EmptyState } from "@/components/insights/EmptyState";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import type { ProviderKey } from "@/types/providers";

function InsightsContent() {
  const { empresa } = useEmpresa();
  const { isConnected, loading: connectionsLoading } = useConnections();
  const { preset, range, setPreset, setCustomRange, label } = usePeriodSelector();
  const { data, loading, error, refresh } = useInsights(range.start, range.end);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const connectedProviders = PROVIDER_DISPLAY_ORDER.filter((k) => isConnected(k));
  const connectedCount = connectedProviders.length;
  const hasConnections = connectedCount > 0;

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
              <Sparkles size={18} className="text-accent" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                Inteligencia
              </h1>
              <p className="text-[13px] text-text-secondary">
                Visao consolidada das suas redes e canais
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
            <Link
              href="/relatorios/novo"
              className="btn-primary flex items-center gap-1.5 text-[12px] py-1.5 px-3"
            >
              <FileText size={14} />
              Gerar relatorio
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Period selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
      >
        <PeriodSelector
          preset={preset}
          onPresetChange={setPreset}
          onCustomRange={setCustomRange}
          label={label}
        />
      </motion.div>

      {/* Connection status banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between px-4 py-3 rounded-xl bg-bg-card border border-border"
      >
        <div className="flex items-center gap-2 text-[13px]">
          <Cable size={16} className="text-text-muted" />
          {connectionsLoading ? (
            <span className="text-text-muted">Verificando conexoes...</span>
          ) : (
            <span className="text-text-secondary">
              <span className="font-semibold text-accent">{connectedCount}</span> de{" "}
              <span className="font-medium">{PROVIDER_DISPLAY_ORDER.length}</span> redes
              conectadas
            </span>
          )}
        </div>
        <Link
          href="/conexoes"
          className="text-[12px] font-medium text-accent hover:text-accent-light transition-colors flex items-center gap-1"
        >
          Conectar mais
          <ArrowRight size={12} />
        </Link>
      </motion.div>

      {/* No connections empty state */}
      {!connectionsLoading && !hasConnections && (
        <EmptyState
          icon={Cable}
          title="Nenhuma rede conectada"
          description="Conecte suas redes sociais, ferramentas de analytics e canais de marketing para comecar a ver seus insights consolidados."
          actionLabel="Conectar primeira rede"
          actionHref="/conexoes"
        />
      )}

      {/* Loading skeleton */}
      {loading && hasConnections && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[13px]">
          {error}
        </div>
      )}

      {/* Dashboard content */}
      {data && hasConnections && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

          {/* Time Series Chart */}
          {data.timeSeries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <TimeSeriesChart
                data={data.timeSeries}
                providers={connectedProviders}
              />
            </motion.div>
          )}

          {/* Top Content */}
          {data.topContent.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-text-primary">
                  Top conteudos do periodo
                </h2>
                <Link
                  href="/insights/comparar"
                  className="text-[12px] font-medium text-accent hover:text-accent-light transition-colors flex items-center gap-1"
                >
                  Ver tudo
                  <ArrowRight size={12} />
                </Link>
              </div>
              <div className="space-y-2">
                {data.topContent.slice(0, 10).map((item, i) => (
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
                    rank={i + 1}
                    animationDelay={i * 0.03}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* No content in period */}
          {data.topContent.length === 0 && data.timeSeries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[14px] text-text-muted">
                Nenhuma atividade encontrada neste periodo.
              </p>
              <p className="text-[12px] text-text-muted mt-1">
                Tente selecionar um periodo mais longo.
              </p>
            </div>
          )}

          {/* AI Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <AnalysisCard
              analysis={data.latestAnalysis}
              compact
              showGenerateButton
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 text-text-muted">
          Carregando...
        </div>
      }
    >
      <InsightsContent />
    </Suspense>
  );
}
