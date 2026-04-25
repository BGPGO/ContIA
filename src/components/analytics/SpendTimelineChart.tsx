"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingDown } from "lucide-react";

/* ── Types ── */

export interface SpendDayPoint {
  date: string;
  spend: number;
  conversions: number;
}

interface SpendTimelineChartProps {
  data: SpendDayPoint[];
  title?: string;
}

/* ── Formatters ── */

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateFull(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/* ── Custom Tooltip ── */

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const spendEntry = payload.find((p) => p.dataKey === "spend");
  const convEntry = payload.find((p) => p.dataKey === "conversions");

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-xl min-w-[210px]">
      <p className="text-[11px] text-text-muted mb-2 font-medium">
        {formatDateFull(label)}
      </p>
      {spendEntry && (
        <div className="flex items-center gap-2 text-[12px] mb-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#7c3aed" }}
          />
          <span className="text-text-secondary">Gasto</span>
          <span className="ml-auto font-semibold text-text-primary">
            {formatBRL(spendEntry.value)}
          </span>
        </div>
      )}
      {convEntry && (
        <div className="flex items-center gap-2 text-[12px]">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#3b82f6" }}
          />
          <span className="text-text-secondary">Conversoes</span>
          <span className="ml-auto font-semibold text-text-primary">
            {convEntry.value.toLocaleString("pt-BR")}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export function SpendTimelineChart({
  data,
  title = "Evolucao de Gasto",
}: SpendTimelineChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.spend > 0);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        dateLabel: formatDateShort(d.date),
      })),
    [data]
  );

  const maxSpend = useMemo(
    () => Math.max(...data.map((d) => d.spend), 0),
    [data]
  );

  const maxConversions = useMemo(
    () => Math.max(...data.map((d) => d.conversions), 0),
    [data]
  );

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
        {hasData && (
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded bg-purple-500 inline-block" />
              Gasto (R$)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded bg-blue-500 inline-block" />
              Conversoes
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-[260px] gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
            <TrendingDown size={18} className="text-text-muted" />
          </div>
          <p className="text-[13px] text-text-muted">
            Sem gasto registrado no periodo
          </p>
        </div>
      ) : (
        <>
          {/* Gradient defs + chart */}
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                opacity={0.4}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              {/* Left Y: spend */}
              <YAxis
                yAxisId="spend"
                orientation="left"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toFixed(0)}`
                }
                domain={[0, maxSpend * 1.15]}
              />
              {/* Right Y: conversions */}
              {maxConversions > 0 && (
                <YAxis
                  yAxisId="conv"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, maxConversions * 1.15]}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconSize={8}
                iconType="circle"
                formatter={(value: string) =>
                  value === "spend" ? "Gasto (R$)" : "Conversoes"
                }
              />
              <Area
                yAxisId="spend"
                type="monotone"
                dataKey="spend"
                name="spend"
                stroke="#7c3aed"
                strokeWidth={2}
                fill="url(#spendGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#7c3aed" }}
              />
              {maxConversions > 0 && (
                <Area
                  yAxisId="conv"
                  type="monotone"
                  dataKey="conversions"
                  name="conversions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#convGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
