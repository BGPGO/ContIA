"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  ImageOff,
} from "lucide-react";
import { Post, PostApproval } from "@/types";
import { getPlataformaCor, getPlataformaLabel } from "@/lib/utils";

// ── Props ─────────────────────────────────────────────────────────────────────

interface InstagramPostModalProps {
  open: boolean;
  onClose: () => void;
  post: Post;
  approval?: PostApproval;
  onApprove?: () => void;
  onReject?: () => void;
}

// ── Slide indicator dots ──────────────────────────────────────────────────────

function SlideDots({
  total,
  active,
}: {
  total: number;
  active: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-200 ${
            i === active
              ? "w-2 h-2 bg-white"
              : "w-1.5 h-1.5 bg-white/30"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InstagramPostModal({
  open,
  onClose,
  post,
  onApprove,
  onReject,
}: InstagramPostModalProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [mounted, setMounted] = useState(false);

  // Normaliza a lista de slides: prioriza midia_urls, cai em midia_url
  const slides: string[] = (() => {
    if (post.midia_urls && post.midia_urls.length > 0) return post.midia_urls;
    if (post.midia_url) return [post.midia_url];
    return [];
  })();

  const isCarousel = slides.length > 1;
  const totalSlides = slides.length;

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setActiveSlide(0);
      setSlideDir(1);
    }
  }, [open, post.id]);

  // Portal mount
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const goNext = useCallback(() => {
    if (activeSlide < totalSlides - 1) {
      setSlideDir(1);
      setActiveSlide((s) => s + 1);
    }
  }, [activeSlide, totalSlides]);

  const goPrev = useCallback(() => {
    if (activeSlide > 0) {
      setSlideDir(-1);
      setActiveSlide((s) => s - 1);
    }
  }, [activeSlide]);

  // Keyboard: ESC fecha, ← → navega
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" && isCarousel) {
        goNext();
      } else if (e.key === "ArrowLeft" && isCarousel) {
        goPrev();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, isCarousel, goNext, goPrev, onClose]);

  const createdAt = post.created_at
    ? format(new Date(post.created_at), "dd/MM/yyyy", { locale: ptBR })
    : null;

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="ig-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* ── Card central ── */}
          <motion.div
            key="ig-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ig-modal-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-border/60"
              style={{
                background: "linear-gradient(135deg, #0c0f24 0%, #10133a 100%)",
                maxWidth: "min(940px, 96vw)",
                maxHeight: "92vh",
              }}
            >
              {/* ── Painel de imagem ── */}
              <div
                className="relative flex-shrink-0 bg-bg-primary flex items-center justify-center overflow-hidden"
                style={{
                  width: "min(540px, 100%)",
                  // portrait 4:5 no desktop, quadrado no mobile
                  aspectRatio: "4 / 5",
                  maxHeight: "92vh",
                }}
              >
                {slides.length === 0 ? (
                  // Sem mídia
                  <div className="flex flex-col items-center gap-3 p-8">
                    <div className="w-16 h-16 rounded-2xl bg-border border border-white/10 flex items-center justify-center">
                      <ImageOff className="w-8 h-8 text-text-muted" />
                    </div>
                    <p className="text-sm font-medium text-text-muted">
                      Sem mídia gerada
                    </p>
                  </div>
                ) : (
                  // Slides
                  <>
                    {/* Contador de slide (canto superior) */}
                    {isCarousel && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold">
                        {activeSlide + 1} / {totalSlides}
                      </div>
                    )}

                    {/* Imagem com animação de slide */}
                    <AnimatePresence mode="wait" custom={slideDir}>
                      <motion.img
                        key={activeSlide}
                        custom={slideDir}
                        src={slides[activeSlide]}
                        alt={`${post.titulo} — slide ${activeSlide + 1}`}
                        className="w-full h-full object-contain"
                        initial={{ opacity: 0, x: slideDir * 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: slideDir * -40 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        draggable={false}
                      />
                    </AnimatePresence>

                    {/* Seta esquerda */}
                    {isCarousel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          goPrev();
                        }}
                        disabled={activeSlide === 0}
                        aria-label="Slide anterior"
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all duration-150 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    {/* Seta direita */}
                    {isCarousel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          goNext();
                        }}
                        disabled={activeSlide === totalSlides - 1}
                        aria-label="Próximo slide"
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all duration-150 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}

                    {/* Dots */}
                    {isCarousel && (
                      <div className="absolute bottom-1 left-0 right-0 z-10">
                        <SlideDots total={totalSlides} active={activeSlide} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Painel direito: legenda + ações ── */}
              <div
                className="flex flex-col min-w-0 flex-1 overflow-hidden"
                style={{ minWidth: 0, maxWidth: "380px" }}
              >
                {/* Header do painel */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
                  <h2
                    id="ig-modal-title"
                    className="text-[14px] font-semibold text-text-primary leading-snug line-clamp-1 flex-1 min-w-0 pr-2"
                  >
                    {post.titulo}
                  </h2>
                  <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all duration-200 shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Corpo scrollável */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {/* Plataformas */}
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

                  {/* Tematica */}
                  {post.tematica && (
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#6c5ce7]/15 text-[#a29bfe] border border-[#6c5ce7]/20 font-medium">
                      {post.tematica}
                    </span>
                  )}

                  {/* Legenda / conteúdo */}
                  {post.conteudo && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
                        Legenda
                      </p>
                      <p className="text-[13px] text-[#c8caee] leading-relaxed whitespace-pre-line">
                        {post.conteudo}
                      </p>
                    </div>
                  )}

                  {/* Metadados */}
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    {createdAt && (
                      <p className="text-[11px] text-text-muted">
                        Criado em: {createdAt}
                      </p>
                    )}
                    <p className="text-[11px] text-text-muted">
                      Status:{" "}
                      <span className="text-[#a29bfe] font-medium capitalize">
                        {post.status.replace(/_/g, " ")}
                      </span>
                    </p>
                    {isCarousel && (
                      <p className="text-[11px] text-text-muted">
                        Carrossel:{" "}
                        <span className="text-[#4ecdc4] font-medium">
                          {totalSlides} slides
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer: ações */}
                {(onApprove || onReject) && (
                  <div className="px-4 py-3 border-t border-border/60 flex gap-2.5 shrink-0">
                    {onReject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium border border-[#f87171]/30 text-[#f87171] bg-[#f87171]/[0.06] hover:bg-[#f87171]/[0.12] hover:border-[#f87171]/50 transition-all duration-200"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rejeitar
                      </button>
                    )}
                    {onApprove && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-200"
                        style={{
                          background:
                            "linear-gradient(135deg, #34d399, #059669)",
                          boxShadow: "0 4px 12px rgba(52, 211, 153, 0.25)",
                        }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
