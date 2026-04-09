"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { Loader2 } from "lucide-react";
import { FabricCanvas } from "@/components/canvas/FabricCanvas";
import type { FabricCanvasRef, SelectionInfo } from "@/components/canvas/FabricCanvas";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { PropertyPanel } from "@/components/canvas/PropertyPanel";
import { TemplateGallery } from "@/components/canvas/TemplateGallery";
import { CanvasExporter } from "@/components/canvas/CanvasExporter";
import { EditorBottomBar } from "@/components/canvas/EditorBottomBar";
import { TemplateFromImage } from "@/components/canvas/TemplateFromImage";
import { useFabricCanvas } from "@/hooks/useFabricCanvas";
import { useVisualTemplates } from "@/hooks/useVisualTemplates";
import { useEmpresa } from "@/hooks/useEmpresa";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import type { VisualTemplate, CopyToTemplatePayload } from "@/types/canvas";
import { CANVAS_DIMENSIONS } from "@/types/canvas";
import type { CopyContent } from "@/types/copy-studio";

/* ═══════════════════════════════════════════════════════════════════════════
   Helper: Convert CopyContent → CopyToTemplatePayload
   ═══════════════════════════════════════════════════════════════════════════ */

function copyToCopyPayload(copy: CopyContent): CopyToTemplatePayload {
  return {
    headline: copy.headline,
    subheadline: undefined,
    body: copy.caption,
    cta: copy.cta || undefined,
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
  } = useFabricCanvas();

  const {
    templates,
    saveTemplate,
    deleteTemplate,
    duplicateTemplate,
  } = useVisualTemplates(empresaId || undefined);

  const [showGallery, setShowGallery] = useState(!templateId);
  const [showImageExtractor, setShowImageExtractor] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [copyData, setCopyData] = useState<CopyToTemplatePayload | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionId);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [canvasReady, setCanvasReady] = useState(false);

  // ── Canvas dimensions based on aspect ratio ──
  const dims = CANVAS_DIMENSIONS[state.aspectRatio] || CANVAS_DIMENSIONS["1:1"];

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
          const payload = copyToCopyPayload(data.current_copy as CopyContent);
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
  }, [sessionId]);

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
        }
      } catch (err) {
        console.warn("[Editor] Error loading template:", err);
      } finally {
        if (!cancelled) setIsLoadingTemplate(false);
      }
    }

    loadTemplateFromId();
    return () => { cancelled = true; };
  }, [templateId, canvasReady, loadTemplate, setAspectRatio]);

  // ── Handle template selection from gallery ──
  const handleTemplateSelect = useCallback(
    async (template: VisualTemplate) => {
      if (template.canvas_json) {
        await loadTemplate(template.canvas_json);
        if (template.aspect_ratio) {
          setAspectRatio(template.aspect_ratio as "1:1" | "4:5" | "9:16");
        }
      }
      if (copyData) applyCopy(copyData);
      setShowGallery(false);
    },
    [loadTemplate, setAspectRatio, applyCopy, copyData]
  );

  // ── Handle preset selection ──
  const handlePresetSelect = useCallback(
    async (presetId: string) => {
      await loadPreset(presetId, state.aspectRatio);
      if (copyData) applyCopy(copyData);
      setShowGallery(false);
    },
    [loadPreset, state.aspectRatio, applyCopy, copyData]
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
        const thumbnail = exportImage({ format: "png", quality: 0.8, multiplier: 0.3 });

        await saveTemplate({
          empresa_id: empresaId,
          name,
          description: "",
          canvas_json: json,
          thumbnail_url: thumbnail || null,
          format: "post",
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
      } finally {
        setIsSavingTemplate(false);
      }
    },
    [getCanvasJson, exportImage, saveTemplate, empresaId, state.aspectRatio, markClean]
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

  // ── Determine if loading ──
  const isLoading = isLoadingSession || isLoadingTemplate;

  return (
    <div className="h-screen flex flex-col bg-[#080b1e] overflow-hidden">
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

      {/* Toolbar */}
      <CanvasToolbar
        selection={selection}
        canvasRef={canvasRef}
        aspectRatio={state.aspectRatio}
        onAspectRatioChange={handleAspectRatioChange}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
      />

      {/* Main area: Canvas + Property Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-4 bg-[#080b1e] relative overflow-auto">
          <div
            className="relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden"
            style={{
              width: Math.min(dims.width * 0.5, 540),
              height: Math.min(dims.height * 0.5, 960),
            }}
          >
            <FabricCanvas
              ref={canvasRef}
              width={dims.width}
              height={dims.height}
              aspectRatio={state.aspectRatio}
              onSelectionChange={setSelection}
              onCanvasChange={markDirty}
              onReady={handleCanvasReady}
            />
          </div>

          {/* Exporter popover */}
          {showExporter && (
            <div className="absolute bottom-4 right-4 z-30">
              <CanvasExporter
                canvasRef={canvasRef}
                isVisible={showExporter}
                postTitle="post"
                onSaveAsTemplate={(name) => handleSaveTemplate(name)}
              />
            </div>
          )}
        </div>

        {/* Property Panel (desktop) */}
        <div className="hidden lg:block w-[280px] shrink-0 border-l border-white/10 bg-[#0c0f24] overflow-y-auto">
          <PropertyPanel
            selection={selection}
            canvasRef={canvasRef}
            brandColors={
              empresa
                ? [empresa.cor_primaria, empresa.cor_secundaria].filter(Boolean)
                : ["#4ecdc4", "#6c5ce7"]
            }
          />
        </div>
      </div>

      {/* Bottom Bar */}
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
