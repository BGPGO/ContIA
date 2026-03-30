"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Type,
  MessageSquare,
} from "lucide-react";

interface CarouselSlideData {
  slideNumber: number;
  titulo: string;
  conteudo: string;
}

interface CarouselEditorProps {
  slides: CarouselSlideData[];
  onSlidesChange: (slides: CarouselSlideData[]) => void;
  brandColor?: string;
}

export function CarouselEditor({
  slides,
  onSlidesChange,
  brandColor = "#4ecdc4",
}: CarouselEditorProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const safeActive = Math.min(activeSlide, Math.max(slides.length - 1, 0));

  /* ── Helpers ── */
  const updateSlide = (
    index: number,
    field: keyof CarouselSlideData,
    value: string | number
  ) => {
    const updated = slides.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    onSlidesChange(updated);
  };

  const addSlide = () => {
    const newSlide: CarouselSlideData = {
      slideNumber: slides.length + 1,
      titulo: "",
      conteudo: "",
    };
    onSlidesChange([...slides, newSlide]);
    // Navigate to the new slide after a tick so the DOM updates
    setTimeout(() => {
      setActiveSlide(slides.length);
      scrollToThumbnail(slides.length);
    }, 50);
  };

  const deleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    const updated = slides
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, slideNumber: i + 1 }));
    onSlidesChange(updated);
    if (safeActive >= updated.length) {
      setActiveSlide(updated.length - 1);
    }
  };

  const goToPrev = () => {
    const prev = Math.max(0, safeActive - 1);
    setActiveSlide(prev);
    scrollToThumbnail(prev);
  };

  const goToNext = () => {
    const next = Math.min(slides.length - 1, safeActive + 1);
    setActiveSlide(next);
    scrollToThumbnail(next);
  };

  const scrollToThumbnail = (index: number) => {
    if (!scrollRef.current) return;
    const children = scrollRef.current.children;
    if (children[index]) {
      (children[index] as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  if (slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-sm text-text-muted">Nenhum slide no carrossel.</p>
        <button
          onClick={addSlide}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 transition-all"
        >
          <Plus size={14} />
          Adicionar slide
        </button>
      </div>
    );
  }

  const currentSlide = slides[safeActive];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* ── Slide Navigator (thumbnails) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Slides
          </span>
          <span className="text-xs text-text-muted">
            Slide {safeActive + 1} de {slides.length}
          </span>
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {slides.map((slide, i) => (
              <motion.button
                key={`thumb-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                onClick={() => setActiveSlide(i)}
                className={`shrink-0 w-36 rounded-lg border overflow-hidden text-left transition-all ${
                  safeActive === i
                    ? "border-accent shadow-md shadow-accent/10 ring-1 ring-accent/30"
                    : "border-border hover:border-border-light"
                }`}
              >
                {/* Accent left border indicator */}
                <div className="flex">
                  <div
                    className="w-1 shrink-0 rounded-l-lg"
                    style={{
                      backgroundColor:
                        safeActive === i ? brandColor : "transparent",
                    }}
                  />
                  <div className="flex-1 p-2.5 bg-bg-card">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold"
                        style={{
                          backgroundColor: `${brandColor}20`,
                          color: brandColor,
                        }}
                      >
                        {slide.slideNumber}
                      </span>
                      <span className="text-[10px] text-text-muted font-medium truncate">
                        Slide {slide.slideNumber}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-primary font-semibold truncate leading-tight">
                      {slide.titulo || "Sem titulo"}
                    </p>
                    <p className="text-[9px] text-text-secondary truncate mt-0.5">
                      {slide.conteudo || "Sem conteudo"}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}

            {/* Add slide button in the strip */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: slides.length * 0.05, duration: 0.25 }}
              onClick={addSlide}
              className="shrink-0 w-12 h-full min-h-[60px] rounded-lg border border-dashed border-border hover:border-accent/40 bg-bg-card flex items-center justify-center transition-all hover:bg-accent/5"
            >
              <Plus size={16} className="text-text-muted" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Active Slide Editor ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={safeActive}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="bg-bg-card border border-border rounded-xl overflow-hidden"
        >
          {/* Gradient accent top bar */}
          <div
            className="h-1.5"
            style={{
              background: `linear-gradient(90deg, ${brandColor}, ${brandColor}88, ${brandColor}33)`,
            }}
          />

          <div className="p-5 space-y-5">
            {/* Slide header with controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: `${brandColor}20`,
                    color: brandColor,
                  }}
                >
                  {currentSlide.slideNumber}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Slide {safeActive + 1}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {slides.length} {slides.length === 1 ? "slide" : "slides"}{" "}
                    no carrossel
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Nav arrows */}
                <button
                  onClick={goToPrev}
                  disabled={safeActive === 0}
                  className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input disabled:opacity-25 transition-all"
                  title="Slide anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={goToNext}
                  disabled={safeActive === slides.length - 1}
                  className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input disabled:opacity-25 transition-all"
                  title="Proximo slide"
                >
                  <ChevronRight size={16} />
                </button>

                <div className="w-px h-5 bg-border mx-1" />

                {/* Add */}
                <button
                  onClick={addSlide}
                  className="p-2 rounded-lg text-text-muted hover:text-accent-light hover:bg-accent/10 transition-all"
                  title="Adicionar slide"
                >
                  <Plus size={16} />
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteSlide(safeActive)}
                  disabled={slides.length <= 1}
                  className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-25 transition-all"
                  title="Remover slide"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Title field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                <Type size={11} />
                Titulo
              </label>
              <input
                value={currentSlide.titulo}
                onChange={(e) =>
                  updateSlide(safeActive, "titulo", e.target.value)
                }
                placeholder="Titulo do slide..."
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-semibold placeholder:text-text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Content field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                <MessageSquare size={11} />
                Conteudo
              </label>
              <textarea
                value={currentSlide.conteudo}
                onChange={(e) =>
                  updateSlide(safeActive, "conteudo", e.target.value)
                }
                rows={5}
                placeholder="Conteudo do slide..."
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none placeholder:text-text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Slide visual preview mini */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Preview
              </label>
              <div
                className="rounded-xl border border-border overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}08, ${brandColor}15)`,
                }}
              >
                <div
                  className="h-1"
                  style={{ backgroundColor: brandColor }}
                />
                <div className="p-6 text-center space-y-3">
                  <div
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: `${brandColor}25`,
                      color: brandColor,
                    }}
                  >
                    {currentSlide.slideNumber}
                  </div>
                  <h4 className="text-base font-bold text-text-primary">
                    {currentSlide.titulo || "Titulo do slide"}
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
                    {currentSlide.conteudo || "Conteudo do slide..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Quick Navigation Dots ── */}
      <div className="flex items-center justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={`dot-${i}`}
            onClick={() => {
              setActiveSlide(i);
              scrollToThumbnail(i);
            }}
            className="transition-all"
          >
            <div
              className={`rounded-full transition-all ${
                safeActive === i ? "w-6 h-2" : "w-2 h-2 opacity-40"
              }`}
              style={{
                backgroundColor:
                  safeActive === i ? brandColor : "currentColor",
              }}
            />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
