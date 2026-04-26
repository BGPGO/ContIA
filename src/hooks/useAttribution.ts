"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { AttributionData } from "@/types/attribution";

/* ── In-memory cache ─────────────────────────────────────────────── */

interface CacheEntry {
  data: AttributionData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60s

function getCacheKey(empresaId: string, start: string, end: string): string {
  return `attribution_${empresaId}_${start}_${end}`;
}

/* ── Return type ─────────────────────────────────────────────────── */

export interface UseAttributionReturn {
  data: AttributionData | null;
  loading: boolean;
  error: string | null;
  refresh: (forceRefresh?: boolean) => void;
}

/* ── Hook ────────────────────────────────────────────────────────── */

export function useAttribution(
  empresaId: string | null | undefined,
  periodStart: string,
  periodEnd: string,
  enabled: boolean = true
): UseAttributionReturn {
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!enabled || !empresaId) return;

      const cacheKey = getCacheKey(empresaId, periodStart, periodEnd);

      // Check cache unless forced
      if (!forceRefresh) {
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          setData(cached.data);
          setError(null);
          return;
        }
      }

      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          empresa_id: empresaId,
          period_start: periodStart,
          period_end: periodEnd,
        });
        const res = await fetch(`/api/analytics/attribution?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Erro ${res.status}`);
        }

        const json: AttributionData = await res.json();
        cache.set(cacheKey, { data: json, timestamp: Date.now() });
        setData(json);
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // Race condition — ignore
        setError((err as Error).message ?? "Erro ao carregar dados de atribuição");
      } finally {
        setLoading(false);
      }
    },
    [empresaId, periodStart, periodEnd, enabled]
  );

  // Initial + reactive fetch
  useEffect(() => {
    void fetchData(false);
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchData]);

  const refresh = useCallback(
    (forceRefresh = false) => {
      void fetchData(forceRefresh);
    },
    [fetchData]
  );

  return { data, loading, error, refresh };
}
