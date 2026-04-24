"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

const PALETTE = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#eab308",
  "#6c5ce7",
  "#4ecdc4",
  "#e1306c",
];

export interface BreakdownPieItem {
  label: string;
  value: number;
  color?: string;
}

export interface BreakdownPieProps {
  title: string;
  subtitle?: string;
  data: BreakdownPieItem[];
  centerLabel?: string;
  emptyMessage?: string;
}

interface TooltipPayload {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const total = entry.value;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-2.5 shadow-lg">
      <p className="text-[12px] font-medium text-text-primary">{entry.name}</p>
      <p className="text-[11px] text-text-muted">{total.toLocaleString("pt-BR")}</p>
    </div>
  );
}

export function BreakdownPie({
  title,
  subtitle,
  data,
  centerLabel,
  emptyMessage = "Sem dados no período",
}: BreakdownPieProps) {
  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">{title}</h3>
        {subtitle && (
          <p className="text-[12px] text-text-muted mb-3">{subtitle}</p>
        )}
        <div className="flex items-center justify-center text-text-muted text-[13px] h-[160px]">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-1">{title}</h3>
      {subtitle && (
        <p className="text-[12px] text-text-muted mb-3">{subtitle}</p>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-3">
        {/* Donut */}
        <div className="relative w-[180px] h-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((item, idx) => (
                  <Cell
                    key={item.label}
                    fill={item.color ?? PALETTE[idx % PALETTE.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          {centerLabel && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[12px] font-semibold text-text-primary text-center leading-tight px-2">
                {centerLabel}
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {data.map((item, idx) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
            const color = item.color ?? PALETTE[idx % PALETTE.length];
            return (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[12px] text-text-secondary flex-1 truncate capitalize">
                  {item.label}
                </span>
                <span className="text-[11px] text-text-muted tabular-nums shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
