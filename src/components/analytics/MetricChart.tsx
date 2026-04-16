"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { TimeSeriesDataPoint } from "@/types/analytics";

type ChartVariant = "line" | "area" | "bar";

interface MetricChartProps {
  data: TimeSeriesDataPoint[];
  dataKey: string;
  label?: string;
  color?: string;
  variant?: ChartVariant;
  height?: number;
}

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
      <p className="text-[11px] text-text-muted mb-1.5">
        {label ? formatDateLabel(label) : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[12px]">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}</span>
          <span className="ml-auto font-semibold text-text-primary tabular-nums">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString("pt-BR")
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MetricChart({
  data,
  dataKey,
  label,
  color = "#4ecdc4",
  variant = "area",
  height = 240,
}: MetricChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-[13px]"
        style={{ height }}
      >
        Sem dados para o periodo
      </div>
    );
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 10, left: 0, bottom: 5 },
  };

  const xAxisProps = {
    dataKey: "date" as const,
    tickFormatter: formatDateLabel,
    tick: { fontSize: 11, fill: "var(--color-text-muted)" },
    axisLine: { stroke: "var(--color-border)" },
    tickLine: false,
  };

  const yAxisProps = {
    tick: { fontSize: 11, fill: "var(--color-text-muted)" },
    axisLine: false as const,
    tickLine: false,
    tickFormatter: (v: number) =>
      v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString(),
  };

  const gridProps = {
    strokeDasharray: "3 3",
    stroke: "var(--color-border)",
    opacity: 0.5,
  };

  const displayName = label ?? dataKey;

  return (
    <ResponsiveContainer width="100%" height={height}>
      {variant === "line" ? (
        <LineChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={displayName}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      ) : variant === "bar" ? (
        <BarChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={dataKey} name={displayName} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : (
        <AreaChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            name={displayName}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
