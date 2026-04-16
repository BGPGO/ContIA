"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { Loader2, ClipboardCopy, RefreshCw, Type, Sparkles } from "lucide-react";
import { FabricCanvas } from "@/components/canvas/FabricCanvas";
import type { FabricCanvasRef, SelectionInfo, TextSelectionInfo } from "@/components/canvas/FabricCanvas";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { PropertyPanel } from "@/components/canvas/PropertyPanel";
import { LayersPanel } from "@/components/canvas/LayersPanel";
import { TemplateGallery } from "@/components/canvas/TemplateGallery";
import { CanvasExporter } from "@/components/canvas/CanvasExporter";
import { SlideNavigator } from "@/components/canvas/SlideNavigator";
import { EditorBottomBar } from "@/components/canvas/EditorBottomBar";
import { TemplateFromImage } from "@/components/canvas/TemplateFromImage";
import { BrandAssetsPanel } from "@/components/canvas/BrandAssetsPanel";
import { useFabricCanvas } from "@/hooks/useFabricCanvas";
import { useVisualTemplates } from "@/hooks/useVisualTemplates";
import { useEmpresa } from "@/hooks/useEmpresa";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { externalizeCanvasImages } from "@/lib/canvas-storage";
import type { VisualTemplate, CopyToTemplatePayload } from "@/types/canvas";
import { CANVAS_DIMENSIONS } from "@/types/canvas";
import type { CopyContent } from "@/types/copy-studio";
import type { PsdTemplate } from "@/lib/psd-templates";

/* ═══════════════════════════════════════════════════════════════════════════
   Helper: Convert CopyContent → CopyToTemplatePayload
   ═══════════════════════════════════════════════════════════════════════════ */

function copyToCopyPayload(copy: CopyContent, empresa?: { nome?: string } | null, slideIndex?: number): CopyToTemplatePayload {
  // Per-slide payload for carousels
  if (slideIndex !== undefined && copy.slides && copy.slides[slideIndex]) {
    const slide = copy.slides[slideIndex];
    return {
      headline: slide.headline,
      body: slide.body,
      cta: slideIndex === (copy.slides.length - 1) ? copy.cta : undefined,
      brandName: empresa?.nome,
      hashtags: slideIndex === 0 ? copy.hashtags : undefined,
      slideNumber: slide.slideNumber,
      totalSlides: copy.slides.length,
    };
  }
  // Original behavior for non-carousel / fallback
  return {
    headline: copy.headline,
    subheadline: copy.slides?.[0]?.headline || undefined, // First slide headline as subheadline
    body: copy.caption, // caption IS the body text
    cta: copy.cta || undefined,
    brandName: empresa?.nome,
    hashtags: copy.hashtags,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Save Template Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141736] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-[#e8eaff] mb-4">
          Salvar como Template
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim());
            if (e.key === "Escape") onClose();
          }}
          placeholder="Nome do template..."
          className="w-full bg-[#080b1e] border border-white/10 rounded-lg px-4 py-3 text-sm text-[#e8eaff]
            placeholder:text-[#5e6388] focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
        />
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#8b8fb0]
              hover:text-[#e8eaff] hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim() || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white
              disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            style={{
              background: name.trim()
                ? "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)"
                : "rgba(255,255,255,0.06)",
            }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin mx-4" />
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Copy Text Panel — shows session copy for manual copy/paste + re-apply
   ═══════════════════════════════════════════════════════════════════════════ */

function CopyTextPanel({
  copy,
  copyData,
  onApply,
  onGenerateLayout,
}: {
  copy: CopyContent | null;
  copyData: CopyToTemplatePayload | null;
  onApply: () => void;
  onGenerateLayout?: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!copy) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
        <Type size={24} className="text-[#5e6388] mb-2" />
        <p className="text-xs text-[#5e6388]">Nenhuma copy carregada</p>
        <p className="text-[10px] text-[#5e6388]/60 mt-1">Crie uma copy no Copy Studio primeiro</p>
      </div>
    );
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="p-3 space-y-4">
      {/* Re-apply button */}
      <button
        type="button"
        onClick={onApply}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer transition-all hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)" }}
      >
        <RefreshCw size={12} />
        Aplicar Copy no Template
      </button>

      {/* Generate smart layout from copy */}
      {onGenerateLayout && (
        <button
          type="button"
          onClick={onGenerateLayout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
            text-[#e8eaff] bg-[#141736] border border-white/10 cursor-pointer transition-all hover:border-[#4ecdc4]/30"
        >
          <Sparkles size={12} className="text-[#4ecdc4]" />
          Gerar Layout Inteligente
        </button>
      )}

      {/* Headline */}
      {copy.headline && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[#5e6388] uppercase tracking-wider">Headline</label>
            <button
              onClick={() => copyToClipboard(copy.headline!, "headline")}
              className="p-1 rounded text-[#5e6388] hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar headline"
            >
              <ClipboardCopy size={10} className={copiedField === "headline" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <p className="text-sm font-semibold text-[#e8eaff] select-all cursor-text bg-[#080b1e] rounded-lg px-3 py-2 border border-white/5">
            {copy.headline}
          </p>
        </div>
      )}

      {/* Caption */}
      {copy.caption && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[#5e6388] uppercase tracking-wider">Legenda</label>
            <button
              onClick={() => copyToClipboard(copy.caption!, "caption")}
              className="p-1 rounded text-[#5e6388] hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar legenda"
            >
              <ClipboardCopy size={10} className={copiedField === "caption" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <p className="text-xs text-[#e8eaff]/80 select-all cursor-text bg-[#080b1e] rounded-lg px-3 py-2 border border-white/5 whitespace-pre-line max-h-[120px] overflow-y-auto">
            {copy.caption}
          </p>
        </div>
      )}

      {/* Slides (carousel) */}
      {copy.slides && copy.slides.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-[#5e6388] uppercase tracking-wider">Slides</label>
          {copy.slides.map((slide, i) => (
            <div key={i} className="bg-[#080b1e] rounded-lg px-3 py-2 border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#4ecdc4]">Slide {slide.slideNumber || i + 1}</span>
                <button
                  onClick={() => copyToClipboard(`${slide.headline}\n\n${slide.body}`, `slide-${i}`)}
                  className="p-1 rounded text-[#5e6388] hover:text-[#4ecdc4] cursor-pointer transition-colors"
                  title={`Copiar slide ${i + 1}`}
                >
                  <ClipboardCopy size={10} className={copiedField === `slide-${i}` ? "text-[#4ecdc4]" : ""} />
                </button>
              </div>
              <p className="text-xs font-semibold text-[#e8eaff] select-all cursor-text">{slide.headline}</p>
              <p className="text-[11px] text-[#e8eaff]/70 select-all cursor-text whitespace-pre-line">{slide.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hashtags */}
      {copy.hashtags && copy.hashtags.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[#5e6388] uppercase tracking-wider">Hashtags</label>
            <button
              onClick={() => copyToClipboard(copy.hashtags!.map((t: string) => `#${t.replace('#', '')}`).join(' '), "hashtags")}
              className="p-1 rounded text-[#5e6388] hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar hashtags"
            >
              <ClipboardCopy size={10} className={copiedField === "hashtags" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {copy.hashtags.map((tag: string, i: number) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#4ecdc4]/10 text-[#4ecdc4] select-all cursor-text">
                #{tag.replace('#', '')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {copy.cta && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[#5e6388] uppercase tracking-wider">CTA</label>
            <button
              onClick={() => copyToClipboard(copy.cta || '', "cta")}
              className="p-1 rounded text-[#5e6388] hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar CTA"
            >
              <ClipboardCopy size={10} className={copiedField === "cta" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <p className="text-xs font-medium text-[#6c5ce7] select-all cursor-text bg-[#080b1e] rounded-lg px-3 py-2 border border-white/5">
            {copy.cta}
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Editor Content (inside Suspense)
   ═══════════════════════════════════════════════════════════════════════════ */

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");
  const templateId = searchParams.get("template");

  const { empresa } = useEmpresa();
  const empresaId = empresa?.id || "";

  const {
    canvasRef,
    state,
    loadTemplate,
    loadPreset,
    applyCopy,
    setAspectRatio,
    exportImage,
    getCanvasJson,
    selection,
    setSelection,
    markDirty,
    markClean,
    // Carousel
    slides,
    currentSlideIndex,
    isCarousel,
    slideThumbnails,
    switchSlide,
    addSlide,
    deleteSlide: deleteCarouselSlide,
    duplicateSlide: duplicateCarouselSlide,
    reorderSlide,
    loadCarousel,
  } = useFabricCanvas();

  const {
    templates,
    saveTemplate,
    deleteTemplate,
    duplicateTemplate,
  } = useVisualTemplates(empresaId || undefined);

  const [isEditingText, setIsEditingText] = useState(false);
  const [textSelection, setTextSelection] = useState<TextSelectionInfo | null>(null);
  const [showGallery, setShowGallery] = useState(!templateId);
  const [showImageExtractor, setShowImageExtractor] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [copyData, setCopyData] = useState<CopyToTemplatePayload | null>(null);
  const [rawCopyContent, setRawCopyContent] = useState<CopyContent | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"properties" | "assets" | "copy">("properties");
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionId);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [canvasReady, setCanvasReady] = useState(false);

  // ── Canvas dimensions based on aspect ratio ──
  const dims = CANVAS_DIMENSIONS[state.aspectRatio] || CANVAS_DIMENSIONS["1:1"];

  // ── Apply carousel copy: iterate slides and apply per-slide content ──
  const applyCarouselCopy = useCallback(
    async (copy: CopyContent, numCanvasSlides: number) => {
      if (!copy.slides || copy.slides.length === 0) return false;
      const totalSlides = Math.min(numCanvasSlides, copy.slides.length);
      for (let i = 0; i < totalSlides; i++) {
        await new Promise(r => setTimeout(r, 300));
        switchSlide(i);
        await new Promise(r => setTimeout(r, 300));
        const slidePayload = copyToCopyPayload(copy, empresa, i);
        applyCopy(slidePayload);
      }
      // Return to first slide
      if (totalSlides > 1) {
        await new Promise(r => setTimeout(r, 200));
        switchSlide(0);
      }
      return true;
    },
    [switchSlide, applyCopy, empresa]
  );

  // ── Load copy from session ──
  useEffect(() => {
    if (!sessionId) return;
    if (!isSupabaseConfigured()) {
      setIsLoadingSession(false);
      return;
    }

    let cancelled = false;

    async function loadSessionCopy() {
      setIsLoadingSession(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("copy_sessions")
          .select("current_copy")
          .eq("id", sessionId)
          .single();

        if (error || !data) {
          console.warn("[Editor] Failed to load session:", error?.message);
          setIsLoadingSession(false);
          return;
        }

        if (cancelled) return;

        if (data.current_copy) {
          const copy = data.current_copy as CopyContent;
          setRawCopyContent(copy);
          const payload = copyToCopyPayload(copy, empresa);
          setCopyData(payload);
        }
      } catch (err) {
        console.warn("[Editor] Error loading session:", err);
      } finally {
        if (!cancelled) setIsLoadingSession(false);
      }
    }

    loadSessionCopy();
    return () => { cancelled = true; };
  }, [sessionId, empresa]);

  // ── Auto-apply copy when it arrives after template is already loaded ──
  useEffect(() => {
    if (!copyData || !canvasReady) return;
    // Only auto-apply if template is already loaded (not loading)
    if (isLoadingTemplate) return;
    console.log('[Editor] Auto-applying copy (copyData or canvasReady changed):', copyData);
    // Use 300ms delay to ensure canvas has fully rendered all objects
    setTimeout(() => {
      applyCopy(copyData);
    }, 300);
  }, [copyData, canvasReady, isLoadingTemplate, applyCopy]);

  // ── Load template from URL param ──
  useEffect(() => {
    if (!templateId || !canvasReady) return;

    let cancelled = false;

    async function loadTemplateFromId() {
      setIsLoadingTemplate(true);
      try {
        const res = await fetch(`/api/visual-templates/${templateId}`);
        if (!res.ok) {
          console.warn("[Editor] Failed to load template:", res.status);
          setIsLoadingTemplate(false);
          return;
        }

        const template = await res.json();
        if (cancelled) return;

        if (template.canvas_json) {
          await loadTemplate(template.canvas_json);
          if (template.aspect_ratio) {
            setAspectRatio(template.aspect_ratio);
          }
          // Use 300ms delay to ensure canvas has fully rendered all objects
          if (copyData) {
            console.log('[Editor] Applying copy after URL template load:', copyData);
            setTimeout(() => {
              applyCopy(copyData);
            }, 300);
          }
        }
      } catch (err) {
        console.warn("[Editor] Error loading template:", err);
      } finally {
        if (!cancelled) setIsLoadingTemplate(false);
      }
    }

    loadTemplateFromId();
    return () => { cancelled = true; };
  }, [templateId, canvasReady, loadTemplate, setAspectRatio, copyData, applyCopy]);

  // ── Handle template selection from gallery ──
  const handleTemplateSelect = useCallback(
    async (template: VisualTemplate) => {
      if (template.canvas_json) {
        await loadTemplate(template.canvas_json);
        if (template.aspect_ratio) {
          setAspectRatio(template.aspect_ratio as "1:1" | "4:5" | "9:16");
        }
      }
      // Apply per-slide copy for carousels, single copy otherwise
      if (rawCopyContent && rawCopyContent.slides && rawCopyContent.slides.length > 0 && template.format === "carousel") {
        console.log('[Editor] Applying per-slide copy after template gallery select');
        const slideCount = (template.canvas_json as { slides?: unknown[] })?.slides?.length || rawCopyContent.slides.length;
        await applyCarouselCopy(rawCopyContent, slideCount);
      } else if (copyData) {
        console.log('[Editor] Applying copy after template gallery select:', copyData);
        setTimeout(() => {
          applyCopy(copyData);
        }, 300);
      }
      setShowGallery(false);
    },
    [loadTemplate, setAspectRatio, applyCopy, copyData, rawCopyContent, applyCarouselCopy]
  );

  // ── Handle preset selection ──
  const handlePresetSelect = useCallback(
    async (presetId: string) => {
      await loadPreset(presetId, state.aspectRatio);
      // Apply per-slide copy for carousels if available
      if (rawCopyContent && rawCopyContent.slides && rawCopyContent.slides.length > 0) {
        console.log('[Editor] Applying per-slide copy after preset select:', presetId);
        await applyCarouselCopy(rawCopyContent, rawCopyContent.slides.length);
      } else if (copyData) {
        console.log('[Editor] Applying copy after preset select:', presetId, copyData);
        setTimeout(() => {
          applyCopy(copyData);
        }, 300);
      }
      setShowGallery(false);
    },
    [loadPreset, state.aspectRatio, applyCopy, copyData, rawCopyContent, applyCarouselCopy]
  );

  // ── Handle PSD template selection ──
  const handlePsdSelect = useCallback(
    async (template: PsdTemplate, slideIndex: number) => {
      // Set aspect ratio based on slide dimensions
      const ratio = (template.slideHeight || template.height) / (template.slideWidth || template.width);
      if (ratio > 1.5) setAspectRatio("9:16");
      else if (ratio > 1.1) setAspectRatio("4:5");
      else setAspectRatio("1:1");

      if ((template.slides || 1) > 1) {
        // Carousel: load ALL slides
        const { convertPsdCarouselToFabricSlides } = await import("@/lib/psd-to-fabric");
        const allSlides = convertPsdCarouselToFabricSlides(template);
        await loadCarousel(allSlides);

        // Apply copy per-slide if carousel copy exists, otherwise fallback to single apply
        if (rawCopyContent && rawCopyContent.slides && rawCopyContent.slides.length > 0) {
          console.log('[Editor] Applying per-slide copy after PSD carousel load');
          await applyCarouselCopy(rawCopyContent, allSlides.length);
        } else if (copyData) {
          console.log('[Editor] Applying single copy after PSD carousel load:', copyData);
          setTimeout(() => {
            applyCopy(copyData);
          }, 300);
        }
      } else {
        // Single slide: existing logic
        const { convertPsdToFabricJson } = await import("@/lib/psd-to-fabric");
        const canvasJson = convertPsdToFabricJson(template, { slideIndex });
        await loadTemplate(canvasJson);

        // Use 300ms delay to ensure canvas has fully rendered all objects
        if (copyData) {
          console.log('[Editor] Applying copy after PSD single slide load:', copyData);
          setTimeout(() => {
            applyCopy(copyData);
          }, 300);
        }
      }

      setShowGallery(false);
    },
    [loadTemplate, loadCarousel, setAspectRatio, applyCopy, copyData, rawCopyContent, applyCarouselCopy]
  );

  // ── Handle aspect ratio change ──
  const handleAspectRatioChange = useCallback(
    (ratio: "1:1" | "4:5" | "9:16") => {
      setAspectRatio(ratio);
    },
    [setAspectRatio]
  );

  // ── Save as template ──
  const handleSaveTemplate = useCallback(
    async (name: string) => {
      setIsSavingTemplate(true);
      try {
        const json = getCanvasJson();
        let thumbnail = exportImage({ format: "png", quality: 0.8, multiplier: 0.3 });

        let canvasJsonToSave: unknown = isCarousel ? { slides, currentSlideIndex } : json;

        if (isSupabaseConfigured()) {
          const supabase = createClient();
          // Externaliza imagens grandes do canvas_json
          canvasJsonToSave = await externalizeCanvasImages(canvasJsonToSave, supabase, empresaId);
          // Thumbnail: se grande (> 800KB base64), externaliza; senão deixa inline
          if (thumbnail && thumbnail.length > 800_000) {
            const tmpJson = await externalizeCanvasImages(
              { objects: [{ src: thumbnail }] },
              supabase,
              empresaId
            );
            const extracted = (tmpJson as { objects?: Array<{ src?: string }> })?.objects?.[0]?.src;
            if (typeof extracted === "string" && extracted.startsWith("http")) {
              thumbnail = extracted;
            }
          }
        }

        await saveTemplate({
          empresa_id: empresaId,
          name,
          description: "",
          canvas_json: canvasJsonToSave as object,
          thumbnail_url: thumbnail || null,
          format: isCarousel ? "carousel" : "post",
          aspect_ratio: state.aspectRatio,
          source: "manual",
          tags: [],
          is_public: false,
          source_image_url: null,
          ai_prompt: null,
        });

        markClean();
        setShowSaveModal(false);
      } catch (err) {
        console.error("[Editor] Failed to save template:", err);
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Falha ao salvar template: ${msg}`);
      } finally {
        setIsSavingTemplate(false);
      }
    },
    [getCanvasJson, exportImage, saveTemplate, empresaId, state.aspectRatio, markClean, isCarousel, slides, currentSlideIndex]
  );

  // ── Export / Download ──
  const handleExport = useCallback(() => {
    setShowExporter((prev) => !prev);
  }, []);

  // ── Copy to clipboard ──
  const handleCopyToClipboard = useCallback(async () => {
    try {
      const dataUrl = exportImage({ format: "png", quality: 1, multiplier: 2 });
      if (!dataUrl) return;

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch (err) {
      console.warn("[Editor] Clipboard copy failed:", err);
    }
  }, [exportImage]);

  // ── Back navigation ──
  const handleBack = useCallback(() => {
    if (sessionId) {
      router.push("/studio");
    } else {
      router.push("/studio");
    }
  }, [router, sessionId]);

  // ── Canvas ready callback ──
  const handleCanvasReady = useCallback(() => {
    setCanvasReady(true);
  }, []);

  // ── Generate smart layout from copy content ──
  const handleGenerateLayout = useCallback(async () => {
    if (!rawCopyContent) return;
    const { generateSmartLayout, generateCarouselLayout } = await import("@/lib/smart-layout");
    const brand = {
      primaryColor: empresa?.cor_primaria || "#4ecdc4",
      secondaryColor: empresa?.cor_secundaria || "#6c5ce7",
      brandName: empresa?.nome,
    };
    const format = state.aspectRatio === "9:16" ? "reels" as const : "post" as const;
    const options = { aspectRatio: state.aspectRatio, format };

    if (rawCopyContent.slides && rawCopyContent.slides.length > 0) {
      const slideJsons = generateCarouselLayout(rawCopyContent, brand, options);
      await loadCarousel(slideJsons);
    } else {
      const canvasJson = generateSmartLayout(rawCopyContent, brand, options);
      await loadTemplate(canvasJson);
    }
    markDirty();
  }, [rawCopyContent, empresa, state.aspectRatio, loadTemplate, loadCarousel, markDirty]);

  // ── Re-apply copy handler (for CopyTextPanel) ──
  const handleReapplyCopy = useCallback(() => {
    if (rawCopyContent && rawCopyContent.slides && rawCopyContent.slides.length > 0 && isCarousel) {
      applyCarouselCopy(rawCopyContent, slides.length || rawCopyContent.slides.length);
    } else if (copyData) {
      applyCopy(copyData);
    }
  }, [rawCopyContent, copyData, isCarousel, slides.length, applyCarouselCopy, applyCopy]);

  // ── Auto-show copy tab when copy data is available and no template pre-selected ──
  useEffect(() => {
    if (rawCopyContent && !templateId) {
      setRightPanelTab("copy");
    }
  }, [rawCopyContent, templateId]);

  // ── Determine if loading ──
  const isLoading = isLoadingSession || isLoadingTemplate;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080b1e] overflow-hidden" data-editor-root>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#080b1e]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#4ecdc4]" />
            <p className="text-sm text-[#8b8fb0]">
              {isLoadingSession ? "Carregando copy..." : "Carregando template..."}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar — fixed height */}
      <CanvasToolbar
        selection={selection}
        canvasRef={canvasRef}
        aspectRatio={state.aspectRatio}
        onAspectRatioChange={handleAspectRatioChange}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        isEditingText={isEditingText}
        textSelection={textSelection}
      />

      {/* Main area: Layers LEFT | Canvas CENTER | Properties RIGHT */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT: Layers Panel (desktop only) */}
        <div className="hidden lg:flex flex-col w-[250px] shrink-0 border-r border-white/10 bg-[#0c0f24]">
          <LayersPanel
            canvasRef={canvasRef}
            selection={selection}
          />
        </div>

        {/* CENTER: Canvas + Slide Navigator */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Canvas area — takes remaining space, centers the canvas, NO scroll */}
          <div className="flex-1 flex items-center justify-center bg-[#080b1e] overflow-hidden relative">
            <FabricCanvas
              ref={canvasRef}
              width={dims.width}
              height={dims.height}
              aspectRatio={state.aspectRatio}
              onSelectionChange={setSelection}
              onCanvasChange={markDirty}
              onReady={handleCanvasReady}
              onTextEditingChange={setIsEditingText}
              onTextSelectionChange={setTextSelection}
              className="shadow-2xl shadow-black/50"
            />

            {/* Exporter popover */}
            {showExporter && (
              <div className="absolute bottom-4 right-4 z-30">
                <CanvasExporter
                  canvasRef={canvasRef}
                  isVisible={showExporter}
                  postTitle="post"
                  onSaveAsTemplate={(name) => handleSaveTemplate(name)}
                  isCarousel={isCarousel}
                  slides={slides}
                  currentSlideIndex={currentSlideIndex}
                  onSwitchSlide={switchSlide}
                />
              </div>
            )}
          </div>

          {/* Slide Navigator — only for carousels */}
          {isCarousel && (
            <SlideNavigator
              slides={slides}
              currentSlide={currentSlideIndex}
              thumbnails={slideThumbnails}
              onSlideChange={switchSlide}
              onAddSlide={addSlide}
              onDeleteSlide={deleteCarouselSlide}
              onDuplicateSlide={duplicateCarouselSlide}
              onReorderSlide={reorderSlide}
            />
          )}
        </div>

        {/* RIGHT: Properties + Brand Assets (desktop only) */}
        <div className="hidden lg:flex flex-col w-[280px] shrink-0 border-l border-white/10 bg-[#0c0f24]">
          {/* Tab switcher */}
          <div className="flex border-b border-white/10 shrink-0">
            <button
              onClick={() => setRightPanelTab("properties")}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer
                ${rightPanelTab === "properties"
                  ? "text-[#4ecdc4] border-b-2 border-[#4ecdc4]"
                  : "text-[#5e6388] hover:text-[#8b8fb0]"
                }`}
            >
              Propriedades
            </button>
            <button
              onClick={() => setRightPanelTab("assets")}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer
                ${rightPanelTab === "assets"
                  ? "text-[#4ecdc4] border-b-2 border-[#4ecdc4]"
                  : "text-[#5e6388] hover:text-[#8b8fb0]"
                }`}
            >
              Materiais
            </button>
            <button
              onClick={() => setRightPanelTab("copy")}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer
                ${rightPanelTab === "copy"
                  ? "text-[#4ecdc4] border-b-2 border-[#4ecdc4]"
                  : "text-[#5e6388] hover:text-[#8b8fb0]"
                }`}
            >
              Copy
            </button>
          </div>
          {/* Tab content — scrolls independently */}
          <div className="flex-1 overflow-y-auto" data-allow-scroll>
            {rightPanelTab === "copy" ? (
              <CopyTextPanel
                copy={rawCopyContent}
                copyData={copyData}
                onApply={handleReapplyCopy}
                onGenerateLayout={handleGenerateLayout}
              />
            ) : rightPanelTab === "properties" ? (
              <PropertyPanel
                selection={selection}
                canvasRef={canvasRef}
                brandColors={
                  empresa
                    ? [empresa.cor_primaria, empresa.cor_secundaria].filter(Boolean)
                    : ["#4ecdc4", "#6c5ce7"]
                }
                isEditingText={isEditingText}
                textSelection={textSelection}
              />
            ) : (
              <BrandAssetsPanel
                canvasRef={canvasRef}
                empresaId={empresaId}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar — fixed height */}
      <EditorBottomBar
        onOpenTemplates={() => setShowGallery(true)}
        onSaveTemplate={() => setShowSaveModal(true)}
        onExport={handleExport}
        onCopyToClipboard={handleCopyToClipboard}
        onBack={handleBack}
        onCreateFromImage={() => setShowImageExtractor(true)}
        hasUnsavedChanges={state.isDirty}
        isSaving={isSavingTemplate}
        sessionId={sessionId}
      />

      {/* Template Gallery Modal */}
      <TemplateGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onSelect={handleTemplateSelect}
        onSelectPreset={handlePresetSelect}
        onSelectPsd={handlePsdSelect}
        empresaId={empresaId}
        aspectRatio={state.aspectRatio}
        brandTemplates={templates}
        onDuplicate={duplicateTemplate}
        onDelete={deleteTemplate}
        onCreateFromImage={() => {
          setShowGallery(false);
          setShowImageExtractor(true);
        }}
      />

      {/* Template from Image Modal */}
      <TemplateFromImage
        isOpen={showImageExtractor}
        onClose={() => setShowImageExtractor(false)}
        onTemplateCreated={async (template) => {
          if (template.canvas_json) {
            await loadTemplate(template.canvas_json);
            markDirty();
          }
          setShowImageExtractor(false);
        }}
        empresaId={empresaId}
        aspectRatio={state.aspectRatio}
      />

      {/* Save Template Modal */}
      <SaveTemplateModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        isSaving={isSavingTemplate}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page Export (with Suspense for useSearchParams)
   ═══════════════════════════════════════════════════════════════════════════ */

function EditorLoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#080b1e]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-[#4ecdc4]" />
        <p className="text-sm text-[#8b8fb0]">Carregando editor...</p>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorLoadingFallback />}>
      <EditorContent />
    </Suspense>
  );
}
