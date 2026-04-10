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
} from "@/types/canvas";
import { generatePresetJson } from "@/lib/preset-templates";

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

  // Carousel / multi-slide
  slides: object[];
  currentSlideIndex: number;
  isCarousel: boolean;
  slideThumbnails: string[];
  switchSlide: (index: number) => void;
  addSlide: () => void;
  deleteSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  reorderSlide: (from: number, to: number) => void;
  loadCarousel: (slideJsons: object[]) => Promise<void>;
  exportAllSlides: (options?: ExportOptions) => string[];
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

  // ── Multi-slide / carousel state ──
  const [slides, setSlides] = useState<object[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideThumbnails, setSlideThumbnails] = useState<string[]>([]);
  const isCarousel = slides.length > 1;

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

  // ── Helper: auto-fit text by reducing font size if it overflows container ──
  const autoFitText = (obj: any) => {
    const origFontSize = obj.fontSize || 40;
    const containerWidth = obj.width;
    const containerHeight = obj.height;
    if (containerWidth && containerWidth > 0 && typeof obj.initDimensions === 'function') {
      obj.dirty = true;
      obj.initDimensions();
      const maxH = containerHeight && containerHeight > 0 ? containerHeight : origFontSize * 3;
      let textHeight = obj.calcTextHeight?.() ?? obj._getTextHeight?.() ?? obj.height ?? 0;
      let fs = origFontSize;
      const minFs = Math.max(12, origFontSize * 0.5);
      while (textHeight > maxH * 1.1 && fs > minFs) {
        fs -= 2;
        obj.set({ fontSize: fs });
        obj.dirty = true;
        obj.initDimensions();
        textHeight = obj.calcTextHeight?.() ?? obj._getTextHeight?.() ?? obj.height ?? 0;
      }
    }
    obj.dirty = true;
  };

  // ── Apply copy text to current canvas elements by role ──
  const applyCopy = useCallback((copy: CopyToTemplatePayload) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fabricCanvas = canvas.getCanvas();
    if (!fabricCanvas) return;

    const objects = fabricCanvas.getObjects();

    // Build role map with all copy fields (lowercased keys for case-insensitive matching)
    const roleMap: Record<string, string | undefined> = {
      headline: copy.headline,
      subheadline: copy.subheadline,
      body: copy.body,
      cta: copy.cta,
      brand: copy.brandName,
      category: copy.category,
      hashtags: copy.hashtags?.join(" "),
    };

    if (copy.slideNumber !== undefined) {
      roleMap["slide-number"] = copy.totalSlides
        ? `${copy.slideNumber}/${copy.totalSlides}`
        : String(copy.slideNumber);
    }

    // Debug: log what roles the canvas has vs what copy provides
    const canvasRoles = objects
      .map((o: any) => o.data?.role)
      .filter(Boolean);
    const copyRoles = Object.entries(roleMap)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    console.log('[applyCopy] Roles found in canvas:', canvasRoles);
    console.log('[applyCopy] Roles in copy:', copyRoles);
    console.log('[applyCopy] Total canvas objects:', objects.length);

    let matchedCount = 0;

    for (const obj of objects) {
      const data = (obj as any).data;
      // Case-insensitive role matching — templates may use "Headline", "HEADLINE", etc.
      const role = (data?.role || '').toLowerCase();
      if (!role) continue;

      // Check against lowercased roleMap
      const matchedValue = Object.entries(roleMap).find(
        ([k, v]) => k.toLowerCase() === role && v !== undefined
      );
      if (!matchedValue) continue;

      const newText = matchedValue[1]!;

      // Only inject into text-type objects (Textbox, IText, Text)
      if ((obj as any).text !== undefined) {
        // Set text preserving all existing typography (font, size, color, etc.)
        (obj as any).set({ text: newText });

        // Ensure Textbox wraps properly
        if ((obj as any).splitByGrapheme !== undefined) {
          (obj as any).set({ splitByGrapheme: false });
        }

        // Smart text fitting: reduce font size if text overflows container
        autoFitText(obj);

        // Force re-render of cached object
        (obj as any).dirty = true;
        matchedCount++;
      }
    }

    console.log('[applyCopy] Matched and replaced:', matchedCount, 'objects');

    // ── Heuristic fallback: if no roles matched, assign by font-size hierarchy ──
    // This handles templates that were saved without proper data.role metadata.
    if (matchedCount === 0) {
      console.log('[applyCopy] No role matches — falling back to font-size heuristic');

      const textObjects = objects
        .filter((o: any) =>
          o.text !== undefined &&
          o.data?.role !== 'background-image' &&
          o.data?.role !== 'decoration'
        )
        .sort((a: any, b: any) => (b.fontSize || 0) - (a.fontSize || 0));

      console.log('[applyCopy] Heuristic text objects (by fontSize desc):', textObjects.map((o: any) => ({
        text: ((o as any).text || '').slice(0, 30),
        fontSize: (o as any).fontSize,
        role: (o as any).data?.role,
      })));

      // Largest font size → headline
      if (textObjects.length > 0 && copy.headline) {
        (textObjects[0] as any).set({ text: copy.headline });
        autoFitText(textObjects[0]);
        matchedCount++;
      }

      // Second largest → subheadline (or body if no subheadline)
      if (textObjects.length > 1) {
        const secondText = copy.subheadline || copy.body;
        if (secondText) {
          (textObjects[1] as any).set({ text: secondText });
          autoFitText(textObjects[1]);
          matchedCount++;
        }
      }

      // Third → body (if we have more than 2 distinct text objects)
      if (textObjects.length > 2 && copy.body && copy.subheadline) {
        (textObjects[2] as any).set({ text: copy.body });
        autoFitText(textObjects[2]);
        matchedCount++;
      }

      // Last text object → cta (if available and different from above)
      const lastIdx = textObjects.length - 1;
      if (lastIdx > 0 && copy.cta) {
        (textObjects[lastIdx] as any).set({ text: copy.cta });
        autoFitText(textObjects[lastIdx]);
        matchedCount++;
      }

      console.log('[applyCopy] Heuristic matched:', matchedCount, 'objects');
    }

    fabricCanvas.requestRenderAll();
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

  // ── Generate thumbnail for a slide ──
  const generateThumbnail = useCallback((canvas: FabricCanvasRef): string => {
    try {
      return canvas.toDataURL({ format: "png", quality: 0.5, multiplier: 0.08 });
    } catch {
      return "";
    }
  }, []);

  // ── Save current canvas state into slides array ──
  const saveCurrentSlide = useCallback((): object[] => {
    const canvas = canvasRef.current;
    if (!canvas || slides.length === 0) return slides;

    const currentJson = canvas.toJSON();
    const thumb = generateThumbnail(canvas);
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = currentJson;

    const newThumbs = [...slideThumbnails];
    newThumbs[currentSlideIndex] = thumb;

    setSlides(newSlides);
    setSlideThumbnails(newThumbs);

    return newSlides;
  }, [slides, currentSlideIndex, slideThumbnails, generateThumbnail]);

  // ── Load carousel (array of Fabric JSONs) ──
  const loadCarousel = useCallback(async (slideJsons: object[]) => {
    const canvas = canvasRef.current;
    if (!canvas || slideJsons.length === 0) return;

    setSlides(slideJsons);
    setCurrentSlideIndex(0);

    // Load first slide
    await canvas.loadFromJSON(slideJsons[0]);

    // Generate thumbnails for all slides — for the first one use current canvas,
    // for the rest we generate placeholder thumbnails (they update on switch)
    const thumbs = slideJsons.map((_, i) => (i === 0 ? generateThumbnail(canvas) : ""));
    setSlideThumbnails(thumbs);

    setState((prev) => ({ ...prev, isDirty: false }));
  }, [generateThumbnail]);

  // ── Switch to a different slide ──
  const switchSlide = useCallback(async (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas || index === currentSlideIndex || index < 0 || index >= slides.length) return;

    // Save current slide state + thumbnail
    const currentJson = canvas.toJSON();
    const thumb = generateThumbnail(canvas);
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = currentJson;

    const newThumbs = [...slideThumbnails];
    newThumbs[currentSlideIndex] = thumb;

    // Load target slide
    await canvas.loadFromJSON(newSlides[index]);

    // Update thumbnail for the new slide too
    newThumbs[index] = generateThumbnail(canvas);

    setSlides(newSlides);
    setSlideThumbnails(newThumbs);
    setCurrentSlideIndex(index);
  }, [slides, currentSlideIndex, slideThumbnails, generateThumbnail]);

  // ── Add a new blank slide ──
  const addSlide = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save current state first
    const currentJson = canvas.toJSON();
    const thumb = generateThumbnail(canvas);
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = currentJson;

    const newThumbs = [...slideThumbnails];
    newThumbs[currentSlideIndex] = thumb;

    // Create an empty slide JSON matching current canvas dimensions
    const emptySlide = {
      version: "6.0.0",
      objects: [],
      background: "#080b1e",
    };

    newSlides.push(emptySlide);
    newThumbs.push("");

    setSlides(newSlides);
    setSlideThumbnails(newThumbs);

    // Switch to new slide
    const newIndex = newSlides.length - 1;
    canvas.loadFromJSON(emptySlide).then(() => {
      setCurrentSlideIndex(newIndex);
      setState((prev) => ({ ...prev, isDirty: true }));
    });
  }, [slides, currentSlideIndex, slideThumbnails, generateThumbnail]);

  // ── Delete a slide ──
  const deleteSlide = useCallback(async (index: number) => {
    if (slides.length <= 1) return; // Don't delete last slide

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save current state first
    const currentJson = canvas.toJSON();
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = currentJson;

    const newThumbs = [...slideThumbnails];

    // Remove the slide
    newSlides.splice(index, 1);
    newThumbs.splice(index, 1);

    // Determine which slide to show after deletion
    let nextIndex = currentSlideIndex;
    if (index === currentSlideIndex) {
      nextIndex = Math.min(index, newSlides.length - 1);
    } else if (index < currentSlideIndex) {
      nextIndex = currentSlideIndex - 1;
    }

    // Load the target slide
    await canvas.loadFromJSON(newSlides[nextIndex]);
    newThumbs[nextIndex] = generateThumbnail(canvas);

    setSlides(newSlides);
    setSlideThumbnails(newThumbs);
    setCurrentSlideIndex(nextIndex);
    setState((prev) => ({ ...prev, isDirty: true }));
  }, [slides, currentSlideIndex, slideThumbnails, generateThumbnail]);

  // ── Duplicate a slide ──
  const duplicateSlide = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save current state first
    const currentJson = canvas.toJSON();
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = currentJson;

    const newThumbs = [...slideThumbnails];

    // Deep clone the slide to duplicate
    const cloned = JSON.parse(JSON.stringify(newSlides[index]));

    // Insert after the source slide
    newSlides.splice(index + 1, 0, cloned);
    newThumbs.splice(index + 1, 0, newThumbs[index] || "");

    setSlides(newSlides);
    setSlideThumbnails(newThumbs);

    // Adjust current index if needed
    if (index < currentSlideIndex) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }

    setState((prev) => ({ ...prev, isDirty: true }));
  }, [slides, currentSlideIndex, slideThumbnails]);

  // ── Reorder slides (drag & drop) ──
  const reorderSlide = useCallback((from: number, to: number) => {
    const canvas = canvasRef.current;
    if (!canvas || from === to) return;

    // Save current state first
    const currentJson = canvas.toJSON();
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = currentJson;

    const newThumbs = [...slideThumbnails];

    // Remove from source
    const [movedSlide] = newSlides.splice(from, 1);
    const [movedThumb] = newThumbs.splice(from, 1);

    // Insert at destination
    newSlides.splice(to, 0, movedSlide);
    newThumbs.splice(to, 0, movedThumb);

    // Track where the current slide ended up
    let newCurrentIndex = currentSlideIndex;
    if (currentSlideIndex === from) {
      newCurrentIndex = to;
    } else if (from < currentSlideIndex && to >= currentSlideIndex) {
      newCurrentIndex = currentSlideIndex - 1;
    } else if (from > currentSlideIndex && to <= currentSlideIndex) {
      newCurrentIndex = currentSlideIndex + 1;
    }

    setSlides(newSlides);
    setSlideThumbnails(newThumbs);
    setCurrentSlideIndex(newCurrentIndex);
    setState((prev) => ({ ...prev, isDirty: true }));
  }, [slides, currentSlideIndex, slideThumbnails]);

  // ── Export all slides as data URLs ──
  const exportAllSlides = useCallback((options?: ExportOptions): string[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];

    // Save current slide state into the array
    const currentJson = canvas.toJSON();
    const allSlides = [...slides];
    allSlides[currentSlideIndex] = currentJson;

    const results: string[] = [];

    // For the current slide, export directly
    // For other slides, we need to load → export → restore
    // Since this is sync-ish, we'll return what we can
    // The actual multi-slide export is handled by the exporter component (async)
    for (let i = 0; i < allSlides.length; i++) {
      if (i === currentSlideIndex) {
        results.push(
          canvas.toDataURL({
            format: options?.format || "png",
            quality: options?.quality || 1,
            multiplier: options?.multiplier || 1,
          })
        );
      } else {
        // Placeholder — the async export in CanvasExporter handles this properly
        results.push("");
      }
    }

    return results;
  }, [slides, currentSlideIndex]);

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
    // Carousel
    slides,
    currentSlideIndex,
    isCarousel,
    slideThumbnails,
    switchSlide,
    addSlide,
    deleteSlide,
    duplicateSlide: duplicateSlide,
    reorderSlide,
    loadCarousel,
    exportAllSlides,
  };
}
