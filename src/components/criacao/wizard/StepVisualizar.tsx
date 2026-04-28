"use client";

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  RefreshCw,
  Loader2,
  Palette,
  Square,
  RectangleVertical,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Layers,
  Pencil,
  Image as ImageIcon,
} from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { Empresa } from "@/types";
import type {
  PostDesignData,
  PostDesignTemplate,
} from "@/components/post-design/PostCanvas";
import { PostCanvas } from "@/components/post-design/PostCanvas";
import { CustomCanvas } from "@/components/post-design/CustomCanvas";
import { TemplateBuilder } from "@/components/post-design/TemplateBuilder";
import { useCustomTemplates } from "@/hooks/useCustomTemplates";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";
import type { CustomTemplate } from "@/types/custom-template";
import type { RichSlide, SlideSection } from "@/types/copy-studio";
import React from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Rich Slide Canvas — renders a RichSlide as styled HTML (dark navy design)
   Exportable via html2canvas. Matches smart-layout.ts design system.
   ═══════════════════════════════════════════════════════════════════════════ */

const RICH_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 400, h: 400 },
  "4:5": { w: 400, h: 500 },
  "9:16": { w: 400, h: 711 },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  cover: "CAPA", content: "CONTEUDO", data: "DADOS",
  timeline: "TIMELINE", quote: "CITACAO", list: "LISTA", cta: "CTA",
};

function RichHeadline({ text, highlights, isCover, isCta }: {
  text: string; highlights?: string[]; isCover?: boolean; isCta?: boolean;
}) {
  const fontSize = isCover
    ? (text.length > 40 ? "text-[28px]" : text.length > 25 ? "text-[32px]" : "text-[38px]")
    : isCta
      ? (text.length > 40 ? "text-[24px]" : "text-[30px]")
      : (text.length > 50 ? "text-[18px]" : text.length > 30 ? "text-[20px]" : "text-[24px]");

  if (!highlights?.length) {
    return <div className={`${fontSize} font-black leading-[1.05] text-[#e0e4f0]`}>{text}</div>;
  }

  const phrase = highlights.join(" ");
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) {
    return <div className={`${fontSize} font-black leading-[1.05] text-[#e0e4f0]`}>{text}</div>;
  }

  const before = text.slice(0, idx);
  const highlighted = text.slice(idx, idx + phrase.length);
  const after = text.slice(idx + phrase.length);

  return (
    <div className={`${fontSize} font-black leading-[1.05]`}>
      {before && <span className="text-[#e0e4f0]">{before}</span>}
      <span className="text-[#3b82f6]">{highlighted}</span>
      {after && <span className="text-[#e0e4f0]">{after}</span>}
    </div>
  );
}

function RichSection({ section }: { section: SlideSection }) {
  switch (section.type) {
    case "paragraph":
      return (
        <p className="text-[11px] leading-[1.5] text-[#e0e4f0]/70">
          {section.content?.map((seg, i) => (
            <span key={i} className={`${seg.highlight ? "text-[#3b82f6] font-semibold" : ""} ${seg.bold ? "font-bold" : ""}`}>
              {seg.text}
            </span>
          ))}
        </p>
      );
    case "stat":
      if (!section.stat) return null;
      return (
        <div className="space-y-0.5">
          <div className="text-[24px] font-extrabold text-[#3b82f6] leading-tight">{section.stat.value}</div>
          <div className="text-[10px] text-[#e0e4f0]/60">{section.stat.label}</div>
          {section.stat.source && <div className="text-[8px] text-[#6b7094]/50">{section.stat.source}</div>}
        </div>
      );
    case "callout":
      if (!section.callout) return null;
      return (
        <div className="bg-[#111528] border border-border rounded-[6px] p-3 border-l-[3px] border-l-[#3b82f6]/60">
          <p className="text-[10px] text-[#e0e4f0]/80 italic leading-relaxed">{section.callout.text}</p>
          {section.callout.attribution && (
            <p className="text-[8px] text-[#6b7094] mt-1">— {section.callout.attribution}</p>
          )}
        </div>
      );
    case "list":
      if (!section.items?.length) return null;
      return (
        <div className="space-y-2">
          {section.items.map((item, j) => (
            <div key={j} className="flex gap-2">
              <span className="text-[10px] font-bold text-[#3b82f6] shrink-0 min-w-[20px]">
                {item.date || "●"}
              </span>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#e0e4f0]">{item.title}</span>
                {item.description && (
                  <p className="text-[9px] text-[#e0e4f0]/50 leading-relaxed">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    case "cta-button":
      return (
        <div className="flex justify-center">
          <div className="border-[1.5px] border-[#3b82f6] rounded-[6px] px-8 py-2 text-center">
            <span className="text-[10px] font-bold text-[#3b82f6] tracking-[0.15em]">
              ▸  {section.buttonText || "SAIBA MAIS"}
            </span>
          </div>
          {section.buttonSubtext && (
            <p className="text-[8px] text-[#6b7094]/50 text-center mt-1">{section.buttonSubtext}</p>
          )}
        </div>
      );
    case "divider":
      return <div className="w-1/3 h-[1px] bg-[#3b82f6]/30" />;
    default:
      return null;
  }
}

const RichSlideCanvas = React.forwardRef<HTMLDivElement, {
  slide: RichSlide;
  totalSlides: number;
  aspectRatio: "1:1" | "4:5" | "9:16";
  brandAccent?: string;
}>(({ slide, totalSlides, aspectRatio, brandAccent }, ref) => {
  const { w, h } = RICH_DIMS[aspectRatio] || RICH_DIMS["4:5"];
  const isCover = slide.contentType === "cover";
  const isCta = slide.contentType === "cta";

  return (
    <div
      ref={ref}
      className="relative overflow-hidden flex flex-col"
      style={{
        width: w, height: h,
        background: "#080c1a",
        padding: isCta ? "0 26px" : "22px 26px 18px",
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Tag */}
      {slide.tag && (
        <div className="mb-2" style={{ letterSpacing: "0.15em" }}>
          <span className="text-[8px] font-semibold text-[#6b7094]">
            {isCover ? slide.tag : `●  ${slide.tag}`}
          </span>
        </div>
      )}

      {/* Headline */}
      <div className={isCta ? "flex-1 flex items-center" : "mb-3"}>
        <RichHeadline
          text={slide.headline}
          highlights={slide.headlineHighlights}
          isCover={isCover}
          isCta={isCta}
        />
      </div>

      {/* Sections */}
      <div className={`flex-1 flex flex-col gap-3 ${isCta ? "" : "overflow-hidden"}`}>
        {slide.sections?.map((sec, i) => {
          if (isCta && sec.type === "cta-button") {
            return (
              <div key={i} className="mt-auto mb-6">
                <RichSection section={sec} />
              </div>
            );
          }
          return <RichSection key={i} section={sec} />;
        })}
      </div>

      {/* Dots at bottom */}
      {totalSlides > 1 && (
        <div className="flex justify-center gap-[5px] mt-auto pt-2">
          {Array.from({ length: totalSlides }, (_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 6, height: 6,
                background: i === slide.slideNumber - 1 ? (brandAccent || "#3b82f6") : "#6b7094",
                opacity: i === slide.slideNumber - 1 ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      )}

      {/* Footnote */}
      {slide.footnote && (
        <div className="text-center mt-1">
          <span className="text-[7px] text-[#6b7094]/40">{slide.footnote}</span>
        </div>
      )}
    </div>
  );
});
RichSlideCanvas.displayName = "RichSlideCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const COLOR_PALETTE = [
  "#4ecdc4", "#6c5ce7", "#e11d48", "#f59e0b",
  "#3b82f6", "#10b981", "#ec4899", "#8b5cf6",
];

const TEMPLATE_NAMES: Record<PostDesignTemplate, string> = {
  "bold-statement": "Impactante",
  "gradient-wave": "Gradiente",
  "minimal-clean": "Minimalista",
  "quote-card": "Citacao",
  "tip-numbered": "Dica",
  "stats-highlight": "Destaque",
  "split-content": "Dividido",
  "carousel-slide": "Carrossel",
  "editorial": "Editorial",
  "tweet-quote": "Tweet",
  "vitor-thread": "Thread Vítor",
  "vitor-quote": "Quote Vítor",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Carousel Slide Type (local)
   ═══════════════════════════════════════════════════════════════════════════ */

interface CarouselSlideLocal {
  headline: string;
  subheadline?: string;
  accentText?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════════ */

interface StepVisualizarProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  empresa: Empresa | null;
  onRegenerate: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function StepVisualizar({ state, setField, empresa, onRegenerate }: StepVisualizarProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const isCarousel = state.format === "carrossel";
  const richSlides = state.result?.richSlides as RichSlide[] | undefined;
  const hasRichSlides = !!(richSlides && richSlides.length > 0);

  /* ── Brand DNA — auto-apply brand colors and style ────────────────── */

  const { dna } = useMarcaDNA(empresa?.id);
  const brandInitializedRef = useRef(false);

  // Auto-apply brand colors from DNA on first render
  if (dna?.dna_sintetizado && !brandInitializedRef.current) {
    brandInitializedRef.current = true;
    const ds = dna.dna_sintetizado;

    // Set brand color from DNA palette
    if (ds.paleta_cores?.length) {
      const primaryColor = ds.paleta_cores[0];
      if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        setField("designBrandColor", primaryColor);
      }
    } else if (empresa?.cor_primaria) {
      setField("designBrandColor", empresa.cor_primaria);
    }

    // Auto-select template based on brand style
    if (ds.estilo_visual) {
      const style = ds.estilo_visual.toLowerCase();
      let bestTemplate: PostDesignTemplate = state.designTemplate;

      if (style.includes("minimalista") || style.includes("clean") || style.includes("limpo")) {
        bestTemplate = "minimal-clean";
      } else if (style.includes("bold") || style.includes("impactante") || style.includes("forte")) {
        bestTemplate = "bold-statement";
      } else if (style.includes("gradiente") || style.includes("moderno") || style.includes("vibrante")) {
        bestTemplate = "gradient-wave";
      } else if (style.includes("editorial") || style.includes("profissional") || style.includes("corporativo")) {
        bestTemplate = "editorial";
      } else if (style.includes("quote") || style.includes("citação") || style.includes("frase")) {
        bestTemplate = "quote-card";
      }

      // If AI suggested a template in the generation, prefer that
      const aiSuggested = state.result?.visualPost?.suggestedTemplate;
      if (aiSuggested && aiSuggested !== "bold-statement") {
        bestTemplate = aiSuggested as PostDesignTemplate;
      }

      setField("designTemplate", bestTemplate);
    }
  }

  /* ── Custom templates state ────────────────────────────────────────── */

  const { templates: customTemplates, saveTemplate: saveCustomTemplate, removeTemplate: removeCustomTemplate } = useCustomTemplates(empresa?.id);
  const [activeTab, setActiveTab] = useState<"padrao" | "meus">("padrao");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null);
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<CustomTemplate | null>(null);

  /* ── Content editing overrides ──────────────────────────────────────── */
  const [editHeadline, setEditHeadline] = useState<string | null>(null);
  const [editSubheadline, setEditSubheadline] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<string | null>(null);
  const [editAuthorName, setEditAuthorName] = useState<string | null>(null);
  const [editAuthorHandle, setEditAuthorHandle] = useState<string | null>(null);
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState<string | null>(null);
  const [embeddedImageUrl, setEmbeddedImageUrl] = useState<string | null>(null);
  const [boldWords, setBoldWords] = useState<string>("");
  const [highlightWords, setHighlightWords] = useState<string>("");
  const [highlightColor, setHighlightColor] = useState<string>("#4ecdc4");

  /* ── Carousel slides state ──────────────────────────────────────────── */

  const [carouselSlides, setCarouselSlides] = useState<CarouselSlideLocal[]>(() => {
    if (state.result?.slides && state.result.slides.length > 0) {
      return state.result.slides.map((s) => ({
        headline: s.titulo,
        subheadline: s.conteudo?.slice(0, 120) || undefined,
        accentText: undefined,
      }));
    }
    // Default: generate from result
    const title = state.result?.visualPost?.headline || state.result?.titulo || "Slide 1";
    return [
      { headline: title, subheadline: state.result?.visualPost?.subheadline },
      { headline: "Ponto principal", subheadline: "Detalhe do segundo slide" },
      { headline: "Conclusao", subheadline: "CTA ou resumo final" },
    ];
  });

  const [activeSlide, setActiveSlide] = useState(0);
  const [activeRichSlide, setActiveRichSlide] = useState(0);
  const richCanvasRef = useRef<HTMLDivElement>(null);

  const addSlide = () => {
    setCarouselSlides((prev) => [
      ...prev,
      { headline: `Slide ${prev.length + 1}`, subheadline: "Novo conteudo" },
    ]);
    setActiveSlide(carouselSlides.length);
  };

  const removeSlide = (idx: number) => {
    if (carouselSlides.length <= 2) return;
    setCarouselSlides((prev) => prev.filter((_, i) => i !== idx));
    if (activeSlide >= carouselSlides.length - 1) setActiveSlide(Math.max(0, carouselSlides.length - 2));
  };

  const updateSlide = (idx: number, field: keyof CarouselSlideLocal, value: string) => {
    setCarouselSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  /* ── Design data ────────────────────────────────────────────────────── */

  const brandColor = state.designBrandColor || empresa?.cor_primaria || "#4ecdc4";

  const singleDesignData: PostDesignData = {
    headline: editHeadline ?? state.result?.visualPost?.headline ?? state.result?.titulo ?? "Seu titulo aqui",
    subheadline: editSubheadline ?? state.result?.visualPost?.subheadline ?? undefined,
    body: editBody ?? undefined,
    accentText: state.result?.visualPost?.accentText ?? undefined,
    cta: state.result?.visualPost?.cta ?? undefined,
    authorName: editAuthorName ?? undefined,
    authorHandle: editAuthorHandle ?? undefined,
    authorPhotoUrl: authorPhotoUrl ?? undefined,
    embeddedImageUrl: embeddedImageUrl ?? undefined,
    brandName: empresa?.nome || "GO Studio",
    brandColor,
    boldWords: boldWords.split(",").map((w) => w.trim()).filter(Boolean),
    highlightWords: highlightWords.split(",").map((w) => w.trim()).filter(Boolean),
    highlightColor: highlightColor,
  };

  const getSlideDesignData = (slide: CarouselSlideLocal, idx: number): PostDesignData => ({
    headline: slide.headline,
    subheadline: slide.subheadline,
    accentText: slide.accentText || (idx === 0 ? state.result?.visualPost?.accentText : undefined),
    authorName: editAuthorName ?? undefined,
    authorHandle: editAuthorHandle ?? undefined,
    authorPhotoUrl: authorPhotoUrl ?? undefined,
    embeddedImageUrl: embeddedImageUrl ?? undefined,
    brandName: empresa?.nome || "GO Studio",
    brandColor,
    slideNumber: idx + 1,
    totalSlides: carouselSlides.length,
    boldWords: boldWords.split(",").map((w) => w.trim()).filter(Boolean),
    highlightWords: highlightWords.split(",").map((w) => w.trim()).filter(Boolean),
    highlightColor: highlightColor,
  });

  const currentDesignData = isCarousel
    ? getSlideDesignData(carouselSlides[activeSlide] || carouselSlides[0], activeSlide)
    : singleDesignData;

  /* ── Variations ─────────────────────────────────────────────────────── */

  // Build brand color palette from DNA + empresa + fallback
  const dnaPalette = useMemo(() => {
    const colors: string[] = [];
    if (dna?.dna_sintetizado?.paleta_cores?.length) {
      dna.dna_sintetizado.paleta_cores.forEach((c: string) => {
        if (/^#[0-9A-Fa-f]{6}$/.test(c)) colors.push(c);
      });
    }
    if (empresa?.cor_primaria && !colors.includes(empresa.cor_primaria)) {
      colors.unshift(empresa.cor_primaria);
    }
    if (empresa?.cor_secundaria && !colors.includes(empresa.cor_secundaria)) {
      colors.push(empresa.cor_secundaria);
    }
    return colors.length > 0 ? colors : COLOR_PALETTE;
  }, [dna, empresa]);

  const variations = useMemo(() => {
    const suggested = state.result?.visualPost?.suggestedTemplate || state.designTemplate || "bold-statement";
    const templates: PostDesignTemplate[] = isCarousel
      ? ["carousel-slide", "tip-numbered", "split-content", "bold-statement", "editorial", "gradient-wave"]
      : [
          suggested as PostDesignTemplate,
          "vitor-thread", "vitor-quote",
          "editorial", "tweet-quote", "stats-highlight", "gradient-wave",
          "carousel-slide", "bold-statement", "minimal-clean", "quote-card", "split-content",
        ];

    const unique = [...new Set(templates)].slice(0, 12);
    return unique.map((t, i) => ({
      id: i,
      template: t,
      // Use brand colors for all variations, cycling through DNA palette
      color: i === 0 ? brandColor : dnaPalette[i % dnaPalette.length],
    }));
  }, [state.result, state.designTemplate, brandColor, dnaPalette, isCarousel]);

  /* ── Image upload helper ─────────────────────────────────────────── */

  const handleImageUpload = (
    setter: (url: string) => void,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ── Export handlers ────────────────────────────────────────────────── */

  const handleExport = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(canvasRef.current, { scale: 3, useCORS: true, backgroundColor: null });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      const label = isCarousel ? `slide-${activeSlide + 1}` : "post";
      a.download = `${label}-${empresa?.nome || "contia"}.png`;
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (!isCarousel) return;
    setExportingAll(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      // We need to render each slide and export. We'll use a hidden container.
      for (let i = 0; i < carouselSlides.length; i++) {
        setActiveSlide(i);
        // Small delay for React to re-render
        await new Promise((r) => setTimeout(r, 200));
        if (!canvasRef.current) continue;
        const canvas = await html2canvas(canvasRef.current, { scale: 3, useCORS: true, backgroundColor: null });
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `slide-${i + 1}-${empresa?.nome || "contia"}.png`;
        a.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      console.error("Export all failed:", err);
    } finally {
      setExportingAll(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  /* ── Rich carousel export handler ────────────────────────────────── */
  const handleRichExport = async () => {
    if (!richCanvasRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(richCanvasRef.current, { scale: 3, useCORS: true, backgroundColor: null });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `slide-${activeRichSlide + 1}-${empresa?.nome || "contia"}.png`;
      a.click();
    } catch (err) { console.error("Export failed:", err); }
    finally { setExporting(false); }
  };

  const handleRichExportAll = async () => {
    if (!richSlides?.length) return;
    setExportingAll(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      for (let i = 0; i < richSlides.length; i++) {
        setActiveRichSlide(i);
        await new Promise((r) => setTimeout(r, 250));
        if (!richCanvasRef.current) continue;
        const canvas = await html2canvas(richCanvasRef.current, { scale: 3, useCORS: true, backgroundColor: null });
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `slide-${i + 1}-${empresa?.nome || "contia"}.png`;
        a.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) { console.error("Export all failed:", err); }
    finally { setExportingAll(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RICH SLIDES MODE — when AI generated dynamic layouts
     ═══════════════════════════════════════════════════════════════════════ */
  if (hasRichSlides && isCarousel) {
    const currentRich = richSlides![activeRichSlide] || richSlides![0];
    return (
      <div className="space-y-6">
        {/* ── Badge: Layout Dinamico ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20">
            <Layers size={14} className="text-[#3b82f6]" />
            <span className="text-xs font-semibold text-[#3b82f6]">Layout Dinamico</span>
          </div>
          <span className="text-[11px] text-text-muted">
            {richSlides!.length} slides com layouts variados
          </span>
        </motion.div>

        {/* ── Slide Navigator ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-3"
        >
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: "none" }}>
            {richSlides!.map((rs, idx) => {
              const isActive = activeRichSlide === idx;
              return (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveRichSlide(idx)}
                  className={`shrink-0 relative rounded-lg border-2 p-2 transition-all min-w-[140px] text-left ${
                    isActive ? "border-[#3b82f6] bg-[#3b82f6]/5" : "border-border bg-bg-card hover:border-border-light"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold"
                      style={{ background: isActive ? "#3b82f6" : "rgba(255,255,255,0.06)", color: isActive ? "#fff" : "rgba(255,255,255,0.4)" }}
                    >
                      {idx + 1}
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      isActive ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "dark:bg-white/5 bg-bg-card text-text-muted"
                    }`}>
                      {CONTENT_TYPE_LABELS[rs.contentType] || rs.contentType}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-text-primary truncate">{rs.headline}</p>
                  {rs.tag && <p className="text-[8px] text-text-muted mt-0.5">{rs.tag}</p>}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Main Rich Preview ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-3"
        >
          {/* Navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveRichSlide((p) => Math.max(0, p - 1))}
              disabled={activeRichSlide === 0}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-text-secondary tabular-nums">
              Slide {activeRichSlide + 1} de {richSlides!.length}
            </span>
            <button
              onClick={() => setActiveRichSlide((p) => Math.min(richSlides!.length - 1, p + 1))}
              disabled={activeRichSlide === richSlides!.length - 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card disabled:opacity-30 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Canvas */}
          <div className="bg-bg-card border border-border rounded-2xl p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRichSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <RichSlideCanvas
                  ref={richCanvasRef}
                  slide={currentRich}
                  totalSlides={richSlides!.length}
                  aspectRatio={state.designAspectRatio}
                  brandAccent={brandColor}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="flex gap-1.5">
            {richSlides!.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveRichSlide(idx)}
                className="transition-all"
                style={{
                  width: activeRichSlide === idx ? 20 : 6,
                  height: 6, borderRadius: 3,
                  background: activeRichSlide === idx ? "#3b82f6" : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Controls + Actions ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row items-center gap-4 bg-bg-card border border-border rounded-xl p-4"
        >
          {/* Aspect ratio */}
          <div className="flex items-center gap-1.5">
            {(["1:1", "4:5", "9:16"] as const).map((r) => {
              const icons = { "1:1": Square, "4:5": RectangleVertical, "9:16": Smartphone };
              const Icon = icons[r];
              const active = state.designAspectRatio === r;
              return (
                <button
                  key={r}
                  onClick={() => setField("designAspectRatio", r)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    active ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <Icon size={12} />
                  {r}
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-border hidden sm:block" />

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light transition-all"
            >
              <RefreshCw size={12} />
              Regenerar
            </button>
            <button
              onClick={handleRichExportAll}
              disabled={exportingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/10 disabled:opacity-50 transition-all"
            >
              {exportingAll ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
              Baixar Todos
            </button>
            <button
              onClick={handleRichExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Baixar Slide
            </button>
          </div>
        </motion.div>

        {/* ── Caption Editor ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Legenda do post
          </h3>
          <textarea
            value={state.result?.conteudo || ""}
            onChange={(e) => {
              if (state.result) {
                setField("result", { ...state.result, conteudo: e.target.value } as WizardState["result"]);
              }
            }}
            rows={4}
            className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
            placeholder="Legenda do post..."
          />
          {state.result?.hashtags && state.result.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {state.result.hashtags.map((tag, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                  #{tag.replace("#", "")}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TEMPLATE MODE — original PostCanvas-based rendering
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Section 1: Design Variations (Tabbed) ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {isCarousel ? "Estilo do Carrossel" : "Variacoes"}
          </h3>
          <span className="text-[11px] text-text-muted">Clique para selecionar</span>
        </div>

        {/* Tab headers */}
        <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-1">
          <button
            onClick={() => { setActiveTab("padrao"); setSelectedCustomTemplate(null); }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "padrao" ? "bg-accent/10 text-accent-light" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Padrao
          </button>
          <button
            onClick={() => setActiveTab("meus")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "meus" ? "bg-accent/10 text-accent-light" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Meus Templates {customTemplates.length > 0 && `(${customTemplates.length})`}
          </button>
        </div>

        {/* Tab: Padrao — existing variations strip */}
        {activeTab === "padrao" && (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: "none" }}>
            {variations.map((v) => {
              const isActive = !selectedCustomTemplate && state.designTemplate === v.template && state.designBrandColor === v.color;
              return (
                <motion.button
                  key={v.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedCustomTemplate(null);
                    setField("designTemplate", v.template);
                    setField("designBrandColor", v.color);
                  }}
                  className={`shrink-0 rounded-xl border-2 p-1.5 transition-all ${
                    isActive
                      ? "border-accent shadow-[0_0_15px_rgba(78,205,196,0.2)]"
                      : "border-border hover:border-border-light"
                  }`}
                >
                  <div className="overflow-hidden rounded-lg" style={{ width: 130, height: 130 }}>
                    <div style={{ transform: "scale(0.325)", transformOrigin: "top left", width: 400, height: 400 }}>
                      <PostCanvas
                        data={isCarousel ? getSlideDesignData(carouselSlides[0], 0) : singleDesignData}
                        template={v.template}
                        brandColor={v.color}
                        aspectRatio="1:1"
                      />
                    </div>
                  </div>
                  <p className={`text-[10px] font-medium mt-1.5 text-center truncate px-1 ${
                    isActive ? "text-accent-light" : "text-text-muted"
                  }`}>
                    {TEMPLATE_NAMES[v.template]}
                  </p>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Tab: Meus Templates — custom templates */}
        {activeTab === "meus" && (
          <div className="space-y-3">
            {/* Create button */}
            <button
              onClick={() => { setEditingTemplate(null); setBuilderOpen(true); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-accent/30 hover:bg-accent/5 text-text-muted hover:text-accent transition-all"
            >
              <Plus size={16} />
              <span className="text-xs font-medium">Criar Template</span>
            </button>

            {/* Custom template cards */}
            {customTemplates.length === 0 ? (
              <p className="text-center text-xs text-text-muted py-6">
                Nenhum template personalizado ainda.
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: "none" }}>
                {customTemplates.map((ct) => {
                  const isActive = selectedCustomTemplate?.id === ct.id;
                  return (
                    <motion.div
                      key={ct.id}
                      whileHover={{ scale: 1.02 }}
                      className={`shrink-0 rounded-xl border-2 p-1.5 transition-all cursor-pointer group ${
                        isActive ? "border-accent shadow-[0_0_15px_rgba(78,205,196,0.2)]" : "border-border hover:border-border-light"
                      }`}
                      onClick={() => setSelectedCustomTemplate(ct)}
                    >
                      {/* Mini preview using CustomCanvas */}
                      <div className="overflow-hidden rounded-lg" style={{ width: 130, height: 130 }}>
                        <div style={{ transform: "scale(0.325)", transformOrigin: "top left", width: 400, height: 400 }}>
                          <CustomCanvas
                            data={isCarousel ? getSlideDesignData(carouselSlides[0], 0) : singleDesignData}
                            style={ct.style}
                            aspectRatio="1:1"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 px-1">
                        <p className={`text-[10px] font-medium truncate ${isActive ? "text-accent-light" : "text-text-muted"}`}>
                          {ct.name}
                        </p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTemplate(ct); setBuilderOpen(true); }}
                            className="p-0.5 text-text-muted hover:text-accent"
                            title="Editar"
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeCustomTemplate(ct.id); }}
                            className="p-0.5 text-text-muted hover:text-danger"
                            title="Excluir"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Section 2: Carousel Slide Navigator (only for carousel) ───── */}
      {isCarousel && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">
                Slides ({carouselSlides.length})
              </h3>
            </div>
            <button
              onClick={addSlide}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-accent hover:bg-accent/10 transition-colors"
            >
              <Plus size={12} />
              Adicionar
            </button>
          </div>

          {/* Slide thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: "none" }}>
            {carouselSlides.map((slide, idx) => {
              const isActive = activeSlide === idx;
              return (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveSlide(idx)}
                  className={`shrink-0 relative rounded-lg border-2 p-2 transition-all min-w-[140px] text-left ${
                    isActive
                      ? "border-accent bg-accent/5"
                      : "border-border bg-bg-card hover:border-border-light"
                  }`}
                >
                  {/* Slide number badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold"
                      style={{
                        background: isActive ? brandColor : "rgba(255,255,255,0.06)",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {idx + 1}
                    </span>
                    {carouselSlides.length > 2 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSlide(idx); }}
                        className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-text-primary truncate">{slide.headline}</p>
                  {slide.subheadline && (
                    <p className="text-[9px] text-text-muted truncate mt-0.5">{slide.subheadline}</p>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Section 3: Main Preview ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="flex flex-col items-center gap-3"
      >
        {/* Navigation arrows for carousel */}
        {isCarousel && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveSlide((p) => Math.max(0, p - 1))}
              disabled={activeSlide === 0}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-text-secondary tabular-nums">
              Slide {activeSlide + 1} de {carouselSlides.length}
            </span>
            <button
              onClick={() => setActiveSlide((p) => Math.min(carouselSlides.length - 1, p + 1))}
              disabled={activeSlide === carouselSlides.length - 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card disabled:opacity-30 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCustomTemplate ? `custom-${selectedCustomTemplate.id}` : `preset-${state.designTemplate}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {selectedCustomTemplate ? (
                <CustomCanvas
                  ref={canvasRef}
                  data={currentDesignData}
                  style={selectedCustomTemplate.style}
                  aspectRatio={state.designAspectRatio}
                />
              ) : (
                <PostCanvas
                  ref={canvasRef}
                  data={currentDesignData}
                  template={state.designTemplate}
                  aspectRatio={state.designAspectRatio}
                  brandColor={state.designBrandColor}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel dot indicators */}
        {isCarousel && (
          <div className="flex gap-1.5">
            {carouselSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className="transition-all"
                style={{
                  width: activeSlide === idx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: activeSlide === idx ? brandColor : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Section 3.5: Content Editor ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-bg-card border border-border rounded-xl p-4 space-y-4"
      >
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Editar conteudo
        </h3>

        {/* Row 1: Images upload */}
        <div className="flex gap-3">
          {/* Profile photo upload */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-text-muted font-medium">Foto de perfil</label>
            <div className="flex items-center gap-2">
              {authorPhotoUrl ? (
                <img src={authorPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-bg-input border border-border flex items-center justify-center text-text-muted text-xs">
                  ?
                </div>
              )}
              <label className="cursor-pointer px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-bg-input border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-all">
                {authorPhotoUrl ? "Trocar" : "Subir"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setAuthorPhotoUrl)} />
              </label>
              {authorPhotoUrl && (
                <button
                  onClick={() => setAuthorPhotoUrl(null)}
                  className="text-[10px] text-text-muted hover:text-danger transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          {/* Embedded image upload */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-text-muted font-medium">Imagem do post</label>
            <div className="flex items-center gap-2">
              {embeddedImageUrl ? (
                <img src={embeddedImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-bg-input border border-border flex items-center justify-center text-text-muted text-xs">
                  <ImageIcon size={14} />
                </div>
              )}
              <label className="cursor-pointer px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-bg-input border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-all">
                {embeddedImageUrl ? "Trocar" : "Subir"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setEmbeddedImageUrl)} />
              </label>
              {embeddedImageUrl && (
                <button
                  onClick={() => setEmbeddedImageUrl(null)}
                  className="text-[10px] text-text-muted hover:text-danger transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Author info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Nome do autor</label>
            <input
              value={editAuthorName ?? ""}
              onChange={(e) => setEditAuthorName(e.target.value || null)}
              placeholder="Vitor Bertuzzi"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Handle</label>
            <input
              value={editAuthorHandle ?? ""}
              onChange={(e) => setEditAuthorHandle(e.target.value || null)}
              placeholder="@vitorbertuzzi"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </div>

        {/* Row 3: Text content */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Titulo / Headline</label>
            <textarea
              value={editHeadline ?? singleDesignData.headline}
              onChange={(e) => setEditHeadline(e.target.value)}
              rows={2}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm font-semibold text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Subtitulo</label>
            <textarea
              value={editSubheadline ?? singleDesignData.subheadline ?? ""}
              onChange={(e) => setEditSubheadline(e.target.value || null)}
              rows={2}
              placeholder="Texto de apoio (opcional)"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-secondary resize-none focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Corpo / Paragrafos extras</label>
            <textarea
              value={editBody ?? ""}
              onChange={(e) => setEditBody(e.target.value || null)}
              rows={3}
              placeholder="Paragrafos adicionais (separar por Enter)"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-secondary resize-none focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </div>

        {/* Row 4: Text formatting */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Palavras em negrito</label>
            <input
              value={boldWords}
              onChange={(e) => setBoldWords(e.target.value)}
              placeholder="palavra1, palavra2"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-[9px] text-text-muted">Separe por virgula</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Palavras em destaque</label>
            <input
              value={highlightWords}
              onChange={(e) => setHighlightWords(e.target.value)}
              placeholder="palavra1, palavra2"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-[9px] text-text-muted">Separe por virgula</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-text-muted font-medium">Cor do destaque</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <span className="text-[10px] text-text-muted font-mono">{highlightColor}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Section 4: Slide Editor (carousel only) ──────────────────── */}
      {isCarousel && carouselSlides[activeSlide] && (
        <motion.div
          key={`editor-${activeSlide}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Editar Slide {activeSlide + 1}
          </h3>
          <div className="space-y-2">
            <input
              value={carouselSlides[activeSlide].headline}
              onChange={(e) => updateSlide(activeSlide, "headline", e.target.value)}
              placeholder="Titulo do slide..."
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
            <input
              value={carouselSlides[activeSlide].subheadline || ""}
              onChange={(e) => updateSlide(activeSlide, "subheadline", e.target.value)}
              placeholder="Subtitulo (opcional)..."
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </motion.div>
      )}

      {/* ── Section 5: Quick Controls + Actions ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex flex-col sm:flex-row items-center gap-4 bg-bg-card border border-border rounded-xl p-4"
      >
        {/* Colors */}
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-text-muted shrink-0" />
          <div className="flex gap-1.5">
            {COLOR_PALETTE.map((c) => (
              <button key={c} onClick={() => setField("designBrandColor", c)}>
                <div
                  className={`w-6 h-6 rounded-full transition-all ${
                    state.designBrandColor === c
                      ? "ring-2 ring-white/40 ring-offset-1 ring-offset-bg-card"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Aspect ratio */}
        <div className="flex items-center gap-1.5">
          {(["1:1", "4:5", "9:16"] as const).map((r) => {
            const icons = { "1:1": Square, "4:5": RectangleVertical, "9:16": Smartphone };
            const Icon = icons[r];
            const active = state.designAspectRatio === r;
            return (
              <button
                key={r}
                onClick={() => setField("designAspectRatio", r)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  active ? "bg-accent/10 text-accent-light" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Icon size={12} />
                {r}
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light transition-all"
          >
            <RefreshCw size={12} />
            Regenerar
          </button>

          {isCarousel && (
            <button
              onClick={handleExportAll}
              disabled={exportingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-accent/30 text-accent hover:bg-accent/10 disabled:opacity-50 transition-all"
            >
              {exportingAll ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
              Baixar Todos
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white hover:shadow-[0_0_20px_rgba(78,205,196,0.25)] transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {isCarousel ? "Baixar Slide" : "Baixar PNG"}
          </button>
        </div>
      </motion.div>

      {/* ── Section 6: Caption Editor ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-bg-card border border-border rounded-xl p-4 space-y-3"
      >
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Legenda do post
        </h3>
        <textarea
          value={state.result?.conteudo || ""}
          onChange={(e) => {
            if (state.result) {
              setField("result", { ...state.result, conteudo: e.target.value } as WizardState["result"]);
            }
          }}
          rows={4}
          className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
          placeholder="Legenda do post..."
        />
        {state.result?.hashtags && state.result.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.result.hashtags.map((tag, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-light">
                #{tag.replace("#", "")}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── TemplateBuilder Modal ─────────────────────────────────────── */}
      <TemplateBuilder
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingTemplate(null); }}
        onSave={(template) => {
          saveCustomTemplate(template);
          setSelectedCustomTemplate(template);
          setActiveTab("meus");
          setBuilderOpen(false);
          setEditingTemplate(null);
        }}
        editTemplate={editingTemplate}
        empresaId={empresa?.id || ""}
        empresaNome={empresa?.nome || "ContIA"}
        brandColor={brandColor}
      />
    </div>
  );
}
