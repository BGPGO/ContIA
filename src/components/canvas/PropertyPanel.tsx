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
  CornerUpLeft,
  Paintbrush,
} from "lucide-react";
import type { SelectionInfo, FabricCanvasRef, TextSelectionInfo } from "./FabricCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface PropertyPanelProps {
  selection: SelectionInfo | null;
  canvasRef: React.RefObject<FabricCanvasRef | null>;
  brandColors?: string[];
  isEditingText?: boolean;
  textSelection?: TextSelectionInfo | null;
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
  isEditingText = false,
  textSelection,
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

  const isRect = selection?.type === "rect";

  const isShape =
    selection?.type === "rect" ||
    selection?.type === "circle" ||
    selection?.type === "triangle" ||
    selection?.type === "polygon" ||
    selection?.type === "line";

  // ── Fill type helpers ──
  const setFillSolid = useCallback((color?: string) => {
    updateProp({ fill: color || "#4ecdc4" });
  }, [updateProp]);

  const setFillGradient = useCallback(() => {
    const obj = canvasRef.current?.getSelectedObject();
    if (!obj) return;
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    import("fabric").then(({ Gradient }) => {
      // Use unscaled dimensions for gradient coords
      const w = obj.width || 200;
      const h = obj.height || 200;
      const gradient = new Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: { x1: 0, y1: 0, x2: w, y2: h },
        colorStops: [
          { offset: 0, color: '#4ecdc4' },
          { offset: 1, color: '#6c5ce7' },
        ],
      });
      obj.set({ fill: gradient });
      obj.dirty = true; // Force re-render of cached object
      canvas.requestRenderAll();
    });
  }, [canvasRef]);

  const setNoFill = useCallback(() => {
    const obj = canvasRef.current?.getSelectedObject();
    if (!obj) return;
    updateProp({ fill: 'transparent', stroke: obj.stroke || '#4ecdc4', strokeWidth: Math.max(obj.strokeWidth || 0, 2) });
  }, [canvasRef, updateProp]);

  // ── Gradient helpers ──
  // Read gradient properties from the currently selected object
  const obj = canvasRef.current?.getSelectedObject();
  const objFill = obj?.fill;
  let gradientColor1 = '#4ecdc4';
  let gradientColor2 = '#6c5ce7';
  let gradientAngle = 135;
  let gradientType: 'linear' | 'radial' = 'linear';

  if (objFill && typeof objFill === 'object' && 'colorStops' in objFill) {
    const stops = (objFill as any).colorStops;
    if (stops?.[0]?.color) gradientColor1 = stops[0].color;
    if (stops?.[1]?.color) gradientColor2 = stops[1].color;
    const coords = (objFill as any).coords;
    if (coords && !('r1' in coords)) {
      const angle = Math.round(Math.atan2((coords.y2 || 0) - (coords.y1 || 0), (coords.x2 || 0) - (coords.x1 || 0)) * (180 / Math.PI));
      gradientAngle = angle < 0 ? angle + 360 : angle;
    }
    gradientType = (objFill as any).type || 'linear';
  }

  const fillType = selection?.props.fill === '__gradient__'
    ? 'gradient'
    : selection?.props.fill === 'transparent'
      ? 'none'
      : 'solid';

  const applyGradient = useCallback(async (changes: { type?: 'linear' | 'radial'; color1?: string; color2?: string; angle?: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !selection) return;

    const { Gradient } = await import('fabric');
    const fabricCanvas = canvas.getCanvas();
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj) return;

    // Read current values from the object's fill
    const currentFill = activeObj.fill;
    let c1 = changes.color1 || gradientColor1;
    let c2 = changes.color2 || gradientColor2;
    let type = changes.type || gradientType;
    let angle = changes.angle ?? gradientAngle;

    if (currentFill && typeof currentFill === 'object' && 'colorStops' in currentFill) {
      const stops = (currentFill as any).colorStops;
      if (!changes.color1 && stops?.[0]?.color) c1 = stops[0].color;
      if (!changes.color2 && stops?.[1]?.color) c2 = stops[1].color;
      if (changes.type === undefined) {
        type = (currentFill as any).type || 'linear';
      }
      if (changes.angle === undefined && !('r1' in ((currentFill as any).coords || {}))) {
        const coords = (currentFill as any).coords;
        if (coords) {
          const a = Math.round(Math.atan2((coords.y2 || 0) - (coords.y1 || 0), (coords.x2 || 0) - (coords.x1 || 0)) * (180 / Math.PI));
          angle = a < 0 ? a + 360 : a;
        }
      }
    }

    const w = (activeObj as any).width || 100;
    const h = (activeObj as any).height || 100;

    let coords;
    if (type === 'radial') {
      coords = { x1: w / 2, y1: h / 2, x2: w / 2, y2: h / 2, r1: 0, r2: Math.max(w, h) / 2 };
    } else {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      coords = {
        x1: w / 2 - (cos * w) / 2,
        y1: h / 2 - (sin * h) / 2,
        x2: w / 2 + (cos * w) / 2,
        y2: h / 2 + (sin * h) / 2,
      };
    }

    const gradient = new Gradient({
      type,
      gradientUnits: 'pixels',
      coords,
      colorStops: [
        { offset: 0, color: c1 },
        { offset: 1, color: c2 },
      ],
    });

    activeObj.set({ fill: gradient });
    (activeObj as any).dirty = true;
    fabricCanvas.requestRenderAll();
  }, [canvasRef, selection, gradientColor1, gradientColor2, gradientType, gradientAngle]);

  if (!selection) {
    return (
      <div className="w-full shrink-0 bg-[#0c0f24] flex flex-col">
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
    <div className="w-full shrink-0 bg-[#0c0f24] flex flex-col overflow-hidden">
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

          {/* Fill type toggle for shapes */}
          {isShape && (
            <div className="mb-3">
              <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide block mb-1.5">
                Tipo de preenchimento
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setFillSolid()}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${
                    fillType === 'solid'
                      ? "bg-[#4ecdc4]/15 border-[#4ecdc4]/30 text-[#4ecdc4]"
                      : "bg-[#141736] border-white/10 text-[#8b8fb0] hover:bg-white/5"
                  }`}
                >
                  Solido
                </button>
                <button
                  type="button"
                  onClick={setFillGradient}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${
                    fillType === 'gradient'
                      ? "bg-[#6c5ce7]/15 border-[#6c5ce7]/30 text-[#6c5ce7]"
                      : "bg-[#141736] border-white/10 text-[#8b8fb0] hover:bg-white/5"
                  }`}
                >
                  Gradiente
                </button>
                <button
                  type="button"
                  onClick={setNoFill}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${
                    fillType === 'none'
                      ? "bg-white/10 border-white/20 text-[#e8eaff]"
                      : "bg-[#141736] border-white/10 text-[#8b8fb0] hover:bg-white/5"
                  }`}
                >
                  Sem
                </button>
              </div>

              {/* Gradient editor controls */}
              {fillType === 'gradient' && (
                <div className="space-y-3 mt-3">
                  {/* Type toggle: Linear / Radial */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => applyGradient({ type: 'linear' })}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                        gradientType === 'linear'
                          ? 'bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/20'
                          : 'text-[#8b8fb0] border border-transparent hover:bg-white/5'
                      }`}
                    >Linear</button>
                    <button
                      type="button"
                      onClick={() => applyGradient({ type: 'radial' })}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                        gradientType === 'radial'
                          ? 'bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/20'
                          : 'text-[#8b8fb0] border border-transparent hover:bg-white/5'
                      }`}
                    >Radial</button>
                  </div>

                  {/* Color stops */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] text-[#8b8fb0]">Cor 1</label>
                      <input
                        type="color"
                        value={gradientColor1}
                        onChange={(e) => applyGradient({ color1: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] text-[#8b8fb0]">Cor 2</label>
                      <input
                        type="color"
                        value={gradientColor2}
                        onChange={(e) => applyGradient({ color2: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>

                  {/* Angle slider (linear only) */}
                  {gradientType === 'linear' && (
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[9px] text-[#8b8fb0]">Angulo</label>
                        <span className="text-[9px] text-[#5e6388]">{gradientAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={gradientAngle}
                        onChange={(e) => applyGradient({ angle: Number(e.target.value) })}
                        className="w-full h-1 rounded-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4ecdc4] cursor-pointer"
                      />
                      {/* Quick angle presets */}
                      <div className="flex gap-1">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => applyGradient({ angle: a })}
                            className={`flex-1 py-1 rounded text-[9px] cursor-pointer transition-all ${
                              gradientAngle === a
                                ? 'bg-[#4ecdc4]/15 text-[#4ecdc4]'
                                : 'text-[#8b8fb0] hover:bg-white/5'
                            }`}
                          >
                            {a}°
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview bar */}
                  <div
                    className="h-4 rounded-lg border border-white/10"
                    style={{
                      background: gradientType === 'linear'
                        ? `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})`
                        : `radial-gradient(circle, ${gradientColor1}, ${gradientColor2})`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Color swatches: only show for solid fill or non-shape objects */}
          {(!isShape || fillType === 'solid') && (
            <ColorSwatches
              label="Preenchimento"
              value={selection.props.fill === "__gradient__" ? "#4ecdc4" : (selection.props.fill || "#4ecdc4")}
              onChange={(color) => updateProp({ fill: color })}
              colors={defaultBrandColors}
            />
          )}

          {/* Corner radius for Rects */}
          {isRect && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <CornerUpLeft size={12} className="text-[#4ecdc4]/60" />
                <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
                  Cantos arredondados
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selection.props.rx || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateProp({ rx: val, ry: val });
                  }}
                  className="flex-1 h-1 rounded-full accent-[#4ecdc4] cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={selection.props.rx || 0}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      updateProp({ rx: val, ry: val });
                    }}
                    className="w-12 bg-[#141736] border border-white/10 rounded px-2 py-1 text-xs text-[#e8eaff] text-center focus:outline-none focus:border-[#4ecdc4]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-[#5e6388]">px</span>
                </div>
              </div>
            </div>
          )}

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
              value={selection.props.stroke || "#ffffff"}
              onChange={(color) => updateProp({ stroke: color })}
              colors={defaultBrandColors.slice(0, 5)}
            />
          </div>
          <div className="mt-2">
            <PropSlider
              label="Espessura borda"
              value={selection.props.strokeWidth || 0}
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
              value={
                (isEditingText && textSelection?.hasSelection && textSelection.styles?.fill)
                  ? textSelection.styles.fill
                  : (selection.props.fill || "#e8eaff")
              }
              onChange={(color) => {
                if (isEditingText) {
                  canvasRef.current?.applyStyleToSelection({ fill: color });
                } else {
                  updateProp({ fill: color });
                }
              }}
              colors={defaultBrandColors}
            />

            {/* Highlight / Text Background */}
            <div className="mt-3">
              <label className="text-[10px] text-[#8b8fb0] uppercase tracking-wide">
                Destaque (Highlight)
              </label>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {["#facc15", "#fb923c", "#4ade80", "#60a5fa", "#c084fc", "#fb7185", "#4ecdc4", "#e8eaff"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (isEditingText) {
                        canvasRef.current?.applyStyleToSelection({ textBackgroundColor: c });
                      } else {
                        updateProp({ textBackgroundColor: c });
                      }
                    }}
                    className="w-6 h-6 rounded-md border-2 transition-all cursor-pointer border-transparent hover:border-white/20"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingText) {
                      canvasRef.current?.applyStyleToSelection({ textBackgroundColor: "" });
                    } else {
                      updateProp({ textBackgroundColor: "" });
                    }
                  }}
                  className="px-2 py-1 text-[10px] text-[#8b8fb0] hover:text-[#e8eaff] bg-[#141736] border border-white/10 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyPanel;
