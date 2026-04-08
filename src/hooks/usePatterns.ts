"use client";

import { useState, useEffect, useCallback } from "react";
import type { StyleProfile } from "@/types/patterns";

export function usePatterns(empresaId: string | undefined) {
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/patterns?empresa_id=${empresaId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao buscar padrões");
      }
      const data = await res.json();
      setStyleProfile(data.style_profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  // Auto-fetch on mount if empresaId exists
  useEffect(() => {
    if (empresaId) fetchPatterns();
  }, [empresaId, fetchPatterns]);

  return { styleProfile, loading, error, refetch: fetchPatterns };
}
