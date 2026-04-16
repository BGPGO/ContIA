"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Undo2,
  Redo2,
  Type,
  ImagePlus,
  Square,
  Circle,
  Trash2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Replace,
  Plus,
  Minus,
  Palette,
  ImageUp,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  FlipHorizontal,
  FlipVertical,
  Lock,
  Unlock,
  Link,
  Triangle,
  Hexagon,
  Star,
  Minus as MinusLine,
  CornerUpLeft,
  ChevronDown,
  Underline,
  Strikethrough,
  Highlighter,
  Settings2,
  ArrowUpDown,
  Space,
} from "lucide-react";
import type { SelectionInfo, FabricCanvasRef, TextSelectionInfo } from "./FabricCanvas";

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
  isEditingText?: boolean;
  textSelection?: TextSelectionInfo | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Portal Dropdown: renders dropdown in document.body so it's ALWAYS on top ── */

function PortalDropdown({
  anchorRef,
  open,
  children,
  className = "",
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-toolbar-portal
      className={`fixed bg-[#141736] border border-white/10 rounded-xl shadow-2xl ${className}`}
      style={{ top: pos.top, left: pos.left, zIndex: 99999 }}
    >
      {children}
    </div>,
    document.body
  );
}

function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  className: extraClass,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  className?: string;
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
      } ${extraClass || ""}`}
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

  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-6 h-6 rounded-full border-2 border-white/20 hover:border-white/40 transition-all cursor-pointer"
        style={{ backgroundColor: value }}
        title="Escolher cor"
      />
      <PortalDropdown anchorRef={btnRef} open={open} className="p-3 w-48">
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
      </PortalDropdown>
    </div>
  );
}

function HighlightColorPicker({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (color: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const highlightColors = [
    "#facc15", // yellow
    "#fb923c", // orange
    "#4ade80", // green
    "#60a5fa", // blue
    "#c084fc", // purple
    "#fb7185", // pink
    "#4ecdc4", // teal (brand)
    "#e8eaff", // light
    "#ffffff", // white
    "#080b1e", // dark
  ];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-toolbar-portal]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        title="Destaque / Highlight"
        className={`p-2 rounded-md transition-all cursor-pointer ${
          value
            ? "bg-[#4ecdc4]/20 text-[#4ecdc4]"
            : "text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff]"
        }`}
      >
        <Highlighter size={14} />
      </button>
      <PortalDropdown anchorRef={btnRef} open={open} className="p-3 w-48">
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {highlightColors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
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
        <button
          type="button"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
          className="w-full text-center text-[10px] text-[#8b8fb0] hover:text-[#e8eaff] py-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
        >
          Remover destaque
        </button>
      </PortalDropdown>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shapes Dropdown (for +Forma button)
   ═══════════════════════════════════════════════════════════════════════════ */

function ShapesDropdown({
  canvasRef,
}: {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const close = () => setOpen(false);

  const shapes = [
    { label: "Retangulo", icon: Square, color: "#4ecdc4", action: () => { canvasRef.current?.addRect(); close(); } },
    { label: "Circulo", icon: Circle, color: "#6c5ce7", action: () => { canvasRef.current?.addCircle(); close(); } },
    { label: "Triangulo", icon: Triangle, color: "#4ecdc4", action: () => { canvasRef.current?.addTriangle(); close(); } },
    { label: "Poligono", icon: Hexagon, color: "#6c5ce7", action: () => { canvasRef.current?.addPolygon(6); close(); } },
    { label: "Estrela", icon: Star, color: "#f59e0b", action: () => { canvasRef.current?.addStar(); close(); } },
    { label: "Linha", icon: MinusLine, color: "#4ecdc4", action: () => { canvasRef.current?.addLine(); close(); } },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141736] border border-white/10 text-xs text-[#e8eaff] hover:bg-white/10 hover:border-[#4ecdc4]/30 transition-all cursor-pointer"
      >
        <Square size={13} className="text-[#4ecdc4]" />
        <span>Forma</span>
        <ChevronDown size={11} className="text-[#5e6388]" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-[200] bg-[#141736] border border-white/10 rounded-xl shadow-2xl w-[200px] overflow-hidden p-2">
          <div className="grid grid-cols-3 gap-1">
            {shapes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <Icon size={16} style={{ color: item.color }} />
                  </div>
                  <span className="text-[10px] text-[#8b8fb0] group-hover:text-[#e8eaff] transition-colors">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Text Advanced Dropdown (line height, char spacing) ── */

function TextAdvancedDropdown({
  lineHeight,
  charSpacing,
  onLineHeightChange,
  onCharSpacingChange,
}: {
  lineHeight: number;
  charSpacing: number;
  onLineHeightChange: (v: number) => void;
  onCharSpacingChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-toolbar-portal]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
          open ? "bg-[#4ecdc4]/20 text-[#4ecdc4]" : "bg-[#141736] text-[#8b8fb0] hover:text-[#e8eaff]"
        }`}
        title="Espacamento e entrelinha"
      >
        <Settings2 size={13} />
        <ChevronDown size={10} />
      </button>

      <PortalDropdown anchorRef={btnRef} open={open} className="p-3 min-w-[200px]">
        <p className="text-[10px] text-[#5e6388] uppercase tracking-wider mb-2 font-medium">Espacamento</p>

        {/* Line Height */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-[#8b8fb0]" />
            <span className="text-[11px] text-[#c0c3e0]">Entrelinha</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onLineHeightChange(Math.max(0.5, lineHeight - 0.1))}
              className="w-5 h-5 flex items-center justify-center rounded bg-[#080b1e] text-[#8b8fb0] hover:text-[#e8eaff] transition-colors"
            >
              <Minus size={10} />
            </button>
            <span className="text-[11px] text-[#e8eaff] font-mono w-8 text-center">
              {lineHeight.toFixed(1)}
            </span>
            <button
              onClick={() => onLineHeightChange(Math.min(4, lineHeight + 0.1))}
              className="w-5 h-5 flex items-center justify-center rounded bg-[#080b1e] text-[#8b8fb0] hover:text-[#e8eaff] transition-colors"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>

        {/* Char Spacing */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Space size={12} className="text-[#8b8fb0]" />
            <span className="text-[11px] text-[#c0c3e0]">Entre letras</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCharSpacingChange(Math.max(-200, charSpacing - 20))}
              className="w-5 h-5 flex items-center justify-center rounded bg-[#080b1e] text-[#8b8fb0] hover:text-[#e8eaff] transition-colors"
            >
              <Minus size={10} />
            </button>
            <span className="text-[11px] text-[#e8eaff] font-mono w-8 text-center">
              {charSpacing}
            </span>
            <button
              onClick={() => onCharSpacingChange(Math.min(800, charSpacing + 20))}
              className="w-5 h-5 flex items-center justify-center rounded bg-[#080b1e] text-[#8b8fb0] hover:text-[#e8eaff] transition-colors"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>
      </PortalDropdown>
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
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-toolbar-portal]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-[#141736] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#e8eaff] cursor-pointer hover:border-[#4ecdc4]/50 transition-all max-w-[140px]"
        title="Fonte"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={10} className="text-[#5e6388] shrink-0" />
      </button>
      <PortalDropdown anchorRef={btnRef} open={open} className="w-[200px] overflow-hidden p-2">
        {fonts.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              onChange(f);
              setOpen(false);
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              value === f
                ? "bg-[#4ecdc4]/20 text-[#4ecdc4]"
                : "text-[#c0c3e0] hover:bg-white/5 hover:text-[#e8eaff]"
            }`}
            style={{ fontFamily: f }}
          >
            {f}
          </button>
        ))}
      </PortalDropdown>
    </div>
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
   Alignment Buttons Group
   ═══════════════════════════════════════════════════════════════════════════ */

function AlignmentButtons({
  canvasRef,
  compact = false,
}: {
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  compact?: boolean;
}) {
  const size = compact ? 13 : 14;

  return (
    <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
      <ToolbarButton
        onClick={() => canvasRef.current?.alignSelected('left')}
        title="Alinhar a esquerda"
      >
        <AlignHorizontalJustifyStart size={size} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => canvasRef.current?.alignSelected('center-h')}
        title="Centralizar horizontalmente"
      >
        <AlignHorizontalJustifyCenter size={size} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => canvasRef.current?.alignSelected('right')}
        title="Alinhar a direita"
      >
        <AlignHorizontalJustifyEnd size={size} />
      </ToolbarButton>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
      <ToolbarButton
        onClick={() => canvasRef.current?.alignSelected('top')}
        title="Alinhar ao topo"
      >
        <AlignVerticalJustifyStart size={size} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => canvasRef.current?.alignSelected('center-v')}
        title="Centralizar verticalmente"
      >
        <AlignVerticalJustifyCenter size={size} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => canvasRef.current?.alignSelected('bottom')}
        title="Alinhar abaixo"
      >
        <AlignVerticalJustifyEnd size={size} />
      </ToolbarButton>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Toolbar — Two-row layout
   Row 1: Undo/Redo | +Texto +Forma +Imagem | Aspect Ratio | Background | Delete
   Row 2 (context): Text formatting / Shape controls / Image controls
   ═══════════════════════════════════════════════════════════════════════════ */

export function CanvasToolbar({
  selection,
  canvasRef,
  aspectRatio,
  onAspectRatioChange,
  canUndo,
  canRedo,
  isEditingText = false,
  textSelection,
}: CanvasToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addImageInputRef = useRef<HTMLInputElement>(null);

  const updateProp = useCallback(
    (props: Record<string, any>) => {
      canvasRef.current?.updateSelectedObject(props);
    },
    [canvasRef]
  );

  const applyTextStyle = useCallback(
    (style: Record<string, any>) => {
      canvasRef.current?.applyStyleToSelection(style);
    },
    [canvasRef]
  );

  const getActiveStyle = useCallback(
    (prop: string): any => {
      if (isEditingText && textSelection?.hasSelection && textSelection.styles) {
        return textSelection.styles[prop];
      }
      if (prop === 'fontWeight') return selection?.props.fontWeight;
      if (prop === 'fill') return selection?.props.fill;
      return undefined;
    },
    [isEditingText, textSelection, selection]
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

  // ── Add image from file picker ──
  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      canvasRef.current?.addImage(reader.result as string);
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

  const hasContext = isText || isShape || isImage;

  return (
    <div className="shrink-0 border-b border-white/10 bg-[#0c0f24] h-[96px] flex flex-col relative z-[60]">
      {/* Hidden file inputs */}
      <input
        ref={addImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleAddImageFile}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceImage}
        className="hidden"
      />

      {/* ══════════════════════════════════════════════════════════════════
         ROW 1: Always visible — main actions
         ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 px-3 h-[48px] shrink-0">
        {/* Undo / Redo */}
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

        <ToolbarSeparator />

        {/* ── ADD ELEMENTS — Prominent buttons ── */}
        <button
          type="button"
          onClick={() => canvasRef.current?.addText("Novo texto")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141736] border border-white/10 text-xs text-[#e8eaff] hover:bg-white/10 hover:border-[#4ecdc4]/30 transition-all cursor-pointer"
          title="Adicionar texto"
        >
          <Type size={13} className="text-[#4ecdc4]" />
          <span>Texto</span>
        </button>

        <ShapesDropdown canvasRef={canvasRef} />

        <button
          type="button"
          onClick={() => addImageInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141736] border border-white/10 text-xs text-[#e8eaff] hover:bg-white/10 hover:border-[#4ecdc4]/30 transition-all cursor-pointer"
          title="Adicionar imagem"
        >
          <ImagePlus size={13} className="text-[#3b82f6]" />
          <span>Imagem</span>
        </button>

        <button
          type="button"
          onClick={() => canvasRef.current?.addImageFrame()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141736] border border-white/10 text-xs text-[#e8eaff] hover:bg-white/10 hover:border-[#4ecdc4]/30 transition-all cursor-pointer"
          title="Adicionar frame de imagem"
        >
          <ImagePlus size={13} className="text-[#f59e0b]" />
          <span>Frame</span>
        </button>

        <ToolbarSeparator />

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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Background controls (when nothing selected) */}
        {!selection && (
          <>
            <div className="flex items-center gap-1.5">
              <Palette size={12} className="text-[#5e6388]" />
              <span className="text-[10px] text-[#5e6388] uppercase">Fundo</span>
              <ColorPickerPopover
                value="#080b1e"
                onChange={(color) => canvasRef.current?.setBackgroundColor(color)}
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleBgImage}
              className="hidden"
              id="bg-image-input"
            />
            <ToolbarButton
              onClick={() => (document.getElementById("bg-image-input") as HTMLInputElement)?.click()}
              title="Imagem de fundo"
            >
              <ImageUp size={15} />
            </ToolbarButton>
          </>
        )}

        {/* Alignment (when selected) */}
        {selection && (
          <>
            <AlignmentButtons canvasRef={canvasRef} compact />

            <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
              <ToolbarButton
                onClick={() => canvasRef.current?.flipSelected('horizontal')}
                title="Espelhar horizontalmente"
              >
                <FlipHorizontal size={13} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => canvasRef.current?.flipSelected('vertical')}
                title="Espelhar verticalmente"
              >
                <FlipVertical size={13} />
              </ToolbarButton>
            </div>

            <ToolbarButton
              onClick={() => canvasRef.current?.toggleLockSelected()}
              title="Bloquear/Desbloquear"
            >
              {selection.editable ? <Unlock size={14} /> : <Lock size={14} />}
            </ToolbarButton>
          </>
        )}

        <ToolbarSeparator />

        {/* Delete */}
        <ToolbarButton
          onClick={() => canvasRef.current?.deleteSelected()}
          disabled={!selection}
          title="Excluir (Delete)"
        >
          <Trash2 size={15} />
        </ToolbarButton>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         ROW 2: Context toolbar — always 48px tall, content changes
         ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 px-3 h-[48px] shrink-0 border-t border-white/5 bg-[#080b1e]/50 overflow-x-auto overflow-y-visible">
        {!hasContext && (
          <span className="text-xs text-[#5e6388]">Selecione um elemento para editar</span>
        )}
        {hasContext && (
          <>
          {/* ── Text controls ── */}
          {isText && (
            <>
              {/* Editing text indicator */}
              {isEditingText && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#4ecdc4]/10 rounded-lg border border-[#4ecdc4]/20">
                  <Type size={11} className="text-[#4ecdc4]" />
                  <span className="text-[10px] text-[#4ecdc4] font-medium whitespace-nowrap">
                    {textSelection?.hasSelection
                      ? `${textSelection.end - textSelection.start} car.`
                      : "Editando"}
                  </span>
                </div>
              )}

              <FontFamilySelect
                value={selection!.props.fontFamily || "Plus Jakarta Sans"}
                onChange={(font) => isEditingText ? applyTextStyle({ fontFamily: font }) : updateProp({ fontFamily: font })}
              />
              <FontSizeStepper
                value={selection!.props.fontSize || 48}
                onChange={(size) => isEditingText ? applyTextStyle({ fontSize: size }) : updateProp({ fontSize: size })}
              />

              <ToolbarSeparator />

              {/* B / I / U / S */}
              <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
                <ToolbarButton
                  onClick={() => {
                    const currentWeight = getActiveStyle('fontWeight');
                    const isBold = currentWeight === 'bold' || Number(currentWeight) >= 700;
                    applyTextStyle({ fontWeight: isBold ? 'normal' : 'bold' });
                  }}
                  active={(() => {
                    const w = getActiveStyle('fontWeight');
                    return w === 'bold' || Number(w) >= 700;
                  })()}
                  title="Negrito"
                >
                  <Bold size={14} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    const currentStyle = isEditingText && textSelection?.styles?.fontStyle
                      ? textSelection.styles.fontStyle
                      : canvasRef.current?.getSelectedObject()?.fontStyle;
                    applyTextStyle({ fontStyle: currentStyle === 'italic' ? 'normal' : 'italic' });
                  }}
                  active={(() => {
                    if (isEditingText && textSelection?.hasSelection) {
                      return textSelection.styles?.fontStyle === 'italic';
                    }
                    return canvasRef.current?.getSelectedObject()?.fontStyle === 'italic';
                  })()}
                  title="Italico"
                >
                  <Italic size={14} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    const current = isEditingText && textSelection?.styles?.underline !== undefined
                      ? textSelection.styles.underline
                      : canvasRef.current?.getSelectedObject()?.underline;
                    applyTextStyle({ underline: !current });
                  }}
                  active={(() => {
                    if (isEditingText && textSelection?.hasSelection) {
                      return !!textSelection.styles?.underline;
                    }
                    return !!canvasRef.current?.getSelectedObject()?.underline;
                  })()}
                  title="Sublinhado"
                >
                  <Underline size={14} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    const current = isEditingText && textSelection?.styles?.linethrough !== undefined
                      ? textSelection.styles.linethrough
                      : canvasRef.current?.getSelectedObject()?.linethrough;
                    applyTextStyle({ linethrough: !current });
                  }}
                  active={(() => {
                    if (isEditingText && textSelection?.hasSelection) {
                      return !!textSelection.styles?.linethrough;
                    }
                    return !!canvasRef.current?.getSelectedObject()?.linethrough;
                  })()}
                  title="Tachado"
                >
                  <Strikethrough size={14} />
                </ToolbarButton>
              </div>

              <ToolbarSeparator />

              {/* Text color */}
              <ColorPickerPopover
                value={
                  (isEditingText && textSelection?.hasSelection && textSelection.styles?.fill)
                    ? textSelection.styles.fill
                    : (selection!.props.fill || "#e8eaff")
                }
                onChange={(color) => applyTextStyle({ fill: color })}
              />
              {/* Highlight */}
              <HighlightColorPicker
                value={
                  (isEditingText && textSelection?.hasSelection && textSelection.styles?.textBackgroundColor)
                    ? textSelection.styles.textBackgroundColor
                    : ""
                }
                onChange={(color) => applyTextStyle({ textBackgroundColor: color })}
                onClear={() => applyTextStyle({ textBackgroundColor: "" })}
              />

              <ToolbarSeparator />

              {/* Text alignment */}
              <div className="flex items-center gap-0.5 bg-[#141736] rounded-lg p-1">
                <ToolbarButton
                  onClick={() => updateProp({ textAlign: "left" })}
                  active={selection!.props.textAlign === "left"}
                  title="Alinhar esquerda"
                >
                  <AlignLeft size={14} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => updateProp({ textAlign: "center" })}
                  active={selection!.props.textAlign === "center"}
                  title="Centralizar"
                >
                  <AlignCenter size={14} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => updateProp({ textAlign: "right" })}
                  active={selection!.props.textAlign === "right"}
                  title="Alinhar direita"
                >
                  <AlignRight size={14} />
                </ToolbarButton>
              </div>

              <ToolbarSeparator />

              {/* Advanced text: line height, char spacing — dropdown */}
              <TextAdvancedDropdown
                lineHeight={(() => {
                  const obj = canvasRef.current?.getSelectedObject();
                  return (obj as Record<string, unknown>)?.lineHeight as number ?? 1.2;
                })()}
                charSpacing={(() => {
                  const obj = canvasRef.current?.getSelectedObject();
                  return (obj as Record<string, unknown>)?.charSpacing as number ?? 0;
                })()}
                onLineHeightChange={(v) => updateProp({ lineHeight: v })}
                onCharSpacingChange={(v) => updateProp({ charSpacing: v })}
              />
            </>
          )}

          {/* ── Shape controls ── */}
          {isShape && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#5e6388] uppercase">Preencher</span>
                <ColorPickerPopover
                  value={selection!.props.fill === "__gradient__" ? "#4ecdc4" : (selection!.props.fill || "#4ecdc4")}
                  onChange={(color) => updateProp({ fill: color })}
                />
              </div>

              <ToolbarSeparator />

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#5e6388] uppercase">Borda</span>
                <ColorPickerPopover
                  value={selection!.props.stroke || "#ffffff"}
                  onChange={(color) => updateProp({ stroke: color })}
                />
                <FontSizeStepper
                  value={selection!.props.strokeWidth || 0}
                  onChange={(w) => updateProp({ strokeWidth: w })}
                />
              </div>

              {selection!.type === "rect" && (
                <>
                  <ToolbarSeparator />
                  <div className="flex items-center gap-1.5">
                    <CornerUpLeft size={13} className="text-[#8b8fb0]" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selection!.props.rx || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        updateProp({ rx: val, ry: val });
                      }}
                      className="w-20 h-1 accent-[#4ecdc4] cursor-pointer"
                    />
                    <span className="text-xs text-[#8b8fb0] w-8 tabular-nums">{selection!.props.rx || 0}</span>
                  </div>
                </>
              )}

              <ToolbarSeparator />

              <OpacitySlider
                value={selection!.props.opacity ?? 100}
                onChange={(v) => updateProp({ opacity: v / 100 })}
              />
            </>
          )}

          {/* ── Image controls ── */}
          {isImage && (
            <>
              <ToolbarButton
                onClick={() => fileInputRef.current?.click()}
                title="Substituir imagem"
              >
                <Replace size={15} />
              </ToolbarButton>

              <ToolbarSeparator />

              <OpacitySlider
                value={selection!.props.opacity ?? 100}
                onChange={(v) => updateProp({ opacity: v / 100 })}
              />
            </>
          )}
          </>
        )}
      </div>
    </div>
  );
}

export { AlignmentButtons };
export default CanvasToolbar;
