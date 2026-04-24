"use client";

import { useMemo } from "react";

/* ── Types ─────────────────────────────────────────────────────── */

export interface HeatmapCell {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=domingo ... 6=sábado
  hour: number; // 0-23
  engagement: number;
  postCount: number;
}

export interface BestTimeHeatmapProps {
  data: HeatmapCell[];
  title?: string;
  metric?: "engagement" | "reach" | "engagementRate";
}

/* ── Constants ──────────────────────────────────────────────────── */

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const METRIC_LABELS: Record<string, string> = {
  engagement: "engajamentos",
  reach: "alcance",
  engagementRate: "taxa de engajamento",
};

/* ── Color helpers ──────────────────────────────────────────────── */

/** Normalised 0-1 → HSL string. 0 = near-black, 1 = vibrant green (120°). */
function cellColor(norm: number): string {
  if (norm <= 0) return "rgba(255,255,255,0.04)";
  // Interpolate: hue 120 (green), saturation 85%, lightness 20%→45%
  const hue = 120;
  const sat = 70 + norm * 15; // 70 → 85
  const light = 15 + norm * 30; // 15 → 45
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/* ── Tooltip state (CSS-only, no library) ───────────────────────── */

interface CellData {
  day: number;
  hour: number;
  engagement: number;
  postCount: number;
  norm: number;
}

/* ── Main component ─────────────────────────────────────────────── */

export function BestTimeHeatmap({
  data,
  title = "Melhores horários para postar",
  metric = "engagement",
}: BestTimeHeatmapProps) {
  /* Build lookup map: dayOfWeek → hour → cell */
  const { grid, maxVal, topThree } = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of data) {
      map.set(`${cell.dayOfWeek}-${cell.hour}`, cell);
    }

    let maxVal = 0;
    for (const cell of data) {
      if (cell.engagement > maxVal) maxVal = cell.engagement;
    }

    // Build full 7×24 grid
    const grid: CellData[][] = DAY_LABELS.map((_, dayIdx) =>
      HOURS.map((hour) => {
        const c = map.get(`${dayIdx}-${hour}`);
        const eng = c?.engagement ?? 0;
        return {
          day: dayIdx,
          hour,
          engagement: eng,
          postCount: c?.postCount ?? 0,
          norm: maxVal > 0 ? eng / maxVal : 0,
        };
      })
    );

    // Top 3 cells by engagement
    const allCells = grid.flat().sort((a, b) => b.engagement - a.engagement);
    const topThree = new Set(
      allCells
        .filter((c) => c.engagement > 0)
        .slice(0, 3)
        .map((c) => `${c.day}-${c.hour}`)
    );

    return { grid, maxVal, topThree };
  }, [data]);

  const isEmpty = data.length === 0 || maxVal === 0;

  const metricLabel = METRIC_LABELS[metric] ?? "engajamentos";

  if (isEmpty) {
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
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-[13px] text-text-muted max-w-xs leading-relaxed">
            Aguardando dados. Heatmap aparecerá após semanas de atividade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 sm:p-6">
      {/* Header */}
      <h2 className="text-[15px] font-semibold text-text-primary mb-5">{title}</h2>

      {/* Scrollable grid container */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 800 }}>
          {/* Hour header row */}
          <div className="flex mb-1">
            {/* Day label spacer */}
            <div className="w-10 shrink-0" />
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[10px] text-text-muted leading-none"
                style={{ minWidth: 0 }}
              >
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {grid.map((row, dayIdx) => (
            <div key={dayIdx} className="flex mb-[3px]">
              {/* Day label */}
              <div className="w-10 shrink-0 flex items-center pr-1">
                <span className="text-[11px] text-text-muted font-medium">
                  {DAY_LABELS[dayIdx]}
                </span>
              </div>

              {/* Hour cells */}
              {row.map((cell) => {
                const key = `${cell.day}-${cell.hour}`;
                const isTop = topThree.has(key);
                const bg = cellColor(cell.norm);
                const tooltip =
                  cell.engagement > 0
                    ? `${DAY_LABELS[cell.day]} ${cell.hour}h — ${cell.engagement.toLocaleString("pt-BR")} ${metricLabel}${cell.postCount > 0 ? ` em ${cell.postCount} post${cell.postCount !== 1 ? "s" : ""}` : ""}`
                    : `${DAY_LABELS[cell.day]} ${cell.hour}h — sem dados`;

                return (
                  <div
                    key={key}
                    className="flex-1 group relative"
                    style={{ minWidth: 0 }}
                  >
                    <div
                      style={{
                        background: bg,
                        border: isTop
                          ? "2px solid rgb(34, 197, 94)"
                          : "2px solid transparent",
                        height: 28,
                        margin: "0 1px",
                        borderRadius: 3,
                        cursor: cell.engagement > 0 ? "default" : "default",
                      }}
                    />
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:block">
                      <div className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                        <p className="text-[11px] text-text-primary">{tooltip}</p>
                        {isTop && (
                          <p className="text-[10px] text-accent mt-0.5">Top 3 horário</p>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-bg-elevated border-r border-b border-border rotate-45 mx-auto -mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Color legend */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-[10px] text-text-muted">Menor engajamento</span>
            <div className="flex h-3 flex-1 rounded overflow-hidden max-w-[200px]">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ background: cellColor(i / 19) }}
                />
              ))}
            </div>
            <span className="text-[10px] text-text-muted">Maior engajamento</span>
          </div>
        </div>
      </div>
    </div>
  );
}
