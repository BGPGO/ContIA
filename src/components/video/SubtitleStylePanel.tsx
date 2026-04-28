"use client";

import { useCallback } from "react";
import {
  Type,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Monitor,
} from "lucide-react";
import type { SubtitleStyle } from "@/types/video";
import { SUBTITLE_PRESETS } from "@/types/video";

interface SubtitleStylePanelProps {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

const fontSizes: SubtitleStyle["fontSize"][] = ["sm", "md", "lg", "xl"];
const fontSizeLabels: Record<SubtitleStyle["fontSize"], string> = {
  sm: "P",
  md: "M",
  lg: "G",
  xl: "GG",
};

const positions: SubtitleStyle["position"][] = ["top", "center", "bottom"];
const positionLabels: Record<SubtitleStyle["position"], { label: string; icon: typeof ArrowUp }> = {
  top: { label: "Topo", icon: ArrowUp },
  center: { label: "Centro", icon: Minus },
  bottom: { label: "Base", icon: ArrowDown },
};

const animations: SubtitleStyle["animation"][] = ["none", "fade", "pop"];
const animationLabels: Record<SubtitleStyle["animation"], string> = {
  none: "Nenhuma",
  fade: "Fade",
  pop: "Pop (viral)",
};

const weights: SubtitleStyle["fontWeight"][] = ["normal", "bold", "extrabold"];
const weightLabels: Record<SubtitleStyle["fontWeight"], string> = {
  normal: "Normal",
  bold: "Bold",
  extrabold: "Extra",
};

const families: SubtitleStyle["fontFamily"][] = ["sans", "mono", "serif"];
const familyLabels: Record<SubtitleStyle["fontFamily"], string> = {
  sans: "Sans",
  mono: "Mono",
  serif: "Serif",
};

const colorPresets = [
  "#FFFFFF",
  "#FBBF24",
  "#EF4444",
  "#22C55E",
  "#3B82F6",
  "#A855F7",
  "#EC4899",
  "#F97316",
  "#00FF88",
  "#06B6D4",
];

export function SubtitleStylePanel({ style, onChange }: SubtitleStylePanelProps) {
  const update = useCallback(
    (partial: Partial<SubtitleStyle>) => {
      onChange({ ...style, ...partial });
    },
    [style, onChange]
  );

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-secondary flex items-center justify-center">
          <Type className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Estilo da Legenda</p>
          <p className="text-[10px] text-text-muted">Personalize a aparencia</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div>
          <h4 className="text-text-primary font-semibold text-sm">Detalhes do estilo</h4>
          <p className="text-xs text-text-muted mt-0.5">
            Customize manualmente após escolher um estilo da galeria.
          </p>
        </div>

        {/* Presets */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SUBTITLE_PRESETS).map(([key, preset]) => {
              const isActive =
                style.fontSize === preset.style.fontSize &&
                style.color === preset.style.color &&
                style.animation === preset.style.animation &&
                style.fontWeight === preset.style.fontWeight;
              return (
                <button
                  key={key}
                  onClick={() => onChange(preset.style)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                    isActive
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-border-light"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Cor do texto
          </label>
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  style.color === c
                    ? "border-accent scale-110"
                    : "border-transparent hover:border-border-light"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <label className="w-7 h-7 rounded-full border-2 border-dashed border-border cursor-pointer flex items-center justify-center hover:border-border-light transition-all overflow-hidden">
              <span className="text-[8px] text-text-muted">+</span>
              <input
                type="color"
                value={style.color}
                onChange={(e) => update({ color: e.target.value })}
                className="absolute w-0 h-0 opacity-0"
              />
            </label>
          </div>
        </div>

        {/* Background */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Fundo
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => update({ bgColor: "transparent" })}
              className={`flex-1 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                style.bgColor === "transparent"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              Sem fundo
            </button>
            <button
              onClick={() => update({ bgColor: "#000000CC" })}
              className={`flex-1 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                style.bgColor !== "transparent"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              Com fundo
            </button>
          </div>
        </div>

        {/* Font size */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Tamanho
          </label>
          <div className="flex gap-1.5">
            {fontSizes.map((fs) => (
              <button
                key={fs}
                onClick={() => update({ fontSize: fs })}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  style.fontSize === fs
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >
                {fontSizeLabels[fs]}
              </button>
            ))}
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Posicao
          </label>
          <div className="flex gap-1.5">
            {positions.map((pos) => {
              const { label, icon: Icon } = positionLabels[pos];
              return (
                <button
                  key={pos}
                  onClick={() => update({ position: pos })}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                    style.position === pos
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font weight */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Peso
          </label>
          <div className="flex gap-1.5">
            {weights.map((w) => (
              <button
                key={w}
                onClick={() => update({ fontWeight: w })}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-all ${
                  style.fontWeight === w
                    ? "border-accent bg-accent/10 text-accent font-bold"
                    : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >
                {weightLabels[w]}
              </button>
            ))}
          </div>
        </div>

        {/* Animation */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Animacao
          </label>
          <div className="flex gap-1.5">
            {animations.map((a) => (
              <button
                key={a}
                onClick={() => update({ animation: a })}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  style.animation === a
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >
                {animationLabels[a]}
              </button>
            ))}
          </div>
        </div>

        {/* Font family */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Fonte
          </label>
          <div className="flex gap-1.5">
            {families.map((f) => (
              <button
                key={f}
                onClick={() => update({ fontFamily: f })}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  style.fontFamily === f
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
                style={{
                  fontFamily:
                    f === "mono"
                      ? "monospace"
                      : f === "serif"
                      ? "serif"
                      : "sans-serif",
                }}
              >
                {familyLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Preview box */}
        <div>
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
            Preview
          </label>
          <div className="relative bg-black rounded-lg h-20 flex items-center justify-center overflow-hidden">
            <Monitor className="absolute w-16 h-16 text-white/5" />
            <span
              className="relative z-10 px-3 py-1 rounded text-center"
              style={{
                color: style.color,
                backgroundColor:
                  style.bgColor === "transparent" ? "transparent" : style.bgColor,
                fontSize:
                  style.fontSize === "sm"
                    ? "12px"
                    : style.fontSize === "md"
                    ? "14px"
                    : style.fontSize === "lg"
                    ? "16px"
                    : "20px",
                fontWeight:
                  style.fontWeight === "normal"
                    ? 400
                    : style.fontWeight === "bold"
                    ? 700
                    : 800,
                fontFamily:
                  style.fontFamily === "mono"
                    ? "monospace"
                    : style.fontFamily === "serif"
                    ? "serif"
                    : "sans-serif",
                textShadow:
                  style.bgColor === "transparent"
                    ? "0 0 4px rgba(0,0,0,0.9), 2px 2px 0 rgba(0,0,0,0.8), -2px -2px 0 rgba(0,0,0,0.8)"
                    : "none",
              }}
            >
              Exemplo de legenda
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
