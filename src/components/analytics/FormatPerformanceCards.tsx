"use client";

import { Film, Image, Layers, BookOpen, LayoutGrid } from "lucide-react";

export type FormatType = "reel" | "post" | "carousel" | "story" | string;

export interface FormatItem {
  type: FormatType;
  label: string;
  count: number;
  avgEngagement: number;
  avgReach: number;
  bestPostId?: string;
}

export interface FormatPerformanceCardsProps {
  formats: FormatItem[];
}

const FORMAT_META: Record<string, { icon: typeof Film; color: string }> = {
  reel:     { icon: Film,       color: "#a855f7" },
  post:     { icon: Image,      color: "#3b82f6" },
  carousel: { icon: Layers,     color: "#f97316" },
  story:    { icon: BookOpen,   color: "#22c55e" },
};

function getFormatMeta(type: string): { icon: typeof Film; color: string } {
  return FORMAT_META[type.toLowerCase()] ?? { icon: LayoutGrid, color: "#eab308" };
}

export function FormatPerformanceCards({ formats }: FormatPerformanceCardsProps) {
  if (formats.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 flex items-center justify-center text-text-muted text-[13px]">
        Nenhum formato com dados no período
      </div>
    );
  }

  // Best by avgEngagement
  const bestIdx = formats.reduce(
    (best, fmt, i) => (fmt.avgEngagement > formats[best].avgEngagement ? i : best),
    0
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {formats.map((fmt, idx) => {
        const { icon: Icon, color } = getFormatMeta(fmt.type);
        const isBest = idx === bestIdx;
        const engPct = (fmt.avgEngagement * 100).toFixed(2);

        return (
          <div
            key={fmt.type}
            className={`relative bg-bg-card border rounded-xl p-4 transition-all ${
              isBest
                ? "border-[#a855f7]/40 ring-1 ring-[#a855f7]/20"
                : "border-border hover:border-border/80"
            }`}
          >
            {isBest && (
              <div
                className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: "#a855f720",
                  border: "1px solid #a855f740",
                  color: "#a855f7",
                }}
              >
                Melhor
              </div>
            )}

            {/* Icon + type */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon size={16} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text-primary truncate">
                  {fmt.label}
                </p>
                <p className="text-[11px] text-text-muted">
                  {fmt.count} {fmt.count === 1 ? "post" : "posts"}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Eng. médio</span>
                <span className="text-[13px] font-semibold text-text-primary tabular-nums">
                  {engPct}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Alcance médio</span>
                <span className="text-[12px] font-medium text-text-secondary tabular-nums">
                  {fmt.avgReach >= 1_000
                    ? `${(fmt.avgReach / 1_000).toFixed(1)}k`
                    : fmt.avgReach.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
