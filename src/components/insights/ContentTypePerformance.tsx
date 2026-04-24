"use client";

import { useState, useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/* ── Types ─────────────────────────────────────────────────────── */

export interface ContentTypeData {
  type: string; // "reel" | "post" | "carousel" | "story" | etc
  label: string; // PT-BR, ex: "Reels"
  avgEngagementRate: number; // 0..1
  avgReach: number;
  count: number;
}

export interface ContentTypePerformanceProps {
  data: ContentTypeData[];
  metric?: "engagement" | "reach";
  title?: string;
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatPct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function formatReach(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return Math.round(v).toString();
}

/* ── Custom Tooltip ─────────────────────────────────────────────── */

interface TooltipPayloadItem {
  payload?: ContentTypeData & { radarValue: number };
}

function CustomTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  metric: "engagement" | "reach";
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-bg-elevated border border-border rounded-lg px-3 py-2.5 shadow-lg">
      <p className="text-[12px] font-semibold text-text-primary mb-1">{d.label}</p>
      <p className="text-[11px] text-text-muted">
        {metric === "engagement"
          ? `Taxa de eng.: ${formatPct(d.avgEngagementRate)}`
          : `Alcance médio: ${formatReach(d.avgReach)}`}
      </p>
      <p className="text-[11px] text-text-muted">{d.count} post{d.count !== 1 ? "s" : ""}</p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function ContentTypePerformance({
  data,
  metric: metricProp = "engagement",
  title = "Performance por tipo de conteúdo",
}: ContentTypePerformanceProps) {
  const [metric, setMetric] = useState<"engagement" | "reach">(metricProp);

  /* Guard: need at least 2 types with posts */
  const hasData = data.length >= 2 && data.some((d) => d.count > 0);

  /* Radar data — normalize values 0-100 for visual clarity */
  const { radarData, avg, sorted } = useMemo(() => {
    const active = data.filter((d) => d.count > 0);
    if (active.length === 0) {
      return { radarData: [], avg: 0, sorted: [] };
    }

    const values = active.map((d) =>
      metric === "engagement" ? d.avgEngagementRate : d.avgReach
    );
    const maxVal = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Include all types in radar (even count=0 types show as 0)
    const radarData = data.map((d) => {
      const raw = metric === "engagement" ? d.avgEngagementRate : d.avgReach;
      return {
        ...d,
        radarValue: maxVal > 0 ? (raw / maxVal) * 100 : 0,
      };
    });

    const sorted = [...active].sort((a, b) => {
      const va = metric === "engagement" ? a.avgEngagementRate : a.avgReach;
      const vb = metric === "engagement" ? b.avgEngagementRate : b.avgReach;
      return vb - va;
    });

    return { radarData, avg, sorted };
  }, [data, metric]);

  if (!hasData) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h2 className="text-[15px] font-semibold text-text-primary mb-4">{title}</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-muted"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <p className="text-[13px] text-text-muted max-w-xs leading-relaxed">
            São necessários pelo menos 2 tipos de conteúdo com posts publicados para exibir a comparação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>

        {/* Metric toggle */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-border rounded-lg p-1">
          <button
            onClick={() => setMetric("engagement")}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              metric === "engagement"
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Engajamento
          </button>
          <button
            onClick={() => setMetric("reach")}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              metric === "reach"
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Alcance
          </button>
        </div>
      </div>

      {/* Layout: Radar + list */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Radar chart */}
        <div className="flex-1 min-h-[260px]">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid
                stroke="rgba(255,255,255,0.08)"
                gridType="polygon"
              />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-muted, #9ca3af)", fontSize: 11 }}
              />
              <Radar
                name={metric === "engagement" ? "Taxa de engajamento" : "Alcance médio"}
                dataKey="radarValue"
                stroke="rgb(34, 197, 94)"
                fill="rgba(34, 197, 94, 0.2)"
                strokeWidth={2}
                dot={{ fill: "rgb(34, 197, 94)", r: 3 }}
              />
              <Tooltip
                content={<CustomTooltip metric={metric} />}
                cursor={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking list */}
        <div className="sm:w-[200px] flex flex-col gap-2">
          <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide mb-1">
            Ranking
          </p>
          {sorted.map((item, idx) => {
            const val =
              metric === "engagement" ? item.avgEngagementRate : item.avgReach;
            const avgVal = avg;
            const delta = avgVal > 0 ? ((val - avgVal) / avgVal) * 100 : 0;
            const isAbove = delta >= 0;

            return (
              <div
                key={item.type}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-bg-elevated border border-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-text-muted w-4 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-[12px] text-text-primary truncate">
                    {item.label}
                  </span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[12px] font-semibold text-text-primary">
                    {metric === "engagement"
                      ? formatPct(item.avgEngagementRate)
                      : formatReach(item.avgReach)}
                  </span>
                  {avgVal > 0 && (
                    <span
                      className={`text-[10px] font-medium ${
                        isAbove ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isAbove ? "+" : ""}
                      {delta.toFixed(0)}% vs média
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
