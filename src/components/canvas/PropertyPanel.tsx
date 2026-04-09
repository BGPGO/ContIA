"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Move,
  Maximize2,
  RotateCw,
  Lock,
  Unlock,
  Palette,
  Eye,
  Type,
  Layers,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Crosshair,
} from "lucide-react";
import type { SelectionInfo, FabricCanvasRef } from "./FabricCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface PropertyPanelProps {
  selection: SelectionInfo | null;
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  brandColors?: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={12} className="text-[#4ecdc4]/60" />
      <span className="text-xs uppercase text-[#5e6388] font-medium tracking-wider">
        {label}
      </span>
    </div>
  );
}

function PropInput({
  label,
  value,
  onChange,
  type = "number",
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number | string;
  onChange: (val: number | string) => void;
  type?: "number" | "text";
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) =>
            onChange(type === "number" ? Number(e.target.value) : e.target.value)
          }
          min={min}
          max={max}
          step={step}
          className="w-full bg-[#141736] border border-white/10 rounded px-2.5 py-1.5 text-sm text-[#e8eaff] focus:outline-none focus:border-[#4ecdc4]/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#5e6388]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function PropSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
          {label}
        </label>
        <span className="text-[10px] text-[#5e6388] tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full accent-[#4ecdc4] cursor-pointer"
      />
    </div>
  );
}

function ColorSwatches({
  value,
  onChange,
  colors,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  colors: string[];
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-6 h-6 rounded-md border-2 transition-all cursor-pointer ${
              value === c
                ? "border-white/60 scale-110 shadow-lg"
                : "border-transparent hover:border-white/20"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Custom color input */}
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 rounded-md cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/10"
          />
        </div>
      </div>
      {/* Hex display */}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            onChange(e.target.value);
          }
        }}
        className="bg-[#141736] border border-white/10 rounded px-2 py-1 text-xs text-[#e8eaff] font-mono w-24"
      />
    </div>
  );
}

function FontWeightSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const weights = [
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "Semi-bold", value: "600" },
    { label: "Bold", value: "700" },
    { label: "Extra-bold", value: "800" },
    { label: "Black", value: "900" },
  ];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
        Peso
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#141736] border border-white/10 rounded px-2.5 py-1.5 text-sm text-[#e8eaff] cursor-pointer focus:outline-none focus:border-[#4ecdc4]/40"
      >
        {weights.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label} ({w.value})
          </option>
        ))}
      </select>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PropertyPanel
   ═══════════════════════════════════════════════════════════════════════════ */

export function PropertyPanel({
  selection,
  canvasRef,
  brandColors,
}: PropertyPanelProps) {
  const [lockAspect, setLockAspect] = useState(false);
  const [rotation, setRotation] = useState(0);

  const defaultBrandColors = brandColors || [
    "#4ecdc4",
    "#6c5ce7",
    "#e8eaff",
    "#ffffff",
    "#080b1e",
    "#141736",
    "#e11d48",
    "#f59e0b",
  ];

  // Sync rotation from selection
  useEffect(() => {
    if (!selection) return;
    const obj = canvasRef.current?.getSelectedObject();
    if (obj) {
      setRotation(Math.round(obj.angle || 0));
    }
  }, [selection, canvasRef]);

  const updateProp = useCallback(
    (props: Record<string, any>) => {
      canvasRef.current?.updateSelectedObject(props);
    },
    [canvasRef]
  );

  const updatePosition = useCallback(
    (axis: "left" | "top", value: number) => {
      updateProp({ [axis]: value });
    },
    [updateProp]
  );

  const updateSize = useCallback(
    (dimension: "width" | "height", value: number) => {
      const obj = canvasRef.current?.getSelectedObject();
      if (!obj) return;

      if (dimension === "width") {
        const scaleX = value / (obj.width || 1);
        if (lockAspect) {
          updateProp({ scaleX, scaleY: scaleX });
        } else {
          updateProp({ scaleX });
        }
      } else {
        const scaleY = value / (obj.height || 1);
        if (lockAspect) {
          updateProp({ scaleX: scaleY, scaleY });
        } else {
          updateProp({ scaleY });
        }
      }
    },
    [canvasRef, lockAspect, updateProp]
  );

  const updateRotation = useCallback(
    (angle: number) => {
      setRotation(angle);
      updateProp({ angle });
    },
    [updateProp]
  );

  const isText =
    selection?.type === "textbox" ||
    selection?.type === "text" ||
    selection?.type === "i-text";

  if (!selection) {
    return (
      <div className="w-[260px] shrink-0 bg-[#0c0f24] border-l border-white/10 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Layers size={14} className="text-[#4ecdc4]/60" />
          <span className="text-xs font-semibold text-[#5e6388] uppercase tracking-wider">
            Propriedades
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-[#5e6388] text-center leading-relaxed">
            Selecione um elemento para editar suas propriedades
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 bg-[#0c0f24] border-l border-white/10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
        <Layers size={14} className="text-[#4ecdc4]/60" />
        <span className="text-xs font-semibold text-[#5e6388] uppercase tracking-wider flex-1">
          Propriedades
        </span>
        <span className="text-[10px] text-[#4ecdc4]/60 bg-[#4ecdc4]/10 px-2 py-0.5 rounded">
          {selection.type}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* ── Alignment ── */}
        <div>
          <SectionHeader icon={Crosshair} label="Alinhamento" />
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => canvasRef.current?.alignSelected('left')}
              title="Alinhar a esquerda"
              className="flex items-center justify-center p-2 rounded-md bg-[#141736] border border-white/10 text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff] transition-all cursor-pointer"
            >
              <AlignHorizontalJustifyStart size={14} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.alignSelected('center-h')}
              title="Centralizar horizontalmente"
              className="flex items-center justify-center p-2 rounded-md bg-[#141736] border border-white/10 text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff] transition-all cursor-pointer"
            >
              <AlignHorizontalJustifyCenter size={14} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.alignSelected('right')}
              title="Alinhar a direita"
              className="flex items-center justify-center p-2 rounded-md bg-[#141736] border border-white/10 text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff] transition-all cursor-pointer"
            >
              <AlignHorizontalJustifyEnd size={14} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.alignSelected('top')}
              title="Alinhar ao topo"
              className="flex items-center justify-center p-2 rounded-md bg-[#141736] border border-white/10 text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff] transition-all cursor-pointer"
            >
              <AlignVerticalJustifyStart size={14} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.alignSelected('center-v')}
              title="Centralizar verticalmente"
              className="flex items-center justify-center p-2 rounded-md bg-[#141736] border border-white/10 text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff] transition-all cursor-pointer"
            >
              <AlignVerticalJustifyCenter size={14} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.alignSelected('bottom')}
              title="Alinhar abaixo"
              className="flex items-center justify-center p-2 rounded-md bg-[#141736] border border-white/10 text-[#8b8fb0] hover:bg-white/10 hover:text-[#e8eaff] transition-all cursor-pointer"
            >
              <AlignVerticalJustifyEnd size={14} />
            </button>
          </div>
        </div>

        {/* ── Position & Size ── */}
        <div>
          <SectionHeader icon={Move} label="Posicao e Tamanho" />
          <div className="grid grid-cols-2 gap-2.5">
            <PropInput
              label="X"
              value={selection.props.left}
              onChange={(v) => updatePosition("left", Number(v))}
              suffix="px"
            />
            <PropInput
              label="Y"
              value={selection.props.top}
              onChange={(v) => updatePosition("top", Number(v))}
              suffix="px"
            />
            <PropInput
              label="Largura"
              value={selection.props.width}
              onChange={(v) => updateSize("width", Number(v))}
              suffix="px"
            />
            <PropInput
              label="Altura"
              value={selection.props.height}
              onChange={(v) => updateSize("height", Number(v))}
              suffix="px"
            />
          </div>

          {/* Rotation + lock */}
          <div className="flex items-end gap-2.5 mt-2.5">
            <div className="flex-1">
              <PropInput
                label="Rotacao"
                value={rotation}
                onChange={(v) => updateRotation(Number(v))}
                min={0}
                max={360}
                suffix="deg"
              />
            </div>
            <button
              type="button"
              onClick={() => setLockAspect(!lockAspect)}
              className={`p-2 rounded-md border transition-all cursor-pointer mb-0.5 ${
                lockAspect
                  ? "bg-[#4ecdc4]/10 border-[#4ecdc4]/30 text-[#4ecdc4]"
                  : "bg-[#141736] border-white/10 text-[#5e6388] hover:text-[#8b8fb0]"
              }`}
              title={
                lockAspect ? "Desbloquear proporcoes" : "Bloquear proporcoes"
              }
            >
              {lockAspect ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        </div>

        {/* ── Appearance ── */}
        <div>
          <SectionHeader icon={Palette} label="Aparencia" />

          <ColorSwatches
            label="Preenchimento"
            value={selection.props.fill || "#4ecdc4"}
            onChange={(color) => updateProp({ fill: color })}
            colors={defaultBrandColors}
          />

          <div className="mt-3">
            <PropSlider
              label="Opacidade"
              value={selection.props.opacity ?? 100}
              onChange={(v) => updateProp({ opacity: v / 100 })}
            />
          </div>

          {/* Stroke */}
          <div className="mt-3">
            <ColorSwatches
              label="Borda"
              value="#ffffff"
              onChange={(color) => updateProp({ stroke: color })}
              colors={defaultBrandColors.slice(0, 5)}
            />
          </div>
          <div className="mt-2">
            <PropSlider
              label="Espessura borda"
              value={0}
              onChange={(v) => updateProp({ strokeWidth: v })}
              min={0}
              max={20}
              suffix="px"
            />
          </div>
        </div>

        {/* ── Typography (text objects only) ── */}
        {isText && (
          <div>
            <SectionHeader icon={Type} label="Tipografia" />

            {/* Font family */}
            <div className="flex flex-col gap-1 mb-2.5">
              <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
                Fonte
              </label>
              <select
                value={selection.props.fontFamily || "Plus Jakarta Sans"}
                onChange={(e) => updateProp({ fontFamily: e.target.value })}
                className="bg-[#141736] border border-white/10 rounded px-2.5 py-1.5 text-sm text-[#e8eaff] cursor-pointer focus:outline-none focus:border-[#4ecdc4]/40"
              >
                {[
                  "Plus Jakarta Sans",
                  "Inter",
                  "Formula1 Display",
                  "Formula1 Wide",
                  "Genius Techno",
                  "Georgia",
                  "Arial",
                  "Courier New",
                ].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <PropInput
                label="Tamanho"
                value={selection.props.fontSize || 48}
                onChange={(v) => updateProp({ fontSize: Number(v) })}
                min={8}
                max={200}
                suffix="px"
              />
              <FontWeightSelect
                value={String(selection.props.fontWeight || "400")}
                onChange={(w) => updateProp({ fontWeight: Number(w) })}
              />
            </div>

            {/* Line height & letter spacing */}
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
                  Entrelinha
                </label>
                <input
                  type="number"
                  defaultValue={1.3}
                  step={0.1}
                  min={0.5}
                  max={3}
                  onChange={(e) =>
                    updateProp({ lineHeight: Number(e.target.value) })
                  }
                  className="bg-[#141736] border border-white/10 rounded px-2.5 py-1.5 text-sm text-[#e8eaff] focus:outline-none focus:border-[#4ecdc4]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
                  Espacamento
                </label>
                <input
                  type="number"
                  defaultValue={0}
                  step={10}
                  min={-200}
                  max={800}
                  onChange={(e) =>
                    updateProp({ charSpacing: Number(e.target.value) })
                  }
                  className="bg-[#141736] border border-white/10 rounded px-2.5 py-1.5 text-sm text-[#e8eaff] focus:outline-none focus:border-[#4ecdc4]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Text color */}
            <ColorSwatches
              label="Cor do texto"
              value={selection.props.fill || "#e8eaff"}
              onChange={(color) => updateProp({ fill: color })}
              colors={defaultBrandColors}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyPanel;
