"use client";

import { motion } from "motion/react";
import { Bookmark, TrendingUp, ExternalLink } from "lucide-react";
import type { InstagramSaveRateAnalysis } from "@/types/analytics";

interface SaveRateCardProps {
  data: InstagramSaveRateAnalysis;
}

export function SaveRateCard({ data }: SaveRateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#fbbf24]/10 flex items-center justify-center">
          <Bookmark size={16} className="text-[#fbbf24]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">
            Save Rate Analysis
          </h3>
          <p className="text-[11px] text-text-muted">
            Saves / Alcance -- indicador de qualidade para o algoritmo
          </p>
        </div>
      </div>

      {/* Main metric */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-text-primary tabular-nums">
          {data.avgSaveRate.toFixed(2)}%
        </span>
        <span className="text-[12px] text-text-muted">save rate medio</span>
        {data.avgSaveRate > 2 && (
          <span className="flex items-center gap-1 text-[11px] text-success">
            <TrendingUp size={11} />
            Excelente
          </span>
        )}
        {data.avgSaveRate > 1 && data.avgSaveRate <= 2 && (
          <span className="flex items-center gap-1 text-[11px] text-accent">
            <TrendingUp size={11} />
            Bom
          </span>
        )}
      </div>

      {/* Best save rate posts */}
      {data.bestSaveRatePosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
            Posts com melhor save rate
          </p>
          {data.bestSaveRatePosts.map((post, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated/50 hover:bg-bg-elevated transition-colors"
            >
              <div className="w-9 h-9 rounded-md bg-bg-card overflow-hidden shrink-0">
                {post.thumbnail ? (
                  <img
                    src={post.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Bookmark size={12} className="text-text-muted" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-secondary truncate">
                  {post.caption || "Sem legenda"}
                </p>
              </div>
              <span className="text-[12px] font-semibold text-[#fbbf24] tabular-nums shrink-0">
                {post.saveRate.toFixed(2)}%
              </span>
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-bg-card transition-colors shrink-0"
                >
                  <ExternalLink size={11} className="text-text-muted" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
