"use client";

import { useState } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Trash2 } from "lucide-react";
import { Post } from "@/types";
import { cn, getPlataformaCor } from "@/lib/utils";

function getPostDate(post: Post): string | null {
  if (post.status === "publicado" && post.publicado_em) return post.publicado_em;
  if (post.status === "agendado" && post.agendado_para) return post.agendado_para;
  return post.created_at ?? null;
}

const STATUS_CONFIG: Record<
  Post["status"],
  { label: string; dot: string }
> = {
  publicado: { label: "Publicado", dot: "bg-green-500" },
  agendado: { label: "Agendado", dot: "bg-yellow-500" },
  rascunho: { label: "Rascunho", dot: "bg-white/30" },
  pendente_aprovacao: { label: "Aguardando aprovação", dot: "bg-yellow-500" },
  rejeitado: { label: "Rejeitado", dot: "bg-red-500" },
  erro: { label: "Erro", dot: "bg-red-500" },
};

interface MobileDayListItemProps {
  day: Date;
  currentMonth: Date;
  posts: Post[];
  onCancelSchedule?: (postId: string) => Promise<void>;
  onDeletePost?: (postId: string) => Promise<void>;
}

export function MobileDayListItem({
  day,
  currentMonth,
  posts,
  onCancelSchedule,
  onDeletePost,
}: MobileDayListItemProps) {
  const inMonth = isSameMonth(day, currentMonth);
  const today = isToday(day);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!inMonth || posts.length === 0) return null;

  async function handleCancel(postId: string) {
    if (!onCancelSchedule) return;
    if (!window.confirm("Cancelar o agendamento deste post?")) return;
    setCancelingId(postId);
    try {
      await onCancelSchedule(postId);
    } finally {
      setCancelingId(null);
    }
  }

  async function handleDelete(postId: string) {
    if (!onDeletePost) return;
    if (!window.confirm("Excluir este post? Essa ação não pode ser desfeita.")) return;
    setDeletingId(postId);
    try {
      await onDeletePost(postId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-xs font-medium",
            today ? "text-[#4ecdc4]" : "text-white/50"
          )}
        >
          {format(day, "EEE, dd MMM", { locale: ptBR })}
        </span>
        {today && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#4ecdc4]/15 text-[#4ecdc4] font-medium">
            Hoje
          </span>
        )}
        <span className="text-[10px] text-white/30 ml-auto">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1">
        {posts.map((post) => {
          const color = getPlataformaCor(post.plataformas[0]);
          const statusConf = STATUS_CONFIG[post.status];
          const date = getPostDate(post);
          const isCanceling = cancelingId === post.id;

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
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusConf.dot)} />
                  <span className="text-[10px] text-white/50">{statusConf.label}</span>
                  {date && (
                    <span className="text-[10px] text-white/40 tabular-nums">
                      {format(new Date(date), "HH:mm")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  {post.plataformas.map((p) => (
                    <span
                      key={p}
                      className="w-[6px] h-[6px] rounded-full"
                      style={{ backgroundColor: getPlataformaCor(p) }}
                    />
                  ))}
                </div>

                {post.status === "agendado" && onCancelSchedule && (
                  <button
                    onClick={() => handleCancel(post.id)}
                    disabled={isCanceling}
                    className="text-[10px] px-2 py-0.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isCanceling ? (
                      <Loader2 size={9} className="animate-spin" />
                    ) : (
                      "Cancelar"
                    )}
                  </button>
                )}

                {onDeletePost &&
                  post.status !== "agendado" &&
                  post.status !== "publicado" && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deletingId === post.id}
                      title="Excluir"
                      className="text-[10px] px-2 py-0.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {deletingId === post.id ? (
                        <Loader2 size={9} className="animate-spin" />
                      ) : (
                        <Trash2 size={10} />
                      )}
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
