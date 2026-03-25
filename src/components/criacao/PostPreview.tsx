"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PostSlide {
  slideNumber: number;
  titulo: string;
  subtitulo?: string;
  corpo?: string;
  background: {
    type: string;
    colors: string[];
    overlay_opacity: number;
    image_prompt?: string;
  };
  text_layout: {
    position: string;
    has_container: boolean;
    container_color?: string;
    container_radius?: number;
    title_color: string;
    title_size: number;
    subtitle_color?: string;
    subtitle_size?: number;
    font_weight?: string;
  };
  imageUrl?: string;
}

type PreviewSize = "small" | "medium" | "large";

const SIZE_MAP: Record<PreviewSize, number> = {
  small: 200,
  medium: 350,
  large: 480,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function buildBackground(slide: PostSlide): React.CSSProperties {
  const { background, imageUrl } = slide;

  if (imageUrl) {
    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,${background.overlay_opacity}), rgba(0,0,0,${background.overlay_opacity})), url(${imageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  const colors = background.colors?.length ? background.colors : ["#1a1e42", "#080b1e"];

  if (background.type === "solid-color" || colors.length === 1) {
    return { backgroundColor: colors[0] };
  }

  // gradient (default)
  return {
    background: `linear-gradient(135deg, ${colors.join(", ")})`,
  };
}

function positionClasses(position: string): string {
  switch (position) {
    case "top":
      return "justify-start pt-[16%]";
    case "bottom":
      return "justify-end pb-[16%]";
    case "left":
      return "justify-center items-start pl-[10%] text-left";
    default: // center
      return "justify-center";
  }
}

function titleFontSize(size: PreviewSize, titleSize: number): string {
  const base = SIZE_MAP[size];
  // titleSize is a relative value (e.g. 28-48), scale proportionally
  const scaled = Math.round((titleSize / 40) * (base * 0.072));
  return `${Math.max(scaled, 10)}px`;
}

function subtitleFontSize(size: PreviewSize, subtitleSize?: number): string {
  const base = SIZE_MAP[size];
  const sSize = subtitleSize ?? 18;
  const scaled = Math.round((sSize / 40) * (base * 0.052));
  return `${Math.max(scaled, 8)}px`;
}

function corpoFontSize(size: PreviewSize): string {
  const base = SIZE_MAP[size];
  const scaled = Math.round(base * 0.032);
  return `${Math.max(scaled, 7)}px`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PostPreview — renders a single slide as Instagram-like card
   ═══════════════════════════════════════════════════════════════════════════ */

interface PostPreviewProps {
  slide: PostSlide;
  size?: PreviewSize;
  className?: string;
}

export function PostPreview({ slide, size = "medium", className = "" }: PostPreviewProps) {
  const px = SIZE_MAP[size];
  const { text_layout: tl } = slide;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shrink-0 select-none ${className}`}
      style={{
        width: px,
        height: px * 1.0, // 1:1 ratio
        ...buildBackground(slide),
      }}
    >
      {/* Subtle inner shadow for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.15)",
        }}
      />

      {/* Text layer */}
      <div
        className={`absolute inset-0 flex flex-col items-center px-[8%] ${positionClasses(
          tl.position
        )}`}
      >
        {/* Optional container */}
        <div
          className={`max-w-[90%] ${
            tl.has_container ? "px-[6%] py-[4%]" : ""
          }`}
          style={
            tl.has_container
              ? {
                  backgroundColor: tl.container_color ?? "rgba(0,0,0,0.45)",
                  borderRadius: tl.container_radius
                    ? `${tl.container_radius}px`
                    : "16px",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }
              : undefined
          }
        >
          {/* Title */}
          <h2
            className="leading-[1.15] tracking-tight"
            style={{
              color: tl.title_color || "#ffffff",
              fontSize: titleFontSize(size, tl.title_size),
              fontWeight: tl.font_weight === "normal" ? 500 : 800,
              textShadow: !tl.has_container
                ? "0 2px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)"
                : "none",
              textAlign: tl.position === "left" ? "left" : "center",
              wordBreak: "break-word",
            }}
          >
            {slide.titulo}
          </h2>

          {/* Subtitle */}
          {slide.subtitulo && (
            <p
              className="mt-[4%] leading-snug"
              style={{
                color: tl.subtitle_color ?? "rgba(255,255,255,0.85)",
                fontSize: subtitleFontSize(size, tl.subtitle_size),
                fontWeight: 500,
                textShadow: !tl.has_container
                  ? "0 1px 6px rgba(0,0,0,0.4)"
                  : "none",
                textAlign: tl.position === "left" ? "left" : "center",
              }}
            >
              {slide.subtitulo}
            </p>
          )}

          {/* Body text */}
          {slide.corpo && (
            <p
              className="mt-[3%] leading-relaxed opacity-90"
              style={{
                color: tl.subtitle_color ?? "rgba(255,255,255,0.75)",
                fontSize: corpoFontSize(size),
                textAlign: tl.position === "left" ? "left" : "center",
                textShadow: !tl.has_container
                  ? "0 1px 4px rgba(0,0,0,0.3)"
                  : "none",
              }}
            >
              {slide.corpo}
            </p>
          )}
        </div>
      </div>

      {/* Slide number badge */}
      <div
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          backgroundColor: "rgba(0,0,0,0.4)",
          color: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(8px)",
        }}
      >
        {slide.slideNumber}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PostCarouselPreview — horizontal scrollable strip with navigation
   ═══════════════════════════════════════════════════════════════════════════ */

interface PostCarouselPreviewProps {
  slides: PostSlide[];
  size?: PreviewSize;
  className?: string;
}

export function PostCarouselPreview({
  slides,
  size = "medium",
  className = "",
}: PostCarouselPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const px = SIZE_MAP[size];

  const scrollToIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(index, slides.length - 1));
    setActiveIndex(clamped);
    if (scrollRef.current) {
      const child = scrollRef.current.children[clamped] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  // Sync active index on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const cardWidth = px + 12; // card width + gap
      const idx = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.max(0, Math.min(idx, slides.length - 1)));
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [px, slides.length]);

  if (!slides.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Slides strip */}
      <div className="relative group">
        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={activeIndex === slides.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {slides.map((slide) => (
            <div key={slide.slideNumber} className="snap-center shrink-0">
              <PostPreview slide={slide} size={size} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation dots */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`rounded-full transition-all duration-200 ${
                i === activeIndex
                  ? "w-6 h-2 bg-accent"
                  : "w-2 h-2 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
