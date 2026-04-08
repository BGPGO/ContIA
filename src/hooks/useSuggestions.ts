"use client";

import { useState, useCallback } from "react";
import type { EnrichedSuggestion } from "@/types/suggestions";

export function useSuggestions(empresaId: string | undefined) {
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<{
    news_count: number;
    recent_posts_analyzed: number;
    dna_available: boolean;
  } | null>(null);

  const fetchSuggestions = useCallback(
    async (refresh = false) => {
      if (!empresaId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ empresa_id: empresaId });
        if (refresh) params.set("refresh", "true");
        const res = await fetch(`/api/ai/suggestions?${params}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao buscar sugestões");
        }
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setContext(data.context || null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [empresaId]
  );

  return {
    suggestions,
    loading,
    error,
    context,
    fetchSuggestions,
    refetch: () => fetchSuggestions(true),
  };
}
