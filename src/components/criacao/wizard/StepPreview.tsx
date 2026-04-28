"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ImageIcon,
  Loader2,
  RefreshCw,
  Hash,
  X,
  Smartphone,
  Type,
  MessageSquare,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { RichSlide, SlideSection } from "@/types/copy-studio";
import { PostCarouselPreview } from "@/components/criacao/PostPreview";

interface StepPreviewProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  setSlideImage: (idx: number, url: string) => void;
  setGeneratedImage: (url: string) => void;
  onRegenerate: () => void;
}

/* ─── Phone Mockup ─── */
function PhoneMockup({
  children,
  platform,
}: {
  children: React.ReactNode;
  platform?: string;
}) {
  return (
    <div className="mx-auto max-w-[320px]">
      {/* Phone frame */}
      <div className="bg-[#1a1a2e] rounded-[2rem] p-3 shadow-2xl border border-[#2a2a4a]">
        {/* Notch */}
        <div className="flex justify-center mb-2">
          <div className="w-20 h-1.5 rounded-full bg-[#2a2a4a]" />
        </div>
        {/* Screen */}
        <div className="bg-white rounded-2xl overflow-hidden">
          {/* Status bar */}
          <div className="bg-white px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 font-medium">
              {platform || "Instagram"}
            </span>
            <div className="flex gap-1">
              <div className="w-3 h-1.5 rounded-sm bg-gray-300" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            </div>
          </div>
          {/* Content */}
          <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
            {children}
          </div>
          {/* Engagement bar */}
          <div className="px-4 py-3 bg-white border-t border-gray-100">
            <div className="flex gap-4 mb-2">
              <div className="w-5 h-5 rounded-full bg-gray-200" />
              <div className="w-5 h-5 rounded-full bg-gray-200" />
              <div className="w-5 h-5 rounded-full bg-gray-200" />
            </div>
            <div className="w-16 h-2 rounded bg-gray-200 mb-1.5" />
            <div className="w-full h-2 rounded bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Carousel Slide Card (mini) ─── */
function CarouselSlideCard({
  slide,
  index,
  isActive,
  onClick,
}: {
  slide: { slideNumber: number; titulo: string; conteudo: string };
  index: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      onClick={onClick}
      className={`shrink-0 w-60 bg-bg-card border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-accent/40 ${
        isActive ? "border-accent shadow-lg shadow-accent/10" : "border-border"
      }`}
    >
      {/* Accent gradient header */}
      <div className="h-1.5 bg-gradient-to-r from-accent via-accent-light to-accent/50" />
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent-light text-[10px] font-bold">
            {slide.slideNumber}
          </span>
          <h4 className="text-sm font-semibold text-text-primary truncate flex-1">
            {slide.titulo}
          </h4>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
          {slide.conteudo}
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Rich Slide Preview (visual canvas-like) ─── */
function RichSlidePreview({
  slide,
  totalSlides,
  isActive,
  size = "small",
  onClick,
}: {
  slide: RichSlide;
  totalSlides: number;
  isActive?: boolean;
  size?: "small" | "large";
  onClick?: () => void;
}) {
  const isSmall = size === "small";
  const isCover = slide.contentType === "cover";
  const isCta = slide.contentType === "cta";

  // Render headline with highlighted words in accent color
  const renderHeadline = () => {
    if (!slide.headlineHighlights?.length) {
      return <span className="text-[#e0e4f0]">{slide.headline}</span>;
    }
    // Join all highlights into one search string (case-insensitive)
    const hlText = slide.headlineHighlights.join(" ").toLowerCase();
    const idx = slide.headline.toLowerCase().indexOf(hlText);
    if (idx === -1) {
      return <span className="text-[#e0e4f0]">{slide.headline}</span>;
    }

    const before = slide.headline.slice(0, idx);
    const highlighted = slide.headline.slice(idx, idx + hlText.length);
    const after = slide.headline.slice(idx + hlText.length);

    return (
      <>
        {before && <span className="text-[#e0e4f0]">{before}</span>}
        <span className="text-[#3b82f6]">{highlighted}</span>
        {after && <span className="text-[#e0e4f0]">{after}</span>}
      </>
    );
  };

  // Render a single section
  const renderSection = (section: SlideSection, i: number) => {
    switch (section.type) {
      case "paragraph":
        return (
          <p
            key={i}
            className={`text-[#e0e4f0]/70 leading-relaxed ${isSmall ? "text-[7px]" : "text-xs"}`}
          >
            {section.content?.map((seg, j) => (
              <span
                key={j}
                className={`${seg.highlight ? "text-[#3b82f6]" : ""} ${seg.bold ? "font-semibold" : ""}`}
              >
                {seg.text}
              </span>
            ))}
          </p>
        );
      case "stat":
        return (
          <div key={i} className="space-y-0.5">
            <div
              className={`text-[#3b82f6] font-bold ${isSmall ? "text-base" : "text-2xl"}`}
            >
              {section.stat?.value}
            </div>
            <div
              className={`text-[#e0e4f0]/60 ${isSmall ? "text-[6px]" : "text-[10px]"}`}
            >
              {section.stat?.label}
            </div>
            {section.stat?.source && !isSmall && (
              <div className="text-[#6b7094]/50 text-[8px]">
                {section.stat.source}
              </div>
            )}
          </div>
        );
      case "callout":
        return (
          <div
            key={i}
            className={`bg-[#111528] border border-border rounded-lg border-l-2 border-l-[#3b82f6] ${isSmall ? "p-1.5" : "p-3"}`}
          >
            <p
              className={`text-[#e0e4f0]/80 italic ${isSmall ? "text-[6px]" : "text-xs"}`}
            >
              {section.callout?.text}
            </p>
            {section.callout?.attribution && !isSmall && (
              <span className="text-[#6b7094] text-[9px] mt-1 block">
                -- {section.callout.attribution}
              </span>
            )}
          </div>
        );
      case "list":
        return (
          <div key={i} className={`space-y-${isSmall ? "0.5" : "2"}`}>
            {section.items?.map((item, j) => (
              <div key={j} className="flex gap-2">
                <span
                  className={`text-[#3b82f6] font-bold shrink-0 ${isSmall ? "text-[6px]" : "text-xs"}`}
                >
                  {item.date || "\u25CF"}
                </span>
                <div>
                  <span
                    className={`text-[#e0e4f0] font-semibold ${isSmall ? "text-[6px]" : "text-xs"}`}
                  >
                    {item.title}
                  </span>
                  {item.description && !isSmall && (
                    <p className="text-[#e0e4f0]/50 text-[10px]">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      case "cta-button":
        return (
          <div key={i} className="flex justify-center">
            <div
              className={`border border-[#3b82f6] rounded-lg text-center ${isSmall ? "px-3 py-1" : "px-6 py-2"}`}
            >
              <span
                className={`text-[#3b82f6] font-bold tracking-wider ${isSmall ? "text-[7px]" : "text-xs"}`}
              >
                {"\u25B8"} {section.buttonText}
              </span>
              {section.buttonSubtext && !isSmall && (
                <p className="text-[#6b7094] text-[9px] mt-0.5">
                  {section.buttonSubtext}
                </p>
              )}
            </div>
          </div>
        );
      case "divider":
        return (
          <div key={i} className="w-1/3 h-px bg-[#3b82f6]/30 mx-auto" />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`bg-[#080c1a] rounded-xl overflow-hidden flex flex-col shrink-0 cursor-pointer transition-shadow ${
        isActive ? "ring-2 ring-[#3b82f6] shadow-lg shadow-[#3b82f6]/20" : ""
      } ${
        isSmall
          ? "w-[160px] h-[200px] p-3"
          : "w-[360px] h-[450px] p-6"
      }`}
    >
      {/* Tag */}
      {slide.tag && (
        <span
          className={`text-[#6b7094] uppercase tracking-widest font-semibold ${
            isSmall ? "text-[6px] mb-1" : "text-[10px] mb-2"
          }`}
        >
          {isCover ? slide.tag : `\u25CF ${slide.tag}`}
        </span>
      )}

      {/* Headline */}
      <div
        className={`font-black leading-tight ${
          isCover
            ? isSmall
              ? "text-sm"
              : "text-3xl"
            : isCta
              ? isSmall
                ? "text-sm"
                : "text-2xl"
              : isSmall
                ? "text-[10px]"
                : "text-xl"
        } ${isSmall ? "mb-1" : "mb-3"}`}
      >
        {renderHeadline()}
      </div>

      {/* Sections */}
      <div
        className={`flex-1 overflow-hidden ${
          isSmall ? "space-y-1" : "space-y-3"
        }`}
      >
        {slide.sections?.map((section, i) => renderSection(section, i))}
      </div>

      {/* Navigation dots */}
      <div
        className={`flex justify-center gap-1 ${isSmall ? "mt-1" : "mt-3"}`}
      >
        {Array.from({ length: totalSlides }, (_, i) => (
          <div
            key={i}
            className={`rounded-full ${
              i === slide.slideNumber - 1
                ? "bg-[#3b82f6]"
                : "bg-[#6b7094]/30"
            } ${isSmall ? "w-1 h-1" : "w-1.5 h-1.5"}`}
          />
        ))}
      </div>

      {/* Footnote */}
      {slide.footnote && (
        <span
          className={`text-[#6b7094]/40 text-center mt-1 block ${
            isSmall ? "text-[5px]" : "text-[9px]"
          }`}
        >
          {slide.footnote}
        </span>
      )}
    </motion.div>
  );
}

export function StepPreview({
  state,
  setField,
  setSlideImage,
  setGeneratedImage,
  onRegenerate,
}: StepPreviewProps) {
  const [generatingSlide, setGeneratingSlide] = useState<number | null>(null);
  const [generatingMain, setGeneratingMain] = useState(false);
  const [activeCarouselSlide, setActiveCarouselSlide] = useState(0);

  const generateSlideImage = async (slideIndex: number, prompt: string) => {
    setGeneratingSlide(slideIndex);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Falha ao gerar imagem");
      const data = await res.json();
      setSlideImage(slideIndex, data.url);
    } catch {
      // silent fail
    } finally {
      setGeneratingSlide(null);
    }
  };

  const generateMainImage = async (prompt: string) => {
    setGeneratingMain(true);
    setField("generatingImage", true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Falha ao gerar imagem");
      const data = await res.json();
      setGeneratedImage(data.url);
    } catch {
      // silent fail
    } finally {
      setGeneratingMain(false);
      setField("generatingImage", false);
    }
  };

  const { result, visualSlides, visualMode } = state;
  const richSlides = (result as any)?.richSlides as RichSlide[] | undefined;
  const hasRichSlides = richSlides && richSlides.length > 0;
  const [activeRichSlide, setActiveRichSlide] = useState(0);

  // Reset active rich slide when richSlides change
  useEffect(() => {
    setActiveRichSlide(0);
  }, [richSlides?.length]);

  const platformLabel =
    state.platforms[0] === "instagram"
      ? "Instagram"
      : state.platforms[0] === "linkedin"
        ? "LinkedIn"
        : state.platforms[0] === "facebook"
          ? "Facebook"
          : state.platforms[0] || "Instagram";

  // ── Visual mode with slides ──
  if (visualMode && visualSlides.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-semibold text-text-primary text-center"
        >
          Preview do conteudo
        </motion.h2>

        <div className="flex justify-center">
          <PostCarouselPreview slides={visualSlides} size="large" />
        </div>

        {/* Editable fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 bg-bg-card border border-border rounded-xl p-5"
        >
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Legenda
            </label>
            <textarea
              value={state.visualLegenda}
              onChange={(e) => setField("visualLegenda", e.target.value)}
              rows={3}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Hashtags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {state.visualHashtags.map((tag, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light"
                >
                  <Hash size={10} />
                  {tag.replace("#", "")}
                  <button
                    onClick={() =>
                      setField(
                        "visualHashtags",
                        state.visualHashtags.filter((_, idx) => idx !== i)
                      )
                    }
                    className="hover:text-danger transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              CTA
            </label>
            <input
              value={state.visualCta}
              onChange={(e) => setField("visualCta", e.target.value)}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </motion.div>

        {/* Slide image prompts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-text-secondary">
            Imagens dos slides
          </h3>
          {visualSlides.map((slide: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.05 }}
              className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3"
            >
              <span className="text-xs text-text-muted shrink-0">
                Slide {i + 1}
              </span>
              <p className="flex-1 text-xs text-text-secondary truncate">
                {slide.background?.image_prompt || "Sem prompt de imagem"}
              </p>
              {state.slideImages[i] ? (
                <img
                  src={state.slideImages[i]}
                  alt={`Slide ${i + 1}`}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <button
                  onClick={() =>
                    slide.background?.image_prompt &&
                    generateSlideImage(i, slide.background.image_prompt)
                  }
                  disabled={
                    generatingSlide === i || !slide.background?.image_prompt
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 transition-all shrink-0"
                >
                  {generatingSlide === i ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ImageIcon size={12} />
                  )}
                  Gerar
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <button
            onClick={onRegenerate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light transition-all"
          >
            <RefreshCw size={14} />
            Regenerar
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // ── No result ──
  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-text-muted text-sm">Nenhum conteudo gerado.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-semibold text-text-primary text-center"
      >
        Preview do conteudo
      </motion.h2>

      {/* ═══ POST FORMAT ═══ */}
      {state.format === "post" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <PhoneMockup platform={platformLabel}>
              <div className="w-full h-full flex flex-col items-center justify-center text-center gap-3 p-2">
                {/* Title in card */}
                <div className="w-full">
                  <h3 className="text-base font-bold text-gray-900 leading-snug">
                    {result.titulo}
                  </h3>
                </div>
                {/* Content snippet */}
                <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-5">
                  {result.conteudo}
                </p>
                {/* CTA pill */}
                {result.cta && (
                  <div className="mt-auto">
                    <span className="inline-block px-3 py-1 rounded-full bg-accent text-white text-[10px] font-semibold">
                      {result.cta}
                    </span>
                  </div>
                )}
                {/* Hashtags mini */}
                {result.hashtags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {result.hashtags.slice(0, 4).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[9px] text-blue-500 font-medium"
                      >
                        #{tag.replace("#", "")}
                      </span>
                    ))}
                    {result.hashtags.length > 4 && (
                      <span className="text-[9px] text-gray-400">
                        +{result.hashtags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </PhoneMockup>
          </motion.div>

          {/* Right: Editable Fields */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="bg-bg-card border border-border rounded-xl p-5 space-y-4"
            >
              {/* Title */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <Type size={12} />
                  Titulo
                </label>
                <input
                  value={result.titulo}
                  onChange={(e) =>
                    setField("result", {
                      ...result,
                      titulo: e.target.value,
                    } as any)
                  }
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-semibold focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="space-y-2"
              >
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <MessageSquare size={12} />
                  Conteudo
                </label>
                <textarea
                  value={result.conteudo}
                  onChange={(e) =>
                    setField("result", {
                      ...result,
                      conteudo: e.target.value,
                    } as any)
                  }
                  rows={6}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
                />
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
                className="space-y-2"
              >
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <Zap size={12} />
                  CTA
                </label>
                <div className="relative">
                  <input
                    value={result.cta}
                    onChange={(e) =>
                      setField("result", {
                        ...result,
                        cta: e.target.value,
                      } as any)
                    }
                    className="w-full bg-bg-input border border-accent/30 rounded-lg px-3 py-2.5 text-sm text-accent-light font-medium focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>
              </motion.div>

              {/* Hashtags */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.35 }}
                className="space-y-2"
              >
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <Hash size={12} />
                  Hashtags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {result.hashtags.map((tag, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.03 }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light cursor-default hover:bg-accent/20 transition-colors"
                    >
                      #{tag.replace("#", "")}
                      <button
                        onClick={() =>
                          setField("result", {
                            ...result,
                            hashtags: result.hashtags.filter(
                              (_, idx) => idx !== i
                            ),
                          } as any)
                        }
                        className="hover:text-danger transition-colors ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ═══ CARROSSEL FORMAT — Rich Slides ═══ */}
      {state.format === "carrossel" && hasRichSlides && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          {/* Thumbnail strip */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Slides visuais
            </label>
            <div className="relative">
              <div
                className="flex gap-3 overflow-x-auto pb-3 scrollbar-none"
                style={{ scrollbarWidth: "none" }}
              >
                {richSlides!.map((slide, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.35 }}
                  >
                    <RichSlidePreview
                      slide={slide}
                      totalSlides={richSlides!.length}
                      isActive={activeRichSlide === i}
                      size="small"
                      onClick={() => setActiveRichSlide(i)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Active slide large preview */}
          <AnimatePresence mode="wait">
            {richSlides![activeRichSlide] && (
              <motion.div
                key={`rich-${activeRichSlide}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Navigation header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/15 text-accent-light text-xs font-bold">
                      {richSlides![activeRichSlide].slideNumber}
                    </span>
                    <div>
                      <span className="text-xs text-text-muted">
                        Slide {activeRichSlide + 1} de {richSlides!.length}
                      </span>
                      <span className="text-[10px] text-text-muted/60 ml-2 uppercase">
                        {richSlides![activeRichSlide].contentType}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setActiveRichSlide(Math.max(0, activeRichSlide - 1))
                      }
                      disabled={activeRichSlide === 0}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setActiveRichSlide(
                          Math.min(richSlides!.length - 1, activeRichSlide + 1)
                        )
                      }
                      disabled={activeRichSlide === richSlides!.length - 1}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input disabled:opacity-30 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Large preview centered */}
                <div className="flex justify-center">
                  <RichSlidePreview
                    slide={richSlides![activeRichSlide]}
                    totalSlides={richSlides!.length}
                    isActive
                    size="large"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editable caption */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-bg-card border border-border rounded-xl p-5 space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Legenda
              </label>
              <textarea
                value={result.conteudo}
                onChange={(e) =>
                  setField("result", {
                    ...result,
                    conteudo: e.target.value,
                  } as any)
                }
                rows={3}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                <Zap size={12} />
                CTA
              </label>
              <input
                value={result.cta}
                onChange={(e) =>
                  setField("result", {
                    ...result,
                    cta: e.target.value,
                  } as any)
                }
                className="w-full bg-bg-input border border-accent/30 rounded-lg px-3 py-2.5 text-sm text-accent-light font-medium focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                <Hash size={12} />
                Hashtags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 + i * 0.03 }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light hover:bg-accent/20 transition-colors"
                  >
                    #{tag.replace("#", "")}
                    <button
                      onClick={() =>
                        setField("result", {
                          ...result,
                          hashtags: result.hashtags.filter(
                            (_, idx) => idx !== i
                          ),
                        } as any)
                      }
                      className="hover:text-danger transition-colors ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ CARROSSEL FORMAT — Basic (fallback) ═══ */}
      {state.format === "carrossel" && !hasRichSlides && result.slides && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          {/* Horizontal slide strip */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Slides
            </label>
            <div className="relative">
              <div
                className="flex gap-3 overflow-x-auto pb-3 scrollbar-none"
                style={{ scrollbarWidth: "none" }}
              >
                {result.slides.map((slide, i) => (
                  <CarouselSlideCard
                    key={i}
                    slide={slide}
                    index={i}
                    isActive={activeCarouselSlide === i}
                    onClick={() => setActiveCarouselSlide(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Active slide detail */}
          <AnimatePresence mode="wait">
            {result.slides[activeCarouselSlide] && (
              <motion.div
                key={activeCarouselSlide}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-bg-card border border-border rounded-xl overflow-hidden"
              >
                {/* Gradient header */}
                <div className="h-1 bg-gradient-to-r from-accent via-accent-light to-accent/30" />
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/15 text-accent-light text-xs font-bold">
                        {result.slides[activeCarouselSlide].slideNumber}
                      </span>
                      <span className="text-xs text-text-muted">
                        Slide {activeCarouselSlide + 1} de{" "}
                        {result.slides.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setActiveCarouselSlide(
                            Math.max(0, activeCarouselSlide - 1)
                          )
                        }
                        disabled={activeCarouselSlide === 0}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setActiveCarouselSlide(
                            Math.min(
                              result.slides!.length - 1,
                              activeCarouselSlide + 1
                            )
                          )
                        }
                        disabled={
                          activeCarouselSlide === result.slides!.length - 1
                        }
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Titulo
                    </label>
                    <input
                      value={result.slides[activeCarouselSlide].titulo}
                      onChange={(e) => {
                        const newSlides = [...result.slides!];
                        newSlides[activeCarouselSlide] = {
                          ...newSlides[activeCarouselSlide],
                          titulo: e.target.value,
                        };
                        setField("result", {
                          ...result,
                          slides: newSlides,
                        } as any);
                      }}
                      className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-semibold focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      Conteudo
                    </label>
                    <textarea
                      value={result.slides[activeCarouselSlide].conteudo}
                      onChange={(e) => {
                        const newSlides = [...result.slides!];
                        newSlides[activeCarouselSlide] = {
                          ...newSlides[activeCarouselSlide],
                          conteudo: e.target.value,
                        };
                        setField("result", {
                          ...result,
                          slides: newSlides,
                        } as any);
                      }}
                      rows={4}
                      className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hashtags for carousel */}
          {result.hashtags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-bg-card border border-border rounded-xl p-5 space-y-2"
            >
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Hashtags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.03 }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light hover:bg-accent/20 transition-colors"
                  >
                    #{tag.replace("#", "")}
                    <button
                      onClick={() =>
                        setField("result", {
                          ...result,
                          hashtags: result.hashtags.filter(
                            (_, idx) => idx !== i
                          ),
                        } as any)
                      }
                      className="hover:text-danger transition-colors ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ═══ OTHER FORMATS (reels, email, copy) ═══ */}
      {state.format !== "post" && state.format !== "carrossel" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-bg-card border border-border rounded-xl p-5 space-y-5"
        >
          {/* Reels */}
          {state.format === "reels" && result.reelsScript && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Hook
                </label>
                <p className="text-sm text-text-primary font-medium bg-bg-input border border-border rounded-lg px-3 py-2.5">
                  {result.reelsScript.hook}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Roteiro
                </label>
                <ol className="space-y-2">
                  {result.reelsScript.corpo.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.06 }}
                      className="flex items-start gap-2 text-sm text-text-secondary"
                    >
                      <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent-light text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </motion.li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Duracao
                  </label>
                  <p className="text-sm text-text-secondary">
                    {result.reelsScript.duracao}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Musica sugerida
                  </label>
                  <p className="text-sm text-text-secondary">
                    {result.reelsScript.musica_sugerida}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  CTA
                </label>
                <p className="text-sm text-text-primary">
                  {result.reelsScript.cta}
                </p>
              </div>
            </div>
          )}

          {/* Email */}
          {state.format === "email" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Assunto
                </label>
                <p className="text-sm text-text-primary font-semibold bg-bg-input border border-border rounded-lg px-3 py-2.5">
                  {result.emailSubject}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Corpo
                </label>
                <div
                  className="text-sm text-text-secondary bg-bg-input border border-border rounded-lg px-4 py-3 prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: result.emailBody || result.conteudo,
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  CTA
                </label>
                <p className="text-sm text-accent-light font-medium">
                  {result.cta}
                </p>
              </div>
            </div>
          )}

          {/* Copy */}
          {state.format === "copy" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Headline
                </label>
                <p className="text-lg font-bold text-text-primary">
                  {result.titulo}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Corpo
                </label>
                <textarea
                  value={result.conteudo}
                  onChange={(e) =>
                    setField("result", {
                      ...result,
                      conteudo: e.target.value,
                    } as any)
                  }
                  rows={5}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  CTA
                </label>
                <p className="text-sm text-accent-light font-semibold">
                  {result.cta}
                </p>
              </div>
            </div>
          )}

          {/* Hashtags */}
          {result.hashtags.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Hashtags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-light"
                  >
                    #{tag.replace("#", "")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ IMAGE GENERATION (all formats) ═══ */}
      {result.imagePrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-bg-card border border-border rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-text-secondary">Imagem</h3>
          <p className="text-xs text-text-muted">{result.imagePrompt}</p>

          {state.generatedImageUrl ? (
            <img
              src={state.generatedImageUrl}
              alt="Generated"
              className="w-full max-w-xs sm:max-w-md rounded-xl border border-border"
            />
          ) : (
            <button
              onClick={() => generateMainImage(result.imagePrompt)}
              disabled={generatingMain}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 transition-all"
            >
              {generatingMain ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImageIcon size={14} />
              )}
              Gerar Imagem
            </button>
          )}
        </motion.div>
      )}

      {/* ═══ REGENERATE BUTTON ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        <button
          onClick={onRegenerate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light transition-all"
        >
          <RefreshCw size={14} />
          Regenerar
        </button>
      </motion.div>
    </motion.div>
  );
}
