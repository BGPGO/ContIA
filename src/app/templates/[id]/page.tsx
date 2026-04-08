"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Type,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface TemplateTextLayer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: number;
  alignment?: "left" | "center" | "right";
  tracking?: number;
  numLines?: number;
  fauxBold?: boolean;
  fauxItalic?: boolean;
  slide?: number;
  slideX?: number;
}

interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  format: "feed" | "story" | "carousel";
  slides: number;
  slideWidth: number;
  slideHeight: number;
  thumbnail: string;
  background: string;
  fullComposite: string;
  fonts: string[];
  colors: string[];
  textLayers: TemplateTextLayer[];
  slideAssets?: {
    composites: string[];
    backgrounds: string[];
  };
}

// ── Font mapping ───────────────────────────────────────────────

const FONT_MAP: Record<string, { css: string; weight: number }> = {
  "Formula1-Display-Bold": {
    css: "'Formula1 Display', 'Oswald', sans-serif",
    weight: 700,
  },
  "Formula1-Display-Regular": {
    css: "'Formula1 Display', 'Oswald', sans-serif",
    weight: 400,
  },
  "Poppins-SemiBold": { css: "'Poppins', sans-serif", weight: 600 },
  "Poppins-ExtraLight": { css: "'Poppins', sans-serif", weight: 200 },
  "AlmarenaNeue-Regular": {
    css: "'Genius Techno', 'Poppins', sans-serif",
    weight: 400,
  },
};

// ── Canvas text drawing ────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  // If text already has explicit line breaks, split on those
  const explicitLines = text.split(/\r|\n/);
  const allLines: string[] = [];

  for (const eLine of explicitLines) {
    // Check if this line fits
    if (ctx.measureText(eLine).width <= maxWidth) {
      allLines.push(eLine);
      continue;
    }
    // Word wrap
    const words = eLine.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) allLines.push(current);
        current = word;
      }
    }
    if (current) allLines.push(current);
  }
  return allLines;
}

// Auto-fit: find the font size that makes wrapped text fit the layer box
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontStr: (size: number) => string
): { fontSize: number; lines: string[] } {
  let lo = 4;
  let hi = maxHeight;
  let bestSize = lo;
  let bestLines: string[] = [text];

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    ctx.font = fontStr(mid);
    const lines = wrapText(ctx, text, maxWidth, mid);
    const totalH = lines.length * mid * 1.15;

    if (totalH <= maxHeight) {
      bestSize = mid;
      bestLines = lines;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { fontSize: bestSize, lines: bestLines };
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TemplateTextLayer,
  editedText: string
) {
  const font = FONT_MAP[layer.fontFamily || ""] || {
    css: "'Poppins', sans-serif",
    weight: 400,
  };
  const x = layer.slide !== undefined ? layer.slideX || 0 : layer.x;
  const y = layer.y;
  const layerWidth = layer.width;
  const layerHeight = layer.height;
  const alignment = layer.alignment || "left";
  const fontStyle = layer.fauxItalic ? "italic " : "";

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = layer.fontColor || "#ffffff";
  ctx.textBaseline = "top";

  // Auto-fit font size to bounding box
  const makeFontStr = (size: number) =>
    `${fontStyle}${font.weight} ${size}px ${font.css}`;

  const { fontSize, lines } = fitFontSize(
    ctx,
    editedText,
    layerWidth,
    layerHeight,
    makeFontStr
  );

  ctx.font = makeFontStr(fontSize);
  const lineH = fontSize * 1.15;

  // Tracking (letter-spacing)
  const trackingPx = ((layer.tracking || 0) / 1000) * fontSize;

  const drawLine = (line: string, lx: number, ly: number) => {
    if (Math.abs(trackingPx) > 0.5) {
      let cx = lx;
      for (const ch of line) {
        ctx.fillText(ch, cx, ly);
        cx += ctx.measureText(ch).width + trackingPx;
      }
    } else {
      ctx.fillText(line, lx, ly);
    }
  };

  lines.forEach((line, i) => {
    let lx = x;
    if (alignment === "center") {
      const w = ctx.measureText(line).width;
      lx = x + (layerWidth - w) / 2;
    } else if (alignment === "right") {
      const w = ctx.measureText(line).width;
      lx = x + layerWidth - w;
    }
    drawLine(line, lx, y + i * lineH);
  });

  ctx.restore();
}

// ── Format labels ──────────────────────────────────────────────

const formatLabel: Record<Template["format"], string> = {
  carousel: "Carrossel",
  story: "Story",
  feed: "Feed",
};

// ── Page component ─────────────────────────────────────────────

export default function TemplateEditorPage() {
  const params = useParams();
  const id = params.id as string;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

  // Load Google Fonts + wait for custom fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,200;0,300;0,400;0,600;0,700;1,200;1,300;1,400&family=Oswald:wght@400;500;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // Wait for all fonts (including @font-face from globals.css) to load
    document.fonts.ready.then(() => {
      setFontsReady(true);
    });
  }, []);

  // Fetch template data
  useEffect(() => {
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/psd-templates/${id}`);
        if (!res.ok) throw new Error("Erro ao carregar template");
        const data: Template = await res.json();
        setTemplate(data);

        const initialTexts: Record<string, string> = {};
        data.textLayers.forEach((layer) => {
          initialTexts[layer.id] = layer.text;
        });
        setTexts(initialTexts);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [id]);

  // Determine the background image URL for the current view
  const getBackgroundUrl = useCallback((): string | null => {
    if (!template) return null;
    if (template.format === "carousel" && template.slideAssets?.backgrounds) {
      return template.slideAssets.backgrounds[currentSlide] || null;
    }
    return template.background;
  }, [template, currentSlide]);

  // Get canvas dimensions
  const getCanvasDimensions = useCallback((): {
    width: number;
    height: number;
  } => {
    if (!template) return { width: 1080, height: 1080 };
    if (template.format === "carousel") {
      return {
        width: template.slideWidth || 1080,
        height: template.slideHeight || 1350,
      };
    }
    return { width: template.width, height: template.height };
  }, [template]);

  // Get layers for the current view
  const getCurrentLayers = useCallback((): TemplateTextLayer[] => {
    if (!template) return [];
    if (template.format === "carousel") {
      return template.textLayers.filter(
        (layer) => layer.slide === currentSlide
      );
    }
    return template.textLayers;
  }, [template, currentSlide]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;

    const { width, height } = getCanvasDimensions();
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw background image if loaded
    if (bgImageRef.current && bgImageRef.current.complete) {
      ctx.drawImage(bgImageRef.current, 0, 0, width, height);
    } else {
      // Dark fallback
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, width, height);
    }

    // Draw text layers
    const layers = getCurrentLayers();
    layers.forEach((layer) => {
      const editedText = texts[layer.id] ?? layer.text;
      drawTextLayer(ctx, layer, editedText);
    });
  }, [template, texts, fontsReady, getCanvasDimensions, getCurrentLayers]);

  // Load background image and redraw
  useEffect(() => {
    const url = getBackgroundUrl();
    if (!url) {
      bgImageRef.current = null;
      drawCanvas();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImageRef.current = img;
      drawCanvas();
    };
    img.onerror = () => {
      bgImageRef.current = null;
      drawCanvas();
    };
    img.src = url;
  }, [getBackgroundUrl, drawCanvas]);

  // Redraw when texts change or fonts load
  useEffect(() => {
    drawCanvas();
  }, [texts, fontsReady, drawCanvas]);

  // Text change handler
  function handleTextChange(layerId: string, value: string) {
    setTexts((prev) => ({ ...prev, [layerId]: value }));
  }

  // Download current canvas as PNG
  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;

    const link = document.createElement("a");
    const slideSuffix =
      template.format === "carousel" ? `-slide${currentSlide + 1}` : "";
    link.download = `${template.name}${slideSuffix}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
        <span className="ml-3 text-text-secondary">
          Carregando template...
        </span>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────

  if (error || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center max-w-md">
          <p className="text-danger mb-4">{error || "Template nao encontrado"}</p>
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-light transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para templates
          </Link>
        </div>
      </div>
    );
  }

  // ── Layers for current slide ─────────────────────────────────

  const visibleLayers = getCurrentLayers();
  const isCarousel = template.format === "carousel";

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/templates"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para templates
      </Link>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left panel: Canvas preview ── */}
        <div className="lg:w-[60%] flex flex-col items-center">
          {/* Canvas container */}
          <div
            className={cn(
              "relative w-full rounded-xl overflow-hidden border border-border",
              "bg-bg-primary flex items-center justify-center"
            )}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: "75vh" }}
            />
          </div>

          {/* Carousel navigation */}
          {isCarousel && (
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={() =>
                  setCurrentSlide((prev) => Math.max(0, prev - 1))
                }
                disabled={currentSlide === 0}
                className={cn(
                  "p-2 rounded-lg border border-border",
                  "hover:bg-bg-elevated hover:border-accent/40 transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <ChevronLeft className="w-5 h-5 text-text-primary" />
              </button>

              <span className="text-sm text-text-secondary font-medium">
                Slide {currentSlide + 1} de {template.slides}
              </span>

              <button
                onClick={() =>
                  setCurrentSlide((prev) =>
                    Math.min(template.slides - 1, prev + 1)
                  )
                }
                disabled={currentSlide === template.slides - 1}
                className={cn(
                  "p-2 rounded-lg border border-border",
                  "hover:bg-bg-elevated hover:border-accent/40 transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <ChevronRight className="w-5 h-5 text-text-primary" />
              </button>
            </div>
          )}
        </div>

        {/* ── Right panel: Editor form ── */}
        <div className="lg:w-[40%]">
          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            {/* Template info header */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-text-primary mb-1">
                {template.name}
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5",
                    "rounded-full text-xs font-medium",
                    "bg-accent/20 text-accent"
                  )}
                >
                  {formatLabel[template.format]}
                  {isCarousel && ` - ${template.slides} slides`}
                </span>
                <span className="text-xs text-text-muted">
                  {template.width}x{template.height}
                </span>
              </div>
            </div>

            {/* Slide selector tabs (carousel only) */}
            {isCarousel && (
              <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
                {Array.from({ length: template.slides }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                      currentSlide === i
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-bg-input text-text-secondary border border-border hover:border-border-light"
                    )}
                  >
                    Slide {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Text layer editors */}
            <div className="space-y-4">
              {visibleLayers.length === 0 && (
                <p className="text-sm text-text-muted py-4 text-center">
                  Nenhuma camada de texto neste slide.
                </p>
              )}

              {visibleLayers.map((layer) => (
                <div key={layer.id}>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-text-primary mb-1.5">
                    <Type className="w-3.5 h-3.5 text-accent" />
                    {layer.name}
                  </label>
                  <textarea
                    value={texts[layer.id] ?? layer.text}
                    onChange={(e) =>
                      handleTextChange(layer.id, e.target.value)
                    }
                    rows={Math.max(
                      2,
                      (texts[layer.id] ?? layer.text).split(/\r|\n/).length
                    )}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm",
                      "bg-bg-input border border-border",
                      "text-text-primary placeholder-text-muted",
                      "focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30",
                      "resize-y transition-colors"
                    )}
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    {layer.fontFamily || "Poppins"} &middot;{" "}
                    {Math.round(layer.fontSize || 24)}px
                    {layer.alignment && layer.alignment !== "left" && ` · ${layer.alignment}`}
                    {layer.fontColor && (
                      <>
                        {" "}
                        &middot;{" "}
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full align-middle"
                          style={{ backgroundColor: layer.fontColor }}
                        />
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleDownload}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "px-4 py-2.5 rounded-lg text-sm font-medium",
                  "text-white transition-colors",
                  "bg-[#295d6f] hover:bg-[#347a8f]"
                )}
              >
                <Download className="w-4 h-4" />
                Baixar PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
