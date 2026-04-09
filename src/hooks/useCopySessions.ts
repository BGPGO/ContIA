"use client";

import { useState, useEffect, useCallback } from "react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import type { ContentFormat, ContentTone } from "@/types/ai";
import type { CopySession } from "@/types/copy-studio";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** Lightweight session for list views (no full messages) */
export interface CopySessionSummary {
  id: string;
  empresa_id: string;
  user_id: string;
  title: string;
  format: ContentFormat;
  tone: ContentTone;
  platforms: string[];
  topic: string;
  status: CopySession["status"];
  created_at: string;
  updated_at: string;
}

interface UseCopySessionsReturn {
  sessions: CopySessionSummary[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (config: {
    title?: string;
    format?: ContentFormat;
    tone?: ContentTone;
    platforms?: string[];
    topic?: string;
  }) => Promise<string | null>;
  deleteSession: (id: string) => Promise<void>;
  duplicateSession: (id: string) => Promise<string | null>;
}

// ═══════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════

export function useCopySessions(): UseCopySessionsReturn {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const configured = isSupabaseConfigured();

  const [sessions, setSessions] = useState<CopySessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch sessions ──
  const fetchSessions = useCallback(async () => {
    if (!empresaId || !configured) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("copy_sessions")
        .select("id, empresa_id, user_id, title, format, tone, platforms, topic, status, created_at, updated_at")
        .eq("empresa_id", empresaId)
        .order("updated_at", { ascending: false });

      if (err) throw new Error(err.message);
      setSessions((data || []) as CopySessionSummary[]);
    } catch (e: any) {
      const msg = e.message || "Erro ao carregar sessoes";
      setError(msg);
      console.error("[CopySessions] Fetch failed:", msg);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId, configured]);

  // ── Auto-fetch on mount / empresa change ──
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Create session ──
  const createSession = useCallback(
    async (config: {
      title?: string;
      format?: ContentFormat;
      tone?: ContentTone;
      platforms?: string[];
      topic?: string;
    }): Promise<string | null> => {
      if (!empresaId || !configured) return null;

      setError(null);

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nao autenticado");

        const newSession = {
          empresa_id: empresaId,
          user_id: user.id,
          title: config.title || config.topic || "Nova sessao",
          format: config.format || "post",
          tone: config.tone || "casual",
          platforms: config.platforms || ["instagram"],
          topic: config.topic || "",
          current_copy: null,
          messages: [],
          dna_context: null,
          style_profile: null,
          status: "draft" as const,
        };

        // Optimistic add
        const optimisticId = crypto.randomUUID();
        const optimisticEntry: CopySessionSummary = {
          id: optimisticId,
          empresa_id: newSession.empresa_id,
          user_id: newSession.user_id,
          title: newSession.title,
          format: newSession.format as ContentFormat,
          tone: newSession.tone as ContentTone,
          platforms: newSession.platforms,
          topic: newSession.topic,
          status: newSession.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setSessions((prev) => [optimisticEntry, ...prev]);

        const { data, error: err } = await supabase
          .from("copy_sessions")
          .insert(newSession)
          .select("id, empresa_id, user_id, title, format, tone, platforms, topic, status, created_at, updated_at")
          .single();

        if (err) {
          // Rollback optimistic add
          setSessions((prev) => prev.filter((s) => s.id !== optimisticId));
          throw new Error(err.message);
        }

        // Replace optimistic entry with real one
        const created = data as CopySessionSummary;
        setSessions((prev) =>
          prev.map((s) => (s.id === optimisticId ? created : s))
        );

        return created.id;
      } catch (e: any) {
        const msg = e.message || "Erro ao criar sessao";
        setError(msg);
        console.error("[CopySessions] Create failed:", msg);
        return null;
      }
    },
    [empresaId, configured]
  );

  // ── Delete session ──
  const deleteSession = useCallback(
    async (id: string) => {
      if (!configured) return;

      setError(null);

      // Optimistic delete
      const removed = sessions.find((s) => s.id === id);
      setSessions((prev) => prev.filter((s) => s.id !== id));

      try {
        const supabase = createClient();
        const { error: err } = await supabase
          .from("copy_sessions")
          .delete()
          .eq("id", id);

        if (err) {
          // Rollback
          if (removed) {
            setSessions((prev) => [...prev, removed]);
          }
          throw new Error(err.message);
        }
      } catch (e: any) {
        const msg = e.message || "Erro ao deletar sessao";
        setError(msg);
        console.error("[CopySessions] Delete failed:", msg);
      }
    },
    [configured, sessions]
  );

  // ── Duplicate session ──
  const duplicateSession = useCallback(
    async (id: string): Promise<string | null> => {
      if (!configured || !empresaId) return null;

      setError(null);

      try {
        const supabase = createClient();

        // Fetch full session to duplicate
        const { data: original, error: fetchErr } = await supabase
          .from("copy_sessions")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchErr || !original) {
          throw new Error(fetchErr?.message || "Sessao nao encontrada");
        }

        const session = original as CopySession;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nao autenticado");

        const duplicated = {
          empresa_id: session.empresa_id,
          user_id: user.id,
          title: `${session.title} (copia)`,
          format: session.format,
          tone: session.tone,
          platforms: session.platforms,
          topic: session.topic,
          current_copy: session.current_copy,
          messages: session.messages,
          dna_context: session.dna_context,
          style_profile: session.style_profile,
          status: "draft" as const,
        };

        const { data, error: insertErr } = await supabase
          .from("copy_sessions")
          .insert(duplicated)
          .select("id, empresa_id, user_id, title, format, tone, platforms, topic, status, created_at, updated_at")
          .single();

        if (insertErr) throw new Error(insertErr.message);

        const created = data as CopySessionSummary;
        setSessions((prev) => [created, ...prev]);

        return created.id;
      } catch (e: any) {
        const msg = e.message || "Erro ao duplicar sessao";
        setError(msg);
        console.error("[CopySessions] Duplicate failed:", msg);
        return null;
      }
    },
    [configured, empresaId]
  );

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    createSession,
    deleteSession,
    duplicateSession,
  };
}
