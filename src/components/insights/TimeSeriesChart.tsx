"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";
import type { TimeSeriesPoint } from "@/hooks/useInsights";

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  providers: ProviderKey[];
  metrics?: string[];
  height?: number;
  showLegend?: boolean;
  singleProvider?: ProviderKey;
}

const METRIC_OPTIONS = [
  { key: "followers", label: "Seguidores" },
  { key: "engagement", label: "Engajamento" },
  { key: "reach", label: "Alcance" },
  { key: "impressions", label: "Impressoes" },
];

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
  } catch {
    return dateStr;
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-[11px] text-text-muted mb-2">{label ? formatDateLabel(label) : ""}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[12px]">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}</span>
          <span className="ml-auto font-semibold text-text-primary">
            {typeof entry.value === "number" ? entry.value.toLocaleString("pt-BR") : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimeSeriesChart({
  data,
  providers,
  height = 320,
  showLegend = true,
  singleProvider,
}: TimeSeriesChartProps) {
  const [activeMetric, setActiveMetric] = useState("followers");

  // Build line keys: either one per provider or metrics for a single provider
  const lines = useMemo(() => {
    if (singleProvider) {
      return METRIC_OPTIONS.filter((m) => m.key === activeMetric).map((m) => ({
        dataKey: m.key,
        name: m.label,
        color: METADATA_BY_PROVIDER[singleProvider]?.color ?? "#4ecdc4",
      }));
    }

    return providers.map((p) => ({
      dataKey: `${p}_${activeMetric}`,
      name: METADATA_BY_PROVIDER[p]?.displayName ?? p,
      color: METADATA_BY_PROVIDER[p]?.color ?? "#4ecdc4",
    }));
  }, [providers, activeMetric, singleProvider]);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      {/* Metric toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-text-primary">
          Evolucao temporal
        </h3>
        <div className="flex items-center gap-1" role="tablist" aria-label="Selecionar metrica">
          {METRIC_OPTIONS.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={activeMetric === m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                activeMetric === m.key
                  ? "bg-accent text-bg-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-text-muted text-[13px]">
          Sem dados para o periodo selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
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
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconSize={8}
                iconType="circle"
              />
            )}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
