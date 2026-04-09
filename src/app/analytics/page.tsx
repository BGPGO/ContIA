"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Users,
  Heart,
  MessageCircle,
  Eye,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  Camera,
  Hash,
  Type,
  Smile,
  Calendar,
  Image,
  Film,
  LayoutGrid,
  BarChart3,
  Activity,
  Target,
  LinkIcon,
  Clock,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAnalytics } from "@/hooks/useAnalytics";
import type {
  IGAnalyticsData,
  IGAnalyticsTopPost,
  IGContentBreakdown,
} from "@/hooks/useAnalytics";
import { cn, formatNumber } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HOUR_LABELS = [
  "0h", "1h", "2h", "3h", "4h", "5h", "6h", "7h",
  "8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h",
  "16h", "17h", "18h", "19h", "20h", "21h", "22h", "23h",
];

const MEDIA_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carrossel",
  REELS: "Reels",
};

const MEDIA_TYPE_COLORS: Record<string, string> = {
  IMAGE: "#6c5ce7",
  VIDEO: "#e1306c",
  CAROUSEL_ALBUM: "#4ecdc4",
  REELS: "#fbbf24",
};

const MEDIA_TYPE_ICONS: Record<string, React.ReactNode> = {
  IMAGE: <Image size={14} />,
  VIDEO: <Film size={14} />,
  CAROUSEL_ALBUM: <LayoutGrid size={14} />,
  REELS: <Film size={14} />,
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  suffix?: string;
  index: number;
}

function KPICard({ icon, label, value, color, suffix, index }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-bg-card border border-border rounded-xl p-5 transition-colors duration-300 hover:border-border-light cursor-default"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, boxShadow: `0 0 20px ${color}15` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-bold -tracking-tight text-text-primary tabular-nums leading-none">
          {value}
        </span>
        {suffix && (
          <span className="text-lg font-semibold" style={{ color }}>
            {suffix}
          </span>
        )}
      </div>
      <span className="text-sm text-text-secondary mt-2 block">{label}</span>
    </motion.div>
  );
}

// ── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({ data, onRefresh, refreshing }: {
  data: IGAnalyticsData;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { profile, fetched_at } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-bg-card border border-border rounded-xl p-5 sm:p-6 hover:border-border-light transition-colors"
    >
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden ring-2 ring-[#e1306c]/30 ring-offset-2 ring-offset-[#0d1025]">
            {profile.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#e1306c] to-[#6c5ce7] flex items-center justify-center">
                <Camera size={28} className="text-white" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center">
            <Camera size={12} className="text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-text-primary">
              {profile.name || profile.username}
            </h2>
            <span className="text-sm text-text-muted">@{profile.username}</span>
          </div>
          {profile.biography && (
            <p className="text-sm text-text-secondary mt-1 line-clamp-2 max-w-lg">
              {profile.biography}
            </p>
          )}
          <div className="flex items-center gap-4 sm:gap-6 mt-3">
            <div className="text-center">
              <span className="text-lg font-bold text-text-primary tabular-nums">
                {formatNumber(profile.followers_count)}
              </span>
              <span className="text-xs text-text-muted block">Seguidores</span>
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-text-primary tabular-nums">
                {formatNumber(profile.follows_count)}
              </span>
              <span className="text-xs text-text-muted block">Seguindo</span>
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-text-primary tabular-nums">
                {formatNumber(profile.media_count)}
              </span>
              <span className="text-xs text-text-muted block">Posts</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <span className="text-[10px] text-text-muted hidden sm:inline">
            {new Date(fetched_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300",
              "bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white",
              "hover:shadow-[0_0_20px_rgba(78,205,196,0.3)] hover:-translate-y-0.5",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            )}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Engagement Bar Chart (last 30 posts) ─────────────────────────────────────

function EngagementBarChart({ topPosts }: { topPosts: IGAnalyticsTopPost[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Show all posts sorted by timestamp for the bar chart
  const sorted = useMemo(
    () => [...topPosts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [topPosts]
  );

  if (sorted.length === 0) {
    return <p className="text-text-muted text-sm text-center py-10">Sem dados de posts.</p>;
  }

  const maxEng = Math.max(...sorted.map((p) => p.like_count + p.comments_count), 1);

  return (
    <div>
      <div className="flex items-end gap-[3px] h-40 sm:h-48" role="img" aria-label="Engajamento por post">
        {sorted.map((post, i) => {
          const total = post.like_count + post.comments_count;
          const height = (total / maxEng) * 100;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={post.id}
              className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer relative group"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#1a1e42] border border-border-light rounded-lg px-2.5 py-1.5 text-[10px] text-text-primary whitespace-nowrap z-10 shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><Heart size={9} className="text-[#e1306c]" />{post.like_count}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={9} className="text-[#3b82f6]" />{post.comments_count}</span>
                  </div>
                </div>
              )}
              <div
                className="w-full rounded-t-sm transition-all duration-200"
                style={{
                  height: `${Math.max(height, 3)}%`,
                  background: isHovered
                    ? "linear-gradient(180deg, #6c5ce7, #4ecdc4)"
                    : "linear-gradient(180deg, #6c5ce740, #4ecdc430)",
                  boxShadow: isHovered ? "0 0 12px rgba(108, 92, 231, 0.4)" : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 px-1">
        <span className="text-[10px] text-text-muted">Mais antigo</span>
        <span className="text-[10px] text-text-muted">Mais recente</span>
      </div>
    </div>
  );
}

// ── Donut Chart (Content Type Distribution) ──────────────────────────────────

function DonutChart({ breakdown }: { breakdown: IGContentBreakdown[] }) {
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  if (breakdown.length === 0) {
    return <p className="text-text-muted text-sm text-center py-10">Sem dados.</p>;
  }

  const total = breakdown.reduce((sum, b) => sum + b.count, 0);
  const size = 140;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const segments = breakdown.map((b) => {
    const pct = b.count / total;
    const dashLen = pct * circumference;
    const gap = circumference - dashLen;
    const offset = -cumulativeOffset;
    cumulativeOffset += dashLen;
    return { ...b, dashLen, gap, offset };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg) => {
            const color = MEDIA_TYPE_COLORS[seg.type] ?? "#6c5ce7";
            const isHovered = hoveredType === seg.type;
            return (
              <circle
                key={seg.type}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${seg.dashLen} ${seg.gap}`}
                strokeDashoffset={seg.offset}
                strokeLinecap="round"
                className="transition-all duration-200"
                opacity={hoveredType && !isHovered ? 0.3 : 1}
                style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
                onMouseEnter={() => setHoveredType(seg.type)}
                onMouseLeave={() => setHoveredType(null)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-text-primary tabular-nums">{total}</span>
          <span className="text-[10px] text-text-muted">posts</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {breakdown.map((b) => {
          const color = MEDIA_TYPE_COLORS[b.type] ?? "#6c5ce7";
          const isHovered = hoveredType === b.type;
          return (
            <div
              key={b.type}
              className={cn(
                "flex items-center gap-2.5 cursor-default transition-opacity duration-200",
                hoveredType && !isHovered ? "opacity-40" : "opacity-100"
              )}
              onMouseEnter={() => setHoveredType(b.type)}
              onMouseLeave={() => setHoveredType(null)}
            >
              <div className="flex items-center gap-1.5" style={{ color }}>
                {MEDIA_TYPE_ICONS[b.type] ?? <Image size={14} />}
              </div>
              <span className="text-xs text-text-primary font-medium w-20">
                {MEDIA_TYPE_LABELS[b.type] ?? b.type}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color }}>
                {b.percentage}%
              </span>
              <span className="text-[10px] text-text-muted tabular-nums">
                ({b.count})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Heatmap (best posting times) ─────────────────────────────────────────────

function PostingHeatmap({ byDayOfWeek, byHour }: { byDayOfWeek: number[]; byHour: number[] }) {
  // Create a simplified heatmap: hours grouped into 4 slots x 7 days
  const hourSlots = [
    { label: "Madrugada", range: [0, 5] },
    { label: "Manha", range: [6, 11] },
    { label: "Tarde", range: [12, 17] },
    { label: "Noite", range: [18, 23] },
  ];

  // Build matrix: day x time slot
  const matrix: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: number[] = [];
    for (const slot of hourSlots) {
      // Simple heuristic: combine day and hour distributions
      const dayWeight = byDayOfWeek[d] ?? 0;
      let hourSum = 0;
      for (let h = slot.range[0]; h <= slot.range[1]; h++) {
        hourSum += byHour[h] ?? 0;
      }
      row.push(dayWeight + hourSum);
    }
    matrix.push(row);
  }

  const maxVal = Math.max(...matrix.flat(), 1);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[48px_repeat(4,1fr)] gap-1.5">
        <div />
        {hourSlots.map((s) => (
          <span key={s.label} className="text-[10px] text-text-muted text-center">{s.label}</span>
        ))}
      </div>

      {/* Grid */}
      {DAY_LABELS.map((day, di) => (
        <div key={day} className="grid grid-cols-[48px_repeat(4,1fr)] gap-1.5">
          <span className="text-[11px] text-text-secondary font-medium flex items-center">{day}</span>
          {matrix[di].map((val, si) => {
            const intensity = val / maxVal;
            const opacity = 0.1 + intensity * 0.9;
            return (
              <div
                key={si}
                className="h-7 rounded-md transition-all duration-200 hover:ring-1 hover:ring-[#6c5ce7]/50 cursor-default"
                style={{
                  backgroundColor: `rgba(108, 92, 231, ${opacity})`,
                  boxShadow: intensity > 0.6 ? `0 0 8px rgba(108, 92, 231, ${intensity * 0.3})` : "none",
                }}
                title={`${day} ${hourSlots[si].label}: ${val} posts`}
              />
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <span className="text-[10px] text-text-muted">Menos</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
          <div
            key={o}
            className="w-4 h-4 rounded-sm"
            style={{ backgroundColor: `rgba(108, 92, 231, ${o})` }}
          />
        ))}
        <span className="text-[10px] text-text-muted">Mais</span>
      </div>
    </div>
  );
}

// ── Top Posts Grid ────────────────────────────────────────────────────────────

function TopPostsGrid({ posts }: { posts: IGAnalyticsTopPost[] }) {
  if (posts.length === 0) {
    return <p className="text-text-muted text-sm text-center py-10">Sem posts para exibir.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {posts.map((post, i) => (
        <motion.a
          key={post.id}
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-all duration-300 group"
        >
          {/* Thumbnail */}
          <div className="aspect-square relative overflow-hidden bg-bg-elevated">
            {(post.thumbnail_url || post.media_url) ? (
              <img
                src={post.thumbnail_url || post.media_url}
                alt="Post thumbnail"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#6c5ce7]/20 to-[#e1306c]/20">
                <Camera size={24} className="text-text-muted" />
              </div>
            )}

            {/* Overlay with metrics */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
              <div className="flex items-center gap-3 text-white text-xs">
                <span className="flex items-center gap-1">
                  <Heart size={11} /> {formatNumber(post.like_count)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={11} /> {formatNumber(post.comments_count)}
                </span>
              </div>
              <ExternalLink size={12} className="text-white/70 ml-auto" />
            </div>

            {/* Badge */}
            <div className="absolute top-2 left-2">
              <span className="text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                #{i + 1}
              </span>
            </div>

            {/* Type indicator */}
            <div className="absolute top-2 right-2" style={{ color: MEDIA_TYPE_COLORS[post.media_type] ?? "#6c5ce7" }}>
              {MEDIA_TYPE_ICONS[post.media_type] ?? <Image size={14} />}
            </div>
          </div>

          {/* Caption */}
          <div className="p-3">
            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed mb-2">
              {post.caption || "Sem legenda"}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[10px] text-text-muted">
                <span className="flex items-center gap-0.5">
                  <Heart size={9} className="text-[#e1306c]" />
                  {formatNumber(post.like_count)}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageCircle size={9} className="text-[#3b82f6]" />
                  {formatNumber(post.comments_count)}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[#4ecdc4] tabular-nums">
                {post.engagement_rate.toFixed(1)}%
              </span>
            </div>
          </div>
        </motion.a>
      ))}
    </div>
  );
}

// ── Hashtag Cloud ────────────────────────────────────────────────────────────

function HashtagCloud({ hashtags }: { hashtags: { tag: string; count: number }[] }) {
  if (hashtags.length === 0) {
    return <p className="text-text-muted text-sm text-center py-6">Nenhuma hashtag encontrada.</p>;
  }

  const maxCount = Math.max(...hashtags.map((h) => h.count), 1);

  return (
    <div className="flex flex-wrap gap-2">
      {hashtags.map((h) => {
        const intensity = h.count / maxCount;
        const size = 11 + intensity * 3;
        return (
          <span
            key={h.tag}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:border-[#6c5ce7]/40 transition-colors cursor-default"
            style={{
              fontSize: `${size}px`,
              backgroundColor: `rgba(108, 92, 231, ${0.05 + intensity * 0.15})`,
              color: `rgba(232, 234, 255, ${0.5 + intensity * 0.5})`,
            }}
          >
            {h.tag}
            <span className="text-[9px] text-text-muted tabular-nums">({h.count})</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Day of Week Chart ────────────────────────────────────────────────────────

function DayOfWeekChart({ byDay }: { byDay: number[] }) {
  const max = Math.max(...byDay, 1);

  return (
    <div className="flex items-end gap-2 h-24">
      {byDay.map((count, i) => {
        const height = (count / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-muted tabular-nums">{count}</span>
            <div
              className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
              style={{
                height: `${Math.max(height, 4)}%`,
                background: "linear-gradient(180deg, #6c5ce7, #4ecdc4)",
                opacity: 0.4 + (count / max) * 0.6,
              }}
            />
            <span className="text-[10px] text-text-muted font-medium">{DAY_LABELS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton Loading ─────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-bg-card border border-border rounded-xl p-5 animate-pulse", className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-bg-elevated" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-bg-elevated rounded w-1/3" />
          <div className="h-2 bg-bg-elevated rounded w-1/2" />
        </div>
      </div>
      <div className="h-6 bg-bg-elevated rounded w-1/4 mb-2" />
      <div className="h-3 bg-bg-elevated rounded w-1/3" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Profile skeleton */}
      <div className="bg-bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-bg-elevated" />
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-bg-elevated rounded w-40" />
            <div className="h-3 bg-bg-elevated rounded w-64" />
            <div className="flex gap-6 mt-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-5 bg-bg-elevated rounded w-12" />
                  <div className="h-2 bg-bg-elevated rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI skeletons */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-bg-card border border-border rounded-xl p-5 animate-pulse h-72" />
        <div className="bg-bg-card border border-border rounded-xl p-5 animate-pulse h-72" />
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md mx-auto px-6"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e1306c]/20 to-[#6c5ce7]/20 flex items-center justify-center mx-auto mb-5">
          <Camera size={32} className="text-[#e1306c]" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Instagram nao conectado
        </h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Conecte sua conta do Instagram na pagina de{" "}
          <a href="/configuracoes" className="text-[#4ecdc4] hover:underline font-medium">
            Configuracoes
          </a>{" "}
          para ver as metricas reais do seu perfil.
        </p>
        <a
          href="/configuracoes"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-xl hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] hover:-translate-y-0.5 transition-all duration-300"
        >
          <LinkIcon size={14} />
          Conectar Instagram
        </a>
      </motion.div>
    </div>
  );
}

// ── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md mx-auto px-6"
      >
        <div className="w-20 h-20 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-5">
          <Activity size={32} className="text-danger" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Erro ao carregar dados
        </h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          {message}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-xl hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] hover:-translate-y-0.5 transition-all duration-300"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </motion.div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { empresa } = useEmpresa();
  const { data, loading, error, notConnected, refresh } = useAnalytics(empresa?.id);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  if (notConnected) {
    return (
      <div className="p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header mb-6"
        >
          <h1>Analytics</h1>
          <p>{empresa.nome}</p>
        </motion.div>
        <EmptyState />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header mb-6"
        >
          <h1>Analytics</h1>
          <p>{empresa.nome}</p>
        </motion.div>
        <ErrorState message={error} onRetry={handleRefresh} />
      </div>
    );
  }

  if (!data) return null;

  const { profile, engagement, top_posts, content_breakdown, posting_frequency, insights, insights_error, content_analysis } = data;

  // Compute reach from insights if available
  const reachInsight = insights.find((i) => i.name === "reach");
  const viewsInsight = insights.find((i) => i.name === "views");
  const avgReach = reachInsight?.values.length
    ? Math.round(reachInsight.values.reduce((s, v) => s + v.value, 0) / reachInsight.values.length)
    : 0;
  const totalViews = viewsInsight?.values.length
    ? viewsInsight.values.reduce((s, v) => s + v.value, 0)
    : 0;
  const insightsUnavailable = avgReach === 0 && totalViews === 0;

  return (
    <div className="fade-in space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header"
      >
        <h1>Analytics</h1>
        <p>{empresa.nome} &middot; Instagram &middot; Ultimos 30 posts</p>
      </motion.div>

      {/* Profile Card */}
      <ProfileCard data={data} onRefresh={handleRefresh} refreshing={refreshing} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard
          icon={<Users size={18} />}
          label="Seguidores"
          value={formatNumber(profile.followers_count)}
          color="#3b82f6"
          index={0}
        />
        <KPICard
          icon={<TrendingUp size={18} />}
          label="Taxa de Engajamento"
          value={engagement.engagement_rate.toFixed(1)}
          suffix="%"
          color="#4ecdc4"
          index={1}
        />
        <KPICard
          icon={<Eye size={18} />}
          label="Alcance Medio"
          value={avgReach > 0 ? formatNumber(avgReach) : "--"}
          color="#6c5ce7"
          index={2}
        />
        <KPICard
          icon={<BarChart3 size={18} />}
          label="Visualizacoes"
          value={totalViews > 0 ? formatNumber(totalViews) : "--"}
          color="#fbbf24"
          index={3}
        />
        <KPICard
          icon={<Heart size={18} />}
          label="Media de Curtidas"
          value={formatNumber(engagement.avg_likes)}
          color="#e1306c"
          index={4}
        />
        <KPICard
          icon={<MessageCircle size={18} />}
          label="Media de Comentarios"
          value={formatNumber(engagement.avg_comments)}
          color="#34d399"
          index={5}
        />
      </div>

      {/* Insights unavailable notice */}
      {insightsUnavailable && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#6c5ce7]/10 border border-[#6c5ce7]/20 text-sm text-text-secondary">
          <Eye size={16} className="text-[#6c5ce7] shrink-0" />
          <span>
            {insights_error || "Dados de alcance e impressoes ficam disponiveis apos alguns dias de atividade no Instagram."}
          </span>
        </div>
      )}

      {/* Charts Row 1: Engagement + Content Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#6c5ce7]/15 flex items-center justify-center">
              <BarChart3 size={14} className="text-[#6c5ce7]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Engajamento por Post</h3>
            <span className="text-[10px] text-text-muted ml-auto">{top_posts.length} posts analisados</span>
          </div>
          <EngagementBarChart topPosts={top_posts} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#4ecdc4]/15 flex items-center justify-center">
              <Target size={14} className="text-[#4ecdc4]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Tipos de Conteudo</h3>
          </div>
          <DonutChart breakdown={content_breakdown} />
        </motion.div>
      </div>

      {/* Charts Row 2: Posting Heatmap + Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="lg:col-span-3 bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#6c5ce7]/15 flex items-center justify-center">
              <Clock size={14} className="text-[#6c5ce7]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Melhores Horarios para Postar</h3>
          </div>
          <PostingHeatmap
            byDayOfWeek={posting_frequency.by_day_of_week}
            byHour={posting_frequency.by_hour}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#fbbf24]/15 flex items-center justify-center">
              <Calendar size={14} className="text-[#fbbf24]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Posts por Dia da Semana</h3>
          </div>
          <DayOfWeekChart byDay={posting_frequency.by_day_of_week} />
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Frequencia</span>
              <span className="text-sm font-semibold text-[#4ecdc4] tabular-nums">
                {posting_frequency.posts_per_week} posts/semana
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Top Posts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-lg bg-[#e1306c]/15 flex items-center justify-center">
            <ArrowUpRight size={14} className="text-[#e1306c]" />
          </div>
          <h3 className="section-title text-[#e8eaff]">Top 5 Posts</h3>
          <span className="text-[10px] text-text-muted ml-1">por engajamento</span>
        </div>
        <TopPostsGrid posts={top_posts} />
      </motion.div>

      {/* Content Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {/* Hashtags */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#6c5ce7]/15 flex items-center justify-center">
              <Hash size={14} className="text-[#6c5ce7]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Hashtags Mais Usadas</h3>
          </div>
          <HashtagCloud hashtags={content_analysis.top_hashtags} />
        </div>

        {/* Text Stats */}
        <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#34d399]/15 flex items-center justify-center">
              <Type size={14} className="text-[#34d399]" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Analise de Texto</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type size={14} className="text-text-muted" />
                <span className="text-xs text-text-secondary">Tamanho medio da legenda</span>
              </div>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {content_analysis.avg_caption_length} chars
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smile size={14} className="text-text-muted" />
                <span className="text-xs text-text-secondary">Emojis por post</span>
              </div>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {content_analysis.avg_emojis_per_post}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-text-muted" />
                <span className="text-xs text-text-secondary">Total de hashtags unicas</span>
              </div>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {content_analysis.top_hashtags.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smile size={14} className="text-text-muted" />
                <span className="text-xs text-text-secondary">Total de emojis usados</span>
              </div>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {content_analysis.emoji_count}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
