"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdLibraryAd {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  publisher_platforms?: string[];
  languages?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
}

interface AdsResponse {
  ads: AdLibraryAd[];
  total: number;
  has_more: boolean;
  cached?: boolean;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const adsCache = new Map<string, AdsResponse>();

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConcorrenteAds(concorrenteId: string | null) {
  const [ads, setAds] = useState<AdLibraryAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [cached, setCached] = useState(false);
  const lastIdRef = useRef<string | null>(null);

  const fetchAds = useCallback(
    async (force = false) => {
      if (!concorrenteId) return;

      // Use in-memory cache if available and not forcing
      if (!force && adsCache.has(concorrenteId)) {
        const cached = adsCache.get(concorrenteId)!;
        setAds(cached.ads);
        setTotal(cached.total);
        setCached(cached.cached ?? true);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (force) {
          params.set("force", "true");
          params.set("refresh", "true");
        }
        const qs = params.toString();
        const url = `/api/concorrentes/${concorrenteId}/ads${qs ? `?${qs}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Erro ao buscar anúncios.");
          return;
        }

        const response: AdsResponse = {
          ads: data.ads || [],
          total: data.total ?? 0,
          has_more: data.has_more ?? false,
          cached: data.cached ?? false,
        };

        adsCache.set(concorrenteId, response);
        setAds(response.ads);
        setTotal(response.total);
        setCached(response.cached ?? false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      } finally {
        setLoading(false);
      }
    },
    [concorrenteId]
  );

  const refresh = useCallback(() => {
    if (concorrenteId) {
      adsCache.delete(concorrenteId);
    }
    return fetchAds(true);
  }, [concorrenteId, fetchAds]);

  // Auto-fetch when concorrenteId changes
  useEffect(() => {
    if (concorrenteId && concorrenteId !== lastIdRef.current) {
      lastIdRef.current = concorrenteId;
      fetchAds();
    }
  }, [concorrenteId, fetchAds]);

  return { ads, loading, error, total, cached, fetchAds, refresh };
}
