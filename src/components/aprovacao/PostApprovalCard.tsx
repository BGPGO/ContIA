"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, XCircle, Loader2, Clock, ImageOff, Layers } from "lucide-react";
import { Post, PostApproval } from "@/types";
import { ApprovalModal } from "@/components/aprovacao/ApprovalModal";
import { ApproveAndScheduleModal } from "@/components/aprovacao/ApproveAndScheduleModal";
import { InstagramPostModal } from "@/components/aprovacao/InstagramPostModal";
import { getPlataformaCor, getPlataformaLabel } from "@/lib/utils";

interface PostApprovalCardProps {
  post: Post;
  approval: PostApproval;
  onApprove: (approvalId: string, comment?: string) => Promise<void>;
  onReject: (approvalId: string, comment: string) => Promise<void>;
}

function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${
        type === "success"
          ? "bg-bg-secondary/95 border-[#34d399]/30 text-[#34d399]"
          : "bg-bg-secondary/95 border-[#f87171]/30 text-[#f87171]"
      }`}
    >
      {type === "success" ? (
        <CheckCircle className="w-4 h-4 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="text-sm font-medium text-text-primary">{message}</span>
    </motion.div>
  );
}

export function PostApprovalCard({
  post,
  approval,
  onApprove,
  onReject,
}: PostApprovalCardProps) {
  // Estado para o modal de rejeição (fluxo existente)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  // Estado para o novo modal consolidado de aprovação + agendamento
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  // Estado para o modal Instagram expandido
  const [igModalOpen, setIgModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function openApprove() {
    setScheduleModalOpen(true);
  }

  function openReject() {
    setRejectModalOpen(true);
  }

  // Handler do modal de rejeição (fluxo inalterado)
  async function handleRejectConfirm(comment: string) {
    setSubmitting(true);
    try {
      await onReject(approval.id, comment);
      showToast("Post rejeitado.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.",
        "error"
      );
      throw err; // propagate so modal stays open
    } finally {
      setSubmitting(false);
    }
  }

  // Chamado pelo ApproveAndScheduleModal após sucesso completo ou sucesso parcial
  function handleScheduleComplete() {
    showToast("Post aprovado e agendado!", "success");
  }

  function handleScheduleError(message: string) {
    showToast(message, "error");
  }

  const createdAt = approval.createdAt
    ? format(new Date(approval.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  const postCreatedAt = post.created_at
    ? format(new Date(post.created_at), "dd/MM/yyyy", { locale: ptBR })
    : null;

  const conteudoPreview = post.conteudo
    ? post.conteudo.slice(0, 180) + (post.conteudo.length > 180 ? "..." : "")
    : null;

  const hasThumbnail = Boolean(post.midia_url);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        onClick={() => setIgModalOpen(true)}
        className="bg-bg-secondary border border-border/70 rounded-2xl overflow-hidden shadow-lg hover:border-[#4ecdc4]/30 hover:shadow-[#4ecdc4]/5 transition-all duration-300 flex flex-col cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #0c0f24 0%, #10133a 100%)",
        }}
      >
        {/* ── Hero image ── */}
        {hasThumbnail ? (
          <div
            className="relative w-full overflow-hidden bg-bg-primary flex items-center justify-center"
            style={{ maxHeight: "500px", aspectRatio: "1 / 1" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.midia_url!}
              alt={post.titulo}
              className="w-full h-full object-contain"
              style={{ maxHeight: "500px" }}
            />
            {/* Badge de carrossel */}
            {post.midia_urls && post.midia_urls.length > 1 && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-semibold">
                <Layers className="w-3 h-3" />
                <span>{post.midia_urls.length} slides</span>
              </div>
            )}
          </div>
        ) : (
          /* Placeholder maior e mais evidente quando não há mídia */
          <div
            className="w-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-bg-card to-bg-secondary"
            style={{ minHeight: "200px", aspectRatio: "1 / 1", maxHeight: "300px" }}
          >
            <div className="w-16 h-16 rounded-2xl bg-border border border-white/10 flex items-center justify-center">
              <ImageOff className="w-8 h-8 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-muted">Sem mídia gerada</p>
            <p className="text-[11px] text-text-muted/60 text-center px-4">
              O canvas estava vazio ou a imagem possuía restrição de exportação
            </p>
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-4 flex-1 space-y-2.5">
          {/* Title */}
          <h3 className="text-[15px] font-semibold text-text-primary leading-snug line-clamp-2">
            {post.titulo}
          </h3>

          {/* Content preview */}
          {conteudoPreview && (
            <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-2">
              {conteudoPreview}
            </p>
          )}

          {/* Platforms */}
          {post.plataformas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.plataformas.map((plat) => (
                <span
                  key={plat}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${getPlataformaCor(plat)}15`,
                    borderColor: `${getPlataformaCor(plat)}30`,
                    color: getPlataformaCor(plat),
                  }}
                >
                  {getPlataformaLabel(plat)}
                </span>
              ))}
            </div>
          )}

          {/* Meta: tematica + dates */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
            {post.tematica && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#6c5ce7]/15 text-[#a29bfe] border border-[#6c5ce7]/20 font-medium">
                {post.tematica}
              </span>
            )}
          </div>

          {/* Requested / created date */}
          {createdAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted pt-0.5">
              <Clock className="w-3 h-3 shrink-0" />
              <span>Solicitado em: {createdAt}</span>
            </div>
          )}
          {postCreatedAt && !createdAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Clock className="w-3 h-3 shrink-0" />
              <span>Criado em: {postCreatedAt}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border/50" />

        {/* ── Footer actions ── */}
        <div className="p-4 flex gap-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); openReject(); }}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium border border-[#f87171]/30 text-[#f87171] bg-[#f87171]/[0.06] hover:bg-[#f87171]/[0.12] hover:border-[#f87171]/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Rejeitar
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); openApprove(); }}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #34d399, #059669)",
              boxShadow: "0 4px 12px rgba(52, 211, 153, 0.25)",
            }}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Aprovar
          </button>
        </div>
      </motion.div>

      {/* Modal de rejeição — fluxo inalterado */}
      <ApprovalModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        mode="reject"
        postTitle={post.titulo}
        onConfirm={handleRejectConfirm}
      />

      {/* Modal consolidado de aprovação + agendamento */}
      <ApproveAndScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        post={post}
        approval={approval}
        onApprove={onApprove}
        onComplete={handleScheduleComplete}
        onError={handleScheduleError}
      />

      {/* Modal Instagram expandido */}
      <InstagramPostModal
        open={igModalOpen}
        onClose={() => setIgModalOpen(false)}
        post={post}
        approval={approval}
        onApprove={() => {
          setIgModalOpen(false);
          openApprove();
        }}
        onReject={() => {
          setIgModalOpen(false);
          openReject();
        }}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </>
  );
}
