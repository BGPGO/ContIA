"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";

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
    const [scale, setScale] = useState(1);
    const [ready, setReady] = useState(false);

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
        });

        // ── Events: change tracking ──
        const handleChange = () => {
          saveHistory();
          onCanvasChange?.();
        };
        canvasInstance.on("object:modified", handleChange);
        canvasInstance.on("object:added", handleChange);
        canvasInstance.on("object:removed", handleChange);

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
          const fabricModule = await import("fabric");
          const canvas = fabricRef.current;
          if (!canvas) return;
          const img = await fabricModule.FabricImage.fromURL(url, {
            crossOrigin: "anonymous",
          });
          // Scale to fit ~50% of canvas
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
      }),
      [dims.w, dims.h, undoAction, redoAction, saveHistory, emitSelection, computeScale, onCanvasChange]
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
