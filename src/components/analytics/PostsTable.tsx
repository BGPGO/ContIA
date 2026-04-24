"use client";

import { useState, useMemo } from "react";
import {
  Globe,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Share2,
} from "lucide-react";

export interface PostMetrics {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
}

export interface PostsTableRow {
  id: string;
  thumbnail?: string;
  caption: string;
  provider: string;
  publishedAt: string;
  metrics: PostMetrics;
  engagementRate?: number;
}

export interface PostsTableProps {
  posts: PostsTableRow[];
  emptyMessage?: string;
  limit?: number;
  onRowClick?: (post: PostsTableRow) => void;
}

type SortKey = "publishedAt" | "likes" | "comments" | "saves" | "reach" | "engagementRate";

const PROVIDER_ICONS: Record<string, typeof Globe> = {
  share: Share2,
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function SortBtn({
  label,
  colKey,
  current,
  dir,
  onToggle,
}: {
  label: string;
  colKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onToggle: (k: SortKey) => void;
}) {
  const active = current === colKey;
  return (
    <button
      onClick={() => onToggle(colKey)}
      className={`inline-flex items-center gap-1 hover:text-text-secondary transition-colors ${active ? "text-text-primary" : "text-text-muted"}`}
    >
      {label}
      <ArrowUpDown size={10} className={active ? "opacity-100" : "opacity-40"} />
    </button>
  );
}

export function PostsTable({
  posts,
  emptyMessage = "Nenhum post no período",
  limit = 10,
  onRowClick,
}: PostsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("publishedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const sorted = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      let va: number;
      let vb: number;
      if (sortKey === "publishedAt") {
        va = new Date(a.publishedAt).getTime();
        vb = new Date(b.publishedAt).getTime();
      } else if (sortKey === "engagementRate") {
        va = a.engagementRate ?? 0;
        vb = b.engagementRate ?? 0;
      } else {
        va = a.metrics[sortKey];
        vb = b.metrics[sortKey];
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [posts, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paginated = sorted.slice(page * limit, (page + 1) * limit);

  const thClass =
    "px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-right";

  if (posts.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 flex items-center justify-center text-text-muted text-[13px]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left w-[52px]" />
              <th className="px-3 py-2 text-[11px] font-medium text-text-muted uppercase tracking-wider text-left">
                Post
              </th>
              <th className="px-3 py-2 text-[11px] font-medium text-text-muted uppercase tracking-wider text-left w-[90px]">
                Canal
              </th>
              <th className={thClass}>
                <SortBtn label="Data" colKey="publishedAt" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Curtidas" colKey="likes" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Coment." colKey="comments" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Saves" colKey="saves" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Alcance" colKey="reach" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Eng%" colKey="engagementRate" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((post) => {
              const ProviderIcon = PROVIDER_ICONS[post.provider.toLowerCase()] ?? Globe;
              const caption =
                post.caption.length > 80
                  ? post.caption.slice(0, 80) + "…"
                  : post.caption;
              const engPct =
                post.engagementRate != null
                  ? (post.engagementRate * 100).toFixed(2) + "%"
                  : "--";

              return (
                <tr
                  key={post.id}
                  onClick={() => onRowClick?.(post)}
                  className={`border-b border-border/50 transition-colors ${onRowClick ? "cursor-pointer hover:bg-bg-card-hover" : "hover:bg-bg-elevated/30"}`}
                >
                  <td className="px-3 py-2.5">
                    <div className="w-10 h-10 rounded-lg bg-bg-elevated overflow-hidden flex items-center justify-center shrink-0">
                      {post.thumbnail ? (
                        <img
                          src={post.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <FileText size={16} className="text-text-muted" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-[12px] text-text-primary truncate max-w-[220px]">
                      {caption}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <ProviderIcon size={13} className="text-text-muted" />
                      <span className="text-[11px] text-text-muted capitalize">{post.provider}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-text-muted whitespace-nowrap tabular-nums">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNum(post.metrics.likes)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNum(post.metrics.comments)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNum(post.metrics.saves)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {post.metrics.reach > 0 ? formatNum(post.metrics.reach) : "--"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums" style={{ color: "#22c55e" }}>
                    {engPct}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
              aria-label="Página anterior"
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
              aria-label="Próxima página"
            >
              <ChevronRight size={16} className="text-text-muted" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
