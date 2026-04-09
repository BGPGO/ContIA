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
  };
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
}

export interface FabricCanvasProps {
  width: number;
  height: number;
  canvasJson?: object;
  aspectRatio: "1:1" | "4:5" | "9:16";
  onSelectionChange?: (selection: SelectionInfo | null) => void;
  onCanvasChange?: () => void;
  onReady?: () => void;
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
      fill: typeof obj.fill === "string" ? obj.fill : "#000000",
      fontSize: obj.fontSize,
      fontFamily: obj.fontFamily,
      fontWeight: String(obj.fontWeight ?? ""),
      textAlign: obj.textAlign,
      opacity: obj.opacity != null ? Math.round(obj.opacity * 100) : 100,
      text: obj.text,
    },
  };
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
          addImageFromDataUrl(dataUrl);
        };
        reader.readAsDataURL(imageFile);
      }
    }, [addImageFromDataUrl]);

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

        // ── Events: snapping & smart guides ──
        canvasInstance.on("object:moving", handleObjectMoving);

        // ── Load initial JSON if provided ──
        if (canvasJson) {
          canvasInstance.loadFromJSON(canvasJson).then(() => {
            canvasInstance.renderAll();
            saveHistory();
          });
        } else {
          saveHistory();
        }

        // ── Compute initial scale ──
        const s = computeScale();
        setScale(s);
        setReady(true);
        onReady?.();
      });

      return () => {
        cancelled = true;
        if (canvasInstance) {
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
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const ro = new ResizeObserver(() => {
        setScale(computeScale());
      });
      ro.observe(container);
      return () => ro.disconnect();
    }, [computeScale]);

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
          if (active) {
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
      canvas.loadFromJSON(JSON.parse(json)).then(() => {
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
      canvas.loadFromJSON(JSON.parse(json)).then(() => {
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
          await canvas.loadFromJSON(json);
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
          img.set({ scaleX: bgScale, scaleY: bgScale });
          canvas.backgroundImage = img;
          canvas.renderAll();
          saveHistory();
        },

        zoomToFit: () => {
          setScale(computeScale());
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
      }),
      [dims.w, dims.h, undoAction, redoAction, saveHistory, emitSelection, computeScale, onCanvasChange, addImageFromDataUrl]
    );

    // ── Expose canUndo / canRedo via data attributes for parent to read ──
    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    return (
      <div
        ref={containerRef}
        className={`relative flex items-center justify-center w-full h-full overflow-hidden ${className}`}
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
