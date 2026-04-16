"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "approve" | "reject";
  postTitle: string;
  onConfirm: (comment: string) => Promise<void>;
}

export function ApprovalModal({
  isOpen,
  onClose,
  mode,
  postTitle,
  onConfirm,
}: ApprovalModalProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setComment("");
      setValidationError(null);
      setSubmitting(false);
      // Focus textarea after animation
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, submitting, onClose]);

  async function handleConfirm() {
    if (mode === "reject" && !comment.trim()) {
      setValidationError("O motivo da rejeicao e obrigatorio.");
      textareaRef.current?.focus();
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    try {
      await onConfirm(comment.trim());
      onClose();
    } catch {
      // Errors handled by parent
    } finally {
      setSubmitting(false);
    }
  }

  const isApprove = mode === "approve";
  const accentColor = isApprove ? "#34d399" : "#f87171";
  const Icon = isApprove ? CheckCircle : XCircle;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#080b1e]/75 backdrop-blur-sm"
            onClick={() => !submitting && onClose()}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md bg-[#0c0f24] border border-[#1e2348]/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div
                className="px-5 py-4 border-b border-[#1e2348]/60 flex items-center gap-3"
                style={{ background: `${accentColor}08` }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    id="modal-title"
                    className="text-[15px] font-semibold text-[#e8eaff]"
                  >
                    {isApprove ? "Aprovar post" : "Rejeitar post"}
                  </h2>
                  <p className="text-[12px] text-[#5e6388] truncate mt-0.5">
                    {postTitle}
                  </p>
                </div>
                <button
                  onClick={() => !submitting && onClose()}
                  disabled={submitting}
                  className="p-1.5 rounded-lg text-[#5e6388] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-all duration-200 disabled:opacity-40"
                  aria-label="Fechar modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <p className="text-[13px] text-[#8b8fb0]">
                  {isApprove
                    ? "Voce pode adicionar um comentario opcional antes de aprovar este post."
                    : "Informe o motivo da rejeicao. Este comentario sera enviado ao autor do post."}
                </p>

                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-comment"
                    className="text-[12px] font-medium text-[#8b8fb0]"
                  >
                    {isApprove ? "Comentario (opcional)" : "Motivo da rejeicao"}
                    {!isApprove && (
                      <span className="text-[#f87171] ml-1">*</span>
                    )}
                  </label>
                  <textarea
                    id="modal-comment"
                    ref={textareaRef}
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    disabled={submitting}
                    placeholder={
                      isApprove
                        ? "Ex: Otimo conteudo, aprovado!"
                        : "Ex: O texto precisa ser revisado..."
                    }
                    rows={3}
                    className={`w-full px-3 py-2.5 rounded-xl bg-[#141736]/80 border text-[13px] text-[#e8eaff] placeholder-[#5e6388]/60 resize-none transition-all duration-200 outline-none focus:ring-1 disabled:opacity-50 ${
                      validationError
                        ? "border-[#f87171]/60 focus:border-[#f87171] focus:ring-[#f87171]/30"
                        : "border-[#1e2348]/60 focus:border-[#4ecdc4]/40 focus:ring-[#4ecdc4]/20"
                    }`}
                  />
                  {validationError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[11px] text-[#f87171]"
                    >
                      {validationError}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex gap-2.5 justify-end">
                <button
                  onClick={() => !submitting && onClose()}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-all duration-200 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: isApprove
                      ? "linear-gradient(135deg, #34d399, #059669)"
                      : "linear-gradient(135deg, #f87171, #dc2626)",
                    boxShadow: `0 4px 12px ${accentColor}40`,
                  }}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isApprove ? "Confirmar aprovacao" : "Confirmar rejeicao"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
