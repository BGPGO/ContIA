"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

/* ── Cores consistentes com globals.css / paleta do projeto ── */
const COLOR_GAIN = "#22c55e";   // green-500
const COLOR_LOSS = "#ef4444";   // red-500
const COLOR_ZERO = "#5e6388";   // --color-text-muted

interface DeltaPoint {
  date: string;
  delta: number;
}

export interface FollowersDeltaChartProps {
  /** Série temporal de seguidores, ordenada por data asc */
  data: Array<{ date: string; followers: number }>;
  /** Nome do provider (ex: "Instagram"). Se omitido, título genérico. */
  provider?: string;
  height?: number;
}

/* ── Helpers de formatação ── */
function formatShortDate(dateStr: string): string {
  try {
    // dateStr pode ser "YYYY-MM-DD" — forçar interpretação local
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
  } catch {
    return dateStr;
  }
}

function formatLongDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatDeltaLabel(delta: number): string {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function formatYAxis(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

/* ── Tooltip customizado PT-BR ── */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: DeltaPoint }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || label === undefined) return null;

  const delta = payload[0].value;
  let segText: string;
  if (delta > 0) segText = `+${delta} seguidores`;
  else if (delta < 0) segText = `${delta} seguidores`;
  else segText = "Sem mudança";

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-[11px] text-text-muted mb-1">{formatLongDate(label)}</p>
      <p
        className="text-[13px] font-semibold"
        style={{
          color: delta > 0 ? COLOR_GAIN : delta < 0 ? COLOR_LOSS : COLOR_ZERO,
        }}
      >
        {segText}
      </p>
    </div>
  );
}

/* ── Totais agregados ── */
interface TotalsProps {
  deltaData: DeltaPoint[];
}

function DeltaTotals({ deltaData }: TotalsProps) {
  const gain = deltaData.reduce((acc, d) => (d.delta > 0 ? acc + d.delta : acc), 0);
  const loss = deltaData.reduce((acc, d) => (d.delta < 0 ? acc + d.delta : acc), 0);
  const balance = gain + loss;

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex flex-col">
        <span className="text-[10px] text-text-muted uppercase tracking-wide">Ganho</span>
        <span className="text-[15px] font-bold" style={{ color: COLOR_GAIN }}>
          +{gain}
        </span>
      </div>
      <div className="w-px h-8 bg-border" />
      <div className="flex flex-col">
        <span className="text-[10px] text-text-muted uppercase tracking-wide">Perda</span>
        <span className="text-[15px] font-bold" style={{ color: COLOR_LOSS }}>
          {loss}
        </span>
      </div>
      <div className="w-px h-8 bg-border" />
      <div className="flex flex-col">
        <span className="text-[10px] text-text-muted uppercase tracking-wide">Saldo</span>
        <span
          className="text-[15px] font-bold"
          style={{ color: balance > 0 ? COLOR_GAIN : balance < 0 ? COLOR_LOSS : COLOR_ZERO }}
        >
          {formatDeltaLabel(balance)}
        </span>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function FollowersDeltaChart({
  data,
  provider,
  height = 240,
}: FollowersDeltaChartProps) {
  const deltaData: DeltaPoint[] = useMemo(() => {
    if (data.length < 2) return [];
    return data.slice(1).map((point, idx) => ({
      date: point.date,
      delta: point.followers - data[idx].followers,
    }));
  }, [data]);

  const title = provider
    ? `Variação diária — ${provider}`
    : "Variação diária de seguidores";

  /* ── Empty state ── */
  if (data.length < 2) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="mb-1">
          <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
          <p className="text-[11px] text-text-muted">Entradas e saídas</p>
        </div>
        <div className="flex items-center justify-center h-[160px] text-text-muted text-[13px] text-center px-4">
          Aguardando dados. Variação aparecerá após o segundo dia de conexão.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
          <p className="text-[11px] text-text-muted">Entradas e saídas</p>
        </div>
        <DeltaTotals deltaData={deltaData} />
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={deltaData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatYAxis}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="delta" radius={[3, 3, 0, 0]} maxBarSize={32}>
            {deltaData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.delta > 0 ? COLOR_GAIN : entry.delta < 0 ? COLOR_LOSS : COLOR_ZERO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
