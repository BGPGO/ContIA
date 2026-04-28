"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, PlusCircle, Loader2, Calendar, Trash2 } from "lucide-react";
import { Post } from "@/types";
import { cn, getPlataformaCor, getPlataformaLabel } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPostDate(post: Post): string | null {
  if (post.status === "publicado" && post.publicado_em) return post.publicado_em;
  if (post.status === "agendado" && post.agendado_para) return post.agendado_para;
  return post.created_at ?? null;
}

const STATUS_CONFIG: Record<
  Post["status"],
  { label: string; dot: string; badgeCls: string }
> = {
  publicado: {
    label: "Publicado",
    dot: "bg-green-500",
    badgeCls: "bg-green-500/15 text-green-400 border-green-500/20",
  },
  agendado: {
    label: "Agendado",
    dot: "bg-yellow-500",
    badgeCls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  },
  rascunho: {
    label: "Rascunho",
    dot: "bg-white/30",
    badgeCls: "bg-white/5 text-white/50 border-white/10",
  },
  pendente_aprovacao: {
    label: "Aguardando aprovação",
    dot: "bg-yellow-500",
    badgeCls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  },
  rejeitado: {
    label: "Rejeitado",
    dot: "bg-red-500",
    badgeCls: "bg-red-500/15 text-red-400 border-red-500/20",
  },
  erro: {
    label: "Erro",
    dot: "bg-red-500",
    badgeCls: "bg-red-500/15 text-red-400 border-red-500/20",
  },
};

// ─── props ────────────────────────────────────────────────────────────────────

export interface DayDrawerProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  posts: Post[];
  onCancelSchedule: (postId: string) => Promise<void>;
  onDeletePost?: (postId: string) => Promise<void>;
  onEditPost?: (postId: string) => void;
}

// ─── post card inside drawer ──────────────────────────────────────────────────

function DrawerPostCard({
  post,
  onCancelSchedule,
  onDeletePost,
  onEditPost,
}: {
  post: Post;
  onCancelSchedule: (postId: string) => Promise<void>;
  onDeletePost?: (postId: string) => Promise<void>;
  onEditPost?: (postId: string) => void;
}) {
  const [canceling, setCanceling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const color = getPlataformaCor(post.plataformas[0]);
  const statusConf = STATUS_CONFIG[post.status];
  const date = getPostDate(post);

  async function handleCancel() {
    if (!window.confirm("Cancelar o agendamento deste post?")) return;
    setCanceling(true);
    try {
      await onCancelSchedule(post.id);
    } finally {
      setCanceling(false);
    }
  }

  async function handleDelete() {
    if (!onDeletePost) return;
    if (!window.confirm("Excluir este post? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      await onDeletePost(post.id);
    } finally {
      setDeleting(false);
    }
  }

  // Posts em status agendado não devem ser deletados direto (precisam cancelar agendamento primeiro)
  const canDelete =
    onDeletePost &&
    post.status !== "agendado" &&
    post.status !== "publicado";

  return (
    <div
      className="rounded-xl border border-white/8 bg-white/3 overflow-hidden hover:bg-white/5 transition-colors"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* thumbnail */}
      {post.midia_url && (
        <div className="h-32 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.midia_url}
            alt={post.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3 space-y-2.5">
        {/* title */}
        <p className="text-sm font-semibold text-white leading-snug">
          {post.titulo}
        </p>

        {/* meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* status badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium",
              statusConf.badgeCls
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", statusConf.dot)} />
            {statusConf.label}
          </span>

          {/* time */}
          {date && (
            <span className="text-[11px] text-white/40 tabular-nums">
              {format(new Date(date), "HH:mm")}
            </span>
          )}
        </div>

        {/* platforms */}
        <div className="flex flex-wrap gap-1">
          {post.plataformas.map((p) => (
            <span
              key={p}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${getPlataformaCor(p)}20`,
                color: getPlataformaCor(p),
              }}
            >
              {getPlataformaLabel(p)}
            </span>
          ))}
        </div>

        {/* tematica */}
        {post.tematica && (
          <p className="text-[11px] text-[#4ecdc4]/70">{post.tematica}</p>
        )}

        {/* actions */}
        <div className="flex items-center gap-2 pt-1">
          {onEditPost && (
            <button
              onClick={() => onEditPost(post.id)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Editar
            </button>
          )}

          {post.status === "agendado" && (
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 flex items-center gap-1.5 ml-auto"
            >
              {canceling ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Cancelando…
                </>
              ) : (
                "Cancelar agendamento"
              )}
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Excluir post"
              className="text-[11px] px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 flex items-center gap-1.5 ml-auto"
            >
              {deleting ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash2 size={11} />
                  Excluir
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── drawer ───────────────────────────────────────────────────────────────────

export function DayDrawer({
  open,
  onClose,
  date,
  posts,
  onCancelSchedule,
  onDeletePost,
  onEditPost,
}: DayDrawerProps) {
  const router = useRouter();

  const dateLabel = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  const dateLabelCapitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Desktop: side drawer */}
          <motion.aside
            key="drawer-desktop"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="hidden md:flex fixed right-0 top-0 bottom-0 w-[420px] z-50 flex-col bg-bg-primary border-l border-white/8 shadow-2xl"
          >
            <DrawerContent
              dateLabelCapitalized={dateLabelCapitalized}
              posts={posts}
              onClose={onClose}
              onCancelSchedule={onCancelSchedule}
              onDeletePost={onDeletePost}
              onEditPost={onEditPost}
              onCreatePost={() => router.push("/criacao")}
            />
          </motion.aside>

          {/* Mobile: bottom sheet */}
          <motion.aside
            key="drawer-mobile"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] rounded-t-2xl bg-bg-primary border-t border-white/8 shadow-2xl flex flex-col"
          >
            {/* pill handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <DrawerContent
              dateLabelCapitalized={dateLabelCapitalized}
              posts={posts}
              onClose={onClose}
              onCancelSchedule={onCancelSchedule}
              onDeletePost={onDeletePost}
              onEditPost={onEditPost}
              onCreatePost={() => router.push("/criacao")}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── shared drawer content ────────────────────────────────────────────────────

function DrawerContent({
  dateLabelCapitalized,
  posts,
  onClose,
  onCancelSchedule,
  onDeletePost,
  onEditPost,
  onCreatePost,
}: {
  dateLabelCapitalized: string;
  posts: Post[];
  onClose: () => void;
  onCancelSchedule: (postId: string) => Promise<void>;
  onDeletePost?: (postId: string) => Promise<void>;
  onEditPost?: (postId: string) => void;
  onCreatePost: () => void;
}) {
  return (
    <>
      {/* header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">{dateLabelCapitalized}</h2>
          <p className="text-[11px] text-white/40 mt-0.5">
            {posts.length} post{posts.length !== 1 ? "s" : ""} neste dia
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Calendar size={36} className="text-white/20" />
            <p className="text-sm text-white/40 text-center">
              Nenhum post neste dia.
            </p>
            <button
              onClick={onCreatePost}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4ecdc4]/15 border border-[#4ecdc4]/30 text-[#4ecdc4] text-sm font-medium hover:bg-[#4ecdc4]/25 transition-colors"
            >
              <PlusCircle size={15} />
              Criar post
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <DrawerPostCard
              key={post.id}
              post={post}
              onCancelSchedule={onCancelSchedule}
              onDeletePost={onDeletePost}
              onEditPost={onEditPost}
            />
          ))
        )}
      </div>

      {/* footer */}
      {posts.length > 0 && (
        <div className="px-5 py-4 border-t border-white/8 shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-white/30">
            {posts.length} post{posts.length !== 1 ? "s" : ""} · {posts.filter((p) => p.status === "agendado").length} agendados
          </span>
          <button
            onClick={onCreatePost}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 text-[#4ecdc4] hover:bg-[#4ecdc4]/20 transition-colors"
          >
            <PlusCircle size={12} />
            Criar post
          </button>
        </div>
      )}
    </>
  );
}
