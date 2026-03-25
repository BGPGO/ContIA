"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
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
    <button
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150",
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
    </button>
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
        borderLeft: `3px solid ${color}`,
        paddingLeft: "5px",
        color: "var(--color-text-secondary)",
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
    <div
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
    </div>
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
        "relative min-h-[80px] p-1.5 border-r border-b border-border-subtle flex flex-col gap-[3px]",
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
              ? "text-accent font-semibold"
              : "text-text-muted"
          )}
        >
          {format(day, "d")}
        </span>
        {today && (
          <span className="w-1 h-1 rounded-full bg-accent" />
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
      {hasSelected && (
        <PostDetailPopover
          post={selectedPost}
          onClose={() => onSelectPost(null)}
        />
      )}
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

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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
    <div className="fade-in space-y-4 p-4 max-w-7xl mx-auto">

      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">
          Calendário de Conteúdo
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-text-primary min-w-[130px] text-center">
            {capitalizedMonth}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all"
            aria-label="Proximo mes"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ALL_PLATFORMS.map((p) => (
          <FilterChip
            key={p}
            label={getPlataformaLabel(p)}
            color={getPlataformaCor(p)}
            active={activePlatforms.has(p)}
            onToggle={() => togglePlatform(p)}
          />
        ))}

        {/* separator */}
        <span className="w-px h-4 bg-border mx-1" />

        {allTematicas.map((t) => (
          <FilterChip
            key={t}
            label={t}
            active={effectiveActiveTematicas.has(t)}
            onToggle={() => toggleTematica(t)}
          />
        ))}

        {/* separator */}
        <span className="w-px h-4 bg-border mx-1" />

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

      {/* ── calendar grid ───────────────────────────────────────────────── */}
      <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl p-3">

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
      </div>

      {/* ── summary stats ───────────────────────────────────────────────── */}
      <div className="text-sm text-text-secondary flex items-center gap-1 justify-center">
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
      </div>

    </div>
  );
}
