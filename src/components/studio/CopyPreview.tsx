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
} from "lucide-react";
import type { CopyContent, CopySlide } from "@/types/copy-studio";
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

/* ── Carousel preview ── */
function CarouselPreview({
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
}: CopyPreviewProps) {
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
    </motion.div>
  );
}
