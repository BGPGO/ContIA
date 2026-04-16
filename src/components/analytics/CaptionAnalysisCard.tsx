"use client";

import { motion } from "motion/react";
import { Type, Hash, Megaphone, TrendingUp } from "lucide-react";
import type { InstagramCaptionAnalysis } from "@/types/analytics";

interface CaptionAnalysisCardProps {
  data: InstagramCaptionAnalysis;
}

export function CaptionAnalysisCard({ data }: CaptionAnalysisCardProps) {
  const totalPosts = data.withCTA + data.withoutCTA || 1;
  const ctaPercent = Math.round((data.withCTA / totalPosts) * 100);
  const ctaWins = data.ctaEngagement > data.noCtaEngagement;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.4 }}
      className="bg-bg-card border border-border rounded-xl p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Type size={16} className="text-accent" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">
            Caption & CTA Analysis
          </h3>
          <p className="text-[11px] text-text-muted">
            Analise de legendas e chamadas para acao
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-bg-elevated/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {data.avgLength}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">Caracteres (media)</p>
        </div>

        <div className="bg-bg-elevated/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {ctaPercent}%
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">Posts com CTA</p>
        </div>

        <div className="bg-bg-elevated/50 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
          <div className="flex items-center justify-center gap-1">
            <Megaphone size={14} className={ctaWins ? "text-success" : "text-warning"} />
            <p className={`text-sm font-bold ${ctaWins ? "text-success" : "text-warning"}`}>
              {ctaWins ? "CTA vence!" : "Sem CTA vence"}
            </p>
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">Impacto no engajamento</p>
        </div>
      </div>

      {/* CTA vs No CTA comparison */}
      <div className="mb-5 space-y-2">
        <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
          Eng. medio: COM CTA vs SEM CTA
        </p>
        <div className="flex gap-2">
          <div className={`flex-1 rounded-lg p-3 border ${ctaWins ? "bg-success/5 border-success/20" : "bg-bg-elevated/50 border-border"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Megaphone size={11} className="text-success" />
              <span className="text-[11px] text-text-secondary">Com CTA</span>
            </div>
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {data.ctaEngagement.toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-text-muted">{data.withCTA} posts</p>
          </div>
          <div className={`flex-1 rounded-lg p-3 border ${!ctaWins ? "bg-warning/5 border-warning/20" : "bg-bg-elevated/50 border-border"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Type size={11} className="text-text-muted" />
              <span className="text-[11px] text-text-secondary">Sem CTA</span>
            </div>
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {data.noCtaEngagement.toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-text-muted">{data.withoutCTA} posts</p>
          </div>
        </div>
      </div>

      {/* Top hashtags by engagement */}
      {data.topHashtags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Hash size={12} className="text-accent" />
            <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
              Top Hashtags por Engagement
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.topHashtags.map((tag) => (
              <span
                key={tag.tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-elevated text-[11px] hover:bg-bg-card-hover transition-colors"
              >
                <span className="text-accent font-medium">{tag.tag}</span>
                <span className="text-text-muted">x{tag.count}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-success">
                  <TrendingUp size={9} />
                  {tag.avgEngagement.toLocaleString("pt-BR")}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
