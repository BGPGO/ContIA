"use client";

import { motion } from "motion/react";
import { Image, Film, Layers, Heart, MessageCircle, Bookmark, Share2, ExternalLink } from "lucide-react";
import type { InstagramTopPost } from "@/types/analytics";

interface TopPostsGridProps {
  posts: InstagramTopPost[];
}

const FORMAT_ICONS: Record<string, typeof Image> = {
  IMAGE: Image,
  VIDEO: Film,
  CAROUSEL_ALBUM: Layers,
};

const FORMAT_COLORS: Record<string, string> = {
  Post: "#6c5ce7",
  Reel: "#fbbf24",
  Carrossel: "#e74c6f",
};

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function TopPostsGrid({ posts }: TopPostsGridProps) {
  if (posts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="space-y-3"
    >
      <h3 className="text-[14px] font-semibold text-text-primary">
        Top 6 Posts por Engagement
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {posts.map((post, i) => {
          const Icon = FORMAT_ICONS[post.format] ?? Image;
          const badgeColor = FORMAT_COLORS[post.label] ?? "#4ecdc4";

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.05, duration: 0.3 }}
              className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-all group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-bg-elevated">
                {post.thumbnail ? (
                  <img
                    src={post.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon size={32} className="text-text-muted" />
                  </div>
                )}
                {/* Format badge */}
                <span
                  className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md"
                  style={{
                    backgroundColor: `${badgeColor}30`,
                    color: badgeColor,
                  }}
                >
                  <Icon size={10} />
                  {post.label}
                </span>
                {/* Engagement rate badge */}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur-md tabular-nums">
                  {post.engagementRate.toFixed(2)}%
                </span>
                {/* External link */}
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    aria-label="Abrir no Instagram"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* Metrics */}
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="text-center">
                    <Heart size={11} className="mx-auto text-[#e74c6f] mb-0.5" />
                    <p className="text-[11px] font-semibold text-text-primary tabular-nums">
                      {post.likes.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-center">
                    <MessageCircle size={11} className="mx-auto text-[#6c5ce7] mb-0.5" />
                    <p className="text-[11px] font-semibold text-text-primary tabular-nums">
                      {post.comments.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-center">
                    <Bookmark size={11} className="mx-auto text-[#fbbf24] mb-0.5" />
                    <p className="text-[11px] font-semibold text-text-primary tabular-nums">
                      {post.saves.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-center">
                    <Share2 size={11} className="mx-auto text-[#10B981] mb-0.5" />
                    <p className="text-[11px] font-semibold text-text-primary tabular-nums">
                      {post.shares.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                {post.caption && (
                  <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                    {post.caption.slice(0, 120)}
                  </p>
                )}

                <p className="text-[10px] text-text-muted">{formatDate(post.date)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
