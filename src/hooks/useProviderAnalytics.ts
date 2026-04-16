"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEmpresa } from "./useEmpresa";
import type { ProviderKey } from "@/types/providers";
import type { ProviderAnalyticsData } from "@/types/analytics";

interface UseProviderAnalyticsReturn {
  data: ProviderAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const CACHE_TTL = 60_000;
const cache = new Map<string, { data: ProviderAnalyticsData; ts: number }>();

export function useProviderAnalytics(
  provider: ProviderKey,
  periodStart: Date,
  periodEnd: Date
): UseProviderAnalyticsReturn {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<ProviderAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startISO = periodStart.toISOString().split("T")[0];
  const endISO = periodEnd.toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    if (!empresa?.id) return;

    const cacheKey = `${empresa.id}_${provider}_${startISO}_${endISO}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/analytics/${provider}?empresa_id=${encodeURIComponent(empresa.id)}&period_start=${startISO}&period_end=${endISO}`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json: ProviderAnalyticsData = await res.json();
      cache.set(cacheKey, { data: json, ts: Date.now() });
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro ao carregar analytics");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, provider, startISO, endISO]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
