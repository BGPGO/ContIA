"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Palette,
  Type,
  Layout,
  Maximize,
  Check,
  Square,
  RectangleVertical,
  Smartphone,
} from "lucide-react";
import type { PostDesignTemplate, PostDesignData } from "./PostCanvas";

/* ------------------------------------------------------------------ */
/*  Template metadata                                                  */
/* ------------------------------------------------------------------ */

const TEMPLATES: {
  id: PostDesignTemplate;
  name: string;
  description: string;
  icon: typeof Layout;
}[] = [
  {
    id: "bold-statement",
    name: "Impactante",
    description: "Headline bold, visual forte",
    icon: Type,
  },
  {
    id: "gradient-wave",
    name: "Gradiente",
    description: "Fundo gradiente moderno",
    icon: Palette,
  },
  {
    id: "minimal-clean",
    name: "Minimalista",
    description: "Clean, muito espaco",
    icon: Layout,
  },
  {
    id: "quote-card",
    name: "Citacao",
    description: "Card de frase/quote",
    icon: Type,
  },
  {
    id: "tip-numbered",
    name: "Dica",
    description: "Dica numerada estruturada",
    icon: Layout,
  },
  {
    id: "stats-highlight",
    name: "Destaque",
    description: "Numero em destaque",
    icon: Maximize,
  },
  {
    id: "split-content",
    name: "Dividido",
    description: "Layout split two-tone",
    icon: Layout,
  },
  {
    id: "carousel-slide",
    name: "Carrossel",
    description: "Slide de carrossel",
    icon: Layout,
  },
];

/* ------------------------------------------------------------------ */
/*  Color presets                                                       */
/* ------------------------------------------------------------------ */

const COLOR_PRESETS = [
  "#4ecdc4",
  "#6c5ce7",
  "#e11d48",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

/* ------------------------------------------------------------------ */
/*  Aspect ratio options                                                */
/* ------------------------------------------------------------------ */

const ASPECT_RATIOS: {
  value: "1:1" | "4:5" | "9:16";
  label: string;
  sublabel: string;
  icon: typeof Square;
}[] = [
  {
    value: "1:1",
    label: "1:1",
    sublabel: "Feed",
    icon: Square,
  },
  {
    value: "4:5",
    label: "4:5",
    sublabel: "Retrato",
    icon: RectangleVertical,
  },
  {
    value: "9:16",
    label: "9:16",
    sublabel: "Story/Reels",
    icon: Smartphone,
  },
];

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface DesignPickerProps {
  data: PostDesignData;
  selectedTemplate: PostDesignTemplate;
  onTemplateChange: (t: PostDesignTemplate) => void;
  brandColor: string;
  onBrandColorChange: (c: string) => void;
  aspectRatio: "1:1" | "4:5" | "9:16";
  onAspectRatioChange: (r: "1:1" | "4:5" | "9:16") => void;
  dnaBrandColors?: string[]; // Brand colors from DNA palette
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function DesignPicker({
  data,
  selectedTemplate,
  onTemplateChange,
  brandColor,
  onBrandColorChange,
  aspectRatio,
  onAspectRatioChange,
  dnaBrandColors,
}: DesignPickerProps) {
  // Merge DNA brand colors with defaults, putting brand colors first
  const effectiveColorPresets = (() => {
    if (!dnaBrandColors?.length) return COLOR_PRESETS;
    const merged = [...dnaBrandColors];
    COLOR_PRESETS.forEach((c) => {
      if (!merged.includes(c)) merged.push(c);
    });
    return merged.slice(0, 12);
  })();
  const [customColor, setCustomColor] = useState(brandColor);

  /* Sync custom input when a preset is picked */
  const handlePresetClick = (color: string) => {
    setCustomColor(color);
    onBrandColorChange(color);
  };

  const handleCustomColorCommit = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      onBrandColorChange(customColor);
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------- Template Grid ---------- */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Layout size={14} />
          Template
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATES.map((tpl) => {
            const isSelected = tpl.id === selectedTemplate;
            const Icon = tpl.icon;

            return (
              <motion.button
                key={tpl.id}
                onClick={() => onTemplateChange(tpl.id)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer
                  ${
                    isSelected
                      ? "border-accent bg-accent/5 shadow-[0_0_20px_rgba(78,205,196,0.15)]"
                      : "border-border bg-bg-card hover:border-border-light hover:bg-bg-card/80"
                  }
                `}
              >
                {/* Simplified thumbnail — colored placeholder */}
                <div
                  className="w-full aspect-square rounded-lg flex items-center justify-center"
                  style={{
                    background: tpl.id.includes("minimal")
                      ? "#ffffff"
                      : tpl.id.includes("gradient")
                        ? `linear-gradient(135deg, ${brandColor}, #6c5ce7)`
                        : "#0c0f24",
                  }}
                >
                  <Icon
                    size={20}
                    style={{
                      color: tpl.id.includes("minimal") ? brandColor : "#ffffff",
                      opacity: 0.5,
                    }}
                  />
                </div>

                {/* Selection check */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 20,
                      }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center shadow-lg"
                    >
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Label */}
                <div className="flex items-center gap-1.5 w-full">
                  <Icon
                    size={12}
                    className={
                      isSelected
                        ? "text-accent-light"
                        : "text-text-muted group-hover:text-text-secondary"
                    }
                  />
                  <span
                    className={`text-[11px] font-semibold truncate ${
                      isSelected
                        ? "text-accent-light"
                        : "text-text-secondary group-hover:text-text-primary"
                    }`}
                  >
                    {tpl.name}
                  </span>
                </div>

                {/* Selection indicator using layoutId */}
                {isSelected && (
                  <motion.div
                    layoutId="template-selection-ring"
                    className="absolute inset-0 rounded-xl border-2 border-accent pointer-events-none"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* ---------- Brand Color ---------- */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Palette size={14} />
          Cor da marca
        </h3>

        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Brand colors label */}
          {dnaBrandColors?.length ? (
            <p className="text-[10px] text-text-muted font-medium">Cores da marca</p>
          ) : null}

          {/* Preset swatches */}
          <div className="flex flex-wrap gap-2.5">
            {effectiveColorPresets.map((color) => {
              const isActive = brandColor === color;
              return (
                <motion.button
                  key={color}
                  onClick={() => handlePresetClick(color)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className="relative"
                  title={color}
                >
                  <div
                    className={`w-8 h-8 rounded-full transition-all duration-200 ${
                      isActive
                        ? "ring-2 ring-offset-2 ring-offset-bg-card ring-white/50 shadow-lg"
                        : "hover:shadow-md"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Check size={14} className="text-white drop-shadow-md" strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Custom hex input */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg border border-border shrink-0"
              style={{ backgroundColor: customColor }}
            />
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-xs text-text-muted font-mono">#</span>
              <input
                type="text"
                value={customColor.replace("#", "")}
                onChange={(e) => {
                  const val = `#${e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6)}`;
                  setCustomColor(val);
                }}
                onBlur={handleCustomColorCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomColorCommit();
                }}
                maxLength={6}
                className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="4ecdc4"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Aspect Ratio ---------- */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Maximize size={14} />
          Proporcao
        </h3>

        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ar) => {
            const isActive = aspectRatio === ar.value;
            const Icon = ar.icon;

            return (
              <motion.button
                key={ar.value}
                onClick={() => onAspectRatioChange(ar.value)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  flex-1 flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 transition-all duration-200
                  ${
                    isActive
                      ? "border-accent bg-accent/5 shadow-[0_0_15px_rgba(78,205,196,0.12)]"
                      : "border-border bg-bg-card hover:border-border-light"
                  }
                `}
              >
                <Icon
                  size={18}
                  className={
                    isActive ? "text-accent-light" : "text-text-muted"
                  }
                />
                <span
                  className={`text-xs font-bold ${
                    isActive ? "text-accent-light" : "text-text-primary"
                  }`}
                >
                  {ar.label}
                </span>
                <span
                  className={`text-[10px] ${
                    isActive ? "text-accent/70" : "text-text-muted"
                  }`}
                >
                  {ar.sublabel}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
