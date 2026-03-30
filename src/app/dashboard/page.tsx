"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useSpring, useMotionValue } from "motion/react";
import {
  FileText,
  CalendarDays,
  Clock,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  Plus,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePosts } from "@/hooks/usePosts";
import { PostModal } from "@/components/posts/PostModal";
import { cn, getPlataformaCor, getPlataformaLabel } from "@/lib/utils";
import { Post } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─── animated number ────────────────────────────────────────────────────────

function AnimatedNumber({ value, loading }: { value: number; loading?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 30, mass: 1 });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toString();
      }
    });
    return unsubscribe;
  }, [springValue]);

  if (loading) {
    return <span className="w-8 h-6 bg-bg-elevated rounded animate-pulse inline-block" />;
  }

  return (
    <span
      ref={ref}
      className="text-2xl font-bold text-text-primary leading-none -tracking-tight tabular-nums"
    >
      0
    </span>
  );
}

// ─── stat card with variants ────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: string;
  loading?: boolean;
}

function StatCard({ icon, label, value, tint, loading }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-bg-card border border-border rounded-xl p-4 transition-colors duration-300 hover:border-border-light cursor-pointer"
    >
      <div className="flex items-center gap-3.5">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${tint}20`, boxShadow: `0 0 20px ${tint}25` }}
        >
          <span style={{ color: tint }}>{icon}</span>
        </motion.div>
        <div className="flex flex-col min-w-0">
          <AnimatedNumber value={value} loading={loading} />
          <span className="text-xs text-text-secondary mt-1.5">{label}</span>
        </div>
      </div>
    </motion.div>
  );
}

function PlatformDot({ plataforma }: { plataforma: string }) {
  const color = getPlataformaCor(plataforma);
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={getPlataformaLabel(plataforma)}
    />
  );
}

function StatusBadge({ status }: { status: Post["status"] }) {
  const map: Record<Post["status"], { label: string; dotColor: string; textCls: string; bgCls: string }> = {
    publicado: { label: "Publicado", dotColor: "#4ecdc4", textCls: "text-[#4ecdc4]", bgCls: "bg-[#4ecdc4]/15" },
    agendado:  { label: "Agendado",  dotColor: "#fbbf24", textCls: "text-[#fbbf24]", bgCls: "bg-[#fbbf24]/15" },
    rascunho:  { label: "Rascunho",  dotColor: "var(--color-text-muted)", textCls: "text-text-muted", bgCls: "bg-text-muted/10" },
    erro:      { label: "Erro",      dotColor: "#f87171", textCls: "text-[#f87171]", bgCls: "bg-[#f87171]/15" },
  };
  const { label, dotColor, textCls, bgCls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full", bgCls)}>
      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: dotColor }} />
      <span className={cn("text-[11px] font-medium", textCls)}>{label}</span>
    </span>
  );
}

// ─── loading skeleton rows ────────────────────────────────────────────────────

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-border-subtle">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 animate-pulse">
          <span className="flex-1 h-4 bg-bg-elevated rounded" />
          <span className="w-16 h-4 bg-bg-elevated rounded" />
          <span className="w-12 h-5 bg-bg-elevated rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { empresa } = useEmpresa();
  const { posts, loading, createPost, updatePost } = usePosts(empresa?.id);

  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const countMes = useMemo(
    () => posts.filter((p) =>
      (p.status === "publicado" && isThisMonth(p.publicado_em)) ||
      (p.status === "agendado" && isThisMonth(p.agendado_para))
    ).length,
    [posts]
  );

  const countSemana = useMemo(
    () => posts.filter((p) =>
      (p.status === "publicado" && isThisWeek(p.publicado_em)) ||
      (p.status === "agendado" && isThisWeek(p.agendado_para))
    ).length,
    [posts]
  );

  const countAgendados = useMemo(
    () => posts.filter((p) => p.status === "agendado").length,
    [posts]
  );

  const postsDoDia = useMemo(
    () => posts
      .filter((p) =>
        (p.status === "publicado" && isToday(p.publicado_em)) ||
        (p.status === "agendado" && isToday(p.agendado_para))
      )
      .sort((a, b) => {
        const da = a.agendado_para ?? a.publicado_em ?? "";
        const db = b.agendado_para ?? b.publicado_em ?? "";
        return da.localeCompare(db);
      }),
    [posts]
  );

  const proximosAgendamentos = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return posts
      .filter((p) => p.status === "agendado" && p.agendado_para && p.agendado_para > now)
      .sort((a, b) => (a.agendado_para! > b.agendado_para! ? 1 : -1))
      .slice(0, 6);
  }, [posts]);

  const todasRedes = ["instagram", "facebook", "linkedin", "twitter", "youtube", "tiktok"];
  const redesSociais = empresa?.redes_sociais ?? {};

  // ── modal handlers ──

  function openNewPost() {
    setEditingPost(null);
    setShowModal(true);
  }

  function openEditPost(post: Post) {
    setEditingPost(post);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingPost(null);
  }

  async function handleSave(data: Omit<Post, "id" | "created_at" | "metricas">) {
    if (editingPost) {
      await updatePost(editingPost.id, data);
    } else {
      await createPost(data);
    }
  }

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const cor = empresa.cor_primaria;

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Page Header ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4"
      >
        <div>
          <h1 className="text-lg sm:text-xl">Bem-vindo, {empresa.nome}</h1>
          <p>{empresa.nicho}</p>
        </div>
        <button
          onClick={openNewPost}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-lg hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] hover:-translate-y-0.5 transition-all duration-300 w-full sm:w-auto"
        >
          <Plus size={13} />
          Novo Post
        </button>
      </motion.div>

      {/* ── Stats cards with variants ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <BarChart3 size={18} />, label: "Posts este mês", value: countMes, tint: cor },
          { icon: <CalendarDays size={18} />, label: "Posts esta semana", value: countSemana, tint: "var(--color-success)" },
          { icon: <Clock size={18} />, label: "Agendados", value: countAgendados, tint: "var(--color-warning)" },
          { icon: <FileText size={18} />, label: "Total de posts", value: posts.length, tint: "var(--color-info)" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <StatCard {...stat} loading={loading} />
          </motion.div>
        ))}
      </div>

      {/* ── Connected channels ───────────────────────────────────── */}
      <div>
        <span className="section-title mb-3 block text-[#e8eaff]">Canais conectados</span>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {todasRedes.map((rede, index) => {
            const config = redesSociais[rede as keyof typeof redesSociais];
            const conectado = config?.conectado ?? false;
            const corRede = getPlataformaCor(rede);
            const label = getPlataformaLabel(rede);

            return (
              <motion.span
                key={rede}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium hover:-translate-y-0.5 transition-all duration-200",
                  conectado
                    ? "border"
                    : "border border-dashed border-border opacity-35"
                )}
                style={
                  conectado
                    ? { borderColor: `${corRede}40`, color: corRede, backgroundColor: `${corRede}0d` }
                    : { color: "var(--color-text-muted)" }
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: conectado ? corRede : "var(--color-text-muted)" }}
                />
                {label}
                {conectado && (
                  <TrendingUp size={10} style={{ color: corRede, opacity: 0.6 }} />
                )}
              </motion.span>
            );
          })}
        </div>
      </div>

      {/* ── Two-column: Posts do dia + Próximos agendamentos ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Left: Posts do dia */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3 bg-bg-card border border-border rounded-xl p-3 sm:p-5"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <CalendarCheck size={14} className="text-accent" />
            </div>
            <h2 className="section-title text-[#e8eaff]">Posts de hoje</h2>
            {postsDoDia.length > 0 && (
              <span className="ml-auto text-[11px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full tabular-nums">
                {postsDoDia.length}
              </span>
            )}
          </div>

          {loading ? (
            <SkeletonRows count={3} />
          ) : postsDoDia.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">
              Nenhum post para hoje.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle overflow-x-auto">
              {postsDoDia.map((post, index) => {
                const dateStr = post.agendado_para ?? post.publicado_em;
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="flex items-center gap-2 sm:gap-3 py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-[#4ecdc4]/5 rounded-lg px-1 -mx-1 transition-colors duration-150 min-w-0"
                    onClick={() => openEditPost(post)}
                  >
                    <p className="text-sm text-text-primary truncate flex-1 min-w-0 font-medium">
                      {post.titulo}
                    </p>
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      {post.plataformas.map((p) => (
                        <PlatformDot key={p} plataforma={p} />
                      ))}
                    </div>
                    {dateStr && (
                      <span className="text-[11px] text-text-muted tabular-nums shrink-0 hidden sm:inline">
                        {formatTime(dateStr)}
                      </span>
                    )}
                    <StatusBadge status={post.status} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Right: Proximos agendamentos */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-3 sm:p-5"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
              <CalendarDays size={14} className="text-warning" />
            </div>
            <h2 className="section-title text-[#e8eaff]">Próximos agendamentos</h2>
            {proximosAgendamentos.length > 0 && (
              <span className="ml-auto text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full tabular-nums">
                {proximosAgendamentos.length}
              </span>
            )}
          </div>

          {loading ? (
            <SkeletonRows count={3} />
          ) : proximosAgendamentos.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">
              Nenhum agendamento futuro.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {proximosAgendamentos.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="py-3 first:pt-0 last:pb-0 space-y-1.5 cursor-pointer hover:bg-[#4ecdc4]/5 rounded-lg px-1 -mx-1 transition-colors duration-150"
                  onClick={() => openEditPost(post)}
                >
                  <p className="text-sm text-text-primary leading-snug line-clamp-1 font-medium">
                    {post.titulo}
                  </p>
                  <div className="flex items-center gap-2.5">
                    {post.agendado_para && (
                      <span className="text-xs text-text-secondary tabular-nums">
                        {formatShortDate(post.agendado_para)}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      {post.plataformas.map((p) => (
                        <PlatformDot key={p} plataforma={p} />
                      ))}
                    </div>
                    <span className="text-[11px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded">
                      {post.tematica}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

      </div>

      {/* ── PostModal ──────────────────────────────────────────────── */}
      {empresa && (
        <PostModal
          open={showModal}
          onClose={closeModal}
          onSave={handleSave}
          post={editingPost}
          empresaId={empresa.id}
        />
      )}

    </div>
  );
}
