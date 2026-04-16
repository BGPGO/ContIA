"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEmpresa } from "./useEmpresa";
import type { ProviderKey, ContentItem, ProviderSnapshot } from "@/types/providers";
import type { ReportAnalysis, Comparison } from "@/types/reports";

/* ── Types ──────────────────────────────────────────────────── */

export interface KPI {
  label: string;
  value: number;
  previousValue: number;
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "flat";
  icon: string;
}

export interface TimeSeriesPoint {
  date: string;
  [providerOrMetric: string]: string | number;
}

export interface TopContentItem {
  id: string;
  provider: ProviderKey;
  content_type: string;
  title: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  url: string | null;
  published_at: string | null;
  engagement: number;
  metrics: Record<string, number>;
}

export interface DashboardData {
  kpis: KPI[];
  timeSeries: TimeSeriesPoint[];
  topContent: TopContentItem[];
  connectedCount: number;
  totalProviders: number;
  latestAnalysis: ReportAnalysis | null;
  comparisons: Comparison[];
}

export interface UseInsightsReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/* ── Cache ──────────────────────────────────────────────────── */

const CACHE_TTL = 60_000; // 60s
const cache = new Map<string, { data: DashboardData; ts: number }>();

function getCacheKey(empresaId: string, start: string, end: string): string {
  return `${empresaId}:${start}:${end}`;
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useInsights(periodStart: Date, periodEnd: Date): UseInsightsReturn {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!empresa?.id) {
      setLoading(false);
      return;
    }

    const startISO = periodStart.toISOString().split("T")[0];
    const endISO = periodEnd.toISOString().split("T")[0];
    const key = getCacheKey(empresa.id, startISO, endISO);

    // Check cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        empresa_id: empresa.id,
        period_start: startISO,
        period_end: endISO,
      });

      const res = await fetch(`/api/insights/dashboard?${params}`, {
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as DashboardData;
      setData(json);
      cache.set(key, { data: json, ts: Date.now() });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro ao carregar insights");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, periodStart, periodEnd]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const refresh = useCallback(() => {
    if (!empresa?.id) return;
    const startISO = periodStart.toISOString().split("T")[0];
    const endISO = periodEnd.toISOString().split("T")[0];
    cache.delete(getCacheKey(empresa.id, startISO, endISO));
    fetchData();
  }, [empresa?.id, periodStart, periodEnd, fetchData]);

  return { data, loading, error, refresh };
}
