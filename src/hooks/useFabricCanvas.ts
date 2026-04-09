"use client";

import { useRef, useState, useCallback } from "react";
import type {
  FabricCanvasRef,
  SelectionInfo,
} from "@/components/canvas/FabricCanvas";
import type {
  CanvasEditorState,
  ExportOptions,
  CopyToTemplatePayload,
  CanvasElementRole,
} from "@/types/canvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UseFabricCanvasReturn {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  state: CanvasEditorState;

  // Template operations
  loadTemplate: (canvasJson: object) => Promise<void>;
  loadPreset: (presetId: string, aspectRatio: string) => Promise<void>;
  applyCopy: (copy: CopyToTemplatePayload) => void;

  // Aspect ratio
  setAspectRatio: (ratio: "1:1" | "4:5" | "9:16") => void;

  // Export
  exportImage: (options?: ExportOptions) => string;

  // Save
  getCanvasJson: () => object;

  // Selection bridging
  selection: SelectionInfo | null;
  setSelection: (sel: SelectionInfo | null) => void;

  // State mutations
  markDirty: () => void;
  markClean: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Preset template definitions (Fabric JSON generators)
   ═══════════════════════════════════════════════════════════════════════════ */

const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

function generatePresetJson(
  presetId: string,
  aspectRatio: string
): object {
  const dims = ASPECT_DIMS[aspectRatio] || ASPECT_DIMS["1:1"];
  const w = dims.w;
  const h = dims.h;

  // Shared base with background
  const base = {
    version: "6.0.0",
    objects: [] as object[],
    background: "#080b1e",
  };

  const makeText = (
    text: string,
    role: CanvasElementRole,
    opts: Record<string, any>
  ) => ({
    type: "Textbox",
    left: opts.left ?? w * 0.1,
    top: opts.top ?? h * 0.3,
    width: opts.width ?? w * 0.8,
    text,
    fontSize: opts.fontSize ?? 48,
    fontFamily: opts.fontFamily ?? "Plus Jakarta Sans",
    fontWeight: opts.fontWeight ?? "bold",
    fill: opts.fill ?? "#e8eaff",
    textAlign: opts.textAlign ?? "center",
    data: { id: crypto.randomUUID(), role, editable: true },
    ...opts,
  });

  const makeRect = (opts: Record<string, any>) => ({
    type: "Rect",
    left: opts.left ?? 0,
    top: opts.top ?? 0,
    width: opts.width ?? w,
    height: opts.height ?? h,
    fill: opts.fill ?? "#4ecdc4",
    rx: opts.rx ?? 0,
    ry: opts.ry ?? 0,
    selectable: opts.selectable ?? false,
    data: {
      id: crypto.randomUUID(),
      role: opts.role ?? "decoration",
      editable: false,
    },
    ...opts,
  });

  switch (presetId) {
    case "bold-statement":
      base.background = "#080b1e";
      base.objects = [
        makeRect({ fill: "#4ecdc4", height: 6, top: h * 0.15, left: w * 0.35, width: w * 0.3, role: "decoration" }),
        makeText("HEADLINE AQUI", "headline", { top: h * 0.25, fontSize: 72, fontWeight: "900" }),
        makeText("Subtitulo do post", "subheadline", { top: h * 0.55, fontSize: 32, fontWeight: "400", fill: "#5e6388" }),
        makeText("@marca", "brand", { top: h * 0.85, fontSize: 24, fill: "#4ecdc4" }),
      ];
      break;

    case "gradient-wave":
      base.background = "#080b1e";
      base.objects = [
        makeRect({ fill: "rgba(108, 92, 231, 0.3)", height: h * 0.5, top: h * 0.5, role: "background" }),
        makeRect({ fill: "rgba(78, 205, 196, 0.2)", height: h * 0.3, top: h * 0.7, role: "background" }),
        makeText("Titulo Gradiente", "headline", { top: h * 0.2, fontSize: 64, fontWeight: "800" }),
        makeText("Texto complementar aqui", "body", { top: h * 0.5, fontSize: 28, fill: "#c0c4e8" }),
      ];
      break;

    case "minimal-clean":
      base.background = "#ffffff";
      base.objects = [
        makeText("Titulo Limpo", "headline", { top: h * 0.35, fontSize: 56, fontWeight: "700", fill: "#1a1a2e" }),
        makeText("Descricao minimalista", "subheadline", { top: h * 0.55, fontSize: 24, fontWeight: "400", fill: "#666680" }),
        makeRect({ fill: "#4ecdc4", height: 4, top: h * 0.75, left: w * 0.4, width: w * 0.2, role: "decoration" }),
      ];
      break;

    case "quote-card":
      base.background = "#0c0f24";
      base.objects = [
        makeText("\u201C", "decoration", { top: h * 0.1, left: w * 0.08, fontSize: 180, fill: "#4ecdc4", fontWeight: "400", textAlign: "left" }),
        makeText("Sua frase inspiradora aqui", "headline", { top: h * 0.3, fontSize: 44, fontWeight: "600", textAlign: "left", left: w * 0.1, width: w * 0.8 }),
        makeRect({ fill: "#4ecdc4", height: 3, top: h * 0.7, left: w * 0.1, width: w * 0.15, role: "decoration" }),
        makeText("— Autor", "brand", { top: h * 0.75, fontSize: 22, fill: "#5e6388", textAlign: "left", left: w * 0.1 }),
      ];
      break;

    case "tip-numbered":
      base.background = "#080b1e";
      base.objects = [
        makeText("01", "slide-number", { top: h * 0.08, left: w * 0.1, fontSize: 120, fontWeight: "900", fill: "#4ecdc4", textAlign: "left", width: w * 0.3 }),
        makeText("DICA", "category", { top: h * 0.1, left: w * 0.55, fontSize: 20, fill: "#6c5ce7", fontWeight: "700", textAlign: "left", width: w * 0.35 }),
        makeRect({ fill: "#4ecdc4", height: 3, top: h * 0.35, left: w * 0.1, width: w * 0.8, role: "decoration" }),
        makeText("Titulo da dica", "headline", { top: h * 0.4, fontSize: 48, fontWeight: "700", textAlign: "left", left: w * 0.1, width: w * 0.8 }),
        makeText("Descricao detalhada da dica que voce quer compartilhar com sua audiencia.", "body", { top: h * 0.6, fontSize: 24, fontWeight: "400", fill: "#8b8fb8", textAlign: "left", left: w * 0.1, width: w * 0.8 }),
      ];
      break;

    case "stats-highlight":
      base.background = "#080b1e";
      base.objects = [
        makeText("87%", "headline", { top: h * 0.2, fontSize: 140, fontWeight: "900", fill: "#4ecdc4" }),
        makeText("dos profissionais concordam", "subheadline", { top: h * 0.55, fontSize: 32, fontWeight: "500" }),
        makeRect({ fill: "#6c5ce7", height: 4, top: h * 0.72, left: w * 0.3, width: w * 0.4, role: "decoration" }),
        makeText("Fonte: Pesquisa 2026", "body", { top: h * 0.8, fontSize: 18, fill: "#5e6388" }),
      ];
      break;

    case "split-content":
      base.background = "#080b1e";
      base.objects = [
        makeRect({ fill: "#4ecdc4", width: w * 0.4, height: h, left: 0, role: "background" }),
        makeText("TITULO", "headline", { top: h * 0.3, left: w * 0.05, width: w * 0.3, fontSize: 48, fontWeight: "900", fill: "#080b1e", textAlign: "left" }),
        makeText("Conteudo do lado direito com mais detalhes sobre o assunto.", "body", { top: h * 0.3, left: w * 0.48, width: w * 0.45, fontSize: 28, fontWeight: "400", fill: "#c0c4e8", textAlign: "left" }),
        makeText("@marca", "brand", { top: h * 0.85, left: w * 0.48, fontSize: 20, fill: "#5e6388", textAlign: "left" }),
      ];
      break;

    case "carousel-slide":
      base.background = "#0c0f24";
      base.objects = [
        makeRect({ fill: "#141736", width: w, height: 80, top: 0, role: "decoration" }),
        makeText("NOME DA SERIE", "category", { top: 25, fontSize: 18, fill: "#4ecdc4", fontWeight: "700" }),
        makeText("Titulo do Slide", "headline", { top: h * 0.25, fontSize: 56, fontWeight: "800" }),
        makeText("Conteudo principal do slide do carrossel.", "body", { top: h * 0.55, fontSize: 26, fill: "#8b8fb8" }),
        makeRect({ fill: "#141736", width: w, height: 80, top: h - 80, role: "decoration" }),
        makeText("1/5", "slide-number", { top: h - 55, fontSize: 20, fill: "#5e6388" }),
      ];
      break;

    case "editorial":
      base.background = "#0c0f24";
      base.objects = [
        makeRect({ fill: "#4ecdc4", width: 4, height: h * 0.6, left: w * 0.08, top: h * 0.2, role: "decoration" }),
        makeText("Editorial", "category", { top: h * 0.12, left: w * 0.13, fontSize: 16, fill: "#6c5ce7", fontWeight: "600", textAlign: "left", width: w * 0.8 }),
        makeText("Titulo do artigo editorial aqui", "headline", { top: h * 0.22, left: w * 0.13, width: w * 0.75, fontSize: 44, fontWeight: "700", textAlign: "left" }),
        makeText("Paragrafo com o conteudo principal do editorial. Aqui voce escreve o texto completo.", "body", { top: h * 0.5, left: w * 0.13, width: w * 0.75, fontSize: 22, fontWeight: "400", fill: "#8b8fb8", textAlign: "left" }),
        makeText("Leia mais →", "cta", { top: h * 0.82, left: w * 0.13, fontSize: 20, fill: "#4ecdc4", fontWeight: "600", textAlign: "left" }),
      ];
      break;

    case "tweet-quote":
      base.background = "#0c0f24";
      base.objects = [
        makeRect({ fill: "#141736", width: w * 0.85, height: h * 0.6, left: w * 0.075, top: h * 0.2, rx: 16, ry: 16, role: "decoration" }),
        makeText("Tweet ou frase que voce quer destacar no seu feed.", "headline", { top: h * 0.32, left: w * 0.12, width: w * 0.76, fontSize: 36, fontWeight: "500", textAlign: "left" }),
        makeRect({ fill: "#4ecdc4", height: 3, top: h * 0.65, left: w * 0.12, width: w * 0.2, role: "decoration" }),
        makeText("@usuario • 10h", "brand", { top: h * 0.7, left: w * 0.12, fontSize: 18, fill: "#5e6388", textAlign: "left" }),
      ];
      break;

    case "vitor-thread":
      base.background = "#080b1e";
      base.objects = [
        makeRect({ fill: "#6c5ce7", width: w * 0.15, height: h, left: 0, role: "background" }),
        makeText("01", "slide-number", { top: h * 0.35, left: w * 0.02, width: w * 0.11, fontSize: 64, fontWeight: "900", fill: "#ffffff" }),
        makeText("Titulo da Thread", "headline", { top: h * 0.15, left: w * 0.2, width: w * 0.72, fontSize: 48, fontWeight: "800", textAlign: "left" }),
        makeText("Conteudo detalhado da thread. Aqui voce desenvolve o argumento principal.", "body", { top: h * 0.45, left: w * 0.2, width: w * 0.72, fontSize: 24, fill: "#8b8fb8", textAlign: "left" }),
        makeText("Salve para depois →", "cta", { top: h * 0.82, left: w * 0.2, fontSize: 20, fill: "#4ecdc4", fontWeight: "600", textAlign: "left" }),
      ];
      break;

    case "vitor-quote":
      base.background = "#080b1e";
      base.objects = [
        makeRect({ fill: "#6c5ce7", width: w, height: h * 0.08, top: 0, role: "decoration" }),
        makeRect({ fill: "#6c5ce7", width: w, height: h * 0.08, top: h * 0.92, role: "decoration" }),
        makeText("\u201C", "decoration", { top: h * 0.12, fontSize: 160, fill: "#6c5ce7", fontWeight: "400" }),
        makeText("Frase impactante que fica na mente do seguidor.", "headline", { top: h * 0.35, fontSize: 42, fontWeight: "600" }),
        makeRect({ fill: "#4ecdc4", height: 3, top: h * 0.7, left: w * 0.35, width: w * 0.3, role: "decoration" }),
        makeText("NOME DO AUTOR", "brand", { top: h * 0.76, fontSize: 20, fill: "#4ecdc4", fontWeight: "700" }),
        makeText("Cargo ou descricao", "subheadline", { top: h * 0.82, fontSize: 16, fill: "#5e6388" }),
      ];
      break;

    default:
      // Fallback: simple text on dark bg
      base.objects = [
        makeText("Template", "headline", { top: h * 0.35, fontSize: 56 }),
      ];
  }

  return base;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook
   ═══════════════════════════════════════════════════════════════════════════ */

export function useFabricCanvas(): UseFabricCanvasReturn {
  const canvasRef = useRef<FabricCanvasRef | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [state, setState] = useState<CanvasEditorState>({
    selectedObjectId: null,
    selectedObjectType: null,
    selectedObjectRole: null,
    zoom: 1,
    aspectRatio: "1:1",
    isDirty: false,
    canUndo: false,
    canRedo: false,
  });

  // ── Load a template from Fabric JSON ──
  const loadTemplate = useCallback(async (canvasJson: object) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await canvas.loadFromJSON(canvasJson);
    setState((prev) => ({ ...prev, isDirty: false }));
  }, []);

  // ── Load a preset template by ID ──
  const loadPreset = useCallback(
    async (presetId: string, aspectRatio: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const json = generatePresetJson(presetId, aspectRatio);
      await canvas.loadFromJSON(json);
      setState((prev) => ({
        ...prev,
        aspectRatio: aspectRatio as "1:1" | "4:5" | "9:16",
        isDirty: false,
      }));
    },
    []
  );

  // ── Apply copy text to current canvas elements by role ──
  const applyCopy = useCallback((copy: CopyToTemplatePayload) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fabricCanvas = canvas.getCanvas();
    if (!fabricCanvas) return;

    const objects = fabricCanvas.getObjects();
    const roleMap: Record<string, string> = {
      headline: copy.headline,
      ...(copy.subheadline && { subheadline: copy.subheadline }),
      ...(copy.body && { body: copy.body }),
      ...(copy.cta && { cta: copy.cta }),
      ...(copy.brandName && { brand: copy.brandName }),
      ...(copy.category && { category: copy.category }),
      ...(copy.hashtags?.length && { hashtags: copy.hashtags.join(" ") }),
    };

    if (copy.slideNumber !== undefined) {
      roleMap["slide-number"] =
        copy.totalSlides
          ? `${copy.slideNumber}/${copy.totalSlides}`
          : String(copy.slideNumber);
    }

    for (const obj of objects) {
      const role = (obj as any).data?.role;
      if (role && roleMap[role] && (obj as any).set) {
        (obj as any).set({ text: roleMap[role] });
      }
    }

    fabricCanvas.renderAll();
    setState((prev) => ({ ...prev, isDirty: true }));
  }, []);

  // ── Set aspect ratio ──
  const setAspectRatio = useCallback(
    (ratio: "1:1" | "4:5" | "9:16") => {
      setState((prev) => ({ ...prev, aspectRatio: ratio }));
    },
    []
  );

  // ── Export image ──
  const exportImage = useCallback(
    (options?: ExportOptions): string => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      return canvas.toDataURL({
        format: options?.format || "png",
        quality: options?.quality || 1,
        multiplier: options?.multiplier || 1,
      });
    },
    []
  );

  // ── Get canvas JSON ──
  const getCanvasJson = useCallback((): object => {
    const canvas = canvasRef.current;
    if (!canvas) return {};
    return canvas.toJSON();
  }, []);

  // ── Dirty tracking ──
  const markDirty = useCallback(() => {
    setState((prev) => ({ ...prev, isDirty: true }));
  }, []);

  const markClean = useCallback(() => {
    setState((prev) => ({ ...prev, isDirty: false }));
  }, []);

  return {
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
  };
}
