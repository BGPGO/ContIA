"use client";

import { useState, useEffect } from "react";
import { CalendarDays, Info } from "lucide-react";
import type { PeriodPreset } from "@/hooks/usePeriodSelector";
import { useConnections } from "@/hooks/useConnections";

interface PeriodSelectorProps {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomRange: (start: Date, end: Date) => void;
  label: string;
  /**
   * Opcional — sobrescreve o earliestConnectionDate derivado do useConnections.
   * Útil para testes ou quando o componente pai já possui o valor.
   */
  earliestConnectionDate?: Date | null;
}

const PRESETS: { key: PeriodPreset; label: string; days: number | null }[] = [
  { key: "today", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "thisMonth", label: "Este mes", days: null },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "custom", label: "Personalizado", days: null },
];

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toInputValue(d: Date): string {
  // YYYY-MM-DD para input type=date
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function PeriodSelector({
  preset,
  onPresetChange,
  onCustomRange,
  label,
  earliestConnectionDate: earliestProp,
}: PeriodSelectorProps) {
  const { earliestConnectionDate: earliestFromHook, loading: connectionsLoading } =
    useConnections();

  // Prop tem prioridade; se não vier, usa o valor derivado do hook
  const earliestConnectionDate =
    earliestProp !== undefined ? earliestProp : earliestFromHook;

  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Fallback automático: se o preset ativo ficou inválido após carregar earliest,
  // migra para o maior preset válido sem sobrescrever a preferência persistida —
  // o hook usePeriodSelector vai manter a preferência salva para quando o tempo passar.
  useEffect(() => {
    if (connectionsLoading || !earliestConnectionDate || preset === "custom") return;

    const isCurrentValid = checkPresetValid(preset, earliestConnectionDate);
    if (!isCurrentValid) {
      const best = findBestValidPreset(earliestConnectionDate);
      if (best === "custom") {
        // Nenhum preset cobre — vai para custom com range máximo disponível
        onCustomRange(earliestConnectionDate, new Date());
      } else {
        onPresetChange(best);
      }
    }
  // Executar apenas quando earliest mudar (não a cada render do preset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earliestConnectionDate, connectionsLoading]);

  function checkPresetValid(p: PeriodPreset, earliest: Date | null): boolean {
    if (!earliest || p === "custom") return true;
    if (p === "today") {
      const start = new Date(); start.setHours(0,0,0,0);
      return start >= earliest;
    }
    if (p === "thisMonth") {
      const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
      return start >= earliest;
    }
    const meta = PRESETS.find((x) => x.key === p);
    if (!meta?.days) return true;
    const periodStart = daysAgo(meta.days);
    return periodStart >= earliest;
  }

  function findBestValidPreset(earliest: Date | null): PeriodPreset {
    const ordered: PeriodPreset[] = ["today", "7d", "thisMonth", "30d", "90d"];
    for (const p of ordered) {
      if (checkPresetValid(p, earliest)) return p;
    }
    return "custom";
  }

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

  const minDateValue = earliestConnectionDate
    ? toInputValue(earliestConnectionDate)
    : undefined;

  // Badge: texto informativo sobre disponibilidade de dados
  const showBadge = !connectionsLoading;
  const badgeText = earliestConnectionDate
    ? `Dados disponíveis desde ${formatDate(earliestConnectionDate)}`
    : null;
  const noBadgeText =
    !earliestConnectionDate && !connectionsLoading
      ? "Conecte uma rede social para coletar dados"
      : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Badge informativo */}
      {showBadge && (badgeText ?? noBadgeText) && (
        <div className="flex items-center gap-1.5">
          <Info size={12} className="text-text-muted shrink-0" />
          <span className="text-[11px] text-text-muted">
            {badgeText ?? noBadgeText}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div
          className="flex items-center gap-1"
          role="tablist"
          aria-label="Selecionar periodo"
        >
          {PRESETS.map((p) => {
            const isDisabled =
              p.key !== "custom" &&
              !!earliestConnectionDate &&
              !checkPresetValid(p.key, earliestConnectionDate);

            const periodStart =
              p.days !== null ? daysAgo(p.days) : null;
            const tooltipText =
              isDisabled && earliestConnectionDate && periodStart
                ? `Dados disponíveis a partir de ${formatDate(earliestConnectionDate)}`
                : undefined;

            return (
              <button
                key={p.key}
                role="tab"
                aria-selected={preset === p.key}
                onClick={() => !isDisabled && handlePreset(p.key)}
                disabled={isDisabled}
                title={tooltipText}
                aria-label={tooltipText ?? p.label}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed text-text-muted"
                    : preset === p.key
                    ? "bg-accent text-bg-primary shadow-sm shadow-accent/30"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {showCustom && (
          <div className="flex items-center gap-2 animate-fade-in-up">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-text-muted" />
              <input
                type="date"
                value={customStart}
                min={minDateValue}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-bg-input border border-border rounded-lg px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Data inicial"
              />
              <span className="text-[11px] text-text-muted">ate</span>
              <input
                type="date"
                value={customEnd}
                min={minDateValue}
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
    </div>
  );
}
