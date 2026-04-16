"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Image,
  Film,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { ProviderPost } from "@/types/analytics";

interface PostsTableProps {
  posts: ProviderPost[];
  pageSize?: number;
}

type SortKey = "published_at" | "likes" | "comments" | "reach" | "engagement";

const TYPE_ICONS: Record<string, typeof Image> = {
  post: Image,
  reel: Film,
  video: Film,
  story: Image,
  youtube_video: Film,
  youtube_short: Film,
};

function getMetric(m: Record<string, number>, key: string): number {
  return m[key] ?? 0;
}

function getEngagement(m: Record<string, number>): number {
  return (
    (m.likes ?? m.like_count ?? 0) +
    (m.comments ?? m.comments_count ?? 0) +
    (m.shares ?? m.share_count ?? 0) +
    (m.saves ?? 0)
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function PostsTable({ posts, pageSize = 10 }: PostsTableProps) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      let va: number;
      let vb: number;
      if (sortKey === "published_at") {
        va = new Date(a.published_at ?? 0).getTime();
        vb = new Date(b.published_at ?? 0).getTime();
      } else if (sortKey === "engagement") {
        va = getEngagement(a.metrics);
        vb = getEngagement(b.metrics);
      } else {
        va = getMetric(a.metrics, sortKey === "likes" ? "likes" : sortKey === "comments" ? "comments" : "reach");
        vb = getMetric(b.metrics, sortKey === "likes" ? "likes" : sortKey === "comments" ? "comments" : "reach");
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [posts, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const headerClass =
    "px-3 py-2 text-[11px] font-medium text-text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text-secondary transition-colors";

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-[11px] font-medium text-text-muted uppercase tracking-wider text-left w-[60px]">
                #
              </th>
              <th className="px-3 py-2 text-[11px] font-medium text-text-muted uppercase tracking-wider text-left">
                Post
              </th>
              <th
                className={headerClass + " text-right"}
                onClick={() => toggleSort("likes")}
              >
                <span className="inline-flex items-center gap-1">
                  Curtidas <ArrowUpDown size={10} />
                </span>
              </th>
              <th
                className={headerClass + " text-right"}
                onClick={() => toggleSort("comments")}
              >
                <span className="inline-flex items-center gap-1">
                  Coment. <ArrowUpDown size={10} />
                </span>
              </th>
              <th
                className={headerClass + " text-right"}
                onClick={() => toggleSort("reach")}
              >
                <span className="inline-flex items-center gap-1">
                  Alcance <ArrowUpDown size={10} />
                </span>
              </th>
              <th
                className={headerClass + " text-right"}
                onClick={() => toggleSort("engagement")}
              >
                <span className="inline-flex items-center gap-1">
                  Engaj. <ArrowUpDown size={10} />
                </span>
              </th>
              <th
                className={headerClass + " text-right"}
                onClick={() => toggleSort("published_at")}
              >
                <span className="inline-flex items-center gap-1">
                  Data <ArrowUpDown size={10} />
                </span>
              </th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((post, i) => {
              const Icon = TYPE_ICONS[post.content_type] ?? FileText;
              const displayTitle =
                post.title ?? post.caption?.slice(0, 60) ?? "Sem titulo";
              const likes = post.metrics.likes ?? post.metrics.like_count ?? 0;
              const comments =
                post.metrics.comments ?? post.metrics.comments_count ?? 0;
              const reach = post.metrics.reach ?? 0;
              const eng = getEngagement(post.metrics);

              return (
                <motion.tr
                  key={post.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-bg-card-hover transition-colors"
                >
                  <td className="px-3 py-2.5">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-bg-elevated overflow-hidden flex items-center justify-center">
                      {post.thumbnail_url ? (
                        <img
                          src={post.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Icon size={16} className="text-text-muted" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-[12px] font-medium text-text-primary truncate max-w-[250px]">
                      {displayTitle}
                    </p>
                    <span className="text-[10px] text-text-muted capitalize">
                      {post.content_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNumber(likes)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNumber(comments)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {reach > 0 ? formatNumber(reach) : "--"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-accent tabular-nums">
                    {formatNumber(eng)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-text-muted whitespace-nowrap">
                    {formatDate(post.published_at)}
                  </td>
                  <td className="px-2 py-2.5">
                    {post.url && (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-bg-elevated transition-colors"
                        aria-label="Abrir post"
                      >
                        <ExternalLink size={13} className="text-text-muted" />
                      </a>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-[11px] text-text-muted">
            {sorted.length} posts
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded-lg hover:bg-bg-elevated disabled:opacity-30 transition-all"
              aria-label="Pagina anterior"
            >
              <ChevronLeft size={16} className="text-text-muted" />
            </button>
            <span className="text-[11px] text-text-secondary tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded-lg hover:bg-bg-elevated disabled:opacity-30 transition-all"
              aria-label="Proxima pagina"
            >
              <ChevronRight size={16} className="text-text-muted" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
