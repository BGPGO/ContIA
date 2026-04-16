"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Smartphone,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePosts } from "@/hooks/usePosts";
import { cn, getPlataformaCor, getPlataformaLabel } from "@/lib/utils";
import { Post } from "@/types";
import { PhoneMockup } from "@/components/calendario/PhoneMockup";
import { useInstagramFeedPreview } from "@/hooks/useInstagramFeedPreview";

// ─── constants ────────────────────────────────────────────────────────────────

const ALL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
] as const;

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const STATUS_CONFIG: Record<
  Post["status"],
  { label: string; dot: string; color: string }
> = {
  publicado: {
    label: "Publicado",
    dot: "bg-success",
    color: "var(--color-success)",
  },
  agendado: {
    label: "Agendado",
    dot: "bg-warning",
    color: "var(--color-warning)",
  },
  rascunho: {
    label: "Rascunho",
    dot: "bg-text-muted",
    color: "var(--color-text-muted)",
  },
  erro: {
    label: "Erro",
    dot: "bg-danger",
    color: "var(--color-danger)",
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPostDate(post: Post): string | null {
  if (post.status === "publicado" && post.publicado_em) return post.publicado_em;
  if (post.status === "agendado" && post.agendado_para) return post.agendado_para;
  return post.created_at ?? null;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max).trimEnd() + "\u2026" : str;
}

// ─── filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onToggle,
  color,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  color?: string;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150 shrink-0",
        active
          ? "text-text-primary"
          : "bg-bg-card border-border text-text-muted opacity-50 hover:opacity-75"
      )}
      style={
        active && color
          ? {
              backgroundColor: `${color}26`,
              borderColor: `${color}40`,
              color,
            }
          : active
          ? {
              backgroundColor: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.12)",
            }
          : undefined
      }
    >
      {color && (
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </motion.button>
  );
}

// ─── post chip (inside day cell) ──────────────────────────────────────────────

function PostChip({
  post,
  selected,
  onSelect,
}: {
  post: Post;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = getPlataformaCor(post.plataformas[0]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "w-full text-left flex items-center gap-1 rounded text-[10px] leading-tight py-[3px] pr-1 transition-all duration-100",
        selected && "ring-1 ring-accent/60"
      )}
      style={{
        borderLeft: `4px solid ${color}`,
        paddingLeft: "5px",
        color: "var(--color-text-secondary)",
        background: `linear-gradient(90deg, ${color}08, transparent)`,
      }}
      title={post.titulo}
    >
      <span className="truncate flex-1">{truncate(post.titulo, 18)}</span>
    </button>
  );
}

// ─── post detail popover ──────────────────────────────────────────────────────

function PostDetailPopover({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const statusConf = STATUS_CONFIG[post.status];
  const date = getPostDate(post);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="absolute z-30 left-0 top-full mt-1 w-56 bg-bg-card backdrop-blur-xl border border-border rounded-xl shadow-2xl p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-text-primary text-xs leading-snug flex-1">
          {post.titulo}
        </p>
        <button
          onClick={onClose}
          className="shrink-0 text-text-muted hover:text-text-secondary transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={cn("w-1.5 h-1.5 rounded-full", statusConf.dot)}
        />
        <span className="text-[11px] text-text-secondary">
          {statusConf.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {post.plataformas.map((p) => (
          <span
            key={p}
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${getPlataformaCor(p)}20`,
              color: getPlataformaCor(p),
            }}
          >
            {getPlataformaLabel(p)}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border">
        <span className="text-accent-light">{post.tematica}</span>
        {date && (
          <span>{format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day,
  currentMonth,
  posts,
  selectedPostId,
  onSelectPost,
}: {
  day: Date;
  currentMonth: Date;
  posts: Post[];
  selectedPostId: string | null;
  onSelectPost: (id: string | null) => void;
}) {
  const inMonth = isSameMonth(day, currentMonth);
  const today = isToday(day);
  const MAX_VISIBLE = 3;
  const overflow = posts.length - MAX_VISIBLE;

  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;
  const hasSelected = selectedPost !== null;

  return (
    <div
      className={cn(
        "relative min-h-[80px] p-1.5 border-r border-b border-border-subtle flex flex-col gap-[3px] hover:bg-[#4ecdc4]/5 transition-colors duration-150",
        !inMonth && "opacity-25"
      )}
      onClick={() => {
        if (hasSelected) onSelectPost(null);
      }}
    >
      {/* day number */}
      <div className="flex items-center gap-1 mb-0.5">
        <span
          className={cn(
            "text-xs leading-none",
            today
              ? "text-[#4ecdc4] font-semibold"
              : "text-text-muted"
          )}
        >
          {format(day, "d")}
        </span>
        {today && (
          <span className="w-1 h-1 rounded-full bg-[#4ecdc4]" />
        )}
      </div>

      {/* post chips */}
      <div className="flex flex-col gap-[2px] flex-1">
        {posts.slice(0, MAX_VISIBLE).map((post) => (
          <PostChip
            key={post.id}
            post={post}
            selected={selectedPostId === post.id}
            onSelect={() =>
              onSelectPost(selectedPostId === post.id ? null : post.id)
            }
          />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-text-muted pl-2">
            +{overflow}
          </span>
        )}
      </div>

      {/* detail popover */}
      <AnimatePresence>
        {hasSelected && (
          <PostDetailPopover
            post={selectedPost}
            onClose={() => onSelectPost(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── mobile list item for a day ──────────────────────────────────────────────

function MobileDayListItem({
  day,
  currentMonth,
  posts,
}: {
  day: Date;
  currentMonth: Date;
  posts: Post[];
}) {
  const inMonth = isSameMonth(day, currentMonth);
  const today = isToday(day);

  if (!inMonth || posts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-xs font-medium",
            today ? "text-[#4ecdc4]" : "text-text-muted"
          )}
        >
          {format(day, "EEE, dd MMM", { locale: ptBR })}
        </span>
        {today && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#4ecdc4]/15 text-[#4ecdc4] font-medium">
            Hoje
          </span>
        )}
        <span className="text-[10px] text-text-muted ml-auto">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-1">
        {posts.map((post) => {
          const color = getPlataformaCor(post.plataformas[0]);
          const statusConf = STATUS_CONFIG[post.status];
          const date = getPostDate(post);
          return (
            <div
              key={post.id}
              className="flex items-center gap-2 bg-bg-card border border-border rounded-lg p-2.5"
              style={{ borderLeftWidth: 3, borderLeftColor: color }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  {post.titulo}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={cn("w-1.5 h-1.5 rounded-full", statusConf.dot)}
                  />
                  <span className="text-[10px] text-text-muted">
                    {statusConf.label}
                  </span>
                  {date && (
                    <span className="text-[10px] text-text-muted tabular-nums">
                      {format(new Date(date), "HH:mm")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {post.plataformas.map((p) => (
                  <span
                    key={p}
                    className="w-[6px] h-[6px] rounded-full"
                    style={{ backgroundColor: getPlataformaCor(p) }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 border-t border-l border-border-subtle animate-pulse">
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[80px] p-1.5 border-r border-b border-border-subtle"
        >
          <div className="w-4 h-3 bg-bg-elevated rounded mb-2" />
          <div className="space-y-1">
            <div className="h-3 bg-bg-elevated rounded" />
            <div className="h-3 bg-bg-elevated rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-24 bg-bg-elevated rounded" />
          <div className="h-12 bg-bg-elevated rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const { empresa } = useEmpresa();
  const { posts: allPosts, loading } = usePosts(empresa?.id);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(
    () => new Set(ALL_PLATFORMS)
  );
  const [activeTematicas, setActiveTematicas] = useState<Set<string>>(
    () => new Set()
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<Post["status"]>>(
    () => new Set<Post["status"]>(["publicado", "agendado", "rascunho", "erro"])
  );

  const [direction, setDirection] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showPhoneMock, setShowPhoneMock] = useState(true);

  const feedPreview = useInstagramFeedPreview(empresa?.id);

  const allTematicas = useMemo(
    () => Array.from(new Set(allPosts.map((p) => p.tematica))).sort(),
    [allPosts]
  );

  const effectiveActiveTematicas = useMemo(
    () => (activeTematicas.size === 0 ? new Set(allTematicas) : activeTematicas),
    [activeTematicas, allTematicas]
  );

  const filteredPosts = useMemo(
    () =>
      allPosts.filter(
        (p) =>
          p.plataformas.some((pl) => activePlatforms.has(pl)) &&
          effectiveActiveTematicas.has(p.tematica) &&
          activeStatuses.has(p.status)
      ),
    [allPosts, activePlatforms, effectiveActiveTematicas, activeStatuses]
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    filteredPosts.forEach((post) => {
      const dateStr = getPostDate(post);
      if (!dateStr) return;
      const key = dateStr.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    });
    return map;
  }, [filteredPosts]);

  function togglePlatform(p: string) {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function toggleTematica(t: string) {
    setActiveTematicas((prev) => {
      const next = new Set(prev);
      if (prev.size === 0) {
        const full = new Set(allTematicas);
        full.delete(t);
        return full;
      }
      next.has(t) ? next.delete(t) : next.add(t);
      if (next.size === allTematicas.length) return new Set();
      return next;
    });
  }

  function toggleStatus(s: Post["status"]) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR });
  const capitalizedMonth =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const countPublicado = filteredPosts.filter((p) => p.status === "publicado").length;
  const countAgendado = filteredPosts.filter((p) => p.status === "agendado").length;
  const countRascunho = filteredPosts.filter((p) => p.status === "rascunho").length;

  return (
    <div className="space-y-3 sm:space-y-4 p-2 sm:p-4 max-w-7xl mx-auto">

      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-base sm:text-xl font-semibold text-text-primary tracking-tight">
          Calendario
        </h1>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowPhoneMock((v) => !v)}
            className={cn(
              "hidden md:flex p-1.5 rounded-lg transition-all duration-200 mr-2",
              showPhoneMock
                ? "text-[#4ecdc4] bg-[#4ecdc4]/10"
                : "text-text-muted hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10"
            )}
            aria-label="Toggle feed preview"
            title="Preview do feed Instagram"
          >
            <Smartphone size={16} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setDirection(-1); setCurrentMonth((m) => subMonths(m, 1)); }}
            className="p-1 rounded-lg text-text-muted hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-all duration-200"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} />
          </motion.button>
          <AnimatePresence mode="wait">
            <motion.span
              key={capitalizedMonth}
              initial={{ opacity: 0, y: direction * 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: direction * -10 }}
              transition={{ duration: 0.2 }}
              className="text-xs sm:text-sm font-medium text-text-primary min-w-[100px] sm:min-w-[130px] text-center"
            >
              {capitalizedMonth}
            </motion.span>
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setDirection(1); setCurrentMonth((m) => addMonths(m, 1)); }}
            className="p-1 rounded-lg text-text-muted hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-all duration-200"
            aria-label="Proximo mes"
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>
      </div>

      {/* ── filters (horizontally scrollable on mobile) ────────────────── */}
      <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 min-w-max sm:flex-wrap sm:min-w-0">
          {ALL_PLATFORMS.map((p) => (
            <FilterChip
              key={p}
              label={getPlataformaLabel(p)}
              color={getPlataformaCor(p)}
              active={activePlatforms.has(p)}
              onToggle={() => togglePlatform(p)}
            />
          ))}

          <span className="w-px h-4 bg-border mx-1 shrink-0" />

          {allTematicas.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={effectiveActiveTematicas.has(t)}
              onToggle={() => toggleTematica(t)}
            />
          ))}

          <span className="w-px h-4 bg-border mx-1 shrink-0" />

          {(["publicado", "agendado", "rascunho"] as Post["status"][]).map((s) => {
            const conf = STATUS_CONFIG[s];
            return (
              <FilterChip
                key={s}
                label={conf.label}
                color={conf.color}
                active={activeStatuses.has(s)}
                onToggle={() => toggleStatus(s)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Desktop: calendar grid + phone mockup (hidden on <md) ─────── */}
      <div className="hidden md:flex gap-4">
        {/* Calendar (expands to fill) */}
        <div className={cn(
          "bg-bg-card backdrop-blur-xl border border-border rounded-xl p-3 transition-all duration-300",
          showPhoneMock ? "flex-1 min-w-0" : "w-full"
        )}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={format(currentMonth, "yyyy-MM")}
              initial={{ opacity: 0, x: direction * 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -80 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* weekday header */}
              <div className="grid grid-cols-7">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="text-center text-[11px] uppercase tracking-wider text-text-muted py-2 font-medium"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* days grid */}
              {loading ? (
                <CalendarSkeleton />
              ) : (
                <div className="grid grid-cols-7 border-t border-l border-border-subtle">
                  {calendarDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayPosts = postsByDay.get(key) ?? [];
                    return (
                      <DayCell
                        key={key}
                        day={day}
                        currentMonth={currentMonth}
                        posts={dayPosts}
                        selectedPostId={selectedPostId}
                        onSelectPost={setSelectedPostId}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Phone mockup sidebar */}
        <AnimatePresence>
          {showPhoneMock && (
            <motion.div
              initial={{ opacity: 0, x: 40, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: 40, width: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="shrink-0 flex items-start justify-center pt-4 overflow-hidden"
            >
              <PhoneMockup
                feedPosts={feedPreview.feedPosts}
                profilePic={feedPreview.profilePic}
                username={feedPreview.username}
                followersCount={feedPreview.followersCount}
                postsCount={feedPreview.postsCount}
                loading={feedPreview.loading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile: list view (visible only on <md) ────────────────────── */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <MobileListSkeleton />
        ) : (
          <>
            {calendarDays.filter((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDay.get(key) ?? [];
              return isSameMonth(day, currentMonth) && dayPosts.length > 0;
            }).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Calendar size={32} className="text-text-muted" />
                <p className="text-text-muted text-sm">Nenhum post neste mes.</p>
              </div>
            ) : (
              calendarDays.map((day, index) => {
                const key = format(day, "yyyy-MM-dd");
                const dayPosts = postsByDay.get(key) ?? [];
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.5) }}
                  >
                    <MobileDayListItem
                      day={day}
                      currentMonth={currentMonth}
                      posts={dayPosts}
                    />
                  </motion.div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ── Mobile: phone mockup (collapsible) ──────────────────────────── */}
      <div className="md:hidden">
        <button
          onClick={() => setShowPhoneMock((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg-card border border-border text-text-secondary text-xs font-medium hover:border-[#4ecdc4]/30 transition-colors"
        >
          <Smartphone size={14} />
          {showPhoneMock ? "Ocultar preview do feed" : "Ver preview do feed"}
        </button>
        <AnimatePresence>
          {showPhoneMock && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden flex justify-center pt-4"
            >
              <PhoneMockup
                feedPosts={feedPreview.feedPosts}
                profilePic={feedPreview.profilePic}
                username={feedPreview.username}
                followersCount={feedPreview.followersCount}
                postsCount={feedPreview.postsCount}
                loading={feedPreview.loading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── summary stats ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs sm:text-sm text-text-secondary flex items-center gap-1 justify-center flex-wrap"
      >
        {loading ? (
          <span className="text-text-muted text-xs">Carregando posts...</span>
        ) : (
          <>
            <span className="text-text-primary font-medium">{countPublicado}</span>
            <span>publicados</span>
            <span className="text-text-muted mx-1">&middot;</span>
            <span className="text-text-primary font-medium">{countAgendado}</span>
            <span>agendados</span>
            <span className="text-text-muted mx-1">&middot;</span>
            <span className="text-text-primary font-medium">{countRascunho}</span>
            <span>rascunhos</span>
            <span className="text-text-muted mx-1">&middot;</span>
            <span className="text-text-primary font-medium">{filteredPosts.length}</span>
            <span>total</span>
          </>
        )}
      </motion.div>

    </div>
  );
}
