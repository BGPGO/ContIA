"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  ArrowRight,
  Hash,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Type,
  MessageSquare,
  Zap,
  Film,
  Music,
  Clock,
  AlertCircle,
  Send,
  Loader2,
  XCircle,
} from "lucide-react";
import type { CopyContent, CopySlide, RichSlide, SlideSection } from "@/types/copy-studio";
import {
  Layout,
  BarChart3,
  List,
  BookOpen,
  Target,
  Quote,
} from "lucide-react";
import type { ContentFormat } from "@/types/ai";

/* ── Character limits per platform ── */
const CAPTION_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  twitter: 280,
};

interface CopyPreviewProps {
  copy: CopyContent | null;
  format: ContentFormat;
  platforms: string[];
  isApproved: boolean;
  onApprove: () => void;
  onEdit: (field: keyof CopyContent, value: unknown) => void;
  onCreateVisual: () => void;
  onSubmitApproval?: () => Promise<void>;
}

/* ── Inline editable field ── */
function EditableField({
  value,
  onChange,
  className,
  multiline = false,
  placeholder = "Clique para editar...",
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = inputRef.current.scrollHeight + "px";
      }
    }
  }, [editing, multiline]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) {
      onChange(draft.trim());
    }
  };

  if (editing) {
    const shared =
      "w-full bg-bg-input border border-accent/30 rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50 transition-colors " +
      (className || "");

    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={shared + " resize-none"}
          rows={3}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={shared}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`cursor-pointer rounded-lg px-1 -mx-1 transition-colors hover:bg-white/5 ${className || ""}`}
      title="Clique para editar"
    >
      {value || <span className="text-text-muted italic">{placeholder}</span>}
    </div>
  );
}

/* ── Empty state ── */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full px-6 py-12 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Sparkles size={28} className="text-accent/50" />
      </div>
      <h3 className="text-sm font-semibold text-text-secondary mb-1.5">
        Nenhuma copy ainda
      </h3>
      <p className="text-xs text-text-muted max-w-[240px] leading-relaxed">
        Converse com a IA no chat ao lado para gerar sua primeira copy. Ela aparecera aqui em tempo real.
      </p>
    </motion.div>
  );
}

/* ── Carousel navigator ── */
function CarouselNav({
  slides,
  activeIndex,
  onIndexChange,
}: {
  slides: CopySlide[];
  activeIndex: number;
  onIndexChange: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <button
        type="button"
        onClick={() => onIndexChange(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
        className="p-1 rounded-lg text-text-muted hover:text-text-primary disabled:opacity-30 transition-all cursor-pointer"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onIndexChange(i)}
            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
              i === activeIndex
                ? "bg-accent w-5"
                : "bg-text-muted/30 hover:bg-text-muted/50"
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onIndexChange(Math.min(slides.length - 1, activeIndex + 1))}
        disabled={activeIndex === slides.length - 1}
        className="p-1 rounded-lg text-text-muted hover:text-text-primary disabled:opacity-30 transition-all cursor-pointer"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ── Post preview card ── */
function PostPreview({
  copy,
  platforms,
  onEdit,
}: {
  copy: CopyContent;
  platforms: string[];
  onEdit: (field: keyof CopyContent, value: unknown) => void;
}) {
  const mainLimit = platforms.length > 0 ? CAPTION_LIMITS[platforms[0]] || 2200 : 2200;
  const captionLen = (copy.caption || "").length;
  const isOverLimit = captionLen > mainLimit;

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
          <Type size={10} />
          Headline
        </label>
        <EditableField
          value={copy.headline}
          onChange={(val) => onEdit("headline", val)}
          className="text-xl font-bold text-white leading-snug"
        />
      </div>

      {/* Caption */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
            <MessageSquare size={10} />
            Legenda
          </label>
          <span
            className={`text-[10px] font-medium ${
              isOverLimit ? "text-danger" : "text-text-muted"
            }`}
          >
            {isOverLimit && <AlertCircle size={10} className="inline mr-0.5" />}
            {captionLen}/{mainLimit}
          </span>
        </div>
        <EditableField
          value={copy.caption || ""}
          onChange={(val) => onEdit("caption", val)}
          className="text-sm text-[#e8eaff] leading-relaxed whitespace-pre-line"
          multiline
        />
      </div>

      {/* Hashtags */}
      {(copy.hashtags?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
            <Hash size={10} />
            Hashtags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {copy.hashtags!.map((tag, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-[#4ecdc4] cursor-default
                  hover:bg-accent/20 transition-colors"
              >
                #{tag.replace("#", "")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {copy.cta && (
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
            <Zap size={10} />
            CTA
          </label>
          <EditableField
            value={copy.cta}
            onChange={(val) => onEdit("cta", val)}
            className="text-sm font-medium text-[#6c5ce7]"
          />
        </div>
      )}
    </div>
  );
}

/* ── Content type badge config ── */
const CONTENT_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  cover: { icon: Layout, label: "Capa", color: "text-[#6c5ce7] bg-[#6c5ce7]/10" },
  content: { icon: BookOpen, label: "Conteudo", color: "text-[#4ecdc4] bg-[#4ecdc4]/10" },
  data: { icon: BarChart3, label: "Dados", color: "text-[#f39c12] bg-[#f39c12]/10" },
  list: { icon: List, label: "Lista", color: "text-[#3498db] bg-[#3498db]/10" },
  timeline: { icon: Clock, label: "Timeline", color: "text-[#e17055] bg-[#e17055]/10" },
  quote: { icon: Quote, label: "Citacao", color: "text-[#a29bfe] bg-[#a29bfe]/10" },
  cta: { icon: Target, label: "CTA", color: "text-[#00cec9] bg-[#00cec9]/10" },
};

/* ── Render headline with highlighted words ── */
function HighlightedHeadline({
  headline,
  highlights,
}: {
  headline: string;
  highlights?: string[];
}) {
  if (!highlights || highlights.length === 0) {
    return <span>{headline}</span>;
  }

  const pattern = highlights
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = headline.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isHighlighted = highlights.some(
          (h) => h.toLowerCase() === part.toLowerCase()
        );
        return isHighlighted ? (
          <span key={i} className="text-[#4ecdc4]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

/* ── Render a single rich section ── */
function RichSectionPreview({ section }: { section: SlideSection }) {
  switch (section.type) {
    case "stat":
      if (!section.stat) return null;
      return (
        <div className="flex flex-col items-center text-center py-2">
          <span className="text-2xl font-extrabold text-[#4ecdc4]">
            {section.stat.value}
          </span>
          <span className="text-xs text-text-secondary mt-0.5">
            {section.stat.label}
          </span>
          {section.stat.source && (
            <span className="text-[10px] text-text-muted mt-1 italic">
              {section.stat.source}
            </span>
          )}
        </div>
      );

    case "callout":
      if (!section.callout) return null;
      return (
        <div className="border-l-2 border-[#6c5ce7]/50 bg-[#6c5ce7]/5 rounded-r-lg px-3 py-2.5">
          <p className="text-sm text-text-primary italic leading-relaxed">
            &ldquo;{section.callout.text}&rdquo;
          </p>
          {section.callout.attribution && (
            <p className="text-[10px] text-text-muted mt-1">
              — {section.callout.attribution}
            </p>
          )}
        </div>
      );

    case "list":
      if (!section.items || section.items.length === 0) return null;
      return (
        <ul className="space-y-1.5">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-[#4ecdc4]" />
              <div>
                <span className="font-semibold text-text-primary">
                  {item.title}
                </span>
                {item.description && (
                  <span className="text-text-secondary ml-1">
                    {item.description}
                  </span>
                )}
                {item.date && (
                  <span className="text-text-muted text-[10px] ml-1.5">
                    {item.date}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      );

    case "paragraph":
      if (!section.content || section.content.length === 0) return null;
      return (
        <p className="text-sm text-text-secondary leading-relaxed">
          {section.content.map((seg, i) => (
            <span
              key={i}
              className={`${seg.highlight ? "text-[#4ecdc4] font-semibold" : ""} ${seg.bold ? "font-bold text-text-primary" : ""}`}
              style={seg.color ? { color: seg.color } : undefined}
            >
              {seg.text}
            </span>
          ))}
        </p>
      );

    case "cta-button":
      return (
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white text-sm font-semibold text-center">
            {section.buttonText || "Saiba mais"}
          </div>
          {section.buttonSubtext && (
            <span className="text-[10px] text-text-muted">
              {section.buttonSubtext}
            </span>
          )}
        </div>
      );

    case "divider":
      return <hr className="border-border/30 my-1" />;

    default:
      return null;
  }
}

/* ── Rich carousel preview (richSlides) ── */
function RichCarouselPreview({
  copy,
  onEdit,
}: {
  copy: CopyContent;
  onEdit: (field: keyof CopyContent, value: unknown) => void;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const richSlides = copy.richSlides!;

  // Build a minimal CopySlide[] for CarouselNav compatibility
  const navSlides: CopySlide[] = richSlides.map((s) => ({
    slideNumber: s.slideNumber,
    headline: s.headline,
    body: "",
  }));

  const slide = richSlides[activeSlide];
  const typeConfig = CONTENT_TYPE_CONFIG[slide.contentType] || CONTENT_TYPE_CONFIG.content;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="space-y-3">
      <CarouselNav
        slides={navSlides}
        activeIndex={activeSlide}
        onIndexChange={setActiveSlide}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {/* Slide header: number + content type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent-light text-[10px] font-bold">
              {slide.slideNumber}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeConfig.color}`}>
              <TypeIcon size={10} />
              {typeConfig.label}
            </span>
            {slide.tag && (
              <span className="text-[10px] text-text-muted bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {slide.tag}
              </span>
            )}
            <span className="text-xs text-text-muted ml-auto">
              {activeSlide + 1}/{richSlides.length}
            </span>
          </div>

          {/* Headline with highlights */}
          <h3 className="text-base font-bold text-white leading-snug">
            <HighlightedHeadline
              headline={slide.headline}
              highlights={slide.headlineHighlights}
            />
          </h3>

          {/* Sections */}
          <div className="space-y-3">
            {slide.sections.map((section, i) => (
              <RichSectionPreview key={i} section={section} />
            ))}
          </div>

          {/* Footnote */}
          {slide.footnote && (
            <p className="text-[10px] text-text-muted italic pt-1 border-t border-border/30">
              {slide.footnote}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Caption + Hashtags for entire carousel */}
      <div className="pt-3 border-t border-border/50 space-y-3">
        <EditableField
          value={copy.caption || ""}
          onChange={(val) => onEdit("caption", val)}
          className="text-sm text-[#e8eaff] leading-relaxed"
          multiline
          placeholder="Legenda do carrossel..."
        />
        {(copy.hashtags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {copy.hashtags!.map((tag, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-[#4ecdc4]"
              >
                #{tag.replace("#", "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Basic carousel preview (CopySlide[]) ── */
function BasicCarouselPreview({
  copy,
  onEdit,
}: {
  copy: CopyContent;
  onEdit: (field: keyof CopyContent, value: unknown) => void;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = copy.slides || [];

  if (slides.length === 0) return null;

  const slide = slides[activeSlide];

  return (
    <div className="space-y-3">
      <CarouselNav
        slides={slides}
        activeIndex={activeSlide}
        onIndexChange={setActiveSlide}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent-light text-[10px] font-bold">
              {slide.slideNumber}
            </span>
            <span className="text-xs text-text-muted">
              Slide {activeSlide + 1} de {slides.length}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Titulo
            </label>
            <EditableField
              value={slide.headline}
              onChange={(val) => {
                const newSlides = [...slides];
                newSlides[activeSlide] = { ...newSlides[activeSlide], headline: val };
                onEdit("slides", newSlides);
              }}
              className="text-base font-bold text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Conteudo
            </label>
            <EditableField
              value={slide.body}
              onChange={(val) => {
                const newSlides = [...slides];
                newSlides[activeSlide] = { ...newSlides[activeSlide], body: val };
                onEdit("slides", newSlides);
              }}
              className="text-sm text-text-secondary leading-relaxed"
              multiline
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Caption + Hashtags for entire carousel */}
      <div className="pt-3 border-t border-border/50 space-y-3">
        <EditableField
          value={copy.caption || ""}
          onChange={(val) => onEdit("caption", val)}
          className="text-sm text-[#e8eaff] leading-relaxed"
          multiline
          placeholder="Legenda do carrossel..."
        />
        {(copy.hashtags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {copy.hashtags!.map((tag, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-[#4ecdc4]"
              >
                #{tag.replace("#", "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Carousel preview (delegates to rich or basic) ── */
function CarouselPreview({
  copy,
  onEdit,
}: {
  copy: CopyContent;
  onEdit: (field: keyof CopyContent, value: unknown) => void;
}) {
  if (copy.richSlides && copy.richSlides.length > 0) {
    return <RichCarouselPreview copy={copy} onEdit={onEdit} />;
  }
  return <BasicCarouselPreview copy={copy} onEdit={onEdit} />;
}

/* ── Reels script preview ── */
function ReelsPreview({ copy, onEdit }: { copy: CopyContent; onEdit: (field: keyof CopyContent, value: unknown) => void }) {
  const script = copy.reelsScript;
  if (!script) {
    return (
      <PostPreview copy={copy} platforms={[]} onEdit={onEdit} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
          <Film size={10} />
          Hook
        </label>
        <p className="text-sm text-text-primary font-medium bg-bg-input border border-border rounded-lg px-3 py-2.5">
          {script.hook}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
          Roteiro
        </label>
        <ol className="space-y-2">
          {script.corpo.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-text-secondary"
            >
              <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent-light text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="flex items-center gap-1 text-[10px] font-medium text-text-muted uppercase tracking-wider">
            <Clock size={10} />
            Duracao
          </label>
          <p className="text-sm text-text-secondary">{script.duracao}</p>
        </div>
        {script.musica_sugerida && (
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[10px] font-medium text-text-muted uppercase tracking-wider">
              <Music size={10} />
              Musica
            </label>
            <p className="text-sm text-text-secondary">{script.musica_sugerida}</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
          <Zap size={10} />
          CTA
        </label>
        <p className="text-sm text-accent-light font-medium">{script.cta}</p>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export function CopyPreview({
  copy,
  format,
  platforms,
  isApproved,
  onApprove,
  onEdit,
  onCreateVisual,
  onSubmitApproval,
}: CopyPreviewProps) {
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmitApproval() {
    if (!onSubmitApproval) return;
    setSubmittingApproval(true);
    try {
      await onSubmitApproval();
      showToast("Post enviado para aprovação!", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar para aprovação";
      showToast(msg, "error");
    } finally {
      setSubmittingApproval(false);
    }
  }

  if (!copy) return <EmptyState />;

  const renderContent = () => {
    switch (format) {
      case "carrossel":
        return <CarouselPreview copy={copy} onEdit={onEdit} />;
      case "reels":
        return <ReelsPreview copy={copy} onEdit={onEdit} />;
      default:
        return <PostPreview copy={copy} platforms={platforms} onEdit={onEdit} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      {/* Card with gradient border */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="relative rounded-xl overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#4ecdc4]/20 to-[#6c5ce7]/20 p-px">
            <div className="w-full h-full rounded-xl bg-[#141736]" />
          </div>
          {/* Content */}
          <div className="relative p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={JSON.stringify(copy).slice(0, 100)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 px-5 py-4 border-t border-border/50 space-y-2">
        {!isApproved ? (
          <button
            type="button"
            onClick={onApprove}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-success/15 text-success border border-success/20
              hover:bg-success/25 hover:border-success/40
              transition-all cursor-pointer"
          >
            <Check size={16} />
            Aprovar Copy
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium mb-2">
            <Check size={14} />
            Copy aprovada
          </div>
        )}

        {/* Enviar para aprovação — fluxo alternativo ao Criar Visual */}
        {onSubmitApproval && (
          <button
            type="button"
            onClick={handleSubmitApproval}
            disabled={submittingApproval}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-[#6c5ce7]/10 text-[#a29bfe] border border-[#6c5ce7]/20
              hover:bg-[#6c5ce7]/20 hover:border-[#6c5ce7]/40
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all cursor-pointer"
          >
            {submittingApproval ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {submittingApproval ? "Enviando..." : "Enviar para Aprovação"}
          </button>
        )}

        <button
          type="button"
          onClick={onCreateVisual}
          disabled={!isApproved}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
            text-white disabled:opacity-40 disabled:cursor-not-allowed
            transition-all cursor-pointer hover:shadow-lg hover:shadow-secondary/20 active:scale-[0.98]"
          style={{
            background: isApproved
              ? "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)"
              : "rgba(255,255,255,0.06)",
          }}
        >
          <ArrowRight size={16} />
          Criar Visual
        </button>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${
              toast.type === "success"
                ? "bg-[#0c0f24]/95 border-[#34d399]/30 text-[#34d399]"
                : "bg-[#0c0f24]/95 border-[#f87171]/30 text-[#f87171]"
            }`}
          >
            {toast.type === "success" ? (
              <Check size={16} className="shrink-0" />
            ) : (
              <XCircle size={16} className="shrink-0" />
            )}
            <span className="text-sm font-medium text-[#e8eaff]">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
