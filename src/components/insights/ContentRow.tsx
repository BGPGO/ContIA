"use client";

import { motion } from "motion/react";
import { Image, Film, FileText, ExternalLink } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { ProviderBadge } from "./ProviderBadge";
import type { ProviderKey } from "@/types/providers";

interface ContentRowProps {
  id: string;
  provider: ProviderKey;
  contentType: string;
  title: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  url: string | null;
  engagement: number;
  metrics: Record<string, number>;
  rank?: number;
  animationDelay?: number;
}

const TYPE_ICONS: Record<string, typeof Image> = {
  post: Image,
  reel: Film,
  video: Film,
  story: Image,
  youtube_video: Film,
  youtube_short: Film,
};

export function ContentRow({
  id,
  provider,
  contentType,
  title,
  caption,
  thumbnailUrl,
  url,
  engagement,
  metrics,
  rank,
  animationDelay = 0,
}: ContentRowProps) {
  const TypeIcon = TYPE_ICONS[contentType] ?? FileText;
  const displayTitle = title ?? caption?.slice(0, 80) ?? "Sem titulo";
  const likes = metrics.likes ?? metrics.like_count ?? 0;
  const comments = metrics.comments ?? metrics.comments_count ?? 0;
  const shares = metrics.shares ?? metrics.share_count ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationDelay, duration: 0.25 }}
      className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl bg-bg-card border border-border hover:border-border-light hover:bg-bg-card-hover transition-all duration-200 group"
    >
      {/* Rank */}
      {rank !== undefined && (
        <span className="shrink-0 w-6 text-center text-[12px] font-bold text-text-muted">
          {rank}
        </span>
      )}

      {/* Thumbnail */}
      <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-bg-elevated overflow-hidden flex items-center justify-center">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={displayTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <TypeIcon size={20} className="text-text-muted" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <ProviderBadge provider={provider} />
          <span className="text-[10px] text-text-muted capitalize">{contentType}</span>
        </div>
        <p className="text-[13px] font-medium text-text-primary truncate">
          {displayTitle}
        </p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
          {likes > 0 && <span>{formatNumber(likes)} curtidas</span>}
          {comments > 0 && <span>{formatNumber(comments)} comentarios</span>}
          {shares > 0 && <span>{formatNumber(shares)} compartilhamentos</span>}
        </div>
      </div>

      {/* Engagement */}
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-bold text-accent">{formatNumber(engagement)}</p>
        <p className="text-[10px] text-text-muted">engajamento</p>
      </div>

      {/* Link */}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-bg-elevated"
          aria-label="Abrir post original"
        >
          <ExternalLink size={14} className="text-text-muted" />
        </a>
      )}
    </motion.div>
  );
}
