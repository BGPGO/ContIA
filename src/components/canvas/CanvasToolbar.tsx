"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Undo2,
  Redo2,
  Type,
  ImagePlus,
  Square,
  Circle,
  Trash2,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Paintbrush,
  Replace,
  ArrowUpToLine,
  ArrowDownToLine,
  Plus,
  Minus,
  Palette,
  ImageUp,
} from "lucide-react";
import type { SelectionInfo, FabricCanvasRef } from "./FabricCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface CanvasToolbarProps {
  selection: SelectionInfo | null;
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  aspectRatio: "1:1" | "4:5" | "9:16";
  onAspectRatioChange: (ratio: "1:1" | "4:5" | "9:16") => void;
  canUndo: boolean;
  canRedo: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-md transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "bg-[#4ecdc4]/20 text-[#4ecdc4]"
          : "text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff]"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-white/10 mx-1" />;
}

function ColorPickerPopover({
  value,
  onChange,
  presets,
}: {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const defaultPresets = [
    "#e8eaff",
    "#ffffff",
    "#080b1e",
    "#141736",
    "#4ecdc4",
    "#6c5ce7",
    "#e11d48",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
  ];
  const colors = presets || defaultPresets;

  useEffect(() => setHex(value), [value]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-6 h-6 rounded-full border-2 border-white/20 hover:border-white/40 transition-all cursor-pointer"
        style={{ backgroundColor: value }}
        title="Escolher cor"
      />
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-[#141736] border border-white/10 rounded-xl shadow-xl p-3 w-48">
          {/* Preset grid */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setHex(c);
                }}
                className={`w-7 h-7 rounded-md border-2 transition-all cursor-pointer ${
                  value === c
                    ? "border-white/60 scale-110"
                    : "border-transparent hover:border-white/20"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {/* Hex input */}
          <div className="flex items-center gap-2">
            <input
              ref={colorInputRef}
              type="color"
              value={hex}
              onChange={(e) => {
                setHex(e.target.value);
                onChange(e.target.value);
              }}
              className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/10"
            />
            <input
              type="text"
              value={hex}
              onChange={(e) => {
                setHex(e.target.value);
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                  onChange(e.target.value);
                }
              }}
              onBlur={() => {
                if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
              }}
              className="flex-1 bg-[#0c0f24] border border-white/10 rounded px-2 py-1 text-xs text-[#e8eaff] font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AddElementDropdown({
  canvasRef,
}: {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    {
      label: "Texto",
      icon: Type,
      action: () => canvasRef.current?.addText("Novo texto"),
    },
    {
      label: "Imagem",
      icon: ImagePlus,
      action: () => fileInputRef.current?.click(),
    },
    {
      label: "Retangulo",
      icon: Square,
      action: () => canvasRef.current?.addRect(),
    },
    {
      label: "Circulo",
      icon: Circle,
      action: () => canvasRef.current?.addCircle(),
    },
  ];

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      canvasRef.current?.addImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <ToolbarButton onClick={() => setOpen(!open)} title="Adicionar elemento">
        <Plus size={16} />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFile}
        className="hidden"
      />
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#141736] border border-white/10 rounded-xl shadow-xl py-1 min-w-[160px]">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#8b8fb0] hover:bg-white/5 hover:text-[#e8eaff] transition-colors cursor-pointer"
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FontSizeStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    <div className="flex items-center bg-[#141736] rounded-lg border border-white/10">
      <button
        type="button"
        onClick={() => onChange(Math.max(8, value - 2))}
        className="p-1.5 text-[#8b8fb0] hover:text-[#e8eaff] transition-colors cursor-pointer"
      >
        <Minus size={12} />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(8, Math.min(200, Number(e.target.value) || 48)))}
        className="w-10 bg-transparent text-center text-xs text-[#e8eaff] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(200, value + 2))}
        className="p-1.5 text-[#8b8fb0] hover:text-[#e8eaff] transition-colors cursor-pointer"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

function FontFamilySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (font: string) => void;
}) {
  const fonts = [
    "Plus Jakarta Sans",
    "Inter",
    "Formula1 Display",
    "Formula1 Wide",
    "Genius Techno",
    "Georgia",
    "Arial",
    "Courier New",
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#141736] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#e8eaff] cursor-pointer focus:outline-none focus:border-[#4ecdc4]/50 max-w-[140px]"
    >
      {fonts.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}

function OpacitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 h-1 accent-[#4ecdc4] cursor-pointer"
      />
      <span className="text-[10px] text-[#5e6388] w-7 text-right">
        {value}%
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Toolbar
   ═══════════════════════════════════════════════════════════════════════════ */

export function CanvasToolbar({
  selection,
  canvasRef,
  aspectRatio,
  onAspectRatioChange,
  canUndo,
  canRedo,
}: CanvasToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProp = useCallback(
    (props: Record<string, any>) => {
      canvasRef.current?.updateSelectedObject(props);
    },
    [canvasRef]
  );

  const isText =
    selection?.type === "textbox" ||
    selection?.type === "text" ||
    selection?.type === "i-text";
  const isShape =
    selection?.type === "rect" ||
    selection?.type === "circle" ||
    selection?.type === "triangle" ||
    selection?.type === "polygon" ||
    selection?.type === "line";
  const isImage = selection?.type === "image";

  // ── Replace image handler ──
  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const canvas = canvasRef.current?.getCanvas();
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;
      const fabricModule = await import("fabric");
      const img = await fabricModule.FabricImage.fromURL(
        reader.result as string,
        { crossOrigin: "anonymous" }
      );
      img.set({
        left: active.left,
        top: active.top,
        scaleX: active.scaleX,
        scaleY: active.scaleY,
        data: active.data,
      });
      canvas.remove(active);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Background image upload ──
  const handleBgImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      canvasRef.current?.setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Layer operations ──
  const bringForward = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) {
      canvas.bringObjectForward(obj);
      canvas.renderAll();
    }
  };

  const sendBackward = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) {
      canvas.sendObjectBackwards(obj);
      canvas.renderAll();
    }
  };

  const sendToBack = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) {
      canvas.sendObjectToBack(obj);
      canvas.renderAll();
    }
  };

  const bringToFront = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) {
      canvas.bringObjectToFront(obj);
      canvas.renderAll();
    }
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-[#0c0f24] border-b border-white/10 flex-wrap">
      {/* ── LEFT: Always visible ── */}
      <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
        <ToolbarButton
          onClick={() => canvasRef.current?.undo()}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => canvasRef.current?.redo()}
          disabled={!canRedo}
          title="Refazer (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </ToolbarButton>
      </div>

      <AddElementDropdown canvasRef={canvasRef} />

      {/* Aspect ratio toggle */}
      <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
        {(["1:1", "4:5", "9:16"] as const).map((ratio) => (
          <button
            key={ratio}
            type="button"
            onClick={() => onAspectRatioChange(ratio)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              aspectRatio === ratio
                ? "bg-[#4ecdc4]/20 text-[#4ecdc4]"
                : "text-[#5e6388] hover:text-[#8b8fb0] hover:bg-white/5"
            }`}
          >
            {ratio}
          </button>
        ))}
      </div>

      <ToolbarSeparator />

      {/* ── CENTER: Context-sensitive ── */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {isText && (
          <>
            <FontFamilySelect
              value={selection.props.fontFamily || "Plus Jakarta Sans"}
              onChange={(font) => updateProp({ fontFamily: font })}
            />
            <FontSizeStepper
              value={selection.props.fontSize || 48}
              onChange={(size) => updateProp({ fontSize: size })}
            />
            <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
              <ToolbarButton
                onClick={() =>
                  updateProp({
                    fontWeight:
                      selection.props.fontWeight === "bold" ||
                      Number(selection.props.fontWeight) >= 700
                        ? "normal"
                        : "bold",
                  })
                }
                active={
                  selection.props.fontWeight === "bold" ||
                  Number(selection.props.fontWeight) >= 700
                }
                title="Negrito"
              >
                <Bold size={14} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  const obj = canvasRef.current?.getSelectedObject();
                  if (!obj) return;
                  updateProp({
                    fontStyle:
                      obj.fontStyle === "italic" ? "normal" : "italic",
                  });
                }}
                active={false}
                title="Italico"
              >
                <Italic size={14} />
              </ToolbarButton>
            </div>
            <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
              <ToolbarButton
                onClick={() => updateProp({ textAlign: "left" })}
                active={selection.props.textAlign === "left"}
                title="Alinhar esquerda"
              >
                <AlignLeft size={14} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => updateProp({ textAlign: "center" })}
                active={selection.props.textAlign === "center"}
                title="Centralizar"
              >
                <AlignCenter size={14} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => updateProp({ textAlign: "right" })}
                active={selection.props.textAlign === "right"}
                title="Alinhar direita"
              >
                <AlignRight size={14} />
              </ToolbarButton>
            </div>
            <ColorPickerPopover
              value={selection.props.fill || "#e8eaff"}
              onChange={(color) => updateProp({ fill: color })}
            />
          </>
        )}

        {isShape && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#5e6388] uppercase">
                Preenchimento
              </span>
              <ColorPickerPopover
                value={selection.props.fill || "#4ecdc4"}
                onChange={(color) => updateProp({ fill: color })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#5e6388] uppercase">
                Borda
              </span>
              <ColorPickerPopover
                value={"#ffffff"}
                onChange={(color) => updateProp({ stroke: color })}
              />
              <FontSizeStepper
                value={0}
                onChange={(w) => updateProp({ strokeWidth: w })}
              />
            </div>
            <OpacitySlider
              value={selection.props.opacity ?? 100}
              onChange={(v) => updateProp({ opacity: v / 100 })}
            />
          </>
        )}

        {isImage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplaceImage}
              className="hidden"
            />
            <ToolbarButton
              onClick={() => fileInputRef.current?.click()}
              title="Substituir imagem"
            >
              <Replace size={15} />
            </ToolbarButton>
            <OpacitySlider
              value={selection.props.opacity ?? 100}
              onChange={(v) => updateProp({ opacity: v / 100 })}
            />
            <ToolbarButton onClick={sendToBack} title="Enviar para tras">
              <ArrowDownToLine size={15} />
            </ToolbarButton>
            <ToolbarButton onClick={bringToFront} title="Trazer para frente">
              <ArrowUpToLine size={15} />
            </ToolbarButton>
          </>
        )}

        {!selection && (
          <>
            <div className="flex items-center gap-2">
              <Palette size={13} className="text-[#5e6388]" />
              <span className="text-[10px] text-[#5e6388] uppercase">
                Fundo
              </span>
              <ColorPickerPopover
                value="#080b1e"
                onChange={(color) =>
                  canvasRef.current?.setBackgroundColor(color)
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleBgImage}
                className="hidden"
                id="bg-image-input"
              />
              <ToolbarButton
                onClick={() =>
                  (
                    document.getElementById("bg-image-input") as HTMLInputElement
                  )?.click()
                }
                title="Imagem de fundo"
              >
                <ImageUp size={15} />
              </ToolbarButton>
            </div>
          </>
        )}
      </div>

      <ToolbarSeparator />

      {/* ── RIGHT: Always visible ── */}
      <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
        <ToolbarButton
          onClick={bringForward}
          disabled={!selection}
          title="Mover para frente"
        >
          <ChevronUp size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={sendBackward}
          disabled={!selection}
          title="Mover para tras"
        >
          <ChevronDown size={15} />
        </ToolbarButton>
      </div>

      <ToolbarButton
        onClick={() => canvasRef.current?.deleteSelected()}
        disabled={!selection}
        title="Excluir (Delete)"
      >
        <Trash2 size={15} />
      </ToolbarButton>
    </div>
  );
}

export default CanvasToolbar;
