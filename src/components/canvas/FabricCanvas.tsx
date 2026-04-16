"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { ImagePlus } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SelectionInfo {
  id: string;
  type: string;
  role: string | null;
  editable: boolean;
  props: {
    left: number;
    top: number;
    width: number;
    height: number;
    fill: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    textAlign?: string;
    opacity?: number;
    text?: string;
    rx?: number;
    ry?: number;
    stroke?: string;
    strokeWidth?: number;
  };
}

export interface TextSelectionInfo {
  start: number;
  end: number;
  hasSelection: boolean;
  styles: Record<string, any>;
}

export interface FabricCanvasRef {
  toJSON: () => object;
  loadFromJSON: (json: object) => Promise<void>;
  toDataURL: (options?: {
    format?: string;
    quality?: number;
    multiplier?: number;
  }) => string;
  getSelectedObject: () => any | null;
  updateSelectedObject: (props: Record<string, any>) => void;
  deleteSelected: () => void;
  addText: (text: string, options?: Record<string, any>) => void;
  addImage: (url: string) => Promise<void>;
  addRect: (options?: Record<string, any>) => void;
  addCircle: (options?: Record<string, any>) => void;
  addTriangle: (options?: Record<string, any>) => void;
  addPolygon: (sides: number, options?: Record<string, any>) => void;
  addStar: (options?: Record<string, any>) => void;
  addLine: (options?: Record<string, any>) => void;
  undo: () => void;
  redo: () => void;
  setBackgroundColor: (color: string) => void;
  setBackgroundImage: (url: string) => Promise<void>;
  zoomToFit: () => void;
  getCanvas: () => any | null;
  alignSelected: (alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void;
  distributeSelected: (direction: 'horizontal' | 'vertical') => void;
  flipSelected: (direction: 'horizontal' | 'vertical') => void;
  toggleLockSelected: () => boolean;
  applyStyleToSelection: (style: Record<string, any>) => void;
  getSelectionStyle: () => Record<string, any> | null;
  isEditingText: () => boolean;
  addImageFrame: (options?: { width?: number; height?: number; rx?: number; ry?: number; shape?: 'rect' | 'rounded' | 'circle' | 'hexagon' }) => void;
  fillImageFrame: (frameId: string, imageUrl: string) => Promise<void>;
  setFrameShape: (frameId: string, shape: 'rect' | 'rounded' | 'circle' | 'hexagon') => void;
  setFrameRadius: (frameId: string, radius: number) => void;
}

export interface FabricCanvasProps {
  width: number;
  height: number;
  canvasJson?: object;
  aspectRatio: "1:1" | "4:5" | "9:16";
  onSelectionChange?: (selection: SelectionInfo | null) => void;
  onCanvasChange?: () => void;
  onReady?: () => void;
  onTextEditingChange?: (isEditing: boolean) => void;
  onTextSelectionChange?: (info: TextSelectionInfo) => void;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

const MAX_HISTORY = 30;
const SNAP_THRESHOLD = 10;

function extractSelectionInfo(obj: any): SelectionInfo {
  const bounds = obj.getBoundingRect ? obj.getBoundingRect() : {};
  return {
    id: obj.data?.id || obj.__uid || String(Math.random()),
    type: obj.type || "object",
    role: obj.data?.role || null,
    editable: obj.selectable !== false,
    props: {
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
      width: Math.round(obj.getScaledWidth?.() ?? obj.width ?? bounds.width ?? 0),
      height: Math.round(obj.getScaledHeight?.() ?? obj.height ?? bounds.height ?? 0),
      fill: typeof obj.fill === "string" ? obj.fill : (obj.fill?.type ? "__gradient__" : "#000000"),
      fontSize: obj.fontSize,
      fontFamily: obj.fontFamily,
      fontWeight: String(obj.fontWeight ?? ""),
      textAlign: obj.textAlign,
      opacity: obj.opacity != null ? Math.round(obj.opacity * 100) : 100,
      text: obj.text,
      rx: (obj as any).data?.frameRx ?? (obj as any).rx ?? 0,
      ry: (obj as any).data?.frameRy ?? (obj as any).ry ?? 0,
      stroke: typeof obj.stroke === "string" ? obj.stroke : undefined,
      strokeWidth: obj.strokeWidth || 0,
    },
  };
}

/**
 * Pré-processa canvas_json ANTES de loadFromJSON para injetar crossOrigin='anonymous'
 * em TODO nó de imagem. Sem isso, Fabric v6 cria <img> sem CORS, o browser cacheia
 * a resposta no-cors e qualquer toDataURL() depois falha com "tainted canvas",
 * mesmo que a origem tenha ACAO: *. Aplicar crossOrigin DEPOIS é tarde demais.
 */
function preProcessCanvasJsonForCrossOrigin(json: any): any {
  if (!json || typeof json !== "object") return json;
  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    const t = node.type;
    if (t === "image" || t === "Image") {
      if (typeof node.src === "string" && !node.src.startsWith("data:")) {
        node.crossOrigin = "anonymous";
      }
    }
    if (Array.isArray(node.objects)) node.objects.forEach(walk);
    if (Array.isArray(node.slides)) node.slides.forEach(walk);
    if (node.backgroundImage) walk(node.backgroundImage);
  }
  walk(json);
  return json;
}

/**
 * After any loadFromJSON, iterate over canvas objects and ensure every
 * FabricImage has crossOrigin='anonymous'. This prevents canvas tainting
 * when the same images are later used in toDataURL().
 */
function patchCanvasCrossOrigin(canvas: any) {
  if (!canvas) return;
  const objects: any[] = canvas.getObjects ? canvas.getObjects() : [];
  for (const obj of objects) {
    if (obj.type === "image" || obj.type === "Image") {
      obj.crossOrigin = "anonymous";
    }
    // Recurse into groups
    if (obj.type === "group" && typeof obj.getObjects === "function") {
      for (const child of obj.getObjects()) {
        if (child.type === "image" || child.type === "Image") {
          child.crossOrigin = "anonymous";
        }
      }
    }
  }
  // Also patch backgroundImage if present
  if (canvas.backgroundImage) {
    canvas.backgroundImage.crossOrigin = "anonymous";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FabricCanvas Component
   ═══════════════════════════════════════════════════════════════════════════ */

const FabricCanvas = forwardRef<FabricCanvasRef, FabricCanvasProps>(
  (
    {
      width,
      height,
      canvasJson,
      aspectRatio,
      onSelectionChange,
      onCanvasChange,
      onReady,
      onTextEditingChange,
      onTextSelectionChange,
      className = "",
    },
    ref
  ) => {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isUndoRedoRef = useRef(false);
    const guidelinesRef = useRef<any[]>([]);
    const clipboardRef = useRef<any>(null);
    const [scale, setScale] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [ready, setReady] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const dims = ASPECT_DIMS[aspectRatio] || ASPECT_DIMS["1:1"];

    // ── Compute scale to fit container ──
    const computeScale = useCallback(() => {
      if (!containerRef.current) return 1;
      const containerW = containerRef.current.clientWidth - 32; // 16px padding each side
      const containerH = containerRef.current.clientHeight - 32;
      const scaleW = containerW / dims.w;
      const scaleH = containerH / dims.h;
      return Math.min(scaleW, scaleH, 1);
    }, [dims.w, dims.h]);

    // ── Save history snapshot ──
    const saveHistory = useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas || isUndoRedoRef.current) return;
      const json = JSON.stringify(canvas.toJSON(["data"]));
      // Trim any redo entries ahead of current index
      historyRef.current = historyRef.current.slice(
        0,
        historyIndexRef.current + 1
      );
      historyRef.current.push(json);
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      historyIndexRef.current = historyRef.current.length - 1;
    }, []);

    // ── Emit selection info ──
    const emitSelection = useCallback(
      (obj: any | null) => {
        if (!onSelectionChange) return;
        if (!obj) {
          onSelectionChange(null);
          return;
        }
        onSelectionChange(extractSelectionInfo(obj));
      },
      [onSelectionChange]
    );

    // ── Smart guides helpers ──
    const clearGuidelines = useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      guidelinesRef.current.forEach((line) => canvas.remove(line));
      guidelinesRef.current = [];
    }, []);

    const showGuideline = useCallback((orientation: 'h' | 'v', position: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      import("fabric").then(({ Line }) => {
        const coords: [number, number, number, number] = orientation === 'h'
          ? [0, position, canvas.width!, position]
          : [position, 0, position, canvas.height!];

        const line = new Line(coords, {
          stroke: '#4ecdc4',
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          excludeFromExport: true,
          data: { _guideline: true },
        });
        canvas.add(line);
        guidelinesRef.current.push(line);
      });
    }, []);

    // ── Snapping logic ──
    const handleObjectMoving = useCallback((e: any) => {
      const canvas = fabricRef.current;
      const obj = e.target;
      if (!canvas || !obj) return;

      clearGuidelines();

      const canvasW = canvas.width!;
      const canvasH = canvas.height!;
      const canvasCenter = { x: canvasW / 2, y: canvasH / 2 };
      const objCenter = obj.getCenterPoint();
      const objW = obj.getScaledWidth();
      const objH = obj.getScaledHeight();
      const objLeft = obj.left!;
      const objTop = obj.top!;
      const objRight = objLeft + objW;
      const objBottom = objTop + objH;

      let snappedX = false;
      let snappedY = false;

      // --- Snap to canvas center ---
      if (Math.abs(objCenter.x - canvasCenter.x) < SNAP_THRESHOLD) {
        obj.set({ left: canvasCenter.x - objW / 2 });
        showGuideline('v', canvasCenter.x);
        snappedX = true;
      }
      if (Math.abs(objCenter.y - canvasCenter.y) < SNAP_THRESHOLD) {
        obj.set({ top: canvasCenter.y - objH / 2 });
        showGuideline('h', canvasCenter.y);
        snappedY = true;
      }

      // --- Snap to canvas edges ---
      if (!snappedX) {
        if (Math.abs(objLeft) < SNAP_THRESHOLD) {
          obj.set({ left: 0 });
          showGuideline('v', 0);
          snappedX = true;
        } else if (Math.abs(objRight - canvasW) < SNAP_THRESHOLD) {
          obj.set({ left: canvasW - objW });
          showGuideline('v', canvasW);
          snappedX = true;
        }
      }
      if (!snappedY) {
        if (Math.abs(objTop) < SNAP_THRESHOLD) {
          obj.set({ top: 0 });
          showGuideline('h', 0);
          snappedY = true;
        } else if (Math.abs(objBottom - canvasH) < SNAP_THRESHOLD) {
          obj.set({ top: canvasH - objH });
          showGuideline('h', canvasH);
          snappedY = true;
        }
      }

      // --- Snap to other objects ---
      const updatedLeft = obj.left!;
      const updatedTop = obj.top!;
      const updatedRight = updatedLeft + objW;
      const updatedBottom = updatedTop + objH;
      const updatedCenterX = updatedLeft + objW / 2;
      const updatedCenterY = updatedTop + objH / 2;

      canvas.getObjects().forEach((other: any) => {
        if (other === obj || !other.selectable || other.data?._guideline) return;

        const otherCenter = other.getCenterPoint();
        const otherW = other.getScaledWidth();
        const otherH = other.getScaledHeight();
        const otherLeft = other.left!;
        const otherTop = other.top!;
        const otherRight = otherLeft + otherW;
        const otherBottom = otherTop + otherH;

        // Horizontal center to center
        if (!snappedX && Math.abs(updatedCenterX - otherCenter.x) < SNAP_THRESHOLD) {
          obj.set({ left: otherCenter.x - objW / 2 });
          showGuideline('v', otherCenter.x);
          snappedX = true;
        }
        // Vertical center to center
        if (!snappedY && Math.abs(updatedCenterY - otherCenter.y) < SNAP_THRESHOLD) {
          obj.set({ top: otherCenter.y - objH / 2 });
          showGuideline('h', otherCenter.y);
          snappedY = true;
        }
        // Left edge to left edge
        if (!snappedX && Math.abs(updatedLeft - otherLeft) < SNAP_THRESHOLD) {
          obj.set({ left: otherLeft });
          showGuideline('v', otherLeft);
          snappedX = true;
        }
        // Right edge to right edge
        if (!snappedX && Math.abs(updatedRight - otherRight) < SNAP_THRESHOLD) {
          obj.set({ left: otherRight - objW });
          showGuideline('v', otherRight);
          snappedX = true;
        }
        // Left to right
        if (!snappedX && Math.abs(updatedLeft - otherRight) < SNAP_THRESHOLD) {
          obj.set({ left: otherRight });
          showGuideline('v', otherRight);
          snappedX = true;
        }
        // Right to left
        if (!snappedX && Math.abs(updatedRight - otherLeft) < SNAP_THRESHOLD) {
          obj.set({ left: otherLeft - objW });
          showGuideline('v', otherLeft);
          snappedX = true;
        }
        // Top edge to top edge
        if (!snappedY && Math.abs(updatedTop - otherTop) < SNAP_THRESHOLD) {
          obj.set({ top: otherTop });
          showGuideline('h', otherTop);
          snappedY = true;
        }
        // Bottom edge to bottom edge
        if (!snappedY && Math.abs(updatedBottom - otherBottom) < SNAP_THRESHOLD) {
          obj.set({ top: otherBottom - objH });
          showGuideline('h', otherBottom);
          snappedY = true;
        }
        // Top to bottom
        if (!snappedY && Math.abs(updatedTop - otherBottom) < SNAP_THRESHOLD) {
          obj.set({ top: otherBottom });
          showGuideline('h', otherBottom);
          snappedY = true;
        }
        // Bottom to top
        if (!snappedY && Math.abs(updatedBottom - otherTop) < SNAP_THRESHOLD) {
          obj.set({ top: otherTop - objH });
          showGuideline('h', otherTop);
          snappedY = true;
        }
      });

      obj.setCoords();
    }, [clearGuidelines, showGuideline]);

    // ── Add image from data URL helper ──
    const addImageFromDataUrl = useCallback(async (dataUrl: string) => {
      const fabricModule = await import("fabric");
      const canvas = fabricRef.current;
      if (!canvas) return;
      const img = await fabricModule.FabricImage.fromURL(dataUrl, {
        crossOrigin: "anonymous",
      });
      const maxW = dims.w * 0.5;
      const maxH = dims.h * 0.5;
      const imgScale = Math.min(
        maxW / (img.width || 1),
        maxH / (img.height || 1),
        1
      );
      img.set({
        left: dims.w / 2 - ((img.width || 0) * imgScale) / 2,
        top: dims.h / 2 - ((img.height || 0) * imgScale) / 2,
        scaleX: imgScale,
        scaleY: imgScale,
        data: { id: crypto.randomUUID(), role: "image" },
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    }, [dims.w, dims.h]);

    // ── Drag and drop handlers ──
    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find(f => f.type.startsWith('image/'));
      if (imageFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;

          // Check if drop target overlaps with an image-frame
          const canvas = fabricRef.current;
          if (canvas && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();

            // Convert mouse coords to canvas coords (accounting for pan + scale + centering)
            const canvasDisplayW = dims.w * scale;
            const canvasDisplayH = dims.h * scale;
            const centerX = (containerRect.width - canvasDisplayW) / 2 + panOffset.x;
            const centerY = (containerRect.height - canvasDisplayH) / 2 + panOffset.y;

            // Mouse position relative to canvas top-left in canvas coordinate space
            const mouseOnCanvasX = (e.clientX - containerRect.left - centerX) / scale;
            const mouseOnCanvasY = (e.clientY - containerRect.top - centerY) / scale;

            const frameObj = canvas.getObjects().find((obj: any) => {
              if (obj.data?.role !== 'image-frame') return false;
              const left = obj.left || 0;
              const top = obj.top || 0;
              const w = obj.getScaledWidth?.() || obj.width || 0;
              const h = obj.getScaledHeight?.() || obj.height || 0;
              return mouseOnCanvasX >= left && mouseOnCanvasX <= left + w && mouseOnCanvasY >= top && mouseOnCanvasY <= top + h;
            });

            if (frameObj && frameObj.data?.id) {
              // Auto-fill the image frame
              import("fabric").then(async ({ FabricImage, Rect }) => {
                const fw = frameObj.data?.frameWidth || frameObj.width || 400;
                const fh = frameObj.data?.frameHeight || frameObj.height || 400;
                const rx = frameObj.data?.frameRx || 20;
                const ry = frameObj.data?.frameRy || 20;

                const img = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
                const scX = fw / (img.width || 1);
                const scY = fh / (img.height || 1);
                const coverScale = Math.max(scX, scY);

                // clipPath in Fabric.js is relative to the object's own coordinate space
                img.set({
                  scaleX: coverScale,
                  scaleY: coverScale,
                  left: frameObj.left || 0,
                  top: frameObj.top || 0,
                  clipPath: new Rect({
                    width: fw / coverScale,
                    height: fh / coverScale,
                    rx: rx / coverScale,
                    ry: ry / coverScale,
                    originX: 'center',
                    originY: 'center',
                  }),
                  data: { id: crypto.randomUUID(), role: 'framed-image' },
                });

                canvas.remove(frameObj);
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.renderAll();
                saveHistory();
              });
              return;
            }
          }

          addImageFromDataUrl(dataUrl);
        };
        reader.readAsDataURL(imageFile);
      }
    }, [addImageFromDataUrl, scale, panOffset, dims.w, dims.h, saveHistory]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    }, []);

    // ── Initialize Fabric ──
    useEffect(() => {
      let cancelled = false;
      let canvasInstance: any = null;

      import("fabric").then((fabricModule) => {
        if (cancelled || !canvasElRef.current) return;

        const { Canvas } = fabricModule;
        canvasInstance = new Canvas(canvasElRef.current, {
          width: dims.w,
          height: dims.h,
          backgroundColor: "#080b1e",
          selection: true,
          preserveObjectStacking: true,
        });

        fabricRef.current = canvasInstance;

        // ── Canva-like selection overlay ──
        canvasInstance.selectionColor = 'rgba(78, 205, 196, 0.08)';
        canvasInstance.selectionBorderColor = '#4ecdc4';
        canvasInstance.selectionLineWidth = 1.5;

        // Customize object controls (handles) — Canva style
        fabricModule.FabricObject.prototype.set({
          transparentCorners: false,
          cornerColor: '#4ecdc4',
          cornerStrokeColor: '#ffffff',
          cornerSize: 8,
          cornerStyle: 'circle',
          borderColor: '#4ecdc4',
          borderScaleFactor: 1.5,
          padding: 4,
        });

        // Move rotation handle further up for cleaner look
        if (fabricModule.FabricObject.prototype.controls?.mtr) {
          fabricModule.FabricObject.prototype.controls.mtr.offsetY = -30;
        }

        // ── Events: selection ──
        canvasInstance.on("selection:created", (e: any) => {
          const sel = e.selected?.[0];
          emitSelection(sel || null);
        });
        canvasInstance.on("selection:updated", (e: any) => {
          const sel = e.selected?.[0];
          emitSelection(sel || null);
        });
        canvasInstance.on("selection:cleared", () => {
          emitSelection(null);
          clearGuidelines();
        });

        // ── Events: change tracking ──
        const handleChange = () => {
          saveHistory();
          onCanvasChange?.();
        };
        canvasInstance.on("object:modified", () => {
          clearGuidelines();
          handleChange();
        });
        canvasInstance.on("object:added", handleChange);
        canvasInstance.on("object:removed", handleChange);

        // ── Events: text editing ──
        canvasInstance.on("text:editing:entered", () => {
          onTextEditingChange?.(true);
        });
        canvasInstance.on("text:editing:exited", () => {
          onTextEditingChange?.(false);
          onTextSelectionChange?.({ start: 0, end: 0, hasSelection: false, styles: {} });
        });
        canvasInstance.on("text:selection:changed", (e: any) => {
          const textObj = e.target;
          if (textObj && onTextSelectionChange) {
            const start = textObj.selectionStart ?? 0;
            const end = textObj.selectionEnd ?? 0;
            // Get style of first selected char for toolbar state
            let styles: Record<string, any> = {};
            if (start !== end && textObj.getSelectionStyles) {
              const selStyles = textObj.getSelectionStyles(start, end);
              if (selStyles && selStyles.length > 0) {
                styles = selStyles[0] || {};
              }
            }
            onTextSelectionChange({ start, end, hasSelection: start !== end, styles });
          }
        });

        // ── Events: snapping & smart guides ──
        canvasInstance.on("object:moving", handleObjectMoving);

        // ── Load initial JSON if provided ──
        if (canvasJson) {
          const preprocessed = preProcessCanvasJsonForCrossOrigin(
            JSON.parse(JSON.stringify(canvasJson))
          );
          canvasInstance.loadFromJSON(preprocessed).then(() => {
            patchCanvasCrossOrigin(canvasInstance);
            canvasInstance.renderAll();
            saveHistory();
          });
        } else {
          saveHistory();
        }

        // ── DEFINITIVO: Prevent ALL scroll caused by Fabric.js text editing ──
        // Override focus() on textareas WITHIN the canvas container only
        const origFocus = HTMLTextAreaElement.prototype.focus;
        const canvasContainer = canvasElRef.current!.parentElement!;
        const patchedFocus = new WeakSet<HTMLTextAreaElement>();

        const patchTextarea = (ta: HTMLTextAreaElement) => {
          if (patchedFocus.has(ta)) return;
          patchedFocus.add(ta);

          ta.focus = function (opts?: FocusOptions) {
            origFocus.call(this, { ...opts, preventScroll: true });
          };
          ta.scrollIntoView = () => {};
          ta.style.position = 'fixed';
          ta.style.top = '0px';
          ta.style.left = '0px';
          ta.style.opacity = '0';
        };

        // Patch existing textareas
        canvasContainer.querySelectorAll('textarea').forEach((ta) => patchTextarea(ta as HTMLTextAreaElement));

        // Watch for new textareas
        const textareaObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of Array.from(m.addedNodes)) {
              if (node instanceof HTMLTextAreaElement) {
                patchTextarea(node);
              }
              if (node instanceof HTMLElement) {
                node.querySelectorAll?.('textarea').forEach((ta) => patchTextarea(ta as HTMLTextAreaElement));
              }
            }
          }
        });
        textareaObserver.observe(canvasContainer, { childList: true, subtree: true });
        (canvasInstance as any).__textareaObserver = textareaObserver;

        // ── Compute initial scale ──
        const s = computeScale();
        setScale(s);
        setReady(true);
        onReady?.();
      });

      return () => {
        cancelled = true;
        if (canvasInstance) {
          (canvasInstance as any).__textareaObserver?.disconnect();
          canvasInstance.dispose();
          fabricRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Resize canvas when aspect ratio changes ──
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      canvas.setDimensions({ width: dims.w, height: dims.h });
      canvas.renderAll();
      const s = computeScale();
      setScale(s);
    }, [aspectRatio, dims.w, dims.h, computeScale]);

    // ── Resize observer for container ──
    // Only reset scale if user hasn't manually zoomed
    const userZoomedRef = useRef(false);
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const ro = new ResizeObserver(() => {
        if (!userZoomedRef.current) {
          setScale(computeScale());
        }
      });
      ro.observe(container);
      return () => ro.disconnect();
    }, [computeScale]);

    // ── Clamp pan so canvas stays mostly visible ──
    const clampPan = useCallback((offset: { x: number; y: number }, currentScale: number) => {
      const container = containerRef.current;
      if (!container) return offset;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const canvasW = dims.w * currentScale;
      const canvasH = dims.h * currentScale;

      let maxPanX: number;
      let maxPanY: number;

      if (canvasW <= cw) {
        // Canvas fits in container — only allow small pan (padding)
        maxPanX = Math.max(16, (cw - canvasW) / 2);
      } else {
        // Canvas is BIGGER than container (zoomed in) — allow pan to see edges
        maxPanX = (canvasW - cw) / 2 + 40; // 40px extra margin
      }

      if (canvasH <= ch) {
        maxPanY = Math.max(16, (ch - canvasH) / 2);
      } else {
        maxPanY = (canvasH - ch) / 2 + 40;
      }

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, offset.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, offset.y)),
      };
    }, [dims.w, dims.h]);

    // ── Wheel handler: Ctrl+scroll = zoom to mouse, plain scroll = pan ──
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
          // ZOOM toward mouse position
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // Mouse position as fraction of container
          const fx = mouseX / rect.width;
          const fy = mouseY / rect.height;

          const delta = e.deltaY > 0 ? -0.05 : 0.05;
          userZoomedRef.current = true; // Mark that user manually zoomed

          setScale((prev) => {
            const fitScale = computeScale();
            const minZoom = fitScale * 0.9;
            const next = Math.min(3, Math.max(minZoom, prev + delta));
            const scaleDiff = next - prev;
            setPanOffset((p) => clampPan({
              x: p.x - (fx - 0.5) * dims.w * scaleDiff,
              y: p.y - (fy - 0.5) * dims.h * scaleDiff,
            }, next));
            return next;
          });
        } else {
          // PAN (scroll when zoomed)
          setScale((currentScale) => {
            setPanOffset((prev) => clampPan({
              x: prev.x - e.deltaX,
              y: prev.y - e.deltaY,
            }, currentScale));
            return currentScale; // unchanged
          });
        }
      };

      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }, [dims.w, dims.h, computeScale, clampPan]);

    // ── Keyboard shortcuts ──
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        // Ignore if focused on input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        if (e.key === "Delete" || e.key === "Backspace") {
          const active = canvas.getActiveObject();
          // Don't delete text object while editing it
          if (active && !(active as any).isEditing) {
            canvas.remove(active);
            canvas.discardActiveObject();
            canvas.renderAll();
            emitSelection(null);
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undoAction();
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.key === "y" || (e.key === "z" && e.shiftKey))
        ) {
          e.preventDefault();
          redoAction();
        }

        // Copy: Ctrl+C
        if ((e.ctrlKey || e.metaKey) && e.key === "c") {
          const obj = canvas.getActiveObject();
          if (obj) {
            obj.clone(["data"]).then((cloned: any) => {
              clipboardRef.current = cloned;
            });
          }
        }

        // Paste: Ctrl+V
        if ((e.ctrlKey || e.metaKey) && e.key === "v") {
          if (clipboardRef.current) {
            clipboardRef.current.clone(["data"]).then((cloned: any) => {
              cloned.set({
                left: (cloned.left || 0) + 20,
                top: (cloned.top || 0) + 20,
                data: { ...cloned.data, id: crypto.randomUUID() },
              });
              canvas.add(cloned);
              canvas.setActiveObject(cloned);
              canvas.requestRenderAll();
              // Update clipboard position for next paste
              clipboardRef.current = cloned;
            });
          }
        }

        // Duplicate: Ctrl+D
        if ((e.ctrlKey || e.metaKey) && e.key === "d") {
          e.preventDefault();
          const obj = canvas.getActiveObject();
          if (obj) {
            obj.clone(["data"]).then((cloned: any) => {
              cloned.set({
                left: (cloned.left || 0) + 20,
                top: (cloned.top || 0) + 20,
                data: { ...cloned.data, id: crypto.randomUUID() },
              });
              canvas.add(cloned);
              canvas.setActiveObject(cloned);
              canvas.requestRenderAll();
            });
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Undo / Redo ──
    const undoAction = useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas || historyIndexRef.current <= 0) return;
      isUndoRedoRef.current = true;
      historyIndexRef.current -= 1;
      const json = historyRef.current[historyIndexRef.current];
      const parsed = preProcessCanvasJsonForCrossOrigin(JSON.parse(json));
      canvas.loadFromJSON(parsed).then(() => {
        patchCanvasCrossOrigin(canvas);
        canvas.renderAll();
        isUndoRedoRef.current = false;
        onCanvasChange?.();
      });
    }, [onCanvasChange]);

    const redoAction = useCallback(() => {
      const canvas = fabricRef.current;
      if (
        !canvas ||
        historyIndexRef.current >= historyRef.current.length - 1
      )
        return;
      isUndoRedoRef.current = true;
      historyIndexRef.current += 1;
      const json = historyRef.current[historyIndexRef.current];
      const parsed = preProcessCanvasJsonForCrossOrigin(JSON.parse(json));
      canvas.loadFromJSON(parsed).then(() => {
        patchCanvasCrossOrigin(canvas);
        canvas.renderAll();
        isUndoRedoRef.current = false;
        onCanvasChange?.();
      });
    }, [onCanvasChange]);

    // ── Ref API ──
    useImperativeHandle(
      ref,
      () => ({
        toJSON: () => {
          const canvas = fabricRef.current;
          return canvas ? canvas.toJSON(["data"]) : {};
        },

        loadFromJSON: async (json: object) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const preprocessed = preProcessCanvasJsonForCrossOrigin(
            JSON.parse(JSON.stringify(json))
          );
          await canvas.loadFromJSON(preprocessed);
          patchCanvasCrossOrigin(canvas);
          canvas.renderAll();
          saveHistory();
        },

        toDataURL: (options) => {
          const canvas = fabricRef.current;
          if (!canvas) return "";
          return canvas.toDataURL({
            format: options?.format || "png",
            quality: options?.quality || 1,
            multiplier: options?.multiplier || 1,
          });
        },

        getSelectedObject: () => {
          const canvas = fabricRef.current;
          return canvas?.getActiveObject() || null;
        },

        updateSelectedObject: (props: Record<string, any>) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const obj = canvas.getActiveObject();
          if (!obj) return;
          obj.set(props);
          canvas.renderAll();
          saveHistory();
          // Re-emit selection info
          emitSelection(obj);
        },

        deleteSelected: () => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const active = canvas.getActiveObject();
          if (!active) return;
          canvas.remove(active);
          canvas.discardActiveObject();
          canvas.renderAll();
          emitSelection(null);
        },

        addText: (text: string, options?: Record<string, any>) => {
          import("fabric").then(({ Textbox }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const textbox = new Textbox(text, {
              left: dims.w / 2 - 150,
              top: dims.h / 2 - 30,
              width: 300,
              fontSize: 48,
              fontFamily: "Plus Jakarta Sans",
              fill: "#e8eaff",
              textAlign: "center",
              data: { id: crypto.randomUUID(), role: "text" },
              ...options,
            });
            canvas.add(textbox);
            canvas.setActiveObject(textbox);
            canvas.renderAll();
          });
        },

        addImage: async (url: string) => {
          await addImageFromDataUrl(url);
        },

        addRect: (options?: Record<string, any>) => {
          import("fabric").then(({ Rect }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const rect = new Rect({
              left: dims.w / 2 - 100,
              top: dims.h / 2 - 75,
              width: 200,
              height: 150,
              fill: "#4ecdc4",
              rx: 8,
              ry: 8,
              data: { id: crypto.randomUUID(), role: "shape" },
              ...options,
            });
            canvas.add(rect);
            canvas.setActiveObject(rect);
            canvas.renderAll();
          });
        },

        addCircle: (options?: Record<string, any>) => {
          import("fabric").then(({ Circle }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const circle = new Circle({
              left: dims.w / 2 - 60,
              top: dims.h / 2 - 60,
              radius: 60,
              fill: "#6c5ce7",
              data: { id: crypto.randomUUID(), role: "shape" },
              ...options,
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
          });
        },

        addTriangle: (options?: Record<string, any>) => {
          import("fabric").then(({ Triangle }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const triangle = new Triangle({
              left: dims.w / 2 - 100,
              top: dims.h / 2 - 100,
              width: 200,
              height: 200,
              fill: "#4ecdc4",
              data: { id: crypto.randomUUID(), role: "shape", editable: true },
              ...options,
            });
            canvas.add(triangle);
            canvas.setActiveObject(triangle);
            canvas.renderAll();
          });
        },

        addPolygon: (sides: number, options?: Record<string, any>) => {
          import("fabric").then(({ Polygon }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const radius = 100;
            const points = [];
            for (let i = 0; i < sides; i++) {
              const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
              points.push({
                x: radius + radius * Math.cos(angle),
                y: radius + radius * Math.sin(angle),
              });
            }
            const polygon = new Polygon(points, {
              left: dims.w / 2 - radius,
              top: dims.h / 2 - radius,
              fill: "#6c5ce7",
              ...options,
            } as any);
            (polygon as any).data = { id: crypto.randomUUID(), role: "shape", editable: true };
            canvas.add(polygon);
            canvas.setActiveObject(polygon);
            canvas.renderAll();
          });
        },

        addStar: (options?: Record<string, any>) => {
          import("fabric").then(({ Polygon }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const outerR = 100;
            const innerR = 45;
            const spikes = 5;
            const points = [];
            for (let i = 0; i < spikes * 2; i++) {
              const r = i % 2 === 0 ? outerR : innerR;
              const angle = (i * Math.PI / spikes) - Math.PI / 2;
              points.push({
                x: outerR + r * Math.cos(angle),
                y: outerR + r * Math.sin(angle),
              });
            }
            const star = new Polygon(points, {
              left: dims.w / 2 - outerR,
              top: dims.h / 2 - outerR,
              fill: "#f59e0b",
              ...options,
            } as any);
            (star as any).data = { id: crypto.randomUUID(), role: "shape", editable: true };
            canvas.add(star);
            canvas.setActiveObject(star);
            canvas.renderAll();
          });
        },

        addLine: (options?: Record<string, any>) => {
          import("fabric").then(({ Line }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;
            const line = new Line(
              [dims.w / 2 - 150, dims.h / 2, dims.w / 2 + 150, dims.h / 2],
              {
                stroke: "#4ecdc4",
                strokeWidth: 4,
                fill: "",
                ...options,
              } as any
            );
            (line as any).data = { id: crypto.randomUUID(), role: "shape", editable: true };
            canvas.add(line);
            canvas.setActiveObject(line);
            canvas.renderAll();
          });
        },

        undo: undoAction,
        redo: redoAction,

        setBackgroundColor: (color: string) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          canvas.backgroundColor = color;
          canvas.renderAll();
          saveHistory();
        },

        setBackgroundImage: async (url: string) => {
          const fabricModule = await import("fabric");
          const canvas = fabricRef.current;
          if (!canvas) return;
          const img = await fabricModule.FabricImage.fromURL(url, {
            crossOrigin: "anonymous",
          });
          // Scale to cover canvas
          const scaleX = dims.w / (img.width || 1);
          const scaleY = dims.h / (img.height || 1);
          const bgScale = Math.max(scaleX, scaleY);

          // Check for existing background image object (from PSD/templates)
          const existingBg = canvas.getObjects().find(
            (obj: any) => obj.data?.role === "background-image"
          );

          if (existingBg) {
            // Replace the existing background object at the same position
            const existingIndex = canvas.getObjects().indexOf(existingBg);
            canvas.remove(existingBg);
            img.set({
              left: 0,
              top: 0,
              scaleX: bgScale,
              scaleY: bgScale,
              selectable: false,
              evented: false,
              data: { id: crypto.randomUUID(), role: "background-image", editable: false },
            });
            canvas.insertAt(img, existingIndex);
          } else {
            // No background object — also clear any existing canvas.backgroundImage
            img.set({ scaleX: bgScale, scaleY: bgScale });
            canvas.backgroundImage = img;
          }

          canvas.renderAll();
          saveHistory();
        },

        zoomToFit: () => {
          userZoomedRef.current = false; // Allow ResizeObserver to adjust again
          setScale(computeScale());
          setPanOffset({ x: 0, y: 0 });
        },

        getCanvas: () => fabricRef.current,

        // ── Alignment ──
        alignSelected: (alignment) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const obj = canvas.getActiveObject();
          if (!obj) return;

          const W = canvas.width!;
          const H = canvas.height!;

          switch (alignment) {
            case 'left':
              obj.set({ left: 0 });
              break;
            case 'center-h':
              obj.set({ left: (W - obj.getScaledWidth()) / 2 });
              break;
            case 'right':
              obj.set({ left: W - obj.getScaledWidth() });
              break;
            case 'top':
              obj.set({ top: 0 });
              break;
            case 'center-v':
              obj.set({ top: (H - obj.getScaledHeight()) / 2 });
              break;
            case 'bottom':
              obj.set({ top: H - obj.getScaledHeight() });
              break;
          }
          obj.setCoords();
          canvas.requestRenderAll();
          saveHistory();
          emitSelection(obj);
        },

        // ── Distribution ──
        distributeSelected: (direction) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const activeObj = canvas.getActiveObject();
          if (!activeObj || activeObj.type !== 'activeSelection') return;

          const objects = (activeObj as any)._objects as any[];
          if (objects.length < 3) return;

          if (direction === 'horizontal') {
            const sorted = [...objects].sort((a, b) => a.left - b.left);
            const first = sorted[0].left;
            const last = sorted[sorted.length - 1].left;
            const gap = (last - first) / (sorted.length - 1);
            sorted.forEach((obj, i) => {
              obj.set({ left: first + gap * i });
              obj.setCoords();
            });
          } else {
            const sorted = [...objects].sort((a, b) => a.top - b.top);
            const first = sorted[0].top;
            const last = sorted[sorted.length - 1].top;
            const gap = (last - first) / (sorted.length - 1);
            sorted.forEach((obj, i) => {
              obj.set({ top: first + gap * i });
              obj.setCoords();
            });
          }

          canvas.requestRenderAll();
          saveHistory();
        },

        // ── Flip ──
        flipSelected: (direction) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const obj = canvas.getActiveObject();
          if (!obj) return;

          if (direction === 'horizontal') {
            obj.set({ flipX: !obj.flipX });
          } else {
            obj.set({ flipY: !obj.flipY });
          }
          obj.setCoords();
          canvas.requestRenderAll();
          saveHistory();
          emitSelection(obj);
        },

        // ── Lock/Unlock ──
        toggleLockSelected: () => {
          const canvas = fabricRef.current;
          if (!canvas) return false;
          const obj = canvas.getActiveObject();
          if (!obj) return false;

          const isLocked = !obj.selectable || !obj.evented;
          obj.set({
            selectable: isLocked ? true : false,
            evented: isLocked ? true : false,
            lockMovementX: !isLocked,
            lockMovementY: !isLocked,
            lockScalingX: !isLocked,
            lockScalingY: !isLocked,
            lockRotation: !isLocked,
          });

          if (!isLocked) {
            canvas.discardActiveObject();
          }

          canvas.requestRenderAll();
          saveHistory();
          return !isLocked; // returns new locked state
        },

        // ── Rich text: apply style to selection ──
        applyStyleToSelection: (style: Record<string, any>) => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const obj = canvas.getActiveObject();
          // Duck-type check: works with Textbox, IText, FabricText — any text object
          if (!obj || typeof (obj as any).setSelectionStyles !== 'function') return;

          const textbox = obj as any;
          const start = textbox.selectionStart ?? 0;
          const end = textbox.selectionEnd ?? 0;

          if (!textbox.isEditing || start === end) {
            // No text selected or not editing — apply to whole object
            textbox.set(style);
          } else {
            // Apply to selected characters using Fabric's built-in method
            textbox.setSelectionStyles(style, start, end);
          }

          canvas.requestRenderAll();
          saveHistory();
          emitSelection(obj);

          // Re-emit text selection info so toolbar updates
          if (textbox.isEditing && onTextSelectionChange) {
            const selStyles = textbox.getSelectionStyles?.(start, end);
            const firstStyle = selStyles?.[0] || {};
            onTextSelectionChange({
              start,
              end,
              hasSelection: start !== end,
              styles: firstStyle,
            });
          }
        },

        // ── Rich text: get style of current selection ──
        getSelectionStyle: () => {
          const canvas = fabricRef.current;
          if (!canvas) return null;
          const obj = canvas.getActiveObject();
          if (!obj || typeof (obj as any).getSelectionStyles !== 'function') return null;

          const textbox = obj as any;
          if (!textbox.isEditing) return null;

          const start = textbox.selectionStart ?? 0;
          const end = textbox.selectionEnd ?? 0;

          if (start === end) {
            // Cursor position, no selection — return object-level styles
            return {
              fontWeight: textbox.fontWeight,
              fontStyle: textbox.fontStyle,
              fill: textbox.fill,
              textBackgroundColor: textbox.textBackgroundColor,
              underline: textbox.underline,
              linethrough: textbox.linethrough,
              fontSize: textbox.fontSize,
            };
          }

          const selStyles = textbox.getSelectionStyles?.(start, end);
          if (selStyles && selStyles.length > 0) {
            return selStyles[0];
          }
          return null;
        },

        // ── Rich text: check if currently editing text ──
        isEditingText: () => {
          const canvas = fabricRef.current;
          if (!canvas) return false;
          const obj = canvas.getActiveObject();
          if (!obj || typeof (obj as any).setSelectionStyles !== 'function') return false;
          return !!(obj as any).isEditing;
        },

        // ── Add image frame (clip mask / mockup frame) ──
        addImageFrame: (options?: { width?: number; height?: number; rx?: number; ry?: number; shape?: 'rect' | 'rounded' | 'circle' | 'hexagon' }) => {
          import("fabric").then(({ Rect, IText, Group }) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const w = options?.width || 400;
            const h = options?.height || 400;
            const shape = options?.shape || 'rounded';
            let rx = options?.rx ?? (shape === 'rect' ? 0 : shape === 'circle' ? Math.min(w, h) / 2 : 20);
            let ry = options?.ry ?? rx;

            const frame = new Rect({
              width: w,
              height: h,
              rx,
              ry,
              fill: '#1a1e42',
              stroke: '#4ecdc4',
              strokeWidth: 2,
              strokeDashArray: [8, 4],
            });

            const label = new IText('Arraste uma imagem aqui', {
              fontSize: 16,
              fill: '#5e6388',
              fontFamily: 'Plus Jakarta Sans',
              textAlign: 'center',
              originX: 'center',
              originY: 'center',
              left: w / 2,
              top: h / 2,
              selectable: false,
              evented: false,
            });

            const group = new Group([frame, label], {
              left: (canvas.width! - w) / 2,
              top: (canvas.height! - h) / 2,
            } as any);
            (group as any).data = {
              id: crypto.randomUUID(),
              role: 'image-frame',
              frameWidth: w,
              frameHeight: h,
              frameRx: rx,
              frameRy: ry,
              frameShape: shape,
            };

            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.renderAll();
            saveHistory();
          });
        },

        // ── Fill image frame with image (clip mask) ──
        fillImageFrame: async (frameId: string, imageUrl: string) => {
          const canvas = fabricRef.current;
          if (!canvas) return;

          const frame = canvas.getObjects().find(
            (obj: any) => obj.data?.id === frameId && obj.data?.role === 'image-frame'
          );
          if (!frame) return;

          const fw = (frame as any).data?.frameWidth || (frame as any).width || 400;
          const fh = (frame as any).data?.frameHeight || (frame as any).height || 400;
          const rx = (frame as any).data?.frameRx || 20;
          const ry = (frame as any).data?.frameRy || 20;
          const frameLeft = frame.left || 0;
          const frameTop = frame.top || 0;

          const { FabricImage, Rect } = await import("fabric");

          const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
          if (!img.width || !img.height) return;

          // Scale to COVER the frame
          const coverScale = Math.max(fw / img.width, fh / img.height);

          // Center the image within the frame
          const imgW = img.width * coverScale;
          const imgH = img.height * coverScale;
          const offsetX = (imgW - fw) / 2;
          const offsetY = (imgH - fh) / 2;

          img.set({
            scaleX: coverScale,
            scaleY: coverScale,
            left: frameLeft - offsetX,
            top: frameTop - offsetY,
            // ClipPath is in the object's local coordinate space (before scaling)
            clipPath: new Rect({
              width: fw / coverScale,
              height: fh / coverScale,
              rx: rx / coverScale,
              ry: ry / coverScale,
              left: offsetX / coverScale,
              top: offsetY / coverScale,
            }),
            data: { id: crypto.randomUUID(), role: 'framed-image', sourceFrameId: frameId },
          });

          canvas.remove(frame);
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveHistory();
        },

        // ── Set frame shape ──
        setFrameShape: (frameId: string, shape: 'rect' | 'rounded' | 'circle' | 'hexagon') => {
          const canvas = fabricRef.current;
          if (!canvas) return;

          const frame = canvas.getObjects().find(
            (obj: any) => obj.data?.id === frameId && obj.data?.role === 'image-frame'
          );
          if (!frame) return;

          const fw = (frame as any).data?.frameWidth || (frame as any).width || 400;
          const fh = (frame as any).data?.frameHeight || (frame as any).height || 400;

          let rx = 0;
          let ry = 0;
          switch (shape) {
            case 'rect': rx = 0; ry = 0; break;
            case 'rounded': rx = 20; ry = 20; break;
            case 'circle': rx = Math.min(fw, fh) / 2; ry = Math.min(fw, fh) / 2; break;
            case 'hexagon': rx = 0; ry = 0; break;
          }

          (frame as any).data.frameRx = rx;
          (frame as any).data.frameRy = ry;
          (frame as any).data.frameShape = shape;

          // If it's a Group, update the first child (the Rect)
          if (typeof (frame as any).getObjects === 'function') {
            const rect = (frame as any).getObjects()[0];
            if (rect) {
              rect.set({ rx, ry });
            }
          }

          canvas.renderAll();
          saveHistory();
          emitSelection(frame);
        },

        // ── Set frame border radius ──
        setFrameRadius: (frameId: string, radius: number) => {
          const canvas = fabricRef.current;
          if (!canvas) return;

          const frame = canvas.getObjects().find(
            (obj: any) => obj.data?.id === frameId && obj.data?.role === 'image-frame'
          );
          if (!frame) return;

          (frame as any).data.frameRx = radius;
          (frame as any).data.frameRy = radius;

          if (typeof (frame as any).getObjects === 'function') {
            const rect = (frame as any).getObjects()[0];
            if (rect) rect.set({ rx: radius, ry: radius });
          }

          canvas.renderAll();
          saveHistory();
          emitSelection(frame);
        },
      }),
      [dims.w, dims.h, undoAction, redoAction, saveHistory, emitSelection, computeScale, onCanvasChange, addImageFromDataUrl, onTextSelectionChange]
    );

    // ── Expose canUndo / canRedo via data attributes for parent to read ──
    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    return (
      <div
        ref={containerRef}
        className={`relative flex items-center justify-center overflow-hidden rounded-lg ${className}`}
        style={{ width: "92%", height: "92%", maxWidth: "92%", maxHeight: "92%" }}
        data-can-undo={canUndo}
        data-can-redo={canRedo}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Loading state */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#4ecdc4]/30 border-t-[#4ecdc4] rounded-full animate-spin" />
              <span className="text-xs text-[#5e6388]">Carregando editor...</span>
            </div>
          </div>
        )}

        {/* Drag-and-drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b1e]/80 border-2 border-dashed border-[#4ecdc4] rounded-lg pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <ImagePlus size={40} className="text-[#4ecdc4]" />
              <span className="text-sm text-[#4ecdc4] font-medium">Solte a imagem aqui</span>
            </div>
          </div>
        )}

        {/* Checkerboard background behind canvas */}
        <div
          className="relative"
          style={{
            width: dims.w * scale,
            height: dims.h * scale,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {/* Canvas wrapper with CSS scale */}
          <div
            style={{
              width: dims.w,
              height: dims.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <canvas ref={canvasElRef} />
          </div>

          {/* Subtle border around scaled canvas */}
          <div
            className="absolute inset-0 pointer-events-none rounded-sm"
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        </div>
      </div>
    );
  }
);

FabricCanvas.displayName = "FabricCanvas";
export { FabricCanvas };
export default FabricCanvas;
