"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { useCreativeIdeas } from "@/hooks/useCreativeIdeas";
import type { CreativeIdea } from "@/types/creative-ideas";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface IdeasModalProps {
  open: boolean;
  onClose: () => void;
  empresaId: string;
  onSelectIdea: (prompt: string) => void;
}

type ModelPill = "sonnet" | "opus";

// ═══════════════════════════════════════════════════════════════════════
// FORMATO CONFIG
// ═══════════════════════════════════════════════════════════════════════

const FORMAT_CONFIG: Record<
  CreativeIdea["formato"],
  { emoji: string; label: string; classes: string }
> = {
  estatico: {
    emoji: "📱",
    label: "Estático",
    classes: "bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/25",
  },
  carrossel: {
    emoji: "🎴",
    label: "Carrossel",
    classes: "bg-[#6c5ce7]/15 text-[#a29bfe] border border-[#6c5ce7]/25",
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SKELETON CARD
// ═══════════════════════════════════════════════════════════════════════

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-20 rounded-full bg-bg-card-hover/70" />
      </div>
      <div className="h-5 w-3/4 rounded-lg bg-bg-card-hover/70" />
      <div className="h-4 w-full rounded-lg bg-bg-card-hover/50" />
      <div className="h-4 w-2/3 rounded-lg bg-bg-card-hover/50" />
      <div className="pt-2 border-t border-border space-y-2">
        <div className="h-3 w-1/2 rounded bg-bg-card-hover/40" />
        <div className="h-8 w-full rounded-lg bg-bg-card-hover/40" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// IDEA CARD
// ═══════════════════════════════════════════════════════════════════════

interface IdeaCardProps {
  idea: CreativeIdea;
  index: number;
  onSelect: (prompt: string) => void;
}

function IdeaCard({ idea, index, onSelect }: IdeaCardProps) {
  const fmt = FORMAT_CONFIG[idea.formato] ?? FORMAT_CONFIG.estatico;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut", delay: index * 0.08 }}
      className="flex flex-col rounded-2xl border border-border bg-bg-card hover:border-[#4ecdc4]/40 transition-colors overflow-hidden"
    >
      <div className="flex-1 p-4 space-y-2">
        {/* Badge formato */}
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${fmt.classes}`}>
          <span>{fmt.emoji}</span>
          {fmt.label}
        </span>

        {/* Título */}
        <h3 className="text-[15px] font-semibold text-text-primary leading-snug">
          {idea.titulo}
        </h3>

        {/* Gancho */}
        <p className="text-[13px] italic text-text-secondary leading-relaxed">
          &ldquo;{idea.gancho}&rdquo;
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
        <p className="text-[11px] text-text-muted truncate">
          Inspirado em: {idea.inspiracao}
        </p>
        <button
          type="button"
          onClick={() => onSelect(idea.prompt_completo)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold
            bg-gradient-to-r from-[#6c5ce7]/80 to-[#4ecdc4]/80 hover:from-[#6c5ce7] hover:to-[#4ecdc4]
            text-white transition-all shadow-sm hover:shadow-[0_0_14px_rgba(78,205,196,0.25)] cursor-pointer"
        >
          Usar e editar antes de enviar
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════════════

export function IdeasModal({ open, onClose, empresaId, onSelectIdea }: IdeasModalProps) {
  const [model, setModel] = useState<ModelPill>("sonnet");
  const { ideias, baseadoEm, loading, error, generate, reset } = useCreativeIdeas();

  // Generate on open
  useEffect(() => {
    if (open && ideias.length === 0 && !loading && !error) {
      generate(empresaId, { model });
    }
    if (!open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleModelChange = (m: ModelPill) => {
    setModel(m);
    generate(empresaId, { model: m });
  };

  const handleGenerate = () => {
    generate(empresaId, { model });
  };

  const handleSelectIdea = (prompt: string) => {
    onSelectIdea(prompt);
    onClose();
  };

  // Subtitle for header
  const subtitle =
    baseadoEm && baseadoEm.totalPosts > 0
      ? `Baseado em ${baseadoEm.totalPosts} posts dos últimos ${baseadoEm.janelaDias} dias`
      : baseadoEm
      ? "Baseado no DNA da marca"
      : "Gerando ideias personalizadas…";

  const hasNoInstagramData = baseadoEm !== null && baseadoEm.totalPosts === 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="ideas-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="ideas-panel"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 top-6 bottom-6 z-50 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[760px] md:top-8 md:bottom-8
              flex flex-col rounded-2xl border border-border bg-bg-secondary shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#4ecdc4] shrink-0" />
                    <h2 className="text-base font-semibold text-text-primary">5 ideias geradas por IA</h2>
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg dark:text-white/50 text-text-secondary
                    dark:hover:text-white/90 hover:text-text-primary dark:hover:bg-white/10 hover:bg-bg-card-hover/60 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Controls row */}
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {/* Model pills */}
                <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => handleModelChange("sonnet")}
                    className={`px-3 py-1.5 font-medium transition-all cursor-pointer ${
                      model === "sonnet"
                        ? "bg-[#4ecdc4] text-black"
                        : "dark:text-white/60 text-text-secondary dark:hover:text-white/80 hover:text-text-primary"
                    }`}
                  >
                    Rápido (Sonnet)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModelChange("opus")}
                    className={`px-3 py-1.5 font-medium transition-all cursor-pointer ${
                      model === "opus"
                        ? "bg-[#6c5ce7] text-white"
                        : "dark:text-white/60 text-text-secondary dark:hover:text-white/80 hover:text-text-primary"
                    }`}
                  >
                    Profundo (Opus)
                  </button>
                </div>

                {/* Gerar button */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold
                    bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white hover:opacity-90 disabled:opacity-50
                    disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Gerando…" : "Gerar"}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* No Instagram data notice */}
              <AnimatePresence>
                {hasNoInstagramData && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px]"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Sem dados do Instagram — ideias geradas a partir do DNA da marca
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading skeletons */}
              {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}

              {/* Error state */}
              {!loading && error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-red-500/10 border border-red-500/25 text-center"
                >
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Erro ao gerar ideias</p>
                    <p className="mt-1 text-[13px] text-text-secondary">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                      bg-red-500/80 hover:bg-red-500 text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tentar novamente
                  </button>
                </motion.div>
              )}

              {/* Ideas grid */}
              {!loading && !error && ideias.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ideias.map((idea, i) => (
                    <IdeaCard
                      key={`${idea.titulo}-${i}`}
                      idea={idea}
                      index={i}
                      onSelect={handleSelectIdea}
                    />
                  ))}
                </div>
              )}

              {/* Empty state (loaded but 0 ideas) */}
              {!loading && !error && ideias.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Sparkles className="w-10 h-10 text-text-muted" />
                  <p className="text-sm text-text-secondary">Clique em &ldquo;Gerar&rdquo; para criar ideias personalizadas.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
