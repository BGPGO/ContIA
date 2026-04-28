"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { Loader2, ClipboardCopy, RefreshCw, Type, Sparkles } from "lucide-react";
import { createPost, submitPostForApproval } from "@/lib/posts";
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
import { externalizeCanvasImages, dataUrlToBlob } from "@/lib/canvas-storage";
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
   Supports two modes:
   - "update": when editing an existing template (originalTemplateId set)
   - "new": always creates a new template (asks for name)
   ═══════════════════════════════════════════════════════════════════════════ */

type SaveModalMode = "update" | "new";

function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  onSaveAsNew,
  isSaving,
  originalTemplateName,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called when saving over the existing template (update mode) or creating new without name conflict */
  onSave: (name: string) => void;
  /** Called when "Salvar como novo" is chosen — always creates a fresh template */
  onSaveAsNew: (name: string) => void;
  isSaving: boolean;
  /** When set, the modal starts in "update" mode offering to overwrite this template */
  originalTemplateName: string | null;
}) {
  const [mode, setMode] = useState<SaveModalMode>(
    originalTemplateName ? "update" : "new"
  );
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(originalTemplateName ? "update" : "new");
      setName(originalTemplateName ?? "");
      setTimeout(() => {
        if (!originalTemplateName) inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, originalTemplateName]);

  if (!isOpen) return null;

  const isUpdate = mode === "update" && !!originalTemplateName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card dark:border-white/10 border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {isUpdate ? "Salvar Template" : "Salvar como Template"}
        </h3>

        {/* Mode switcher — only visible when originalTemplate exists */}
        {originalTemplateName && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode("update")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                mode === "update"
                  ? "border-[#4ecdc4] text-[#4ecdc4] bg-[#4ecdc4]/10"
                  : "dark:border-white/10 border-border text-text-secondary hover:text-text-primary dark:hover:bg-white/5 hover:bg-bg-card-hover/60"
              }`}
            >
              Salvar (substituir)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("new");
                setName("");
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                mode === "new"
                  ? "border-[#6c5ce7] text-[#6c5ce7] bg-[#6c5ce7]/10"
                  : "dark:border-white/10 border-border text-text-secondary hover:text-text-primary dark:hover:bg-white/5 hover:bg-bg-card-hover/60"
              }`}
            >
              Salvar como novo
            </button>
          </div>
        )}

        {/* Update mode: shows current name (read-only) */}
        {isUpdate ? (
          <div className="w-full bg-bg-primary dark:border-white/10 border-border rounded-lg px-4 py-3 text-sm text-text-secondary">
            {originalTemplateName}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onSaveAsNew(name.trim());
              if (e.key === "Escape") onClose();
            }}
            placeholder="Nome do template..."
            className="w-full bg-bg-primary dark:border-white/10 border-border rounded-lg px-4 py-3 text-sm text-text-primary
              placeholder:text-text-muted focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
          />
        )}

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary
              hover:text-text-primary dark:hover:bg-white/5 hover:bg-bg-card-hover/60 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (isUpdate) {
                onSave(originalTemplateName!);
              } else if (name.trim()) {
                onSaveAsNew(name.trim());
              }
            }}
            disabled={(!isUpdate && !name.trim()) || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white
              disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-bg-card transition-all cursor-pointer"
            style={{
              background:
                isUpdate || name.trim()
                  ? "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)"
                  : undefined,
            }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin mx-4" />
            ) : isUpdate ? (
              "Salvar"
            ) : (
              "Criar template"
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
        <Type size={24} className="text-text-muted mb-2" />
        <p className="text-xs text-text-muted">Nenhuma copy carregada</p>
        <p className="text-[10px] text-text-muted/60 mt-1">Crie uma copy no Copy Studio primeiro</p>
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
            text-text-primary bg-bg-card border dark:border-white/10 border-border cursor-pointer transition-all hover:border-[#4ecdc4]/30"
        >
          <Sparkles size={12} className="text-[#4ecdc4]" />
          Gerar Layout Inteligente
        </button>
      )}

      {/* Headline */}
      {copy.headline && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Headline</label>
            <button
              onClick={() => copyToClipboard(copy.headline!, "headline")}
              className="p-1 rounded text-text-muted hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar headline"
            >
              <ClipboardCopy size={10} className={copiedField === "headline" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <p className="text-sm font-semibold text-text-primary select-all cursor-text bg-bg-primary rounded-lg px-3 py-2 dark:border-white/5 border-border">
            {copy.headline}
          </p>
        </div>
      )}

      {/* Caption */}
      {copy.caption && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Legenda</label>
            <button
              onClick={() => copyToClipboard(copy.caption!, "caption")}
              className="p-1 rounded text-text-muted hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar legenda"
            >
              <ClipboardCopy size={10} className={copiedField === "caption" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <p className="text-xs text-text-primary/80 select-all cursor-text bg-bg-primary rounded-lg px-3 py-2 dark:border-white/5 border-border whitespace-pre-line max-h-[120px] overflow-y-auto">
            {copy.caption}
          </p>
        </div>
      )}

      {/* Slides (carousel) */}
      {copy.slides && copy.slides.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Slides</label>
          {copy.slides.map((slide, i) => (
            <div key={i} className="bg-bg-primary rounded-lg px-3 py-2 dark:border-white/5 border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#4ecdc4]">Slide {slide.slideNumber || i + 1}</span>
                <button
                  onClick={() => copyToClipboard(`${slide.headline}\n\n${slide.body}`, `slide-${i}`)}
                  className="p-1 rounded text-text-muted hover:text-[#4ecdc4] cursor-pointer transition-colors"
                  title={`Copiar slide ${i + 1}`}
                >
                  <ClipboardCopy size={10} className={copiedField === `slide-${i}` ? "text-[#4ecdc4]" : ""} />
                </button>
              </div>
              <p className="text-xs font-semibold text-text-primary select-all cursor-text">{slide.headline}</p>
              <p className="text-[11px] text-text-primary/70 select-all cursor-text whitespace-pre-line">{slide.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hashtags */}
      {copy.hashtags && copy.hashtags.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Hashtags</label>
            <button
              onClick={() => copyToClipboard(copy.hashtags!.map((t: string) => `#${t.replace('#', '')}`).join(' '), "hashtags")}
              className="p-1 rounded text-text-muted hover:text-[#4ecdc4] cursor-pointer transition-colors"
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
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">CTA</label>
            <button
              onClick={() => copyToClipboard(copy.cta || '', "cta")}
              className="p-1 rounded text-text-muted hover:text-[#4ecdc4] cursor-pointer transition-colors"
              title="Copiar CTA"
            >
              <ClipboardCopy size={10} className={copiedField === "cta" ? "text-[#4ecdc4]" : ""} />
            </button>
          </div>
          <p className="text-xs font-medium text-[#6c5ce7] select-all cursor-text bg-bg-primary rounded-lg px-3 py-2 dark:border-white/5 border-border">
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
    updateTemplate,
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
  // Track if we're editing an existing template — enables update (PATCH) flow
  const [originalTemplateId, setOriginalTemplateId] = useState<string | null>(templateId);
  const [originalTemplateName, setOriginalTemplateName] = useState<string | null>(null);
  const [copyData, setCopyData] = useState<CopyToTemplatePayload | null>(null);
  const [rawCopyContent, setRawCopyContent] = useState<CopyContent | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"properties" | "assets" | "copy">("properties");
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionId);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [canvasReady, setCanvasReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "warning" | "error" } | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const showToast = useCallback((text: string, type: "success" | "warning" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

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
          // Store identity so save knows to UPDATE rather than INSERT
          if (!cancelled) {
            setOriginalTemplateId(template.id);
            setOriginalTemplateName(template.name ?? null);
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
      // Track the loaded template so save behaves as UPDATE
      setOriginalTemplateId(template.id);
      setOriginalTemplateName(template.name ?? null);
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
      // Presets are NOT existing saved templates — reset tracking so save → INSERT
      setOriginalTemplateId(null);
      setOriginalTemplateName(null);
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
      // PSD templates are presets — reset tracking so save → INSERT
      setOriginalTemplateId(null);
      setOriginalTemplateName(null);
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

  // ── Build canvas payload for save/update ──
  const buildCanvasPayload = useCallback(
    async (): Promise<{ canvasJsonToSave: unknown; thumbnail: string | null; thumbnailFailed: boolean }> => {
      const json = getCanvasJson();
      let thumbnail: string | null = null;
      let thumbnailFailed = false;
      try {
        thumbnail = exportImage({ format: "png", quality: 0.8, multiplier: 0.3 }) ?? null;
      } catch (err) {
        // Canvas tainted by a cross-origin image — save continues without thumbnail
        console.warn("[editor] toDataURL falhou (canvas tainted):", err);
        thumbnailFailed = true;
        thumbnail = null;
      }
      let canvasJsonToSave: unknown = isCarousel ? { slides, currentSlideIndex } : json;

      if (isSupabaseConfigured()) {
        const supabase = createClient();
        canvasJsonToSave = await externalizeCanvasImages(canvasJsonToSave, supabase, empresaId);
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
      return { canvasJsonToSave, thumbnail, thumbnailFailed };
    },
    [getCanvasJson, exportImage, isCarousel, slides, currentSlideIndex, empresaId]
  );

  // ── Update existing template (PATCH) ──
  const handleSaveTemplate = useCallback(
    async (_name: string) => {
      if (!originalTemplateId) {
        // No ID tracked — should not happen via UI, but guard anyway
        console.warn("[Editor] handleSaveTemplate called without originalTemplateId");
        return;
      }
      setIsSavingTemplate(true);
      try {
        const { canvasJsonToSave, thumbnail, thumbnailFailed } = await buildCanvasPayload();

        // When thumbnail generation failed (canvas tainted), omit thumbnail_url from the
        // update so the existing stored thumbnail is preserved.
        const updatePayload: Record<string, unknown> = {
          canvas_json: canvasJsonToSave as object,
          format: isCarousel ? "carousel" : "post",
          aspect_ratio: state.aspectRatio,
        };
        if (!thumbnailFailed) {
          updatePayload.thumbnail_url = thumbnail;
        }

        await updateTemplate(originalTemplateId, updatePayload as Parameters<typeof updateTemplate>[1]);

        markClean();
        setShowSaveModal(false);
        if (thumbnailFailed) {
          showToast("Template salvo, mas a miniatura não pôde ser atualizada (alguma imagem bloqueia a exportação).", "warning");
        } else {
          showToast("Template salvo com sucesso!", "success");
        }
        console.info("[Editor] Template atualizado com sucesso:", originalTemplateId);
      } catch (err) {
        console.error("[Editor] Falha ao atualizar template:", err);
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Erro ao atualizar template: ${msg}`, "error");
      } finally {
        setIsSavingTemplate(false);
      }
    },
    [originalTemplateId, buildCanvasPayload, updateTemplate, isCarousel, state.aspectRatio, markClean, showToast]
  );

  // ── Create new template (POST) — always inserts a new record ──
  const handleSaveAsNewTemplate = useCallback(
    async (name: string) => {
      setIsSavingTemplate(true);
      try {
        const { canvasJsonToSave, thumbnail, thumbnailFailed } = await buildCanvasPayload();

        const newId = await saveTemplate({
          empresa_id: empresaId,
          name,
          description: "",
          canvas_json: canvasJsonToSave as object,
          thumbnail_url: thumbnail,
          format: isCarousel ? "carousel" : "post",
          aspect_ratio: state.aspectRatio,
          source: "manual",
          tags: [],
          is_public: false,
          source_image_url: null,
          ai_prompt: null,
        });

        // Switch tracking to the newly created template
        setOriginalTemplateId(newId);
        setOriginalTemplateName(name);

        markClean();
        setShowSaveModal(false);
        if (thumbnailFailed) {
          showToast("Template criado, mas a miniatura não pôde ser gerada (alguma imagem bloqueia a exportação).", "warning");
        } else {
          showToast("Template criado com sucesso!", "success");
        }
      } catch (err) {
        console.error("[Editor] Falha ao criar template:", err);
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Falha ao salvar template: ${msg}`, "error");
      } finally {
        setIsSavingTemplate(false);
      }
    },
    [buildCanvasPayload, saveTemplate, empresaId, isCarousel, state.aspectRatio, markClean, showToast]
  );

  // ── Export / Download ──
  const handleExport = useCallback(() => {
    setShowExporter((prev) => !prev);
  }, []);

  // ── Copy to clipboard ──
  const handleCopyToClipboard = useCallback(async () => {
    try {
      let dataUrl: string | undefined;
      try {
        dataUrl = exportImage({ format: "png", quality: 1, multiplier: 2 });
      } catch (taintErr) {
        console.warn("[Editor] Clipboard toDataURL falhou (canvas tainted):", taintErr);
        showToast("Não foi possível copiar: alguma imagem bloqueia a exportação.", "warning");
        return;
      }
      if (!dataUrl) return;

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch (err) {
      console.warn("[Editor] Clipboard copy failed:", err);
    }
  }, [exportImage, showToast]);

  // ── Back navigation ──
  const handleBack = useCallback(() => {
    if (sessionId) {
      router.push("/studio");
    } else {
      router.push("/studio");
    }
  }, [router, sessionId]);

  // ── Submit canvas art for approval ──
  // Gera a imagem do canvas, faz upload para Supabase Storage e cria um post.
  // Se o canvas estiver "tainted" (imagem externa sem CORS), exibe toast de erro
  // e INTERROMPE o fluxo — não cria post sem mídia silenciosamente.
  const handleSubmitForApproval = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      showToast("O fluxo de aprovação requer conexão com Supabase.", "error");
      return;
    }
    if (!empresaId) {
      showToast("Nenhuma empresa selecionada.", "error");
      return;
    }

    setIsSubmittingApproval(true);
    try {
      // 1. Exportar imagem do canvas como data URL
      // Se o canvas estiver tainted (imagem externa sem CORS), exportImage lança exceção.
      // Nesse caso, exibimos toast de erro e INTERROMPEMOS — não criamos post sem mídia.
      let dataUrl: string | null = null;
      try {
        dataUrl = exportImage({ format: "png", quality: 0.85, multiplier: 1 }) ?? null;
      } catch (exportErr) {
        console.warn("[Editor] exportImage falhou (canvas tainted):", exportErr);
        showToast(
          "Não foi possível exportar a imagem do canvas. A imagem gerada por IA possui restrição CORS. " +
          "Use uma imagem local ou gere novamente.",
          "error"
        );
        return; // INTERROMPE — não cria post sem mídia
      }

      if (!dataUrl) {
        showToast("O canvas está vazio. Adicione algum conteúdo antes de enviar.", "error");
        return;
      }

      // 2. Fazer upload do data URL para Supabase Storage
      // Evita salvar um data URL enorme no banco (pode ter centenas de KB).
      let midiaUrl: string = dataUrl; // fallback: data URL direto
      const supabase = createClient();
      try {
        const converted = dataUrlToBlob(dataUrl);
        if (converted) {
          const storagePath = `${empresaId}/posts/${crypto.randomUUID()}.${converted.ext}`;
          const { error: uploadError } = await supabase.storage
            .from("brand-assets")
            .upload(storagePath, converted.blob, {
              contentType: converted.blob.type,
              upsert: false,
            });
          if (uploadError) {
            console.warn("[Editor] Upload da mídia falhou, usando data URL:", uploadError.message);
          } else {
            const { data: pub } = supabase.storage
              .from("brand-assets")
              .getPublicUrl(storagePath);
            if (pub?.publicUrl) {
              midiaUrl = pub.publicUrl;
              console.log("[Editor] Mídia do post salva no Storage:", midiaUrl);
            }
          }
        }
      } catch (uploadErr) {
        console.warn("[Editor] Exceção no upload da mídia, usando data URL:", uploadErr);
        // Não bloqueia — continua com data URL
      }

      // 3. Coletar dados da sessão (copy), se houver
      let titulo = originalTemplateName || "Post sem título";
      let conteudo = "";
      let tematica = "";
      let plataformas: string[] = ["instagram"];

      if (rawCopyContent) {
        titulo = rawCopyContent.headline || titulo;
        conteudo = rawCopyContent.caption || rawCopyContent.headline || "";
        tematica = rawCopyContent.headline || "";
      }

      // Buscar plataformas e tematica da copy session, se existir
      if (sessionId && isSupabaseConfigured()) {
        try {
          const { data: sessData } = await supabase
            .from("copy_sessions")
            .select("platforms, topic, current_copy")
            .eq("id", sessionId)
            .single();
          if (sessData) {
            if (sessData.platforms?.length) plataformas = sessData.platforms;
            if (sessData.topic) tematica = sessData.topic;
            if (sessData.current_copy && !rawCopyContent) {
              const cc = sessData.current_copy as { headline?: string; caption?: string };
              titulo = cc.headline || titulo;
              conteudo = cc.caption || cc.headline || "";
            }
          }
        } catch {
          // Não bloqueia o fluxo
        }
      }

      // 4. Criar o post no banco
      const post = await createPost(supabase, {
        empresa_id: empresaId,
        titulo,
        conteudo,
        midia_url: midiaUrl,
        plataformas,
        status: "rascunho",
        agendado_para: null,
        publicado_em: null,
        tematica,
      });

      // 5. Enviar para aprovação
      await submitPostForApproval(post.id);

      showToast("Post enviado para aprovação!", "success");
      setTimeout(() => router.push("/aprovacao"), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar para aprovação";
      console.error("[Editor] handleSubmitForApproval:", msg);
      showToast(`Erro: ${msg}`, "error");
    } finally {
      setIsSubmittingApproval(false);
    }
  }, [empresaId, exportImage, originalTemplateName, rawCopyContent, sessionId, router, showToast]);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary overflow-hidden" data-editor-root>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#4ecdc4]" />
            <p className="text-sm text-text-secondary">
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
        <div className="hidden lg:flex flex-col w-[250px] shrink-0 dark:border-r dark:border-white/10 border-r border-border bg-bg-secondary">
          <LayersPanel
            canvasRef={canvasRef}
            selection={selection}
          />
        </div>

        {/* CENTER: Canvas + Slide Navigator */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Canvas area — takes remaining space, centers the canvas, NO scroll */}
          <div className="flex-1 flex items-center justify-center bg-bg-primary overflow-hidden relative">
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
                  onSaveAsTemplate={(name) => handleSaveAsNewTemplate(name)}
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
        <div className="hidden lg:flex flex-col w-[280px] shrink-0 dark:border-l dark:border-white/10 border-l border-border bg-bg-secondary">
          {/* Tab switcher */}
          <div className="flex border-b dark:border-white/10 border-border shrink-0">
            <button
              onClick={() => setRightPanelTab("properties")}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer
                ${rightPanelTab === "properties"
                  ? "text-[#4ecdc4] border-b-2 border-[#4ecdc4]"
                  : "text-text-muted hover:text-text-secondary"
                }`}
            >
              Propriedades
            </button>
            <button
              onClick={() => setRightPanelTab("assets")}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer
                ${rightPanelTab === "assets"
                  ? "text-[#4ecdc4] border-b-2 border-[#4ecdc4]"
                  : "text-text-muted hover:text-text-secondary"
                }`}
            >
              Materiais
            </button>
            <button
              onClick={() => setRightPanelTab("copy")}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-all cursor-pointer
                ${rightPanelTab === "copy"
                  ? "text-[#4ecdc4] border-b-2 border-[#4ecdc4]"
                  : "text-text-muted hover:text-text-secondary"
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
        onSubmitApproval={handleSubmitForApproval}
        hasUnsavedChanges={state.isDirty}
        isSaving={isSavingTemplate}
        isSubmittingApproval={isSubmittingApproval}
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
        onSaveAsNew={handleSaveAsNewTemplate}
        isSaving={isSavingTemplate}
        originalTemplateName={originalTemplateName}
      />

      {/* Toast notifications */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl
            transition-all pointer-events-none select-none
            ${toastMsg.type === "success" ? "bg-[#4ecdc4]/20 border border-[#4ecdc4]/40 text-[#4ecdc4]" : ""}
            ${toastMsg.type === "warning" ? "bg-yellow-500/15 border border-yellow-400/30 text-yellow-300" : ""}
            ${toastMsg.type === "error" ? "bg-red-500/15 border border-red-400/30 text-red-300" : ""}
          `}
        >
          {toastMsg.text}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page Export (with Suspense for useSearchParams)
   ═══════════════════════════════════════════════════════════════════════════ */

function EditorLoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-[#4ecdc4]" />
        <p className="text-sm text-text-secondary">Carregando editor...</p>
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
