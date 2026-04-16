"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { PeriodPreset } from "@/hooks/usePeriodSelector";

interface PeriodSelectorProps {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomRange: (start: Date, end: Date) => void;
  label: string;
}

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "custom", label: "Personalizado" },
];

export function PeriodSelector({
  preset,
  onPresetChange,
  onCustomRange,
  label,
}: PeriodSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function handlePreset(p: PeriodPreset) {
    if (p === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onPresetChange(p);
    }
  }

  function handleApplyCustom() {
    if (customStart && customEnd) {
      onCustomRange(new Date(customStart), new Date(customEnd));
      setShowCustom(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <div className="flex items-center gap-1" role="tablist" aria-label="Selecionar periodo">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={preset === p.key}
            onClick={() => handlePreset(p.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
              preset === p.key
                ? "bg-accent text-bg-primary shadow-sm shadow-accent/30"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 animate-fade-in-up">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-text-muted" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-bg-input border border-border rounded-lg px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Data inicial"
            />
            <span className="text-[11px] text-text-muted">ate</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-bg-input border border-border rounded-lg px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Data final"
            />
          </div>
          <button
            onClick={handleApplyCustom}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-accent text-bg-primary disabled:opacity-40 transition-all"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
