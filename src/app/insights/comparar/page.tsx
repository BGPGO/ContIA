"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useEmpresa } from "@/hooks/useEmpresa";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import { formatNumber } from "@/lib/utils";
import { MetricDelta } from "@/components/insights/MetricDelta";
import { ProviderBadge } from "@/components/insights/ProviderBadge";
import { EmptyState } from "@/components/insights/EmptyState";
import type { ProviderKey } from "@/types/providers";

/* ── Types ──────────────────────────────────────────────────── */

interface ComparisonRow {
  provider: string;
  providerName: string;
  color: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "flat";
}

interface CompareData {
  comparisons: ComparisonRow[];
  timeSeriesA: Array<Record<string, unknown>>;
  timeSeriesB: Array<Record<string, unknown>>;
  periodA: { start: string; end: string };
  periodB: { start: string; end: string };
  providers: ProviderKey[];
}

/* ── Helpers ────────────────────────────────────────────────── */

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/* ── Custom Tooltip ─────────────────────────────────────────── */

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-[11px] text-text-muted mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-text-secondary">{entry.name}</span>
          <span className="ml-auto font-semibold text-text-primary">
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Page content ──────────────────────────────────────────── */

function CompareContent() {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: this month vs last month
  const [periodAStart, setPeriodAStart] = useState(daysAgo(30));
  const [periodAEnd, setPeriodAEnd] = useState(todayISO());
  const [periodBStart, setPeriodBStart] = useState(daysAgo(60));
  const [periodBEnd, setPeriodBEnd] = useState(daysAgo(31));

  const fetchComparison = useCallback(async () => {
    if (!empresa?.id) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        empresa_id: empresa.id,
        period_a_start: periodAStart,
        period_a_end: periodAEnd,
        period_b_start: periodBStart,
        period_b_end: periodBEnd,
      });

      const res = await fetch(`/api/insights/compare?${params}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = (await res.json()) as CompareData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar comparacao");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, periodAStart, periodAEnd, periodBStart, periodBEnd]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  // Group comparisons by provider
  const groupedByProvider = (data?.comparisons ?? []).reduce(
    (acc, row) => {
      if (!acc[row.provider]) acc[row.provider] = [];
      acc[row.provider].push(row);
      return acc;
    },
    {} as Record<string, ComparisonRow[]>
  );

  // Chart data: one bar per provider, comparing a metric
  const chartData = (data?.providers ?? []).map((p) => {
    const rows = groupedByProvider[p] ?? [];
    const meta = METADATA_BY_PROVIDER[p];
    const entry: Record<string, string | number> = { name: meta?.displayName ?? p };

    for (const row of rows) {
      entry[`${row.metric} (Atual)`] = row.currentValue;
      entry[`${row.metric} (Anterior)`] = row.previousValue;
    }

    return entry;
  });

  return (
    <div className="space-y-5 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Back + Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/insights"
          className="inline-flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Voltar para Inteligencia
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="page-header"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
            <ArrowLeftRight size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              Comparativo
            </h1>
            <p className="text-[13px] text-text-secondary">
              Compare periodos e identifique evolucao
            </p>
          </div>
        </div>
      </motion.div>

      {/* Period selectors */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Period A */}
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-accent uppercase tracking-wide">
              Periodo A (Atual)
            </label>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-text-muted shrink-0" />
              <input
                type="date"
                value={periodAStart}
                onChange={(e) => setPeriodAStart(e.target.value)}
                className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Periodo A inicio"
              />
              <span className="text-[11px] text-text-muted">ate</span>
              <input
                type="date"
                value={periodAEnd}
                onChange={(e) => setPeriodAEnd(e.target.value)}
                className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Periodo A fim"
              />
            </div>
          </div>

          {/* Period B */}
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-secondary uppercase tracking-wide">
              Periodo B (Anterior)
            </label>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-text-muted shrink-0" />
              <input
                type="date"
                value={periodBStart}
                onChange={(e) => setPeriodBStart(e.target.value)}
                className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Periodo B inicio"
              />
              <span className="text-[11px] text-text-muted">ate</span>
              <input
                type="date"
                value={periodBEnd}
                onChange={(e) => setPeriodBEnd(e.target.value)}
                className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Periodo B fim"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={fetchComparison}
            disabled={loading}
            className="btn-primary flex items-center gap-1.5 text-[12px] py-1.5 px-4 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Comparar
          </button>
        </div>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-accent animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[13px]">
          {error}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {data.comparisons.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Sem dados para comparar"
              description="Nao ha dados suficientes nos periodos selecionados para gerar uma comparacao."
            />
          ) : (
            <>
              {/* Comparison Chart */}
              {chartData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
                >
                  <h3 className="text-[14px] font-semibold text-text-primary mb-4">
                    Visao geral por rede
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        axisLine={{ stroke: "var(--color-border)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
                        }
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                      <Bar
                        dataKey="Engajamento (Atual)"
                        fill="var(--color-accent)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Engajamento (Anterior)"
                        fill="var(--color-secondary)"
                        radius={[4, 4, 0, 0]}
                        opacity={0.6}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Comparison Table */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-bg-card border border-border rounded-xl overflow-hidden"
              >
                <div className="px-4 sm:px-5 py-3 border-b border-border">
                  <h3 className="text-[14px] font-semibold text-text-primary">
                    Tabela comparativa
                  </h3>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2.5 text-text-muted font-semibold">
                          Rede
                        </th>
                        <th className="text-left px-4 py-2.5 text-text-muted font-semibold">
                          Metrica
                        </th>
                        <th className="text-right px-4 py-2.5 text-accent font-semibold">
                          {formatDateShort(data.periodA.start)} — {formatDateShort(data.periodA.end)}
                        </th>
                        <th className="text-right px-4 py-2.5 text-secondary font-semibold">
                          {formatDateShort(data.periodB.start)} — {formatDateShort(data.periodB.end)}
                        </th>
                        <th className="text-right px-4 py-2.5 text-text-muted font-semibold">
                          Variacao
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparisons.map((row, i) => (
                        <tr
                          key={`${row.provider}-${row.metric}`}
                          className="border-b border-border/50 hover:bg-bg-card-hover transition-colors"
                        >
                          <td className="px-4 py-2.5">
                            <ProviderBadge provider={row.provider as ProviderKey} />
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary">{row.metric}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-text-primary">
                            {formatNumber(row.currentValue)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-text-secondary">
                            {formatNumber(row.previousValue)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <MetricDelta
                              delta={row.delta}
                              deltaPercent={row.deltaPercent}
                              trend={row.trend}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-border/50">
                  {data.comparisons.map((row) => (
                    <div
                      key={`${row.provider}-${row.metric}-mobile`}
                      className="px-4 py-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <ProviderBadge provider={row.provider as ProviderKey} />
                        <MetricDelta
                          delta={row.delta}
                          deltaPercent={row.deltaPercent}
                          trend={row.trend}
                        />
                      </div>
                      <p className="text-[11px] text-text-muted">{row.metric}</p>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-text-primary font-medium">
                          Atual: {formatNumber(row.currentValue)}
                        </span>
                        <span className="text-text-secondary">
                          Anterior: {formatNumber(row.previousValue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Insights highlight */}
              {data.comparisons.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="card-featured p-5 sm:p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
                      <Sparkles size={20} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-text-primary">
                        Destaques da comparacao
                      </h3>
                      <p className="text-[11px] text-text-muted">
                        Maiores variacoes no periodo
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Best performer */}
                    {(() => {
                      const sorted = [...data.comparisons].sort(
                        (a, b) => b.deltaPercent - a.deltaPercent
                      );
                      const best = sorted[0];
                      const worst = sorted[sorted.length - 1];

                      return (
                        <>
                          {best && best.deltaPercent > 0 && (
                            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                              <p className="text-[11px] font-semibold text-success mb-1">
                                Maior crescimento
                              </p>
                              <p className="text-[13px] text-text-primary font-medium">
                                {best.providerName} — {best.metric}
                              </p>
                              <MetricDelta
                                delta={best.delta}
                                deltaPercent={best.deltaPercent}
                                trend={best.trend}
                                size="md"
                              />
                            </div>
                          )}
                          {worst && worst.deltaPercent < 0 && (
                            <div className="bg-danger/5 border border-danger/20 rounded-lg p-3">
                              <p className="text-[11px] font-semibold text-danger mb-1">
                                Maior queda
                              </p>
                              <p className="text-[13px] text-text-primary font-medium">
                                {worst.providerName} — {worst.metric}
                              </p>
                              <MetricDelta
                                delta={worst.delta}
                                deltaPercent={worst.deltaPercent}
                                trend={worst.trend}
                                size="md"
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 text-text-muted">
          Carregando...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
