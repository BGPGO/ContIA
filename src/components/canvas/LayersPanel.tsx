"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Type as TypeIcon,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  Layers,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { SelectionInfo, FabricCanvasRef } from "./FabricCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface LayersPanelProps {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  selection: SelectionInfo | null;
  onRefresh?: () => void;
}

interface LayerInfo {
  index: number;
  id: string;
  type: string;
  role: string | null;
  text?: string;
  fill?: string;
  visible: boolean;
  locked: boolean;
  name?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const ROLE_COLORS: Record<string, string> = {
  headline: "#4ecdc4",
  body: "#6c5ce7",
  cta: "#e11d48",
  brand: "#f59e0b",
  "background-image": "#3b82f6",
  image: "#22c55e",
  shape: "#8b5cf6",
  text: "#4ecdc4",
  logo: "#f59e0b",
};

function getLayerIcon(type: string) {
  switch (type) {
    case "textbox":
    case "text":
    case "i-text":
      return TypeIcon;
    case "image":
      return ImageIcon;
    case "rect":
      return Square;
    case "circle":
      return Circle;
    case "line":
      return Minus;
    default:
      return Square;
  }
}

function getLayerLabel(layer: LayerInfo): string {
  if (layer.name) return layer.name;
  if (layer.text) return layer.text.slice(0, 20) + (layer.text.length > 20 ? "..." : "");
  switch (layer.type) {
    case "textbox":
    case "text":
    case "i-text":
      return "Texto";
    case "image":
      return layer.role === "background-image" ? "Fundo (imagem)" : "Imagem";
    case "rect":
      return "Retangulo";
    case "circle":
      return "Circulo";
    case "line":
      return "Linha";
    default:
      return layer.type || "Objeto";
  }
}

function getObjectsFromCanvas(canvasRef: React.RefObject<FabricCanvasRef | null>): LayerInfo[] {
  const canvas = canvasRef.current?.getCanvas();
  if (!canvas) return [];

  const objects = canvas.getObjects();
  return objects
    .map((obj: any, index: number) => {
      // Skip guideline objects
      if (obj.data?._guideline) return null;

      return {
        index,
        id: obj.data?.id || String(index),
        type: obj.type || "object",
        role: obj.data?.role || null,
        text: obj.text,
        fill: typeof obj.fill === "string" ? obj.fill : undefined,
        visible: obj.visible !== false,
        locked: obj.selectable === false,
        name: obj.data?.name,
      } satisfies LayerInfo;
    })
    .filter(Boolean) as LayerInfo[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   LayerRow
   ═══════════════════════════════════════════════════════════════════════════ */

function LayerRow({
  layer,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  layer: LayerInfo;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = getLayerIcon(layer.type);
  const label = getLayerLabel(layer);
  const roleColor = layer.role ? ROLE_COLORS[layer.role] || "#5e6388" : null;

  return (
    <div
      className={`
        group flex items-center h-10 px-2 gap-1.5 cursor-pointer select-none transition-all
        ${isSelected ? "bg-[#4ecdc4]/10 border-l-2 border-[#4ecdc4]" : "border-l-2 border-transparent"}
        ${!isSelected ? "hover:bg-white/5" : ""}
        ${!layer.visible ? "opacity-50" : ""}
      `}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Visibility toggle */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
        className="shrink-0 p-0.5 text-[#5e6388] hover:text-[#e8eaff] transition-colors cursor-pointer"
        title={layer.visible ? "Ocultar" : "Mostrar"}
      >
        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>

      {/* Lock toggle */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        className="shrink-0 p-0.5 text-[#5e6388] hover:text-[#e8eaff] transition-colors cursor-pointer"
        title={layer.locked ? "Desbloquear" : "Bloquear"}
      >
        {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
      </button>

      {/* Icon + color preview */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center rounded" style={layer.fill && layer.type !== "image" ? { backgroundColor: layer.fill + "30" } : {}}>
        <Icon size={12} className="text-[#8b8fb0]" style={layer.fill && layer.type !== "image" ? { color: layer.fill } : {}} />
      </div>

      {/* Layer name */}
      <span className="flex-1 min-w-0 text-xs text-[#e8eaff] truncate">
        {label}
      </span>

      {/* Role badge */}
      {layer.role && !hovered && (
        <span
          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: (roleColor || "#5e6388") + "20",
            color: roleColor || "#5e6388",
          }}
        >
          {layer.role}
        </span>
      )}

      {/* Hover actions: UP / DOWN / Duplicate / Delete */}
      {hovered && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="p-0.5 text-[#5e6388] hover:text-[#4ecdc4] transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
            title="Mover para frente (z-index +)"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="p-0.5 text-[#5e6388] hover:text-[#4ecdc4] transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
            title="Mover para tras (z-index -)"
          >
            <ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-0.5 text-[#5e6388] hover:text-[#e8eaff] transition-colors cursor-pointer"
            title="Duplicar"
          >
            <Copy size={10} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 text-[#5e6388] hover:text-red-400 transition-colors cursor-pointer"
            title="Excluir"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LayersPanel
   ═══════════════════════════════════════════════════════════════════════════ */

export function LayersPanel({ canvasRef, selection, onRefresh }: LayersPanelProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh layers list from canvas
  const refreshLayers = useCallback(() => {
    const newLayers = getObjectsFromCanvas(canvasRef);
    setLayers(newLayers);
  }, [canvasRef]);

  // Auto-refresh on selection change and periodically
  useEffect(() => {
    refreshLayers();
  }, [selection, refreshLayers]);

  // Set up canvas event listeners for real-time updates
  useEffect(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    const handleChange = () => {
      // Small delay to let fabric finish its operation
      setTimeout(refreshLayers, 50);
    };

    canvas.on("object:added", handleChange);
    canvas.on("object:removed", handleChange);
    canvas.on("object:modified", handleChange);

    return () => {
      canvas.off("object:added", handleChange);
      canvas.off("object:removed", handleChange);
      canvas.off("object:modified", handleChange);
    };
  }, [canvasRef, refreshLayers]);

  // Also poll periodically to catch any missed updates
  useEffect(() => {
    refreshTimerRef.current = setInterval(refreshLayers, 2000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshLayers]);

  // ── Actions ──

  const handleSelect = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj || obj.selectable === false) return;
    canvas.setActiveObject(obj);
    canvas.renderAll();
  }, [canvasRef]);

  const handleToggleVisibility = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj) return;
    obj.set({ visible: !obj.visible });
    canvas.renderAll();
    refreshLayers();
  }, [canvasRef, refreshLayers]);

  const handleToggleLock = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj) return;

    const isLocked = obj.selectable === false;
    obj.set({
      selectable: isLocked,
      evented: isLocked,
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
      lockRotation: !isLocked,
    });

    if (!isLocked) {
      canvas.discardActiveObject();
    }

    canvas.renderAll();
    refreshLayers();
  }, [canvasRef, refreshLayers]);

  const handleDelete = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    refreshLayers();
  }, [canvasRef, refreshLayers]);

  const handleDuplicate = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj) return;

    obj.clone(["data"]).then((cloned: any) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        data: { ...cloned.data, id: crypto.randomUUID() },
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      refreshLayers();
    });
  }, [canvasRef, refreshLayers]);

  // ── Move Up / Down (z-index reorder) ──
  // "Move Up" in the display = bring forward in canvas (higher z-index)
  // "Move Down" in the display = send backward in canvas (lower z-index)

  const handleMoveUp = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj) return;
    canvas.bringObjectForward(obj);
    canvas.renderAll();
    refreshLayers();
  }, [canvasRef, refreshLayers]);

  const handleMoveDown = useCallback((index: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const objects = canvas.getObjects();
    const obj = objects[index];
    if (!obj) return;
    canvas.sendObjectBackwards(obj);
    canvas.renderAll();
    refreshLayers();
  }, [canvasRef, refreshLayers]);

  // ── Determine selected object index ──
  const selectedId = selection?.id || null;

  // Reverse for display: top = frontmost (highest z-index)
  const displayLayers = [...layers].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
        <Layers size={12} className="text-[#4ecdc4]/60" />
        <span className="text-xs font-semibold text-[#5e6388] uppercase tracking-wider flex-1">
          Camadas
        </span>
        <span className="text-[10px] text-[#5e6388] tabular-nums">
          {layers.length}
        </span>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">
        {displayLayers.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <p className="text-xs text-[#5e6388] text-center leading-relaxed">
              Nenhum elemento no canvas
            </p>
          </div>
        ) : (
          displayLayers.map((layer, displayIndex) => {
            const isSelected = layer.id === selectedId;
            // In display: first item = topmost (highest z-index), can't go higher
            // In display: last item = bottommost (lowest z-index), can't go lower
            const isFirst = displayIndex === 0;
            const isLast = displayIndex === displayLayers.length - 1;
            return (
              <LayerRow
                key={`${layer.index}-${layer.id}`}
                layer={layer}
                isSelected={isSelected}
                isFirst={isFirst}
                isLast={isLast}
                onSelect={() => handleSelect(layer.index)}
                onToggleVisibility={() => handleToggleVisibility(layer.index)}
                onToggleLock={() => handleToggleLock(layer.index)}
                onDelete={() => handleDelete(layer.index)}
                onDuplicate={() => handleDuplicate(layer.index)}
                onMoveUp={() => handleMoveUp(layer.index)}
                onMoveDown={() => handleMoveDown(layer.index)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default LayersPanel;
