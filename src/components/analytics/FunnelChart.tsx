"use client";

import { motion } from "motion/react";
import { formatNumber } from "@/lib/utils";
import type { FunnelStage } from "@/types/analytics";

interface FunnelChartProps {
  stages: FunnelStage[];
  title?: string;
}

export function FunnelChart({
  stages,
  title = "Funil de Vendas",
}: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-2">
          {title}
        </h3>
        <div className="flex items-center justify-center h-32 text-text-muted text-[13px]">
          Sem dados de funil
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-4">
        {title}
      </h3>

      <div className="space-y-2">
        {stages.map((stage, i) => {
          const width = Math.max((stage.count / maxCount) * 100, 4);

          return (
            <div key={stage.name} className="flex items-center gap-3">
              <span className="text-[12px] text-text-secondary w-[120px] sm:w-[160px] text-right truncate shrink-0">
                {stage.name}
              </span>
              <div className="flex-1 h-7 bg-bg-elevated rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-lg flex items-center px-2"
                  style={{ backgroundColor: stage.color }}
                >
                  <span className="text-[11px] font-semibold text-white whitespace-nowrap">
                    {formatNumber(stage.count)}
                  </span>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
