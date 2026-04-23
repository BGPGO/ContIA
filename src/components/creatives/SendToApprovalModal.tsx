"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { X, Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface SendToApprovalModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  messageId: string;
  pngUrls: string[];
  defaultCaption: string;
  onSuccess: (postId: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════
// PLATAFORMAS
// ═══════════════════════════════════════════════════════════════════════

const PLATAFORMAS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "Twitter" },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// INNER MODAL (renderizado dentro do portal)
// ═══════════════════════════════════════════════════════════════════════

function ModalContent({
  open,
  onClose,
  conversationId,
  messageId,
  pngUrls,
  defaultCaption,
  onSuccess,
}: Omit<SendToApprovalModalProps, "open"> & { open: boolean }) {
  const [caption, setCaption] = useState(defaultCaption);
  const [plataformas, setPlataformas] = useState<string[]>(["instagram"]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reseta estado de sucesso sempre que o modal abre
  useEffect(() => {
    if (open) {
      setSuccess(false);
      setErrorMsg(null);
    }
  }, [open]);

  function togglePlataforma(id: string) {
    setPlataformas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!caption.trim() || loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/creatives/${conversationId}/send-to-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, caption: caption.trim(), plataformas }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erro ${res.status} ao enviar para aprovação`);
      }

      const data = (await res.json()) as { post?: { id: string }; approval?: unknown };
      const postId = data.post?.id ?? "";
      setSuccess(true);
      onSuccess(postId);
      // Auto-fecha após 4 segundos
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setErrorMsg(`Erro ao enviar: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // Tela de sucesso
  if (success) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Card de sucesso */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative z-10 w-full max-w-md bg-[#0d1025] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">Enviado pra aprovação!</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Seu criativo foi enviado e tá aguardando revisão.
          </p>
          <div className="flex items-center gap-3 mt-2 w-full">
            <Link
              href="/aprovacao"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4ecdc4] to-[#6c5ce7] text-black font-semibold text-sm hover:opacity-90 transition-all"
            >
              Ver aprovações →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/8 transition-all border border-white/10"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Limitar preview: mostrar até 3 thumbs + badge se houver mais
  const thumbsToShow = pngUrls.slice(0, 3);
  const extraCount = pngUrls.length > 3 ? pngUrls.length - 3 : 0;
  const isSingle = pngUrls.length === 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full max-w-2xl bg-[#0d1025] border border-white/10 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ecdc4]/20 to-[#6c5ce7]/20 border border-[#4ecdc4]/20 flex items-center justify-center">
              <Send className="w-4 h-4 text-[#4ecdc4]" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              Enviar pra aprovação
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview das imagens */}
        {pngUrls.length > 0 && (
          <div className="mb-5">
            {isSingle ? (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pngUrls[0]}
                  alt="Preview do criativo"
                  className="rounded-xl object-contain border border-white/10 shadow-lg"
                  style={{ maxWidth: "200px", maxHeight: "250px" }}
                />
              </div>
            ) : (
              <div className="flex gap-2 items-start">
                {thumbsToShow.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Slide ${i + 1}`}
                      className="rounded-lg object-contain border border-white/10"
                      style={{ width: "90px", height: "110px", objectFit: "cover" }}
                    />
                    {i === thumbsToShow.length - 1 && extraCount > 0 && (
                      <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          +{extraCount}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Legenda do post
          </label>
          <textarea
            rows={6}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={loading}
            placeholder="Escreva a legenda do post…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-[#4ecdc4]/50 focus:bg-white/8 transition-all resize-none disabled:opacity-50"
          />
        </div>

        {/* Plataformas */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-white/70 mb-2">
            Plataformas
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATAFORMAS.map((plat) => {
              const active = plataformas.includes(plat.id);
              return (
                <button
                  key={plat.id}
                  type="button"
                  disabled={loading}
                  onClick={() => togglePlataforma(plat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "bg-[#4ecdc4]/20 border-[#4ecdc4]/50 text-[#4ecdc4]"
                      : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 hover:border-white/20"
                  } disabled:opacity-50`}
                >
                  {plat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Erro inline */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 leading-relaxed">{errorMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/8 transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!caption.trim() || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#4ecdc4] to-[#6c5ce7] text-black font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar pra aprovação
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT (com portal)
// ═══════════════════════════════════════════════════════════════════════

export function SendToApprovalModal(props: SendToApprovalModalProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {props.open && (
        <ModalContent
          open={props.open}
          onClose={props.onClose}
          conversationId={props.conversationId}
          messageId={props.messageId}
          pngUrls={props.pngUrls}
          defaultCaption={props.defaultCaption}
          onSuccess={props.onSuccess}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
