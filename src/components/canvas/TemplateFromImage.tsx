"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Upload,
  ImageIcon,
  Loader2,
  Sparkles,
  Check,
  Palette,
  Type,
  PenTool,
  ArrowRight,
  Image as ImageLucide,
  Eye,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface TemplateFromImageProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated: (template: { canvas_json: object; name: string }) => void;
  empresaId: string;
  aspectRatio?: "1:1" | "4:5" | "9:16";
}

interface ExtractionResult {
  canvas_json: {
    version: string;
    objects: Array<{
      type: string;
      text?: string;
      data?: { role?: string; originalText?: string; editable?: boolean; originalImageUrl?: string; locked?: boolean };
      [key: string]: unknown;
    }>;
    background: string;
  };
  extracted_copy: Record<string, string>;
  color_palette: string[];
  style_description: string;
  has_background_image?: boolean;
  photo_description?: string | null;
  visual_hierarchy?: string[];
  overall_style?: string | null;
  original_image_url?: string;
  photo_background_replaced?: boolean;
}

type Step = "upload" | "analyzing" | "result" | "saved";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, "application/pdf", "image/svg+xml"];

/* ═══════════════════════════════════════════════════════════════════════════
   PDF → Image conversion using pdfjs-dist (renders first page as PNG)
   ═══════════════════════════════════════════════════════════════════════════ */

async function pdfToImage(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2; // High resolution render
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

/* ═══════════════════════════════════════════════════════════════════════════
   SVG → Fabric.js direct import (preserves layers, text, shapes)
   ═══════════════════════════════════════════════════════════════════════════ */

async function processSvgFile(file: File): Promise<{
  canvasJson: ExtractionResult["canvas_json"];
  extractedText: Record<string, string>;
}> {
  const svgString = await file.text();
  const fabricModule = await import("fabric");

  // Parse SVG using Fabric.js built-in parser
  const { objects, options } = await fabricModule.loadSVGFromString(svgString);

  // Determine canvas dimensions from SVG viewBox
  const svgW = (options as any).width || 1080;
  const svgH = (options as any).height || 1080;
  const scale = 1080 / svgW;
  const canvasH = Math.round(svgH * scale);

  const extractedText: Record<string, string> = {};
  let headlineFound = false;
  let bodyCount = 0;

  const fabricObjects: any[] = [];

  for (const obj of objects) {
    if (!obj) continue;

    // Scale to 1080px base width
    obj.set({
      left: (obj.left || 0) * scale,
      top: (obj.top || 0) * scale,
      scaleX: (obj.scaleX || 1) * scale,
      scaleY: (obj.scaleY || 1) * scale,
    });

    // Assign roles to text objects (duck-type check)
    const isTextObj =
      typeof (obj as any).text === "string" &&
      typeof (obj as any).setSelectionStyles === "function";

    if (isTextObj) {
      const text = (obj as any).text || "";
      if (!headlineFound && text.length > 0 && text.length < 80) {
        (obj as any).data = { role: "headline", editable: true, id: crypto.randomUUID() };
        extractedText.headline = text;
        headlineFound = true;
      } else if (text.length > 0) {
        bodyCount++;
        const role = bodyCount === 1 ? "body" : `body_${bodyCount}`;
        (obj as any).data = { role, editable: true, id: crypto.randomUUID() };
        extractedText[role] = text;
      }
    } else {
      (obj as any).data = { role: "decoration", editable: true, id: crypto.randomUUID() };
    }

    fabricObjects.push(obj);
  }

  // Build a canvas JSON structure
  // We need a temporary StaticCanvas (no DOM needed) to serialize properly
  const tempCanvas = new fabricModule.StaticCanvas(undefined, {
    width: 1080,
    height: canvasH,
    backgroundColor: "#080b1e",
  });

  for (const obj of fabricObjects) {
    tempCanvas.add(obj);
  }

  const canvasJson = (tempCanvas as any).toJSON(["data"]) as ExtractionResult["canvas_json"];
  tempCanvas.dispose();

  return { canvasJson, extractedText };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Progress messages for the analyzing step
   ═══════════════════════════════════════════════════════════════════════════ */

const PROGRESS_MESSAGES = [
  "Analisando layout...",
  "Extraindo elementos de texto...",
  "Identificando cores e formas...",
  "Mapeando hierarquia visual...",
  "Gerando template Fabric.js...",
];

/* ═══════════════════════════════════════════════════════════════════════════
   Role labels
   ═══════════════════════════════════════════════════════════════════════════ */

const ROLE_LABELS: Record<string, string> = {
  headline: "Titulo",
  subheadline: "Subtitulo",
  body: "Corpo",
  cta: "CTA",
  brand: "Marca",
  category: "Categoria",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Mini canvas preview — renders the Fabric.js JSON as HTML/CSS
   ═══════════════════════════════════════════════════════════════════════════ */

function CanvasPreview({
  canvasJson,
  className = "",
}: {
  canvasJson: ExtractionResult["canvas_json"];
  className?: string;
}) {
  const objects = canvasJson?.objects || [];
  const bgColor = canvasJson?.background || "#151826";

  // Canvas logical size (1080x1080 for 1:1)
  const canvasW = 1080;
  const canvasH = 1080;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor, aspectRatio: "1/1" }}
    >
      {objects.map((obj, i) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${((obj.left as number) || 0) / canvasW * 100}%`,
          top: `${((obj.top as number) || 0) / canvasH * 100}%`,
        };

        if (obj.type === "Image" && obj.src) {
          return (
            <img
              key={i}
              src={obj.src as string}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ zIndex: i }}
            />
          );
        }

        if (obj.type === "Rect") {
          const w = ((obj.width as number) || 0) / canvasW * 100;
          const h = ((obj.height as number) || 0) / canvasH * 100;
          return (
            <div
              key={i}
              style={{
                ...style,
                width: `${w}%`,
                height: `${h}%`,
                backgroundColor: typeof obj.fill === "string" ? obj.fill : "#000",
                opacity: (obj.opacity as number) ?? 1,
                zIndex: i,
              }}
            />
          );
        }

        if ((obj.type === "Textbox" || obj.type === "IText" || obj.type === "FabricText" || obj.type === "Text") && obj.text) {
          const w = ((obj.width as number) || 0) / canvasW * 100;
          const fontSize = ((obj.fontSize as number) || 32) / canvasW * 100;
          return (
            <div
              key={i}
              style={{
                ...style,
                width: `${w}%`,
                fontSize: `${fontSize}vw`,
                fontWeight: (obj.fontWeight as string) || "400",
                color: (typeof obj.fill === "string" ? obj.fill : "#fff"),
                textAlign: (obj.textAlign as React.CSSProperties["textAlign"]) || "left",
                lineHeight: String(obj.lineHeight || 1.2),
                fontFamily: (obj.fontFamily as string) || "Inter, sans-serif",
                zIndex: i,
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {obj.text}
            </div>
          );
        }

        if (obj.type === "Circle") {
          const r = ((obj.radius as number) || 0) / canvasW * 100;
          return (
            <div
              key={i}
              style={{
                ...style,
                width: `${r * 2}%`,
                height: `${r * 2}%`,
                borderRadius: "50%",
                backgroundColor: typeof obj.fill === "string" ? obj.fill : "transparent",
                border: obj.stroke ? `2px solid ${obj.stroke}` : undefined,
                opacity: (obj.opacity as number) ?? 1,
                zIndex: i,
              }}
            />
          );
        }

        if (obj.type === "Line") {
          const w = ((obj.x2 as number) || 0) / canvasW * 100;
          return (
            <div
              key={i}
              style={{
                ...style,
                width: `${w}%`,
                height: `${(obj.strokeWidth as number) || 2}px`,
                backgroundColor: (obj.stroke as string) || "#4ecdc4",
                zIndex: i,
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function TemplateFromImage({
  isOpen,
  onClose,
  onTemplateCreated,
  empresaId,
  aspectRatio = "1:1",
}: TemplateFromImageProps) {
  const [step, setStep] = useState<Step>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progressIdx, setProgressIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [editedCopy, setEditedCopy] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Reset state ──
  const resetState = useCallback(() => {
    setStep("upload");
    setImagePreview(null);
    setImageFile(null);
    setResult(null);
    setTemplateName("");
    setError(null);
    setProgressIdx(0);
    setEditedCopy({});
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Initialize editedCopy when result arrives
  useEffect(() => {
    if (result?.extracted_copy) {
      setEditedCopy({ ...result.extracted_copy });
    }
  }, [result]);

  // ── Apply edited copy to canvas JSON ──
  const getCanvasJsonWithEdits = useCallback((): object => {
    if (!result) return {};
    const json = JSON.parse(JSON.stringify(result.canvas_json));
    for (const obj of json.objects || []) {
      // Handle text objects from both AI extraction (Textbox) and SVG import (IText, FabricText, etc.)
      const isTextType = obj.type && (obj.type.toLowerCase().includes("text") || obj.type === "IText");
      if (isTextType && obj.data?.role && editedCopy[obj.data.role]) {
        obj.text = editedCopy[obj.data.role];
      }
    }
    return json;
  }, [result, editedCopy]);

  // ── File handling ──
  const processFile = useCallback(async (file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato nao suportado. Use PNG, JPEG, WebP, PDF ou SVG.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Arquivo muito grande. O limite e 4MB.");
      return;
    }

    setImageFile(file);

    if (file.type === "image/svg+xml") {
      // SVG: show inline preview and mark for direct import
      const svgText = await file.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      setImagePreview(url);
      return;
    } else if (file.type === "application/pdf") {
      // Convert PDF first page to image
      try {
        const dataUrl = await pdfToImage(file);
        setImagePreview(dataUrl);
      } catch (err) {
        console.error("PDF render error:", err);
        setError("Nao foi possivel processar o PDF. Tente exportar como imagem.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Drag & drop ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Extract template ──
  const handleExtract = useCallback(async () => {
    if (!imagePreview) return;

    // SVG: direct import without AI — much faster and preserves layers
    if (imageFile?.type === "image/svg+xml") {
      setStep("analyzing");
      setError(null);
      setProgressIdx(0);
      try {
        const { canvasJson, extractedText } = await processSvgFile(imageFile);
        setResult({
          canvas_json: canvasJson,
          extracted_copy: extractedText,
          color_palette: [],
          style_description: "Importado de SVG — textos e camadas preservados",
          has_background_image: false,
          photo_description: null,
          visual_hierarchy: Object.keys(extractedText),
          overall_style: null,
        });
        setTemplateName(`Template SVG - ${new Date().toLocaleDateString("pt-BR")}`);
        setStep("result");
      } catch (err: any) {
        console.error("SVG import error:", err);
        setError("Nao foi possivel processar o SVG. Verifique se o arquivo e valido.");
        setStep("upload");
      }
      return;
    }

    setStep("analyzing");
    setError(null);
    setProgressIdx(0);

    // Animate progress messages
    let idx = 0;
    progressIntervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PROGRESS_MESSAGES.length - 1);
      setProgressIdx(idx);
    }, 2000);

    try {
      const res = await fetch("/api/ai/extract-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imagePreview,
          empresa_id: empresaId,
          context: {
            format: aspectRatio === "9:16" ? "story" : "post",
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const data: ExtractionResult = await res.json();
      setResult(data);
      setTemplateName(`Template extraido - ${new Date().toLocaleDateString("pt-BR")}`);
      setStep("result");
    } catch (err: any) {
      setError(err.message || "Falha ao extrair template. Tente novamente.");
      setStep("upload");
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [imagePreview, imageFile, empresaId, aspectRatio]);

  // ── Save / Use template ──
  const handleUseInEditor = useCallback(() => {
    if (!result) return;
    onTemplateCreated({
      canvas_json: getCanvasJsonWithEdits(),
      name: templateName || "Template extraido",
    });
    handleClose();
  }, [result, templateName, getCanvasJsonWithEdits, onTemplateCreated, handleClose]);

  const handleSaveTemplate = useCallback(() => {
    if (!result) return;
    onTemplateCreated({
      canvas_json: getCanvasJsonWithEdits(),
      name: templateName || "Template extraido",
    });
    setStep("saved");
  }, [result, templateName, getCanvasJsonWithEdits, onTemplateCreated]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0c0f24] border border-white/10 rounded-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#6c5ce7]/20 to-[#4ecdc4]/20">
              <Sparkles size={20} className="text-[#4ecdc4]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#e8eaff]">
                Criar Template de Imagem
              </h2>
              <p className="text-xs text-[#5e6388]">
                Envie uma imagem e a IA extrai o layout automaticamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-[#5e6388] hover:text-[#e8eaff] hover:bg-white/5 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* ── Step: Upload ── */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                  ${isDragging
                    ? "border-[#4ecdc4] bg-[#4ecdc4]/5"
                    : imagePreview
                      ? "border-[#4ecdc4]/30 bg-[#141736]"
                      : "border-white/20 hover:border-[#4ecdc4]/50 hover:bg-white/[0.02]"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={[...ACCEPTED_IMAGE_TYPES, ".pdf", ".svg", "image/svg+xml"].join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-64 h-64 rounded-xl overflow-hidden border border-white/10">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-contain bg-black/20"
                      />
                    </div>
                    <p className="text-sm text-[#8b8fb0]">
                      {imageFile?.name} ({((imageFile?.size || 0) / 1024).toFixed(0)} KB)
                    </p>
                    <p className="text-xs text-[#5e6388]">
                      Clique para trocar a imagem
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-2xl bg-white/5">
                      <Upload size={32} className="text-[#5e6388]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#e8eaff]">
                        Arraste uma imagem aqui ou clique para selecionar
                      </p>
                      <p className="text-xs text-[#5e6388] mt-1">
                        PNG, JPEG, WebP, PDF ou SVG - Maximo 4MB
                      </p>
                      <p className="text-xs text-[#4ecdc4]/70 mt-1">
                        Dica: Exporte do Canva como SVG para manter textos e camadas editaveis
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Extract button */}
              {imagePreview && (
                <div className="flex flex-col items-end gap-2">
                  {imageFile?.type === "image/svg+xml" && (
                    <p className="text-xs text-[#4ecdc4]">
                      SVG detectado — importacao direta sem IA, preservando todas as camadas
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleExtract}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white
                      transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4ecdc4]/20 active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
                    }}
                  >
                    <Sparkles size={16} />
                    {imageFile?.type === "image/svg+xml" ? "Importar SVG" : "Analisar imagem"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step: Analyzing ── */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-8">
              {/* Image with scanning effect */}
              <div className="relative">
                {imagePreview && (
                  <div className="relative w-64 h-64 rounded-xl overflow-hidden border border-white/10">
                    <img
                      src={imagePreview}
                      alt="Analisando"
                      className="w-full h-full object-contain"
                    />
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#4ecdc4]/20 via-transparent to-transparent animate-pulse" />
                    <div
                      className="absolute left-0 right-0 h-1 bg-[#4ecdc4]/60"
                      style={{
                        animation: "scan 2s ease-in-out infinite",
                        top: "0%",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Progress */}
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-[#4ecdc4]" />
                <p className="text-sm font-medium text-[#e8eaff]">
                  {PROGRESS_MESSAGES[progressIdx]}
                </p>
                <div className="flex gap-1.5">
                  {PROGRESS_MESSAGES.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-500 ${
                        i <= progressIdx ? "bg-[#4ecdc4]" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <style jsx>{`
                @keyframes scan {
                  0%, 100% { top: 0%; }
                  50% { top: 95%; }
                }
              `}</style>
            </div>
          )}

          {/* ── Step: Result ── */}
          {step === "result" && result && (
            <div className="space-y-6">
              {/* Split view: Original vs Generated */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Original */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#8b8fb0] flex items-center gap-2">
                    <ImageIcon size={14} />
                    Imagem original
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20 aspect-square flex items-center justify-center">
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>

                {/* Right: Canvas preview */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#8b8fb0] flex items-center gap-2">
                    <Eye size={14} />
                    Preview do template
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-[#4ecdc4]/20 bg-[#141736] aspect-square">
                    <CanvasPreview
                      canvasJson={result.canvas_json}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Background image badge — photo preserved */}
              {result.has_background_image && !result.photo_background_replaced && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#4ecdc4]/5 border border-[#4ecdc4]/20">
                  <ImageLucide size={16} className="text-[#4ecdc4] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#e8eaff]">
                      Imagem de fundo preservada
                    </p>
                    {result.photo_description && (
                      <p className="text-xs text-[#5e6388] mt-0.5">
                        {result.photo_description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Background replaced notice — photo had text overlay */}
              {result.photo_background_replaced && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <ImageLucide size={16} className="text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#e8eaff]">
                      Fundo substituido por cor dominante
                    </p>
                    <p className="text-xs text-[#5e6388] mt-0.5">
                      A imagem original continha texto sobre uma foto. Usamos a cor dominante como fundo para evitar sobreposicao de texto. Voce pode restaurar a foto original no editor.
                    </p>
                    {result.photo_description && (
                      <p className="text-xs text-[#8b8fb0] mt-1 italic">
                        Foto: {result.photo_description}
                      </p>
                    )}
                  </div>
                  {result.original_image_url && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!result.original_image_url) return;
                        // Replace the background rect with the original image in canvas_json
                        const json = result.canvas_json;
                        const bgIdx = json.objects.findIndex(
                          (o) => o.data?.role === "background" && o.data?.originalImageUrl
                        );
                        if (bgIdx >= 0) {
                          json.objects[bgIdx] = {
                            type: "Image",
                            src: result.original_image_url,
                            left: 0,
                            top: 0,
                            width: 1080,
                            height: 1080,
                            scaleX: 1,
                            scaleY: 1,
                            selectable: false,
                            evented: false,
                            data: { role: "background-image", editable: false, locked: true },
                          };
                        }
                        setResult({
                          ...result,
                          has_background_image: true,
                          photo_background_replaced: false,
                        });
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300
                        bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20
                        transition-all cursor-pointer"
                    >
                      Usar foto original
                    </button>
                  )}
                </div>
              )}

              {/* SVG success badge */}
              {result.style_description?.includes("SVG") && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#4ecdc4]/5 border border-[#4ecdc4]/20">
                  <Check size={16} className="text-[#4ecdc4] shrink-0" />
                  <p className="text-sm font-medium text-[#e8eaff]">
                    SVG importado com sucesso! Todos os elementos foram preservados como camadas editaveis.
                  </p>
                </div>
              )}

              {/* Style description */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                <PenTool size={14} className="text-[#6c5ce7] shrink-0" />
                <p className="text-sm text-[#c0c4e0]">{result.style_description}</p>
                <span className="text-xs text-[#5e6388] ml-auto shrink-0">
                  {(result.canvas_json as any)?.objects?.length || 0} objetos
                </span>
              </div>

              {/* Color palette */}
              {result.color_palette.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#8b8fb0] flex items-center gap-2">
                    <Palette size={14} />
                    Paleta de cores extraida
                  </h3>
                  <div className="flex gap-3">
                    {result.color_palette.map((color, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-12 h-12 rounded-xl border border-white/10 shadow-lg"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[10px] text-[#5e6388] font-mono">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted copy — EDITABLE */}
              {Object.keys(editedCopy).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#8b8fb0] flex items-center gap-2">
                    <Type size={14} />
                    Texto extraido
                    <span className="text-[10px] text-[#5e6388] font-normal ml-1">
                      (edite antes de salvar)
                    </span>
                  </h3>
                  <div className="grid gap-2">
                    {Object.entries(editedCopy).map(([role, text]) => (
                      <div
                        key={role}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-1 rounded shrink-0 mt-1">
                          {ROLE_LABELS[role] || role}
                        </span>
                        <input
                          type="text"
                          value={text}
                          onChange={(e) =>
                            setEditedCopy((prev) => ({
                              ...prev,
                              [role]: e.target.value,
                            }))
                          }
                          className="flex-1 bg-[#141736] border border-white/10 rounded px-3 py-1.5 text-sm text-[#e8eaff]
                            focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Template name + actions */}
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div>
                  <label className="text-xs text-[#5e6388] mb-1.5 block">
                    Nome do template
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nome do template..."
                    className="w-full bg-[#080b1e] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#e8eaff]
                      placeholder:text-[#5e6388] focus:outline-none focus:border-[#4ecdc4]/40 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("upload");
                      setResult(null);
                      setEditedCopy({});
                    }}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#8b8fb0]
                      hover:text-[#e8eaff] hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Tentar outra imagem
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#e8eaff]
                        bg-[#141736] border border-white/10 hover:border-[#6c5ce7]/30
                        transition-all cursor-pointer"
                    >
                      Salvar Template
                    </button>
                    <button
                      type="button"
                      onClick={handleUseInEditor}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                        transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4ecdc4]/20 active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
                      }}
                    >
                      Ajustar no Editor
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Saved ── */}
          {step === "saved" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="p-4 rounded-2xl bg-[#4ecdc4]/10">
                <Check size={40} className="text-[#4ecdc4]" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-[#e8eaff]">
                  Template salvo!
                </h3>
                <p className="text-sm text-[#5e6388]">
                  O template &quot;{templateName}&quot; foi criado com sucesso.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#8b8fb0]
                    hover:text-[#e8eaff] hover:bg-white/5 transition-all cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleUseInEditor}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                    transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4ecdc4]/20 active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
                  }}
                >
                  Abrir no Editor
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
