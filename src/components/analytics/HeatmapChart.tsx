"use client";

import { motion } from "motion/react";
import type { HeatmapData } from "@/types/analytics";

interface HeatmapChartProps {
  data: HeatmapData;
  title?: string;
}

export function HeatmapChart({
  data,
  title = "Melhor horario para postar",
}: HeatmapChartProps) {
  const { grid, dayLabels, hourLabels } = data;

  // Find max value for normalization
  let maxVal = 0;
  for (const row of grid) {
    for (const v of row) {
      if (v > maxVal) maxVal = v;
    }
  }

  function cellColor(val: number): string {
    if (maxVal === 0 || val === 0) return "transparent";
    const intensity = val / maxVal;
    // Use accent color (#4ecdc4) with variable opacity
    const alpha = Math.round(intensity * 0.8 * 100) / 100;
    return `rgba(78, 205, 196, ${alpha})`;
  }

  // Only show every 3 hours on x-axis for readability
  const displayHours = hourLabels.filter((_, i) => i % 3 === 0);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-4">
        {title}
      </h3>

      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Hour labels */}
          <div className="flex ml-[50px] mb-1">
            {hourLabels.map((h, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[9px] text-text-muted"
              >
                {i % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* Grid */}
          {grid.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-1 mb-0.5">
              <span className="w-[46px] text-right text-[11px] text-text-muted shrink-0 pr-2">
                {dayLabels[dayIdx]}
              </span>
              <div className="flex-1 flex gap-[2px]">
                {row.map((val, hourIdx) => (
                  <motion.div
                    key={hourIdx}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: (dayIdx * 24 + hourIdx) * 0.002,
                      duration: 0.15,
                    }}
                    className="flex-1 aspect-square rounded-[3px] border border-border/30"
                    style={{ backgroundColor: cellColor(val) }}
                    title={`${dayLabels[dayIdx]} ${hourLabels[hourIdx]}: ${val} engajamentos`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-3">
            <span className="text-[10px] text-text-muted">Menor</span>
            <div className="flex gap-[2px]">
              {[0.1, 0.25, 0.5, 0.75, 1].map((intensity) => (
                <div
                  key={intensity}
                  className="w-3 h-3 rounded-[2px]"
                  style={{
                    backgroundColor: `rgba(78, 205, 196, ${intensity * 0.8})`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-text-muted">Maior</span>
          </div>
        </div>
      </div>
    </div>
  );
}
