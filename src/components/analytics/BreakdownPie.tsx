"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import type { BreakdownItem } from "@/types/analytics";

interface BreakdownPieProps {
  items: BreakdownItem[];
  title?: string;
  height?: number;
}

const DEFAULT_COLORS = [
  "#6c5ce7",
  "#4ecdc4",
  "#fbbf24",
  "#e1306c",
  "#1877F2",
  "#0A66C2",
  "#FF0000",
  "#10B981",
  "#8B5CF6",
];

interface CustomTooltipPayload {
  name: string;
  value: number;
  payload: { percentage: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-bg-card border border-border rounded-lg p-2.5 shadow-lg">
      <p className="text-[12px] font-medium text-text-primary">{entry.name}</p>
      <p className="text-[11px] text-text-muted">
        {entry.value} ({entry.payload.percentage}%)
      </p>
    </div>
  );
}

export function BreakdownPie({
  items,
  title = "Breakdown",
  height = 280,
}: BreakdownPieProps) {
  if (items.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-2">
          {title}
        </h3>
        <div
          className="flex items-center justify-center text-text-muted text-[13px]"
          style={{ height: height - 60 }}
        >
          Sem dados
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-2">
        {title}
      </h3>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <ResponsiveContainer width="100%" height={height - 60}>
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {items.map((item, idx) => (
                <Cell
                  key={item.label}
                  fill={item.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          {items.map((item, idx) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    item.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
                }}
              />
              <span className="text-[11px] text-text-secondary capitalize flex-1">
                {item.label}
              </span>
              <span className="text-[11px] text-text-muted tabular-nums">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
