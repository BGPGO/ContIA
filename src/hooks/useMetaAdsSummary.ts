"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEmpresa } from "./useEmpresa";
import type { ProviderAnalyticsData } from "@/types/analytics";

interface UseMetaAdsSummaryReturn {
  data: ProviderAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const CACHE_TTL = 60_000;
const cache = new Map<string, { data: ProviderAnalyticsData; ts: number }>();

/**
 * Busca o resumo de Meta Ads via endpoint deep-dive.
 * Só faz fetch se `enabled` for true (i.e., a conexão meta_ads está ativa).
 */
export function useMetaAdsSummary(
  periodStart: Date,
  periodEnd: Date,
  enabled: boolean
): UseMetaAdsSummaryReturn {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<ProviderAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startISO = periodStart.toISOString().split("T")[0];
  const endISO = periodEnd.toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    if (!empresa?.id || !enabled) {
      setData(null);
      setLoading(false);
      return;
    }

    const cacheKey = `meta_ads_${empresa.id}_${startISO}_${endISO}`;
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
      const url = `/api/analytics/meta_ads?empresa_id=${encodeURIComponent(empresa.id)}&period_start=${startISO}&period_end=${endISO}`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json: ProviderAnalyticsData = await res.json();
      cache.set(cacheKey, { data: json, ts: Date.now() });
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro ao carregar Meta Ads");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, startISO, endISO, enabled]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return () => {
        abortRef.current?.abort();
      };
    }
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData, enabled]);

  return { data, loading, error, refresh: fetchData };
}
