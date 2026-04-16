"use client";

import { useState, useEffect, useCallback } from "react";
import { IGScrapedPost } from "@/lib/instagram-scraper";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConcorrenteDB {
  id: string;
  empresa_id: string;
  nome: string;
  created_at: string;
  plataformas: Array<{
    id: string;
    concorrente_id: string;
    rede: string;
    username: string;
    seguidores: number;
    taxa_engajamento: number;
    freq_postagem: string;
  }>;
}

export interface ConcorrenteProfileData {
  username: string;
  fullName: string;
  biography: string;
  followers: number;
  following: number;
  postCount: number;
  profilePicUrl: string;
  partial: boolean;
  scrapedAt: string;
}

export interface ConcorrentePostsResult {
  profile: ConcorrenteProfileData | null;
  posts: IGScrapedPost[];
  error?: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConcorrentes(empresaId: string | undefined) {
  const [concorrentes, setConcorrentes] = useState<ConcorrenteDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── List concorrentes ──
  const fetchConcorrentes = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/concorrentes?empresa_id=${empresaId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setConcorrentes(data.concorrentes || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchConcorrentes();
  }, [fetchConcorrentes]);

  // ── Add concorrente ──
  const addConcorrente = useCallback(
    async (nome: string, usernameInstagram: string): Promise<boolean> => {
      if (!empresaId) return false;

      try {
        const res = await fetch("/api/concorrentes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome,
            username_instagram: usernameInstagram,
            empresa_id: empresaId,
          }),
        });

        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return false;
        }

        // Append to list
        if (data.concorrente) {
          setConcorrentes((prev) => [data.concorrente, ...prev]);
        }
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [empresaId]
  );

  // ── Remove concorrente ──
  const removeConcorrente = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/concorrentes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return false;
      }
      setConcorrentes((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  // ── Fetch posts for a concorrente ──
  const fetchPosts = useCallback(
    async (
      concorrenteId: string,
      username?: string,
      forceRefresh = false
    ): Promise<ConcorrentePostsResult> => {
      try {
        let url = `/api/concorrentes/${concorrenteId}/posts`;
        const params = new URLSearchParams();
        if (forceRefresh) params.set("refresh", "1");
        if (username) params.set("username", username);
        const qs = params.toString();
        if (qs) url += `?${qs}`;

        const res = await fetch(url);
        const data = await res.json();
        return {
          profile: data.profile || null,
          posts: data.posts || [],
          error: data.error,
        };
      } catch (err: any) {
        return { profile: null, posts: [], error: err.message };
      }
    },
    []
  );

  return {
    concorrentes,
    loading,
    error,
    fetchConcorrentes,
    addConcorrente,
    removeConcorrente,
    fetchPosts,
  };
}
