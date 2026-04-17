"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface VideoHistoryItem {
  id: string;
  title: string;
  status: string;
  duration_seconds: number | null;
  cut_suggestions: unknown[];
  transcription: unknown[];
  edits: unknown[];
  gemini_analysis: unknown;
  word_timestamps: unknown[];
  keywords: unknown[];
  created_at: string;
  updated_at: string;
}

export function useVideoHistory(empresaId: string | null | undefined) {
  const [projects, setProjects] = useState<VideoHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("video_projects")
        .select(
          "id, title, status, duration_seconds, cut_suggestions, transcription, edits, gemini_analysis, word_timestamps, keywords, created_at, updated_at"
        )
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setProjects(data as VideoHistoryItem[]);
      }
    } catch (err) {
      console.warn("[useVideoHistory] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        const supabase = createClient();
        await supabase.from("video_projects").delete().eq("id", id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        console.warn("[useVideoHistory] delete failed:", err);
      }
    },
    []
  );

  return { projects, loading, refetch: fetchHistory, deleteProject };
}
