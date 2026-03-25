"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MarcaDNA } from "@/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const DNA_STORAGE_PREFIX = "contia_dna_";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getStorageKey(empresaId: string) {
  return `${DNA_STORAGE_PREFIX}${empresaId}`;
}

function loadFromStorage(empresaId: string): MarcaDNA | null {
  try {
    const raw = localStorage.getItem(getStorageKey(empresaId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(empresaId: string, dna: MarcaDNA) {
  try {
    localStorage.setItem(getStorageKey(empresaId), JSON.stringify(dna));
  } catch {
    // Storage full or unavailable
  }
}

function removeFromStorage(empresaId: string) {
  try {
    localStorage.removeItem(getStorageKey(empresaId));
  } catch {}
}

export function useMarcaDNA(empresaId?: string) {
  const [dna, setDna] = useState<MarcaDNA | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoAnalyzedRef = useRef(false);
  const refreshCheckedRef = useRef(false);
  const configured = isSupabaseConfigured();

  // ── Load DNA on mount / empresa change ───────────────────────────────
  useEffect(() => {
    if (!empresaId) {
      setDna(null);
      setLoading(false);
      return;
    }

    // Reset refs when empresa changes
    autoAnalyzedRef.current = false;
    refreshCheckedRef.current = false;

    // 1. Instant load from localStorage
    const cached = loadFromStorage(empresaId);
    if (cached) {
      setDna(cached);
      setLoading(false);
    }

    // 2. Background load from Supabase (fresher)
    if (configured) {
      const supabase = createClient();
      Promise.resolve(
        supabase
          .from("marca_dna")
          .select("*")
          .eq("empresa_id", empresaId)
          .maybeSingle()
      )
        .then(({ data, error: err }) => {
          if (err) {
            console.warn("[MarcaDNA] Supabase load error:", err.message);
          } else if (data) {
            const dnaData = data as MarcaDNA;
            setDna(dnaData);
            saveToStorage(empresaId, dnaData);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (!cached) {
      setLoading(false);
    }
  }, [empresaId, configured]);

  // ── Auto-refresh if DNA is stale (> 7 days) ─────────────────────────
  useEffect(() => {
    if (!empresaId || !dna || refreshCheckedRef.current || analyzing) return;
    refreshCheckedRef.current = true;

    const lastAnalysis = dna.ultima_analise
      ? new Date(dna.ultima_analise).getTime()
      : 0;
    const age = Date.now() - lastAnalysis;

    if (age > REFRESH_INTERVAL_MS && dna.status === "completo") {
      console.log("[MarcaDNA] DNA stale, refreshing in background...");
      refreshInBackground();
    }
  }, [dna, empresaId, analyzing]);

  // ── Trigger full analysis ────────────────────────────────────────────
  const analisar = useCallback(async () => {
    if (!empresaId) return;
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/marca/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Análise falhou");
      }

      const result: MarcaDNA = await res.json();
      setDna(result);
      saveToStorage(empresaId, result);

      // Also save to Supabase
      if (configured) {
        const supabase = createClient();
        await supabase
          .from("marca_dna")
          .upsert(
            { ...result, empresa_id: empresaId },
            { onConflict: "empresa_id" }
          )
          .then(({ error: err }) => {
            if (err) console.warn("[MarcaDNA] Supabase save error:", err.message);
          });
      }

      return result;
    } catch (err: any) {
      const msg = err.message || "Erro na análise";
      setError(msg);
      console.error("[MarcaDNA] Analysis failed:", msg);
      return null;
    } finally {
      setAnalyzing(false);
    }
  }, [empresaId, configured]);

  // ── Background refresh (doesn't block UI) ───────────────────────────
  const refreshInBackground = useCallback(async () => {
    if (!empresaId || analyzing) return;
    setRefreshing(true);

    try {
      const res = await fetch("/api/marca/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });

      if (res.ok) {
        const result: MarcaDNA = await res.json();
        setDna(result);
        saveToStorage(empresaId, result);

        if (configured) {
          const supabase = createClient();
          await supabase
            .from("marca_dna")
            .upsert(
              { ...result, empresa_id: empresaId },
              { onConflict: "empresa_id" }
            );
        }
        console.log("[MarcaDNA] Background refresh complete");
      }
    } catch (err) {
      console.warn("[MarcaDNA] Background refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [empresaId, analyzing, configured]);

  // ── Manual save (for external updates) ──────────────────────────────
  const save = useCallback(
    (updated: MarcaDNA) => {
      if (!empresaId) return;
      setDna(updated);
      saveToStorage(empresaId, updated);
    },
    [empresaId]
  );

  // ── Clear DNA ───────────────────────────────────────────────────────
  const clear = useCallback(() => {
    if (!empresaId) return;
    setDna(null);
    removeFromStorage(empresaId);
  }, [empresaId]);

  return {
    dna,
    loading,
    analyzing,
    refreshing,
    error,
    analisar,
    refreshInBackground,
    save,
    clear,
    isStale:
      dna?.ultima_analise
        ? Date.now() - new Date(dna.ultima_analise).getTime() > REFRESH_INTERVAL_MS
        : false,
  };
}
