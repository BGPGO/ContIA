"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  CheckCircle,
  Calendar,
  Clock,
  Loader2,
  Camera,
  Users,
  Briefcase,
  Hash,
  Play,
  Tv2,
} from "lucide-react";
import { format, addHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Post, PostApproval } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultDatetime(): string {
  const now = new Date();
  // now + 1h
  const future = addHours(now, 1);
  // arredondar para o próximo múltiplo de 15 min
  const mins = future.getMinutes();
  const roundedMins = Math.ceil(mins / 15) * 15;
  const rounded = setMinutes(future, roundedMins === 60 ? 0 : roundedMins);
  if (roundedMins === 60) {
    rounded.setHours(rounded.getHours() + 1);
  }
  rounded.setSeconds(0, 0);
  // formato local para datetime-local input: "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(
    rounded.getDate()
  )}T${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`;
}

function plataformaIcon(plat: string) {
  const size = "w-4 h-4";
  switch (plat.toLowerCase()) {
    case "instagram":
      return <Camera className={size} />;
    case "facebook":
      return <Users className={size} />;
    case "linkedin":
      return <Briefcase className={size} />;
    case "twitter":
      return <Hash className={size} />;
    case "youtube":
      return <Play className={size} />;
    case "tiktok":
      return <Tv2 className={size} />;
    default:
      return null;
  }
}

function plataformaLabel(plat: string): string {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    twitter: "Twitter / X",
    youtube: "YouTube",
    tiktok: "TikTok",
  };
  return labels[plat.toLowerCase()] ?? plat;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ApproveAndScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  approval: PostApproval;
  onApprove: (approvalId: string, comment?: string) => Promise<void>;
  onComplete: () => void;
  onError: (message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApproveAndScheduleModal({
  isOpen,
  onClose,
  post,
  approval,
  onApprove,
  onComplete,
  onError,
}: ApproveAndScheduleModalProps) {
  const [comment, setComment] = useState("");
  const [datetimeLocal, setDatetimeLocal] = useState(getDefaultDatetime);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    post.plataformas
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "scheduling">(
    "idle"
  );

  const firstInputRef = useRef<HTMLTextAreaElement>(null);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setComment("");
      setDatetimeLocal(getDefaultDatetime());
      setSelectedPlatforms(post.plataformas);
      setValidationError(null);
      setSubmitting(false);
      setStep("idle");
      const t = setTimeout(() => firstInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen, post.plataformas]);

  // Fechar no Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [isOpen, submitting, onClose]);

  const togglePlatform = useCallback((plat: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(plat) ? prev.filter((p) => p !== plat) : [...prev, plat]
    );
    setValidationError(null);
  }, []);

  async function handleConfirm() {
    // Validações
    const scheduledDate = new Date(datetimeLocal);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      setValidationError("A data/hora deve ser no futuro.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setValidationError("Selecione ao menos uma plataforma.");
      return;
    }
    setValidationError(null);
    setSubmitting(true);

    try {
      // 1. Aprovar
      setStep("approving");
      await onApprove(approval.id, comment.trim() || undefined);

      // 2. Agendar
      setStep("scheduling");
      const res = await fetch("/api/posts/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          empresaId: post.empresa_id,
          scheduledFor: scheduledDate.toISOString(),
          platforms: selectedPlatforms,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // approve já foi feito — informamos que aprovado mas agendamento falhou
        onError(
          "Post aprovado, mas falhou ao agendar: " +
            (body.error ?? res.statusText)
        );
        onComplete(); // refetch pra tirar da lista de pendentes
        onClose();
        return;
      }

      onComplete();
      onClose();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente."
      );
    } finally {
      setSubmitting(false);
      setStep("idle");
    }
  }

  // Label do botão de submit baseado no step atual
  const submitLabel =
    step === "approving"
      ? "Aprovando..."
      : step === "scheduling"
      ? "Agendando..."
      : "Aprovar e agendar";

  // Formatar data para exibição humanizada (preview)
  let datePreview: string | null = null;
  try {
    const d = new Date(datetimeLocal);
    if (!isNaN(d.getTime())) {
      datePreview = format(d, "EEEE, dd 'de' MMMM 'às' HH:mm", {
        locale: ptBR,
      });
    }
  } catch {
    // silencioso
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="as-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#080b1e]/80 backdrop-blur-sm"
            onClick={() => !submitting && onClose()}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="as-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="as-modal-title"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-lg bg-[#0c0f24] border border-[#1e2348]/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

              {/* ── Header ── */}
              <div
                className="px-5 py-4 border-b border-[#1e2348]/60 flex items-center gap-3"
                style={{ background: "#34d39908" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#34d39915]">
                  <CheckCircle className="w-5 h-5 text-[#34d399]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    id="as-modal-title"
                    className="text-[15px] font-semibold text-[#e8eaff]"
                  >
                    Aprovar e agendar
                  </h2>
                  <p className="text-[12px] text-[#5e6388] truncate mt-0.5">
                    {post.titulo}
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

              {/* ── Body ── */}
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* Seção 1: Comentário */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="as-comment"
                    className="text-[12px] font-medium text-[#8b8fb0]"
                  >
                    Comentário para a equipe{" "}
                    <span className="text-[#5e6388] font-normal">
                      (opcional)
                    </span>
                  </label>
                  <textarea
                    id="as-comment"
                    ref={firstInputRef}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={submitting}
                    placeholder="Ex: Aprovado! Ótimo conteúdo."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141736]/80 border border-[#1e2348]/60 text-[13px] text-[#e8eaff] placeholder-[#5e6388]/60 resize-none transition-all duration-200 outline-none focus:border-[#4ecdc4]/40 focus:ring-1 focus:ring-[#4ecdc4]/20 disabled:opacity-50"
                  />
                </div>

                {/* Divisor */}
                <div className="border-t border-[#1e2348]/50" />

                {/* Seção 2: Data/Hora */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="as-datetime"
                    className="flex items-center gap-1.5 text-[12px] font-medium text-[#8b8fb0]"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#6c5ce7]" />
                    Data e hora do agendamento
                    <span className="text-[#f87171] ml-0.5">*</span>
                  </label>
                  <input
                    id="as-datetime"
                    type="datetime-local"
                    value={datetimeLocal}
                    onChange={(e) => {
                      setDatetimeLocal(e.target.value);
                      setValidationError(null);
                    }}
                    disabled={submitting}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141736]/80 border border-[#1e2348]/60 text-[13px] text-[#e8eaff] transition-all duration-200 outline-none focus:border-[#6c5ce7]/40 focus:ring-1 focus:ring-[#6c5ce7]/20 disabled:opacity-50"
                    style={{
                      colorScheme: "dark",
                    }}
                  />
                  {datePreview && (
                    <p className="flex items-center gap-1.5 text-[11px] text-[#5e6388]">
                      <Clock className="w-3 h-3 shrink-0" />
                      {datePreview}
                    </p>
                  )}
                </div>

                {/* Divisor */}
                <div className="border-t border-[#1e2348]/50" />

                {/* Seção 3: Plataformas */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#8b8fb0]">
                    Plataformas
                    <span className="text-[#f87171] ml-0.5">*</span>
                    <span className="ml-1 text-[#5e6388] font-normal">
                      (ao menos uma)
                    </span>
                  </label>
                  {post.plataformas.length === 0 ? (
                    <p className="text-[12px] text-[#5e6388]">
                      Nenhuma plataforma definida neste post.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {post.plataformas.map((plat) => {
                        const active = selectedPlatforms.includes(plat);
                        return (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => togglePlatform(plat)}
                            disabled={submitting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all duration-200 disabled:opacity-50 ${
                              active
                                ? "bg-[#4ecdc4]/15 border-[#4ecdc4]/40 text-[#4ecdc4]"
                                : "bg-[#141736]/60 border-[#1e2348]/60 text-[#5e6388] hover:border-[#4ecdc4]/20 hover:text-[#8b8fb0]"
                            }`}
                          >
                            {plataformaIcon(plat)}
                            {plataformaLabel(plat)}
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4] ml-0.5 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Erro de validação */}
                <AnimatePresence>
                  {validationError && (
                    <motion.p
                      key="val-error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-[12px] text-[#f87171] bg-[#f87171]/[0.06] border border-[#f87171]/20 px-3 py-2 rounded-xl"
                    >
                      {validationError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Footer ── */}
              <div className="px-5 pb-5 pt-3 border-t border-[#1e2348]/50 flex gap-2.5 justify-end">
                <button
                  onClick={() => !submitting && onClose()}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-all duration-200 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting || selectedPlatforms.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #34d399, #059669)",
                    boxShadow: "0 4px 12px rgba(52, 211, 153, 0.25)",
                  }}
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  {submitLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
