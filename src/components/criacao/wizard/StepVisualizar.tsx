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
import type { CustomTemplate } from "@/types/custom-template";

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
    brandName: empresa?.nome || "ContIA",
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
    brandName: empresa?.nome || "ContIA",
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

  const variations = useMemo(() => {
    const suggested = state.result?.visualPost?.suggestedTemplate || "bold-statement";
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
      color: i === 0 ? brandColor : COLOR_PALETTE[i % COLOR_PALETTE.length],
    }));
  }, [state.result, brandColor, isCarousel]);

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
