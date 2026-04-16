"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEmpresa } from "./useEmpresa";
import type { ProviderKey } from "@/types/providers";
import type { ReportAnalysis } from "@/types/reports";
import type { KPI, TimeSeriesPoint, TopContentItem } from "./useInsights";

/* ── Types ──────────────────────────────────────────────────── */

export interface ProviderDeepDive {
  provider: ProviderKey;
  displayName: string;
  color: string;
  connected: boolean;
  kpis: KPI[];
  timeSeries: TimeSeriesPoint[];
  content: TopContentItem[];
  totalContent: number;
  analysis: ReportAnalysis | null;
}

export interface UseProviderInsightsReturn {
  data: ProviderDeepDive | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  syncing: boolean;
  syncNow: () => Promise<void>;
  loadMore: () => void;
  hasMore: boolean;
}

/* ── Cache ──────────────────────────────────────────────────── */

const CACHE_TTL = 60_000;
const cache = new Map<string, { data: ProviderDeepDive; ts: number }>();

/* ── Hook ───────────────────────────────────────────────────── */

export function useProviderInsights(
  provider: ProviderKey,
  periodStart: Date,
  periodEnd: Date
): UseProviderInsightsReturn {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<ProviderDeepDive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!empresa?.id) {
      setLoading(false);
      return;
    }

    const startISO = periodStart.toISOString().split("T")[0];
    const endISO = periodEnd.toISOString().split("T")[0];
    const key = `${empresa.id}:${provider}:${startISO}:${endISO}`;

    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

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
        page: "1",
        limit: "20",
      });

      const res = await fetch(`/api/insights/${provider}?${params}`, {
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);

      const json = (await res.json()) as ProviderDeepDive & { hasMore?: boolean };
      setData(json);
      setHasMore(json.hasMore ?? false);
      setPage(1);
      cache.set(key, { data: json, ts: Date.now() });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, provider, periodStart, periodEnd]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const refresh = useCallback(() => {
    if (!empresa?.id) return;
    const startISO = periodStart.toISOString().split("T")[0];
    const endISO = periodEnd.toISOString().split("T")[0];
    cache.delete(`${empresa.id}:${provider}:${startISO}:${endISO}`);
    fetchData();
  }, [empresa?.id, provider, periodStart, periodEnd, fetchData]);

  const syncNow = useCallback(async () => {
    if (!empresa?.id || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/sync/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresa.id }),
      });
      if (!res.ok) throw new Error("Sync failed");
      // Refresh data after sync
      await fetchData();
    } catch (err) {
      console.error("[useProviderInsights] sync error:", err);
    } finally {
      setSyncing(false);
    }
  }, [empresa?.id, provider, syncing, fetchData]);

  const loadMore = useCallback(async () => {
    if (!empresa?.id || !hasMore) return;
    const nextPage = page + 1;
    const startISO = periodStart.toISOString().split("T")[0];
    const endISO = periodEnd.toISOString().split("T")[0];

    try {
      const params = new URLSearchParams({
        empresa_id: empresa.id,
        period_start: startISO,
        period_end: endISO,
        page: nextPage.toString(),
        limit: "20",
      });

      const res = await fetch(`/api/insights/${provider}?${params}`);
      if (!res.ok) return;

      const json = (await res.json()) as ProviderDeepDive & { hasMore?: boolean };
      setData((prev) => {
        if (!prev) return json;
        return {
          ...prev,
          content: [...prev.content, ...json.content],
        };
      });
      setHasMore(json.hasMore ?? false);
      setPage(nextPage);
    } catch {
      // silent
    }
  }, [empresa?.id, provider, page, hasMore, periodStart, periodEnd]);

  return { data, loading, error, refresh, syncing, syncNow, loadMore, hasMore };
}
