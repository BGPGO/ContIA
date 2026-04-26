"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Flame, AlertTriangle, Image, LayoutGrid } from "lucide-react";
import type { CreativePerformance, TopIGPost } from "@/types/attribution";

/* ── Props ── */

interface CreativeROIGridProps {
  creatives: CreativePerformance[];
  topIGPosts?: TopIGPost[];
  emptyMessage?: string;
}

/* ── Formatters ── */

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

/* ── Heuristic: find matching IG post by caption ── */

function findMatchingPost(
  creative: CreativePerformance,
  posts: TopIGPost[]
): TopIGPost | null {
  if (posts.length === 0) return null;
  const needle = creative.contentName.toLowerCase().replace(/[-_]/g, " ").slice(0, 20);
  return (
    posts.find((p) =>
      p.caption.toLowerCase().includes(needle)
    ) ?? null
  );
}

/* ── Performance badge ── */

interface PerformanceTier {
  label: string;
  icon: React.ReactNode;
  className: string;
}

function getPerformanceTier(
  creative: CreativePerformance,
  topRevThreshold: number,
  lowRoasFlag: boolean
): PerformanceTier | null {
  if (creative.revenue >= topRevThreshold && topRevThreshold > 0) {
    return {
      label: "Top",
      icon: <Flame size={10} />,
      className: "bg-warning/15 text-warning border border-warning/30",
    };
  }
  if (lowRoasFlag) {
    return {
      label: "Baixo",
      icon: <AlertTriangle size={10} />,
      className: "bg-danger/10 text-danger border border-danger/20",
    };
  }
  return null;
}

/* ── Card ── */

function CreativeCard({
  creative,
  matchedPost,
  tier,
  index,
}: {
  creative: CreativePerformance;
  matchedPost: TopIGPost | null;
  tier: PerformanceTier | null;
  index: number;
}) {
  const hasThumbnail = !!(creative.thumbnailUrl || matchedPost?.thumbnailUrl);
  const thumbUrl = creative.thumbnailUrl ?? matchedPost?.thumbnailUrl ?? null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border/80 hover:bg-bg-elevated/30 transition-all duration-200 flex flex-col"
      role="article"
      aria-label={`Criativo: ${creative.contentName}`}
    >
      {/* Thumbnail */}
      {hasThumbnail && thumbUrl ? (
        <div className="relative h-28 bg-bg-elevated overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl}
            alt={`Preview de ${creative.contentName}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {matchedPost && !creative.thumbnailUrl && (
            <div className="absolute top-2 right-2 bg-bg-card/80 backdrop-blur-sm border border-border rounded-md px-1.5 py-0.5 text-[9px] text-text-muted">
              via IG
            </div>
          )}
          {tier && (
            <div
              className={`absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${tier.className}`}
            >
              {tier.icon}
              {tier.label}
            </div>
          )}
        </div>
      ) : (
        /* Placeholder when no thumbnail */
        <div className="relative h-20 bg-bg-elevated flex items-center justify-center">
          <Image size={24} className="text-text-muted/40" />
          {tier && (
            <div
              className={`absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${tier.className}`}
            >
              {tier.icon}
              {tier.label}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        {/* Name + campaign */}
        <div>
          <p
            className="text-[12px] font-semibold text-text-primary truncate"
            title={creative.contentName}
          >
            {creative.contentName}
          </p>
          <p className="text-[11px] text-text-muted truncate mt-0.5" title={creative.campaign}>
            {creative.campaign}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/60">
          <div className="text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Leads</p>
            <p className="text-[13px] font-bold text-text-primary tabular-nums">
              {formatNum(creative.leadsCount)}
            </p>
          </div>
          <div className="text-center border-x border-border/60">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Deals</p>
            <p className="text-[13px] font-bold text-text-primary tabular-nums">
              {formatNum(creative.dealsWonCount)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Revenue</p>
            <p className="text-[13px] font-bold text-success tabular-nums">
              {formatBRL(creative.revenue)}
            </p>
          </div>
        </div>

        {/* CAC pill */}
        {creative.cac != null && (
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>CAC</span>
            <span className="tabular-nums font-medium text-text-secondary">
              {formatBRL(creative.cac)}
            </span>
          </div>
        )}
      </div>
    </motion.article>
  );
}

/* ── Main ── */

export function CreativeROIGrid({
  creatives,
  topIGPosts = [],
  emptyMessage = "Nenhum criativo encontrado no período",
}: CreativeROIGridProps) {
  const sorted = useMemo(
    () => [...creatives].sort((a, b) => b.revenue - a.revenue),
    [creatives]
  );

  // Top 30% threshold for "Top" badge
  const topThreshold = useMemo(() => {
    if (sorted.length === 0) return 0;
    const topN = Math.max(1, Math.ceil(sorted.length * 0.3));
    return sorted[topN - 1]?.revenue ?? 0;
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
          <LayoutGrid size={18} className="text-text-muted" />
        </div>
        <p className="text-[13px] text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <p className="text-[12px] text-text-muted">
          {sorted.length} criativo{sorted.length !== 1 ? "s" : ""} — ordenados por receita
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/15 text-warning border border-warning/30 text-[10px] font-semibold">
              <Flame size={9} />
              Top
            </span>
            <span className="text-text-muted">top 30%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-danger/10 text-danger border border-danger/20 text-[10px] font-semibold">
              <AlertTriangle size={9} />
              Baixo
            </span>
            <span className="text-text-muted">ROI fraco</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((creative, idx) => {
          const matchedPost = findMatchingPost(creative, topIGPosts);
          const isLowROI =
            creative.revenue === 0 && creative.leadsCount > 0;
          const tier = getPerformanceTier(creative, topThreshold, isLowROI);

          return (
            <CreativeCard
              key={`${creative.contentName}-${idx}`}
              creative={creative}
              matchedPost={matchedPost}
              tier={tier}
              index={idx}
            />
          );
        })}
      </div>
    </div>
  );
}
