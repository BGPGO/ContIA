"use client";

import { motion } from "motion/react";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import type { InstagramEngagementBreakdown } from "@/types/analytics";

interface EngagementBreakdownProps {
  data: InstagramEngagementBreakdown;
}

const METRICS = [
  { key: "avgLikes" as const, label: "Curtidas", color: "#e74c6f", icon: Heart },
  { key: "avgComments" as const, label: "Comentarios", color: "#6c5ce7", icon: MessageCircle },
  { key: "avgSaves" as const, label: "Saves", color: "#fbbf24", icon: Bookmark },
  { key: "avgShares" as const, label: "Compartilhamentos", color: "#10B981", icon: Share2 },
];

export function EngagementBreakdown({ data }: EngagementBreakdownProps) {
  const maxVal = Math.max(data.avgLikes, data.avgComments, data.avgSaves, data.avgShares, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
    >
      <h3 className="text-[14px] font-semibold text-text-primary mb-4">
        Engagement Breakdown
      </h3>
      <p className="text-[11px] text-text-muted mb-4">Media por post</p>

      <div className="space-y-3">
        {METRICS.map((metric) => {
          const value = data[metric.key];
          const width = maxVal > 0 ? (value / maxVal) * 100 : 0;
          const Icon = metric.icon;

          return (
            <div key={metric.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color: metric.color }} />
                  <span className="text-[12px] text-text-secondary">{metric.label}</span>
                </div>
                <span className="text-[13px] font-semibold text-text-primary tabular-nums">
                  {value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
