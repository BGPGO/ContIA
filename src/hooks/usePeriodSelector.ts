"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type PeriodPreset = "7d" | "30d" | "90d" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface UsePeriodSelectorReturn {
  preset: PeriodPreset;
  range: PeriodRange;
  previousRange: PeriodRange;
  setPreset: (p: PeriodPreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
  label: string;
  /** Indica se o preset ativo é válido dado o earliestConnectionDate */
  isPresetValid: (p: PeriodPreset, earliestConnectionDate: Date | null) => boolean;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function today(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function computeRange(preset: PeriodPreset, customStart?: Date, customEnd?: Date): PeriodRange {
  if (preset === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return { start: daysAgo(days), end: today() };
}

/** Retorna true se o preset cobre algum período a partir de earliestConnectionDate */
function presetIsValid(preset: PeriodPreset, earliestConnectionDate: Date | null): boolean {
  if (!earliestConnectionDate || preset === "custom") return true;
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const periodStart = daysAgo(days);
  // Preset válido se a data de início do período NÃO é anterior à data de conexão
  // (ou seja: há dados reais disponíveis naquele intervalo)
  return periodStart >= earliestConnectionDate;
}

/** Encontra o maior preset válido. Se nenhum couber, retorna "custom" */
function findBestValidPreset(earliestConnectionDate: Date | null): PeriodPreset {
  const ordered: PeriodPreset[] = ["7d", "30d", "90d"];
  for (const p of ordered) {
    if (presetIsValid(p, earliestConnectionDate)) return p;
  }
  return "custom";
}

function computePreviousRange(range: PeriodRange): PeriodRange {
  const diff = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { start: prevStart, end: prevEnd };
}

const STORAGE_KEY = "contia_period_preset";
const PRESETS_LABELS: Record<PeriodPreset, string> = {
  "7d": "Ultimos 7 dias",
  "30d": "Ultimos 30 dias",
  "90d": "Ultimos 90 dias",
  custom: "Personalizado",
};

export function usePeriodSelector(): UsePeriodSelectorReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [preset, setPresetState] = useState<PeriodPreset>(() => {
    const fromUrl = searchParams.get("period") as PeriodPreset | null;
    if (fromUrl && fromUrl in PRESETS_LABELS) return fromUrl;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as PeriodPreset | null;
      if (saved && saved in PRESETS_LABELS) return saved;
    }
    return "30d";
  });

  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const range = useMemo(() => computeRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const previousRange = useMemo(() => computePreviousRange(range), [range]);

  const setPreset = useCallback(
    (p: PeriodPreset) => {
      setPresetState(p);
      try { localStorage.setItem(STORAGE_KEY, p); } catch { /* noop */ }
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", p);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setCustomRange = useCallback(
    (start: Date, end: Date) => {
      setCustomStart(start);
      setCustomEnd(end);
      setPreset("custom");
    },
    [setPreset]
  );

  const label = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
      return `${fmt.format(customStart)} — ${fmt.format(customEnd)}`;
    }
    return PRESETS_LABELS[preset];
  }, [preset, customStart, customEnd]);

  const isPresetValid = useCallback(
    (p: PeriodPreset, earliestConnectionDate: Date | null): boolean =>
      presetIsValid(p, earliestConnectionDate),
    []
  );

  return { preset, range, previousRange, setPreset, setCustomRange, label, isPresetValid };
}
