"use client";

import { useMemo, useState } from "react";
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
    <div className="bg-bg-card border border-border rounded-xl p-4 transition-all duration-200 hover:border-border-light cursor-default">
      <div className="flex items-center gap-3.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${tint}20`, boxShadow: `0 0 12px ${tint}10` }}
        >
          <span style={{ color: tint }}>{icon}</span>
        </div>
        <div className="flex flex-col min-w-0">
          {loading ? (
            <span className="w-8 h-6 bg-bg-elevated rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-text-primary leading-none -tracking-tight tabular-nums">
              {value}
            </span>
          )}
          <span className="text-xs text-text-secondary mt-1.5">{label}</span>
        </div>
      </div>
    </div>
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
    publicado: { label: "Publicado", dotColor: "var(--color-success)", textCls: "text-success", bgCls: "bg-success/10" },
    agendado:  { label: "Agendado",  dotColor: "var(--color-warning)", textCls: "text-warning", bgCls: "bg-warning/10" },
    rascunho:  { label: "Rascunho",  dotColor: "var(--color-text-muted)", textCls: "text-text-muted", bgCls: "bg-text-muted/10" },
    erro:      { label: "Erro",      dotColor: "var(--color-danger)", textCls: "text-danger", bgCls: "bg-danger/10" },
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
    <div className="fade-in space-y-6 p-6 max-w-7xl mx-auto">

      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h1>Bem-vindo, {empresa.nome}</h1>
          <p>{empresa.nicho}</p>
        </div>
        <button
          onClick={openNewPost}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-all duration-150"
        >
          <Plus size={13} />
          Novo Post
        </button>
      </div>

      {/* ── Stats cards with variants ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<BarChart3 size={18} />}
          label="Posts este mês"
          value={countMes}
          tint={cor}
          loading={loading}
        />
        <StatCard
          icon={<CalendarDays size={18} />}
          label="Posts esta semana"
          value={countSemana}
          tint="var(--color-success)"
          loading={loading}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Agendados"
          value={countAgendados}
          tint="var(--color-warning)"
          loading={loading}
        />
        <StatCard
          icon={<FileText size={18} />}
          label="Total de posts"
          value={posts.length}
          tint="var(--color-info)"
          loading={loading}
        />
      </div>

      {/* ── Connected channels ───────────────────────────────────── */}
      <div>
        <span className="section-title mb-3 block">Canais conectados</span>
        <div className="flex items-center gap-2 flex-wrap">
          {todasRedes.map((rede) => {
            const config = redesSociais[rede as keyof typeof redesSociais];
            const conectado = config?.conectado ?? false;
            const corRede = getPlataformaCor(rede);
            const label = getPlataformaLabel(rede);

            return (
              <span
                key={rede}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
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
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Two-column: Posts do dia + Próximos agendamentos ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Left: Posts do dia */}
        <div className="lg:col-span-3 bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <CalendarCheck size={14} className="text-accent" />
            </div>
            <h2 className="section-title">Posts de hoje</h2>
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
            <div className="divide-y divide-border-subtle">
              {postsDoDia.map((post) => {
                const dateStr = post.agendado_para ?? post.publicado_em;
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-bg-elevated/40 rounded-lg px-1 -mx-1 transition-colors duration-100"
                    onClick={() => openEditPost(post)}
                  >
                    <p className="text-sm text-text-primary truncate flex-1 min-w-0 font-medium">
                      {post.titulo}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {post.plataformas.map((p) => (
                        <PlatformDot key={p} plataforma={p} />
                      ))}
                    </div>
                    {dateStr && (
                      <span className="text-[11px] text-text-muted tabular-nums shrink-0">
                        {formatTime(dateStr)}
                      </span>
                    )}
                    <StatusBadge status={post.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Próximos agendamentos */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
              <CalendarDays size={14} className="text-warning" />
            </div>
            <h2 className="section-title">Próximos agendamentos</h2>
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
              {proximosAgendamentos.map((post) => (
                <div
                  key={post.id}
                  className="py-3 first:pt-0 last:pb-0 space-y-1.5 cursor-pointer hover:bg-bg-elevated/40 rounded-lg px-1 -mx-1 transition-colors duration-100"
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
                </div>
              ))}
            </div>
          )}
        </div>

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
