"use client";

import { forwardRef, type ReactNode } from "react";
import type { PostDesignData } from "./PostCanvas";
import type { TemplateStyleConfig } from "@/types/custom-template";

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

/** Renders headline text with specific words highlighted in accent color */
function renderHighlightedText(text: string, words: string[], color: string): ReactNode {
  if (!words.length) return text;
  // Build regex that matches any of the highlight words (case-insensitive)
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const isHighlight = words.some((w) => w.toLowerCase() === part.toLowerCase());
    return isHighlight ? (
      <span key={i} style={{ color }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const ASPECT_SIZES: Record<string, { w: number; h: number }> = {
  "1:1": { w: 400, h: 400 },
  "4:5": { w: 400, h: 500 },
  "9:16": { w: 400, h: 711 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════════ */

interface CustomCanvasProps {
  data: PostDesignData;
  style: TemplateStyleConfig;
  aspectRatio?: "1:1" | "4:5" | "9:16";
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CustomCanvas — config-driven flexible renderer
   ═══════════════════════════════════════════════════════════════════════════ */

const CustomCanvas = forwardRef<HTMLDivElement, CustomCanvasProps>(
  ({ data, style: s, aspectRatio = "4:5", className = "" }, ref) => {
    const size = ASPECT_SIZES[aspectRatio] ?? ASPECT_SIZES["4:5"];
    const accent = s.decorations.accentBarColor;

    // Background
    const bgStyle = (): React.CSSProperties => {
      if (
        s.background.type === "gradient" &&
        s.background.gradientFrom &&
        s.background.gradientTo
      ) {
        return {
          background: `linear-gradient(${s.background.gradientAngle || 135}deg, ${s.background.gradientFrom}, ${s.background.gradientTo})`,
        };
      }
      if (s.background.type === "image" && s.background.imageUrl) {
        return {
          backgroundImage: `url(${s.background.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      }
      return { background: s.background.color };
    };

    // Text vertical alignment
    const verticalClass =
      s.text.verticalPosition === "top"
        ? "justify-start pt-20"
        : s.text.verticalPosition === "bottom"
          ? "justify-end pb-20"
          : "justify-center";

    // Text alignment
    const alignClass =
      s.text.headlineAlign === "center"
        ? "text-center items-center"
        : s.text.headlineAlign === "right"
          ? "text-right items-end"
          : "text-left items-start";

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden ${className}`}
        style={{
          width: size.w,
          height: size.h,
          fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          ...bgStyle(),
        }}
      >
        {/* Dark overlay */}
        {s.background.overlayOpacity != null &&
          s.background.overlayOpacity > 0 && (
            <div
              className="absolute inset-0"
              style={{
                background: `rgba(0,0,0,${s.background.overlayOpacity})`,
              }}
            />
          )}

        {/* Noise texture */}
        {s.decorations.noiseTexture && (
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: "128px 128px",
            }}
          />
        )}

        {/* Accent bar */}
        {s.decorations.accentBar !== "none" && (
          <>
            {s.decorations.accentBar === "left" && (
              <div
                className="absolute left-0 top-0 bottom-0"
                style={{ width: 5, background: accent }}
              />
            )}
            {s.decorations.accentBar === "top" && (
              <div
                className="absolute top-0 left-0 right-0"
                style={{ height: 4, background: accent }}
              />
            )}
            {s.decorations.accentBar === "bottom" && (
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{ height: 4, background: accent }}
              />
            )}
          </>
        )}

        {/* Corner accents */}
        {s.decorations.cornerAccents && (
          <>
            <svg
              className="absolute top-0 left-0"
              width="60"
              height="60"
              style={{ opacity: 0.3 }}
            >
              <line
                x1="0"
                y1="20"
                x2="20"
                y2="0"
                stroke={accent}
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="35"
                x2="35"
                y2="0"
                stroke={accent}
                strokeWidth="1"
              />
            </svg>
            <svg
              className="absolute bottom-0 right-0"
              width="60"
              height="60"
              style={{ opacity: 0.3 }}
            >
              <line
                x1="60"
                y1="40"
                x2="40"
                y2="60"
                stroke={accent}
                strokeWidth="2"
              />
              <line
                x1="60"
                y1="25"
                x2="25"
                y2="60"
                stroke={accent}
                strokeWidth="1"
              />
            </svg>
          </>
        )}

        {/* Diagonal stripe */}
        {s.decorations.diagonalStripe && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 400 500"
            preserveAspectRatio="none"
            style={{ opacity: 0.12 }}
          >
            <defs>
              <linearGradient
                id="customDiag"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={s.decorations.diagonalColor || accent}
                  stopOpacity="0.8"
                />
                <stop
                  offset="100%"
                  stopColor={s.decorations.diagonalColor || accent}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <polygon
              points="250,0 400,0 400,280 150,500 100,500 100,400"
              fill="url(#customDiag)"
            />
          </svg>
        )}

        {/* Dot grid */}
        {s.decorations.dotGrid && (
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ opacity: 0.04 }}
          >
            <defs>
              <pattern
                id="customDots"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill={accent} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#customDots)" />
          </svg>
        )}

        {/* Geometric frame */}
        {s.decorations.geometricFrame && (
          <div
            className="absolute"
            style={{
              top: 24,
              left: 24,
              right: 24,
              bottom: 24,
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 2,
            }}
          />
        )}

        {/* Floating circles */}
        {s.decorations.floatingCircles && (
          <>
            <div
              className="absolute rounded-full"
              style={{
                left: "75%",
                top: "15%",
                width: 80,
                height: 80,
                border: "2px solid rgba(255,255,255,0.06)",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: "70%",
                top: "20%",
                width: 40,
                height: 40,
                border: "2px solid rgba(255,255,255,0.08)",
              }}
            />
          </>
        )}

        {/* Radial glow */}
        {s.decorations.radialGlow && (
          <div
            className="absolute"
            style={{
              top: "40%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accent}15, transparent 70%)`,
            }}
          />
        )}

        {/* Quote marks */}
        {s.decorations.quoteMarks && (
          <>
            <span
              className="absolute select-none font-serif"
              style={{
                top: "8%",
                left: "8%",
                fontSize: 140,
                color: `${accent}10`,
                lineHeight: 1,
              }}
            >
              &ldquo;
            </span>
            <span
              className="absolute select-none font-serif"
              style={{
                bottom: "10%",
                right: "8%",
                fontSize: 100,
                color: `${accent}08`,
                lineHeight: 1,
              }}
            >
              &rdquo;
            </span>
          </>
        )}

        {/* Category tag */}
        {s.category.show && data.accentText && (
          <div
            className={`relative z-10 px-8 pt-7 flex ${
              s.category.position === "top-right"
                ? "justify-end"
                : s.category.position === "top-center"
                  ? "justify-center"
                  : "justify-start"
            }`}
          >
            {s.category.style === "pill-badge" ? (
              <span
                className="inline-block rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ background: `${accent}20`, color: accent }}
              >
                {data.accentText}
              </span>
            ) : (
              <span
                className="font-semibold uppercase tracking-[0.18em]"
                style={{ fontSize: 8, color: s.category.color }}
              >
                {data.accentText}
              </span>
            )}
          </div>
        )}

        {/* Slide indicator — large background number */}
        {s.slideIndicator.show && data.slideNumber != null && (
          <>
            {s.slideIndicator.style === "large-bg-number" && (
              <span
                className="absolute select-none font-extrabold"
                style={{
                  right: -10,
                  bottom: -20,
                  fontSize: 220,
                  lineHeight: 1,
                  color: "transparent",
                  WebkitTextStroke: "2px rgba(255,255,255,0.04)",
                }}
              >
                {data.slideNumber}
              </span>
            )}
            {s.slideIndicator.style === "outlined-number" && (
              <span
                className="absolute select-none font-extrabold"
                style={{
                  left: 20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 180,
                  lineHeight: 1,
                  color: "transparent",
                  WebkitTextStroke: "2px rgba(255,255,255,0.04)",
                }}
              >
                {data.slideNumber}
              </span>
            )}
          </>
        )}

        {/* Background decorative text */}
        {s.backgroundText?.content && (
          <span
            className="absolute select-none font-extrabold"
            style={{
              fontSize: s.backgroundText.size || 200,
              lineHeight: 1,
              opacity: s.backgroundText.opacity || 0.05,
              color: s.backgroundText.style === "outlined" ? "transparent" : (s.backgroundText.color || accent),
              WebkitTextStroke: s.backgroundText.style === "outlined" ? `2px ${s.backgroundText.color || accent}` : undefined,
              transform: s.backgroundText.rotation ? `rotate(${s.backgroundText.rotation}deg)` : undefined,
              ...(s.backgroundText.position === "center" ? { top: "50%", left: "50%", transform: `translate(-50%,-50%)${s.backgroundText.rotation ? ` rotate(${s.backgroundText.rotation}deg)` : ""}` } :
                 s.backgroundText.position === "bottom-right" ? { bottom: -20, right: -10 } :
                 s.backgroundText.position === "top-left" ? { top: -15, left: -5 } :
                 s.backgroundText.position === "top-right" ? { top: -15, right: -10 } :
                 { bottom: -20, left: -5 }),
            }}
          >
            {s.backgroundText.content}
          </span>
        )}

        {/* Main content */}
        <div
          className={`relative z-10 flex flex-1 flex-col ${verticalClass} ${alignClass} h-full px-8 py-10`}
        >
          {/* Chevron */}
          {s.decorations.chevronBefore && (
            <span
              className="mb-3 font-bold"
              style={{
                fontSize: 14,
                color: `${accent}80`,
                letterSpacing: "0.15em",
              }}
            >
              &raquo;
            </span>
          )}

          {/* Headline — with optional word highlighting */}
          <h1
            className="font-bold"
            style={{
              fontSize: s.text.headlineSize,
              fontWeight: s.text.headlineWeight,
              color: s.text.headlineColor,
              lineHeight: 1.3,
              letterSpacing: `${s.text.letterSpacing || 0}em`,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical" as const,
            }}
          >
            {s.text.highlightWords && s.text.highlightWords.length > 0
              ? renderHighlightedText(data.headline, s.text.highlightWords, s.text.highlightColor || accent)
              : data.headline}
          </h1>

          {/* Separator */}
          {s.separator?.show && s.separator.style !== "none" && (
            <div className="my-4 flex items-center gap-1.5" style={{ justifyContent: s.text.headlineAlign === "center" ? "center" : s.text.headlineAlign === "right" ? "flex-end" : "flex-start" }}>
              {s.separator.style === "line" && (
                <div style={{ width: s.separator.width || 40, height: 2, borderRadius: 1, background: s.separator.color || accent }} />
              )}
              {s.separator.style === "dots" && (
                <>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: s.separator.color || accent, opacity: 0.5 }} />
                  <div style={{ width: s.separator.width || 30, height: 1.5, borderRadius: 1, background: s.separator.color || accent }} />
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: s.separator.color || accent, opacity: 0.5 }} />
                </>
              )}
              {s.separator.style === "accent-line" && (
                <div style={{ width: s.separator.width || 50, height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${s.separator.color || accent}, transparent)` }} />
              )}
            </div>
          )}

          {/* Subheadline */}
          {data.subheadline && (
            <p
              className={`${s.separator?.show ? "" : "mt-4"} font-medium`}
              style={{
                fontSize: s.text.subheadlineSize,
                color: s.text.subheadlineColor,
                lineHeight: 1.6,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
              }}
            >
              {data.subheadline}
            </p>
          )}
        </div>

        {/* Slide badge indicator (top bar) */}
        {s.slideIndicator.show &&
          s.slideIndicator.style === "badge" &&
          data.slideNumber != null && (
            <div className="absolute top-4 right-5 z-10">
              <span
                className="rounded-full px-3 py-1 text-[10px] font-bold"
                style={{ background: `${accent}20`, color: accent }}
              >
                {String(data.slideNumber).padStart(2, "0")}
                {data.totalSlides
                  ? `/${String(data.totalSlides).padStart(2, "0")}`
                  : ""}
              </span>
            </div>
          )}

        {/* Brand */}
        {s.brand.show && data.brandName && (
          <div
            className={`absolute z-10 px-6 pb-5 flex items-center gap-1.5 ${
              s.brand.position === "bottom-left"
                ? "bottom-0 left-0"
                : s.brand.position === "bottom-center"
                  ? "bottom-0 left-0 right-0 justify-center"
                  : "bottom-0 right-0"
            }`}
            style={{ opacity: s.brand.opacity }}
          >
            {s.brand.showIcon && (
              <div
                className="flex items-center justify-center rounded"
                style={{
                  width: 14,
                  height: 14,
                  background: `${s.brand.color}30`,
                  border: `1px solid ${s.brand.color}20`,
                }}
              >
                <span
                  style={{
                    fontSize: 7,
                    color: `${s.brand.color}90`,
                    fontWeight: 800,
                  }}
                >
                  {data.brandName.charAt(0)}
                </span>
              </div>
            )}
            <span
              className="font-bold lowercase tracking-[0.05em]"
              style={{ fontSize: 10, color: s.brand.color }}
            >
              {data.brandName}
            </span>
          </div>
        )}
      </div>
    );
  }
);

CustomCanvas.displayName = "CustomCanvas";
export { CustomCanvas };
export default CustomCanvas;
