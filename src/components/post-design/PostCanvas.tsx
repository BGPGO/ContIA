"use client";

import React, { forwardRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type PostDesignTemplate =
  | "bold-statement"
  | "gradient-wave"
  | "minimal-clean"
  | "quote-card"
  | "tip-numbered"
  | "stats-highlight"
  | "split-content"
  | "carousel-slide"
  | "editorial"
  | "tweet-quote"
  | "vitor-thread"
  | "vitor-quote";

export interface PostDesignData {
  headline: string;
  subheadline?: string;
  body?: string;
  accentText?: string;
  cta?: string;
  authorName?: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  embeddedImageUrl?: string;
  slideNumber?: number;
  totalSlides?: number;
  brandName?: string;
  brandColor?: string;
  hashtags?: string[];
  boldWords?: string[];
  highlightWords?: string[];
  highlightColor?: string;
}

export interface PostCanvasProps {
  data: PostDesignData;
  template: PostDesignTemplate;
  aspectRatio?: "1:1" | "4:5" | "9:16";
  brandColor?: string;
  accentColor?: string;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const ASPECT_SIZES: Record<string, { w: number; h: number }> = {
  "1:1": { w: 400, h: 400 },
  "4:5": { w: 400, h: 500 },
  "9:16": { w: 400, h: 711 },
};

const DEFAULT_ACCENT = "#4ecdc4";
const DEFAULT_BRAND = "#6c5ce7";
const DARK = "#0c0f24";
const DARKER = "#080b1a";

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const clamp = (lines: number): React.CSSProperties => ({
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical" as const,
});

/** Renders text with bold words and color-highlighted words */
function richText(
  text: string,
  data: PostDesignData,
  defaultColor: string,
): React.ReactNode {
  const bold = data.boldWords || [];
  const highlight = data.highlightWords || [];
  const highlightColor = data.highlightColor || "#4ecdc4";

  if (!bold.length && !highlight.length) return text;

  // Build a combined regex for all special words
  const allWords = [...new Set([...bold, ...highlight])];
  if (!allWords.length) return text;

  const pattern = new RegExp(
    `(${allWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isBold = bold.some((w) => w.toLowerCase() === part.toLowerCase());
    const isHighlight = highlight.some((w) => w.toLowerCase() === part.toLowerCase());

    const style: React.CSSProperties = {};
    if (isBold) style.fontWeight = 800;
    if (isHighlight) style.color = highlightColor;

    if (isBold || isHighlight) {
      return <span key={i} style={style}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

/* ── Shared decorative SVG elements ──────────────────────────────────── */

/** Corner accent lines — geometric detail in corners */
function CornerAccents({ color, opacity = 0.35 }: { color: string; opacity?: number }) {
  return (
    <>
      {/* Top-left */}
      <svg className="absolute top-0 left-0" width="60" height="60" style={{ opacity }}>
        <line x1="0" y1="20" x2="20" y2="0" stroke={color} strokeWidth="2" />
        <line x1="0" y1="35" x2="35" y2="0" stroke={color} strokeWidth="1" />
      </svg>
      {/* Bottom-right */}
      <svg className="absolute bottom-0 right-0" width="60" height="60" style={{ opacity }}>
        <line x1="60" y1="40" x2="40" y2="60" stroke={color} strokeWidth="2" />
        <line x1="60" y1="25" x2="25" y2="60" stroke={color} strokeWidth="1" />
      </svg>
    </>
  );
}

/** Floating decorative circle */
function FloatingCircle({ x, y, size, color, opacity = 0.12 }: { x: string; y: string; size: number; color: string; opacity?: number }) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: x, top: y,
        width: size, height: size,
        border: `2px solid ${rgba(color, opacity)}`,
      }}
    />
  );
}

/** Diagonal stripe decoration — inspired by the carousel reference */
function DiagonalStripe({ color, opacity = 0.15 }: { color: string; opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="none" style={{ opacity }}>
      <defs>
        <linearGradient id="diagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points="250,0 400,0 400,280 150,500 100,500 100,400" fill={`url(#diagGrad)`} />
    </svg>
  );
}

/** Dot grid pattern for texture */
function DotGrid({ color, opacity = 0.06 }: { color: string; opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full" style={{ opacity }}>
      <defs>
        <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

/** Brand watermark — tiny, bottom-right */
function Watermark({ name, color }: { name?: string; color: string }) {
  if (!name) return null;
  return (
    <div
      className="absolute bottom-3 right-4 font-bold uppercase tracking-[0.2em]"
      style={{ color: rgba(color, 0.15), fontSize: 8 }}
    >
      {name}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Template Renderers
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. Bold Statement ──────────────────────────────────────────────────
   Dark bg + diagonal accent stripe + large headline + corner accents
   ──────────────────────────────────────────────────────────────────────── */

function BoldStatement({ data, accent }: { data: PostDesignData; accent: string }) {
  return (
    <div className="relative flex h-full w-full overflow-hidden" style={{ background: DARK }}>
      {/* Diagonal warm stripe */}
      <DiagonalStripe color={accent} opacity={0.12} />

      {/* Accent bar left */}
      <div className="shrink-0" style={{ width: 5, background: accent }} />

      {/* Corner geometric accents */}
      <CornerAccents color={accent} opacity={0.3} />

      {/* Floating circles */}
      <FloatingCircle x="75%" y="15%" size={80} color={accent} opacity={0.08} />
      <FloatingCircle x="70%" y="20%" size={40} color={accent} opacity={0.12} />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-14">
        {data.accentText && (
          <span
            className="mb-4 inline-block self-start rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ background: rgba(accent, 0.15), color: accent }}
          >
            {data.accentText}
          </span>
        )}

        <h1
          className="font-extrabold tracking-tight"
          style={{ fontSize: 32, color: "#fff", lineHeight: 1.1, ...clamp(3) }}
        >
          {richText(data.headline, data, "#fff")}
        </h1>

        {data.subheadline && (
          <p className="mt-4 font-medium" style={{ fontSize: 14, color: rgba("#fff", 0.5), lineHeight: 1.5, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}
      </div>

      <Watermark name={data.brandName} color={accent} />
    </div>
  );
}

/* ── 2. Gradient Wave ───────────────────────────────────────────────────
   Multi-layer gradient + glass circles + geometric lines
   ──────────────────────────────────────────────────────────────────────── */

function GradientWave({ data, accent, brand }: { data: PostDesignData; accent: string; brand: string }) {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center"
      style={{ background: `linear-gradient(135deg, ${brand} 0%, ${DARK} 50%, ${accent} 100%)` }}
    >
      {/* Layered glass circles */}
      <div
        className="absolute rounded-full"
        style={{ top: "-15%", right: "-10%", width: 200, height: 200, background: rgba(accent, 0.08), filter: "blur(2px)" }}
      />
      <div
        className="absolute rounded-full"
        style={{ bottom: "-10%", left: "-8%", width: 160, height: 160, background: rgba(brand, 0.1), filter: "blur(2px)" }}
      />

      {/* Geometric frame lines */}
      <div className="absolute" style={{ top: 30, left: 30, right: 30, bottom: 30, border: `1px solid ${rgba("#fff", 0.08)}`, borderRadius: 4 }} />

      {/* Diagonal accent line */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.1 }}>
        <line x1="0" y1="100%" x2="100%" y2="0" stroke={accent} strokeWidth="1.5" />
      </svg>

      {/* Dot texture */}
      <DotGrid color="#fff" opacity={0.04} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-12 py-14">
        {data.accentText && (
          <span
            className="mb-5 inline-block rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ background: rgba("#fff", 0.12), color: "#fff", backdropFilter: "blur(8px)" }}
          >
            {data.accentText}
          </span>
        )}

        <h1 className="font-extrabold" style={{ fontSize: 30, color: "#fff", lineHeight: 1.12, ...clamp(3) }}>
          {richText(data.headline, data, "#fff")}
        </h1>

        {data.subheadline && (
          <p className="mt-4 font-medium" style={{ fontSize: 14, color: rgba("#fff", 0.65), lineHeight: 1.5, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}
      </div>

      {/* Bottom wave */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 50" preserveAspectRatio="none" style={{ height: 40 }}>
        <path d="M0,25 C80,45 150,5 200,25 C250,45 320,8 400,25 L400,50 L0,50 Z" fill={rgba("#fff", 0.05)} />
      </svg>

      <Watermark name={data.brandName} color="#ffffff" />
    </div>
  );
}

/* ── 3. Minimal Clean ───────────────────────────────────────────────────
   White bg + thin geometric frame + dot texture + elegant spacing
   ──────────────────────────────────────────────────────────────────────── */

function MinimalClean({ data, accent }: { data: PostDesignData; accent: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-white text-center">
      {/* Subtle dot grid */}
      <DotGrid color="#000" opacity={0.03} />

      {/* Thin geometric frame */}
      <div className="absolute" style={{ top: 24, left: 24, right: 24, bottom: 24, border: `1px solid ${rgba(accent, 0.15)}`, borderRadius: 2 }} />

      {/* Corner accent dots */}
      <div className="absolute rounded-full" style={{ top: 21, left: 21, width: 7, height: 7, background: accent }} />
      <div className="absolute rounded-full" style={{ bottom: 21, right: 21, width: 7, height: 7, background: accent }} />

      {/* Content */}
      <div className="relative z-10 px-16 py-20">
        {data.accentText && (
          <span className="mb-4 inline-block text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            {data.accentText}
          </span>
        )}

        <h1 className="font-bold" style={{ fontSize: 26, color: "#1a1a2e", lineHeight: 1.25, ...clamp(3) }}>
          {richText(data.headline, data, "#1a1a2e")}
        </h1>

        {/* Accent separator */}
        <div className="mx-auto my-5 flex items-center gap-2">
          <div className="rounded-full" style={{ width: 8, height: 8, border: `2px solid ${rgba(accent, 0.4)}` }} />
          <div className="rounded-full" style={{ width: 30, height: 2, background: accent }} />
          <div className="rounded-full" style={{ width: 8, height: 8, border: `2px solid ${rgba(accent, 0.4)}` }} />
        </div>

        {data.subheadline && (
          <p className="font-medium" style={{ fontSize: 14, color: "#777790", lineHeight: 1.55, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}
      </div>

      <Watermark name={data.brandName} color="#aaaacc" />
    </div>
  );
}

/* ── 4. Quote Card ──────────────────────────────────────────────────────
   Dark bg + geometric quote frame + accent line decorations
   ──────────────────────────────────────────────────────────────────────── */

function QuoteCard({ data, accent }: { data: PostDesignData; accent: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center" style={{ background: DARKER }}>
      {/* Subtle radial glow */}
      <div className="absolute" style={{ top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, borderRadius: "50%", background: rgba(accent, 0.04), filter: "blur(40px)" }} />

      {/* Geometric frame around quote area */}
      <div className="absolute" style={{ top: "15%", left: "12%", right: "12%", bottom: "15%", border: `1px solid ${rgba(accent, 0.1)}` }}>
        {/* Corner brackets */}
        <div className="absolute -top-px -left-px" style={{ width: 20, height: 20, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
        <div className="absolute -top-px -right-px" style={{ width: 20, height: 20, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
        <div className="absolute -bottom-px -left-px" style={{ width: 20, height: 20, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
        <div className="absolute -bottom-px -right-px" style={{ width: 20, height: 20, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
      </div>

      {/* Large decorative quote marks */}
      <span className="absolute select-none font-serif" style={{ top: "8%", left: "8%", fontSize: 140, color: rgba(accent, 0.06), lineHeight: 1 }}>
        &ldquo;
      </span>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-14 py-14">
        <p className="font-semibold italic leading-relaxed" style={{ fontSize: 21, color: "#e8eaff", lineHeight: 1.5, ...clamp(4) }}>
          {richText(data.headline, data, "#e8eaff")}
        </p>

        {(data.authorName || data.subheadline) && (
          <div className="mt-6 flex items-center gap-3">
            <div className="rounded-full" style={{ width: 20, height: 2, background: accent }} />
            <span className="font-bold uppercase tracking-[0.15em]" style={{ color: accent, fontSize: 11 }}>
              {data.authorName || data.subheadline}
            </span>
            <div className="rounded-full" style={{ width: 20, height: 2, background: accent }} />
          </div>
        )}
      </div>

      <Watermark name={data.brandName} color={accent} />
    </div>
  );
}

/* ── 5. Tip Numbered ────────────────────────────────────────────────────
   Diagonal stripe bg + large outlined number + structured layout
   (Inspired by the carousel reference)
   ──────────────────────────────────────────────────────────────────────── */

function TipNumbered({ data, accent }: { data: PostDesignData; accent: string }) {
  const num = data.slideNumber ?? 1;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: DARK }}>
      {/* Diagonal warm stripe — reference style */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tipDiag" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points="200,0 400,0 400,350 100,500 0,500 0,400" fill="url(#tipDiag)" />
      </svg>

      {/* Large outlined decorative number in background */}
      <span
        className="absolute select-none font-extrabold"
        style={{
          right: -10, bottom: -20,
          fontSize: 220, lineHeight: 1,
          color: "transparent",
          WebkitTextStroke: `2px ${rgba(accent, 0.08)}`,
        }}
      >
        {num}
      </span>

      {/* Corner accents */}
      <CornerAccents color={accent} opacity={0.25} />

      {/* Header bar */}
      <div className="relative z-10 flex items-center gap-3 px-7 py-4" style={{ borderBottom: `2px solid ${rgba(accent, 0.2)}` }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg font-extrabold"
          style={{ background: accent, color: DARKER, fontSize: 14 }}
        >
          {num}
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: rgba(accent, 0.7) }}>
          Dica #{pad(num)}
        </span>

        {/* Slide counter */}
        {data.totalSlides && (
          <span className="ml-auto text-[10px] font-bold" style={{ color: rgba("#fff", 0.3) }}>
            {pad(num)}/{pad(data.totalSlides)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-8 py-8">
        <h2 className="font-bold" style={{ fontSize: 24, color: "#fff", lineHeight: 1.2, ...clamp(3) }}>
          {richText(data.headline, data, "#fff")}
        </h2>
        {data.subheadline && (
          <p className="mt-3 font-medium" style={{ fontSize: 14, color: rgba("#fff", 0.45), lineHeight: 1.5, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}
      </div>

      <Watermark name={data.brandName} color={accent} />
    </div>
  );
}

/* ── 6. Stats Highlight ─────────────────────────────────────────────────
   Dark bg + geometric ring around stat + accent line decorations
   ──────────────────────────────────────────────────────────────────────── */

function StatsHighlight({ data, accent }: { data: PostDesignData; accent: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center" style={{ background: DARKER }}>
      {/* Background geometric rings */}
      <div
        className="absolute rounded-full"
        style={{
          width: 250, height: 250,
          border: `1.5px solid ${rgba(accent, 0.08)}`,
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 320, height: 320,
          border: `1px solid ${rgba(accent, 0.04)}`,
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Radial glow behind stat */}
      <div
        className="absolute"
        style={{
          width: 180, height: 180, borderRadius: "50%",
          background: rgba(accent, 0.06), filter: "blur(30px)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -55%)",
        }}
      />

      {/* Corner accents */}
      <CornerAccents color={accent} opacity={0.2} />

      {/* Dot texture */}
      <DotGrid color={accent} opacity={0.03} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-10 py-14">
        {data.accentText && (
          <span className="mb-3 font-bold uppercase tracking-[0.2em]" style={{ color: rgba(accent, 0.5), fontSize: 10 }}>
            {data.accentText}
          </span>
        )}

        <h1
          className="font-extrabold text-center"
          style={{
            fontSize: data.headline.length <= 6 ? 72 : data.headline.length <= 12 ? 54 : data.headline.length <= 20 ? 40 : 30,
            color: accent, lineHeight: 1.05,
            letterSpacing: "-0.04em",
            textShadow: `0 0 60px ${rgba(accent, 0.15)}`,
            maxWidth: "100%",
            wordBreak: "break-word",
            ...clamp(3),
          }}
        >
          {richText(data.headline, data, accent)}
        </h1>

        {data.subheadline && (
          <p className="mt-4 font-bold" style={{ fontSize: 17, color: "#e8eaff", lineHeight: 1.3, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}

        {/* Accent line separator */}
        <div className="my-4 flex items-center gap-1.5">
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: rgba(accent, 0.3) }} />
          <div style={{ width: 40, height: 1.5, borderRadius: 1, background: rgba(accent, 0.25) }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: rgba(accent, 0.3) }} />
        </div>
      </div>

      <Watermark name={data.brandName} color={accent} />
    </div>
  );
}

/* ── 7. Split Content ───────────────────────────────────────────────────
   Diagonal cut split + geometric shapes in accent panel + large number
   ──────────────────────────────────────────────────────────────────────── */

function SplitContent({ data, accent }: { data: PostDesignData; accent: string }) {
  const num = data.slideNumber;

  return (
    <div className="relative flex h-full w-full overflow-hidden" style={{ background: DARK }}>
      {/* Diagonal accent panel — not a straight split */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="none">
        <polygon points="0,0 180,0 120,500 0,500" fill={accent} />
        <polygon points="120,0 180,0 140,500 120,500" fill={rgba(accent, 0.4)} />
      </svg>

      {/* Decorative elements in accent area */}
      <FloatingCircle x="5%" y="20%" size={50} color="#000" opacity={0.1} />
      <FloatingCircle x="2%" y="60%" size={30} color="#000" opacity={0.08} />

      {/* Large number in accent panel */}
      {num != null && (
        <span
          className="absolute select-none font-extrabold"
          style={{
            left: 20, top: "50%", transform: "translateY(-50%)",
            fontSize: 100, lineHeight: 1,
            color: rgba("#000", 0.12),
          }}
        >
          {pad(num)}
        </span>
      )}

      {/* Corner accents on right side */}
      <svg className="absolute top-0 right-0" width="50" height="50" style={{ opacity: 0.3 }}>
        <line x1="50" y1="15" x2="35" y2="0" stroke={accent} strokeWidth="2" />
        <line x1="50" y1="30" x2="20" y2="0" stroke={accent} strokeWidth="1" />
      </svg>

      {/* Content — right side */}
      <div className="relative z-10 ml-auto flex w-[58%] flex-col justify-center px-7 py-12">
        {data.accentText && (
          <span className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
            {data.accentText}
          </span>
        )}

        <h2 className="font-bold" style={{ fontSize: 23, color: "#fff", lineHeight: 1.2, ...clamp(3) }}>
          {richText(data.headline, data, "#fff")}
        </h2>

        {data.subheadline && (
          <p className="mt-3 font-medium" style={{ fontSize: 13, color: rgba("#fff", 0.45), lineHeight: 1.5, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}

        {/* Small accent line */}
        <div className="mt-5" style={{ width: 30, height: 2, borderRadius: 1, background: rgba(accent, 0.4) }} />
      </div>

      <Watermark name={data.brandName} color={accent} />
    </div>
  );
}

/* ── 8. Carousel Slide ──────────────────────────────────────────────────
   Full carousel template — diagonal stripe, large bg number, header bar
   (Directly inspired by the Vecteezy carousel reference)
   ──────────────────────────────────────────────────────────────────────── */

function CarouselSlide({ data, accent }: { data: PostDesignData; accent: string }) {
  const num = data.slideNumber ?? 1;
  const total = data.totalSlides;
  const slideLabel = total ? `${pad(num)}/${pad(total)}` : pad(num);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: DARK }}>
      {/* Diagonal accent stripe — warm, like the reference */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="none">
        <defs>
          <linearGradient id="carDiag" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points="160,0 400,0 400,350 60,500 0,500 0,400" fill="url(#carDiag)" />
        {/* Second thinner stripe */}
        <polygon points="180,0 210,0 100,500 70,500" fill={rgba(accent, 0.06)} />
      </svg>

      {/* Large outlined number in background */}
      <span
        className="absolute select-none font-extrabold"
        style={{
          left: 20, top: "50%", transform: "translateY(-50%)",
          fontSize: 180, lineHeight: 1,
          color: "transparent",
          WebkitTextStroke: `2px ${rgba("#fff", 0.04)}`,
        }}
      >
        {num}
      </span>

      {/* Corner accent lines */}
      <CornerAccents color={accent} opacity={0.2} />

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        {data.brandName && (
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: rgba("#fff", 0.5) }}>
            {data.brandName}
          </span>
        )}
        <span
          className="ml-auto rounded-full px-3 py-1 text-[10px] font-bold"
          style={{ background: rgba(accent, 0.15), color: accent }}
        >
          {slideLabel}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-8 py-6">
        <h2 className="font-bold" style={{ fontSize: 25, color: "#fff", lineHeight: 1.2, ...clamp(3) }}>
          {richText(data.headline, data, "#fff")}
        </h2>
        {data.subheadline && (
          <p className="mt-3 font-medium" style={{ fontSize: 14, color: rgba("#fff", 0.4), lineHeight: 1.5, ...clamp(2) }}>
            {data.subheadline}
          </p>
        )}
      </div>

      {/* Bottom accent stripe + website area */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3" style={{ borderTop: `1px solid ${rgba(accent, 0.12)}` }}>
        {data.brandName && (
          <span className="text-[9px] font-medium tracking-wide" style={{ color: rgba("#fff", 0.25) }}>
            {data.brandName.toLowerCase().replace(/\s+/g, "")}.com
          </span>
        )}
        <div style={{ width: 30, height: 2, borderRadius: 1, background: accent }} />
      </div>
    </div>
  );
}

/* ── 9. Editorial ───────────────────────────────────────────────────────
   BGP-style: dark muted bg, category tag, chevron decoration,
   large headline, small supporting text. Pure copy-driven, zero shapes.
   Inspired by real BGP Instagram posts.
   ──────────────────────────────────────────────────────────────────────── */

function Editorial({ data, accent }: { data: PostDesignData; accent: string }) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 70% 60% at 80% 90%, rgba(255,255,255,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 50% 50% at 10% 10%, rgba(0,0,0,0.15) 0%, transparent 50%),
          linear-gradient(160deg, #151826 0%, #1d2135 45%, #222740 100%)
        `,
      }}
    >
      {/* Very subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Category tag — top-right like the reference */}
      {data.accentText && (
        <div className="relative z-10 px-8 pt-7 flex justify-end">
          <span
            className="font-semibold uppercase tracking-[0.18em]"
            style={{ fontSize: 8, color: rgba("#fff", 0.3) }}
          >
            {data.accentText}
          </span>
        </div>
      )}

      {/* Main content — vertically centered */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-8 py-10">
        {/* Chevron decoration before headline */}
        <span
          className="mb-3 font-bold"
          style={{ fontSize: 14, color: rgba(accent, 0.45), letterSpacing: "0.15em" }}
        >
          &raquo;
        </span>

        {/* Headline — large, white, breathing */}
        <h1
          className="font-bold"
          style={{
            fontSize: 25,
            color: "#eeeef3",
            lineHeight: 1.38,
            letterSpacing: "-0.01em",
            ...clamp(5),
          }}
        >
          {richText(data.headline, data, "#f0f0f5")}
        </h1>

        {/* Supporting text — small, muted, separated */}
        {data.subheadline && (
          <p
            className="mt-6 font-normal"
            style={{
              fontSize: 12,
              color: rgba("#fff", 0.32),
              lineHeight: 1.65,
              ...clamp(3),
            }}
          >
            {data.subheadline}
          </p>
        )}
      </div>

      {/* Brand — bottom-right with logo mark */}
      {data.brandName && (
        <div className="relative z-10 px-8 pb-6 flex justify-end items-center gap-1.5">
          {/* Small logo mark — square with rounded corners */}
          <div
            className="flex items-center justify-center rounded"
            style={{
              width: 14, height: 14,
              background: rgba(accent, 0.2),
              border: `1px solid ${rgba(accent, 0.15)}`,
            }}
          >
            <span style={{ fontSize: 7, color: rgba(accent, 0.6), fontWeight: 800 }}>
              {data.brandName.charAt(0)}
            </span>
          </div>
          <span
            className="font-bold lowercase tracking-[0.05em]"
            style={{ fontSize: 10, color: rgba("#fff", 0.22) }}
          >
            {data.brandName}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── 10. Tweet Quote ─────────────────────────────────────────────────────
   Viral tweet-style quote card — profile photo circle, quote in large
   text, author name + handle below. Popular format on Instagram.
   ──────────────────────────────────────────────────────────────────────── */

function TweetQuote({ data, accent }: { data: PostDesignData; accent: string }) {
  const initial = (data.authorName || data.brandName || "A").charAt(0).toUpperCase();

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-10 py-12"
      style={{
        background: `linear-gradient(180deg, #0f1118 0%, #161923 100%)`,
      }}
    >
      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% 40%, transparent 0%, rgba(0,0,0,0.3) 100%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[320px]">
        {/* Profile photo circle */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            background: `linear-gradient(135deg, ${accent}, ${rgba(accent, 0.6)})`,
            boxShadow: `0 4px 20px ${rgba(accent, 0.2)}`,
          }}
        >
          <span className="font-bold text-white" style={{ fontSize: 22 }}>
            {initial}
          </span>
        </div>

        {/* Author name + handle */}
        <div className="mt-3 flex flex-col items-center">
          <span className="font-bold" style={{ fontSize: 14, color: "#f0f0f5" }}>
            {data.authorName || data.brandName || "Autor"}
          </span>
          {data.accentText && (
            <span className="font-medium" style={{ fontSize: 11, color: rgba("#fff", 0.35) }}>
              @{data.accentText.toLowerCase().replace(/\s+/g, "")}
            </span>
          )}
        </div>

        {/* Thin separator */}
        <div className="my-5 flex items-center gap-2 w-full">
          <div className="flex-1" style={{ height: 1, background: rgba("#fff", 0.06) }} />
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.15 }}>
            <path d="M6.5 2h3L8 5.5 11.5 3 10 6.5 13.5 8 10 9.5 11.5 13 8 10.5 4.5 13 6 9.5 2.5 8 6 6.5 4.5 3z" fill="#fff" />
          </svg>
          <div className="flex-1" style={{ height: 1, background: rgba("#fff", 0.06) }} />
        </div>

        {/* Quote */}
        <div className="text-center">
          {/* Opening quote mark */}
          <span
            className="font-serif"
            style={{ fontSize: 36, color: rgba(accent, 0.3), lineHeight: 0.5, display: "block", marginBottom: 8 }}
          >
            &ldquo;
          </span>

          <p
            className="font-medium"
            style={{
              fontSize: 18,
              color: "#e8eaff",
              lineHeight: 1.55,
              ...clamp(5),
            }}
          >
            {richText(data.headline, data, "#e8eaff")}
          </p>

          {/* Closing quote mark */}
          <span
            className="font-serif"
            style={{ fontSize: 36, color: rgba(accent, 0.3), lineHeight: 0.5, display: "block", marginTop: 12 }}
          >
            &rdquo;
          </span>
        </div>

        {/* Subheadline as context/date */}
        {data.subheadline && (
          <p
            className="mt-4 text-center font-normal"
            style={{ fontSize: 11, color: rgba("#fff", 0.25), lineHeight: 1.5, ...clamp(2) }}
          >
            {data.subheadline}
          </p>
        )}
      </div>

      <Watermark name={data.brandName} color={accent} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Template Router
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 11. Vítor Thread ────────────────────────────────────────────────────
   EXACT replica of 1.png: black bg, profile + name/handle row,
   bold first paragraph, normal body paragraphs, embedded image frame.
   ──────────────────────────────────────────────────────────────────────── */

function VitorThread({ data }: { data: PostDesignData }) {
  const name = data.authorName || "Vítor Bertuzzi";
  const handle = data.authorHandle || "@vitorbertuzzi";
  const initial = name.charAt(0);

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "#000000" }}>
      <div className="flex flex-col px-5 pt-6 pb-5 h-full">

        {/* ── Profile row: photo + name/handle + dots ── */}
        <div className="flex items-start gap-2.5 mb-4">
          {data.authorPhotoUrl ? (
            <img src={data.authorPhotoUrl} alt={name} className="rounded-full object-cover shrink-0" style={{ width: 34, height: 34 }} />
          ) : (
            <div className="rounded-full flex items-center justify-center font-semibold text-white shrink-0" style={{ width: 34, height: 34, background: "#2a2a2a", fontSize: 14 }}>
              {initial}
            </div>
          )}
          <div className="flex flex-col" style={{ marginTop: 1 }}>
            <span className="font-bold" style={{ fontSize: 13.5, color: "#ffffff", lineHeight: 1.15 }}>{name}</span>
            <span style={{ fontSize: 11.5, color: "#71767b", lineHeight: 1.15, marginTop: 1 }}>{handle}</span>
          </div>
          {/* Three dots — right aligned */}
          <div className="ml-auto shrink-0" style={{ marginTop: 2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#71767b">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </div>
        </div>

        {/* ── Text content ── */}
        <div className="flex-1 flex flex-col">
          {/* Bold headline (first paragraph) */}
          <p style={{ fontSize: 15.5, fontWeight: 700, color: "#e7e9ea", lineHeight: 1.45, marginBottom: 14 }}>
            {richText(data.headline, data, "#e7e9ea")}
          </p>

          {/* Normal body paragraphs — each separated */}
          {data.subheadline && (
            <p style={{ fontSize: 14, fontWeight: 400, color: "#d2d4d7", lineHeight: 1.55, marginBottom: 14 }}>
              {richText(data.subheadline, data, "#d2d4d7")}
            </p>
          )}

          {data.body && data.body.split("\n").filter(Boolean).map((paragraph, i) => (
            <p key={i} style={{ fontSize: 14, fontWeight: 400, color: "#d2d4d7", lineHeight: 1.55, marginBottom: 14 }}>
              {richText(paragraph, data, "#d2d4d7")}
            </p>
          ))}
        </div>

        {/* ── Embedded image frame ── */}
        <div
          className="overflow-hidden"
          style={{
            borderRadius: 14,
            aspectRatio: "16/9",
            marginTop: "auto",
          }}
        >
          {data.embeddedImageUrl ? (
            <img src={data.embeddedImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-full h-full" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="vtSky" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2d5a4a" />
                  <stop offset="60%" stopColor="#4a9a7a" />
                  <stop offset="100%" stopColor="#5ab87e" />
                </linearGradient>
              </defs>
              <rect width="400" height="225" fill="url(#vtSky)" />
              {/* Hills */}
              <ellipse cx="200" cy="260" rx="320" ry="100" fill="#4a9a6e" />
              <ellipse cx="80" cy="250" rx="160" ry="80" fill="#5ab87e" />
              <ellipse cx="320" cy="255" rx="140" ry="70" fill="#6ac88e" />
              {/* Light grass */}
              <ellipse cx="150" cy="245" rx="100" ry="50" fill="#7ad49e" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 12. Vítor Quote ────────────────────────────────────────────────────
   EXACT replica of 3.png: light gray bg, white card in lower half,
   profile with orange dots, bold quote, V logo footer.
   ──────────────────────────────────────────────────────────────────────── */

function VitorQuote({ data }: { data: PostDesignData }) {
  const name = data.authorName || "Vítor Bertuzzi";
  const handle = data.authorHandle || "@vitorbertuzzi";
  const initial = name.charAt(0);

  return (
    <div className="flex h-full w-full flex-col items-center" style={{ background: "#efefef" }}>

      {/* ── Top empty space (40% of height) ── */}
      <div style={{ flex: "0 0 38%" }} />

      {/* ── White card — positioned in lower portion ── */}
      <div
        style={{
          width: "calc(100% - 40px)",
          background: "#ffffff",
          borderRadius: 14,
          padding: "22px 22px 30px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        {/* Profile row */}
        <div className="flex items-center gap-2.5" style={{ marginBottom: 20 }}>
          {data.authorPhotoUrl ? (
            <img src={data.authorPhotoUrl} alt={name} className="rounded-full object-cover shrink-0" style={{ width: 38, height: 38 }} />
          ) : (
            <div className="rounded-full flex items-center justify-center font-semibold text-white shrink-0" style={{ width: 38, height: 38, background: "#2a2a2a", fontSize: 15 }}>
              {initial}
            </div>
          )}
          <div className="flex flex-col" style={{ marginTop: 0 }}>
            <span className="font-bold" style={{ fontSize: 14, color: "#0f1419", lineHeight: 1.15 }}>{name}</span>
            <span style={{ fontSize: 12, color: "#536471", lineHeight: 1.15, marginTop: 2 }}>{handle}</span>
          </div>
          {/* Orange/coral dots — exactly like the reference */}
          <div
            className="ml-auto flex items-center justify-center shrink-0"
            style={{
              width: 28, height: 28,
              borderRadius: 8,
              background: "#f4f4f4",
            }}
          >
            <svg width="16" height="4" viewBox="0 0 16 4">
              <circle cx="2" cy="2" r="1.8" fill="#f97316" />
              <circle cx="8" cy="2" r="1.8" fill="#f97316" />
              <circle cx="14" cy="2" r="1.8" fill="#f97316" />
            </svg>
          </div>
        </div>

        {/* Quote text — large, dark, semibold */}
        <p
          style={{
            fontSize: 21,
            fontWeight: 600,
            color: "#0f1419",
            lineHeight: 1.38,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 6,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          {richText(data.headline, data, "#0f1419")}
        </p>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Footer: V logo ── */}
      <div className="flex items-center justify-center" style={{ paddingBottom: 22 }}>
        <img
          src="/assets/vitor-logo.png"
          alt="Vítor Bertuzzi"
          style={{ height: 18, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Template Router
   ═══════════════════════════════════════════════════════════════════════════ */

function renderTemplate(template: PostDesignTemplate, data: PostDesignData, accent: string, brand: string) {
  switch (template) {
    case "bold-statement":    return <BoldStatement data={data} accent={accent} />;
    case "gradient-wave":     return <GradientWave data={data} accent={accent} brand={brand} />;
    case "minimal-clean":     return <MinimalClean data={data} accent={accent} />;
    case "quote-card":        return <QuoteCard data={data} accent={accent} />;
    case "tip-numbered":      return <TipNumbered data={data} accent={accent} />;
    case "stats-highlight":   return <StatsHighlight data={data} accent={accent} />;
    case "split-content":     return <SplitContent data={data} accent={accent} />;
    case "carousel-slide":    return <CarouselSlide data={data} accent={accent} />;
    case "editorial":         return <Editorial data={data} accent={accent} />;
    case "tweet-quote":       return <TweetQuote data={data} accent={accent} />;
    case "vitor-thread":      return <VitorThread data={data} />;
    case "vitor-quote":       return <VitorQuote data={data} />;
    default:                  return <BoldStatement data={data} accent={accent} />;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PostCanvas — Main Component
   ═══════════════════════════════════════════════════════════════════════════ */

const PostCanvas = forwardRef<HTMLDivElement, PostCanvasProps>(
  ({ data, template, aspectRatio = "1:1", brandColor, accentColor, className = "" }, ref) => {
    const size = ASPECT_SIZES[aspectRatio] ?? ASPECT_SIZES["1:1"];
    const accent = accentColor ?? data.brandColor ?? DEFAULT_ACCENT;
    const brand = brandColor ?? data.brandColor ?? DEFAULT_BRAND;

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden ${className}`}
        style={{
          width: size.w,
          height: size.h,
          fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        {renderTemplate(template, data, accent, brand)}
      </div>
    );
  },
);

PostCanvas.displayName = "PostCanvas";

export { PostCanvas };
export default PostCanvas;
