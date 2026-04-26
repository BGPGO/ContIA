"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import type { CrmLeadOrigin } from "@/types/analytics";

const PALETTE = ["#3b82f6", "#a855f7", "#22c55e", "#f59e0b", "#e1306c", "#4ecdc4"];

interface LeadsByOriginCardProps {
  data: CrmLeadOrigin[];
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: { pct: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-bg-card border border-border rounded-lg p-2.5 shadow-lg text-[12px]">
      <p className="font-medium text-text-primary">{entry.name}</p>
      <p className="text-text-muted">
        {entry.value.toLocaleString("pt-BR")} leads ({entry.payload.pct.toFixed(1)}%)
      </p>
    </div>
  );
}

export function LeadsByOriginCard({ data }: LeadsByOriginCardProps) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">Origens dos Leads</h3>
        <div className="flex items-center justify-center h-40 text-[13px] text-text-muted">
          Nenhum dado de origem no período selecionado.
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const chartData = data.map((d) => ({ ...d, name: d.label }));

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-0.5">Origens dos Leads</h3>
      <p className="text-[12px] text-text-muted mb-4">De onde vieram os novos leads</p>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Donut */}
        <div className="relative w-[160px] h-[160px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="56%"
                outerRadius="78%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[20px] font-bold text-text-primary tabular-nums leading-none">
              {total.toLocaleString("pt-BR")}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">leads</span>
          </div>
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-3 flex-1 min-w-0 w-full">
          {data.map((item, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const barWidth = total > 0 ? Math.max(4, (item.count / total) * 100) : 4;
            return (
              <div key={item.origin} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[12px] text-text-secondary truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-semibold text-text-primary tabular-nums">
                      {item.count.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[11px] text-text-muted tabular-nums w-10 text-right">
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
