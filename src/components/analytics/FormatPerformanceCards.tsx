"use client";

import { motion } from "motion/react";
import { Image, Film, Layers, Trophy } from "lucide-react";
import type { InstagramFormatPerformance } from "@/types/analytics";

interface FormatPerformanceCardsProps {
  data: InstagramFormatPerformance[];
}

const FORMAT_ICONS: Record<string, typeof Image> = {
  IMAGE: Image,
  VIDEO: Film,
  CAROUSEL_ALBUM: Layers,
};

const FORMAT_COLORS: Record<string, string> = {
  IMAGE: "#6c5ce7",
  VIDEO: "#fbbf24",
  CAROUSEL_ALBUM: "#e74c6f",
};

export function FormatPerformanceCards({ data }: FormatPerformanceCardsProps) {
  if (data.length === 0) return null;

  // The first one (sorted by avgEngagement desc) is the best performer
  const bestFormat = data[0]?.format;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="space-y-3"
    >
      <h3 className="text-[14px] font-semibold text-text-primary">
        Performance por Formato
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((fmt) => {
          const Icon = FORMAT_ICONS[fmt.format] ?? Image;
          const color = FORMAT_COLORS[fmt.format] ?? "#4ecdc4";
          const isBest = fmt.format === bestFormat;

          return (
            <motion.div
              key={fmt.format}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className={`relative bg-bg-card border rounded-xl p-4 transition-all ${
                isBest
                  ? "border-accent/40 ring-1 ring-accent/20"
                  : "border-border hover:border-border-light"
              }`}
            >
              {isBest && (
                <div className="absolute -top-2.5 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30">
                  <Trophy size={10} className="text-accent" />
                  <span className="text-[10px] font-medium text-accent">Melhor</span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-text-primary">{fmt.label}</p>
                  <p className="text-[11px] text-text-muted">{fmt.count} posts</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Eng. Rate</span>
                  <span className="text-[13px] font-semibold text-text-primary tabular-nums">
                    {fmt.avgEngagement.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Alcance medio</span>
                  <span className="text-[13px] font-semibold text-text-primary tabular-nums">
                    {fmt.avgReach.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              {fmt.bestPost && fmt.bestPost.thumbnail && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-text-muted mb-1.5">Melhor post</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-bg-elevated overflow-hidden shrink-0">
                      <img
                        src={fmt.bestPost.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[11px] text-accent font-medium tabular-nums">
                      {fmt.bestPost.engagement.toLocaleString("pt-BR")} engaj.
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
