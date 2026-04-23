"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Smartphone, X } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
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
import { FilterGroup, FilterOption } from "@/components/calendario/FilterGroup";
import { DayCell } from "@/components/calendario/DayCell";
import { DayDrawer } from "@/components/calendario/DayDrawer";
import { MobileDayListItem } from "@/components/calendario/MobileDayListItem";
import { CalendarSkeleton, MobileListSkeleton } from "@/components/calendario/Skeletons";

// ─── constants ────────────────────────────────────────────────────────────────

const ALL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
] as const;

const STATUS_OPTIONS: FilterOption[] = [
  { value: "publicado", label: "Publicado", color: "#22c55e" },
  { value: "agendado", label: "Agendado", color: "#eab308" },
  { value: "rascunho", label: "Rascunho", color: "#6b7280" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPostDate(post: Post): string | null {
  if (post.status === "publicado" && post.publicado_em) return post.publicado_em;
  if (post.status === "agendado" && post.agendado_para) return post.agendado_para;
  return post.created_at ?? null;
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const { empresa } = useEmpresa();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postsHook = usePosts(empresa?.id) as any;
  const allPosts: Post[] = postsHook.posts;
  const loading: boolean = postsHook.loading;
  // cancelPostSchedule will be added by Squad Gamma — accessed via hook result when available
  const cancelPostSchedule: ((postId: string) => Promise<void>) | undefined =
    postsHook.cancelPostSchedule;

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [direction, setDirection] = useState(0);
  const [showPhoneMock, setShowPhoneMock] = useState(true);

  // filter state
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(
    () => new Set(ALL_PLATFORMS)
  );
  const [activeTematicas, setActiveTematicas] = useState<Set<string>>(
    () => new Set()
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<Post["status"]>>(
    () => new Set<Post["status"]>(["publicado", "agendado", "rascunho", "erro"])
  );

  // drawer state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const feedPreview = useInstagramFeedPreview(empresa?.id);

  // derived: all unique tematicas
  const allTematicas = useMemo(
    () => Array.from(new Set(allPosts.map((p) => p.tematica))).sort(),
    [allPosts]
  );

  const effectiveActiveTematicas = useMemo(
    () => (activeTematicas.size === 0 ? new Set(allTematicas) : activeTematicas),
    [activeTematicas, allTematicas]
  );

  // derived: filtered posts
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

  // derived: calendar days grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // derived: posts indexed by day key
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

  // selected day's posts for drawer
  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return postsByDay.get(key) ?? [];
  }, [selectedDate, postsByDay]);

  // filter toggle handlers
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

  function toggleStatus(s: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev) as Set<Post["status"]>;
      const key = s as Post["status"];
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function onDayClick(date: Date) {
    setSelectedDate(date);
    setDrawerOpen(true);
  }

  async function handleCancelSchedule(postId: string): Promise<void> {
    if (cancelPostSchedule) {
      await cancelPostSchedule(postId);
    }
  }

  function clearFilters() {
    setActivePlatforms(new Set(ALL_PLATFORMS));
    setActiveTematicas(new Set());
    setActiveStatuses(new Set<Post["status"]>(["publicado", "agendado", "rascunho", "erro"]));
  }

  const hasActiveFilters =
    activePlatforms.size < ALL_PLATFORMS.length ||
    activeTematicas.size > 0 ||
    activeStatuses.size < 3;

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-white/50 text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const platformOptions: FilterOption[] = ALL_PLATFORMS.map((p) => ({
    value: p,
    label: getPlataformaLabel(p),
    color: getPlataformaCor(p),
  }));

  const tematicaOptions: FilterOption[] = allTematicas.map((t) => ({
    value: t,
    label: t,
  }));

  const countPublicado = filteredPosts.filter((p) => p.status === "publicado").length;
  const countAgendado = filteredPosts.filter((p) => p.status === "agendado").length;
  const countRascunho = filteredPosts.filter((p) => p.status === "rascunho").length;

  return (
    <div className="space-y-3 sm:space-y-4 p-2 sm:p-4 max-w-7xl mx-auto">

      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-base sm:text-xl font-semibold text-white tracking-tight">
          Calendário
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
                : "text-white/40 hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10"
            )}
            title="Preview do feed Instagram"
          >
            <Smartphone size={16} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setDirection(-1); setCurrentMonth((m) => subMonths(m, 1)); }}
            className="p-1 rounded-lg text-white/40 hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-all duration-200"
            aria-label="Mês anterior"
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
              className="text-xs sm:text-sm font-medium text-white min-w-[100px] sm:min-w-[130px] text-center"
            >
              {capitalizedMonth}
            </motion.span>
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setDirection(1); setCurrentMonth((m) => addMonths(m, 1)); }}
            className="p-1 rounded-lg text-white/40 hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-all duration-200"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>
      </div>

      {/* ── filters ─────────────────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl px-4 py-3 space-y-2">
        <FilterGroup
          label="Plataformas"
          options={platformOptions}
          selected={activePlatforms}
          onChange={togglePlatform}
        />
        <div className="h-px bg-white/5" />
        <FilterGroup
          label="Status"
          options={STATUS_OPTIONS}
          selected={activeStatuses as Set<string>}
          onChange={toggleStatus}
        />
        {tematicaOptions.length > 0 && (
          <>
            <div className="h-px bg-white/5" />
            <FilterGroup
              label="Temáticas"
              options={tematicaOptions}
              selected={effectiveActiveTematicas}
              onChange={toggleTematica}
            />
          </>
        )}
        {hasActiveFilters && (
          <div className="flex justify-end pt-1">
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={10} />
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: calendar grid + phone mockup ────────────────────────── */}
      <div className="hidden md:flex gap-4">
        {/* calendar */}
        <div
          className={cn(
            "bg-bg-card backdrop-blur-xl border border-border rounded-xl p-3 transition-all duration-300",
            showPhoneMock ? "flex-1 min-w-0" : "w-full"
          )}
        >
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
                    className="text-center text-[11px] uppercase tracking-wider text-white/40 py-2 font-medium"
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
                        onDayClick={onDayClick}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* phone mockup sidebar */}
        <AnimatePresence>
          {showPhoneMock && (
            <motion.div
              initial={{ opacity: 0, x: 40, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: 40, width: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="shrink-0 min-w-[400px] flex items-start justify-center pt-4 overflow-hidden"
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

      {/* ── Mobile: list view ────────────────────────────────────────────── */}
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
                <p className="text-white/40 text-sm">Nenhum post neste mês.</p>
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
                      onCancelSchedule={handleCancelSchedule}
                    />
                  </motion.div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ── Mobile: phone mockup collapsible ────────────────────────────── */}
      <div className="md:hidden">
        <button
          onClick={() => setShowPhoneMock((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg-card border border-border text-white/50 text-xs font-medium hover:border-[#4ecdc4]/30 transition-colors"
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

      {/* ── stats footer ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-white/40 flex items-center gap-1 justify-center flex-wrap"
      >
        {loading ? (
          <span>Carregando posts…</span>
        ) : (
          <>
            <span className="text-white font-medium">{countPublicado}</span>
            <span>publicados</span>
            <span className="text-white/20 mx-1">&middot;</span>
            <span className="text-white font-medium">{countAgendado}</span>
            <span>agendados</span>
            <span className="text-white/20 mx-1">&middot;</span>
            <span className="text-white font-medium">{countRascunho}</span>
            <span>rascunhos</span>
            <span className="text-white/20 mx-1">&middot;</span>
            <span className="text-white font-medium">{filteredPosts.length}</span>
            <span>total</span>
          </>
        )}
      </motion.div>

      {/* ── day drawer ───────────────────────────────────────────────────── */}
      <DayDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        date={selectedDate ?? new Date()}
        posts={selectedDayPosts}
        onCancelSchedule={handleCancelSchedule}
      />
    </div>
  );
}
