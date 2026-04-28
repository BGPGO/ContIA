"use client";

import { useState, useCallback } from "react";
import type { CreativeIdea, CreativeIdeasResponse } from "@/types/creative-ideas";

interface GenerateOptions {
  model?: "sonnet" | "opus";
  daysWindow?: number;
}

interface UseCreativeIdeasReturn {
  ideias: CreativeIdea[];
  baseadoEm: CreativeIdeasResponse["baseadoEm"] | null;
  loading: boolean;
  error: string | null;
  generate: (empresaId: string, opts?: GenerateOptions) => Promise<void>;
  reset: () => void;
}

export function useCreativeIdeas(): UseCreativeIdeasReturn {
  const [ideias, setIdeias] = useState<CreativeIdea[]>([]);
  const [baseadoEm, setBaseadoEm] = useState<CreativeIdeasResponse["baseadoEm"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (empresaId: string, opts?: GenerateOptions) => {
    setLoading(true);
    setError(null);
    setIdeias([]);
    setBaseadoEm(null);

    try {
      const params = new URLSearchParams();
      if (opts?.model === "opus") params.set("model", "opus");

      const url = `/api/creatives/ideas${params.toString() ? `?${params}` : ""}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          ...(opts?.daysWindow ? { daysWindow: opts.daysWindow } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Erro ao gerar ideias.");
        return;
      }

      const typed = data as CreativeIdeasResponse;
      setIdeias(typed.ideias ?? []);
      setBaseadoEm(typed.baseadoEm ?? null);
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIdeias([]);
    setBaseadoEm(null);
    setLoading(false);
    setError(null);
  }, []);

  return { ideias, baseadoEm, loading, error, generate, reset };
}
