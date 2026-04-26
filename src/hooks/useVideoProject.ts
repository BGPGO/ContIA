"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  VideoProject,
  VideoProjectStatus,
  VideoCut,
  VideoEdit,
  VideoAnalysis,
  TranscriptionSegment,
  WordTimestamp,
} from "@/types/video";

/* ── DB persistence helpers ── */

async function updateProjectEdits(
  id: string,
  edits: VideoEdit[]
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from("video_projects")
      .update({ edits, updated_at: new Date().toISOString() })
      .eq("id", id);
  } catch (err) {
    console.warn("[useVideoProject] updateEdits failed:", err);
  }
}

async function updateProjectCuts(
  id: string,
  cuts: VideoCut[]
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from("video_projects")
      .update({ cut_suggestions: cuts, updated_at: new Date().toISOString() })
      .eq("id", id);
  } catch (err) {
    console.warn("[useVideoProject] updateCuts failed:", err);
  }
}

export function useVideoProject() {
  const [project, setProject] = useState<VideoProject | null>(null);
  // status here is only used for the editor step (analyzed / editing).
  // Upload + processing status is now owned by useVideoJob.
  const [status, setStatus] = useState<VideoProjectStatus>("idle");

  const acceptCut = useCallback(
    (cut: VideoCut) => {
      if (!project) return;
      const updatedCuts = project.cuts.map((c) =>
        c.id === cut.id ? { ...c, accepted: true } : c
      );
      setProject({
        ...project,
        cuts: updatedCuts,
        updatedAt: new Date().toISOString(),
      });
      void updateProjectCuts(project.id, updatedCuts);
    },
    [project]
  );

  const removeCut = useCallback(
    (index: number) => {
      if (!project) return;
      setProject({
        ...project,
        cuts: project.cuts.filter((_, i) => i !== index),
        updatedAt: new Date().toISOString(),
      });
    },
    [project]
  );

  const adjustCut = useCallback(
    (index: number, changes: Partial<VideoCut>) => {
      if (!project) return;
      setProject({
        ...project,
        cuts: project.cuts.map((c, i) =>
          i === index ? { ...c, ...changes } : c
        ),
        updatedAt: new Date().toISOString(),
      });
    },
    [project]
  );

  const toggleEdit = useCallback(
    (type: VideoEdit["type"], enabled: boolean) => {
      if (!project) return;
      const updatedEdits = project.edits.map((e) =>
        e.type === type ? { ...e, enabled } : e
      );
      setProject({
        ...project,
        edits: updatedEdits,
        updatedAt: new Date().toISOString(),
      });
      void updateProjectEdits(project.id, updatedEdits);
    },
    [project]
  );

  const reset = useCallback(() => {
    setProject(null);
    setStatus("idle");
  }, []);

  /**
   * Load a project from DB history (no re-processing needed).
   *
   * Supports both new (cuts column) and legacy (cut_suggestions column)
   * schemas: if cuts is empty but cut_suggestions has data, uses cut_suggestions
   * as fallback.
   */
  const loadFromHistory = useCallback(
    (item: {
      id: string;
      title: string;
      status: string;
      duration_seconds: number | null;
      /** Legacy column — still read for fallback */
      cut_suggestions: unknown;
      /** New column (pipeline v2) */
      cuts?: unknown;
      transcription: unknown;
      edits: unknown;
      gemini_analysis: unknown;
      word_timestamps?: unknown;
      keywords?: unknown;
      video_url?: string | null;
      created_at: string;
      updated_at: string;
    }) => {
      // Prefer new `cuts` column; fall back to legacy `cut_suggestions`
      const newCuts = Array.isArray(item.cuts) && item.cuts.length > 0
        ? (item.cuts as VideoCut[])
        : Array.isArray(item.cut_suggestions)
        ? (item.cut_suggestions as VideoCut[])
        : [];

      const restored: VideoProject = {
        id: item.id,
        empresaId: "",
        title: item.title,
        videoUrl: item.video_url ?? "",
        originalFileName: item.title,
        duration: item.duration_seconds ?? 0,
        transcription: Array.isArray(item.transcription)
          ? (item.transcription as TranscriptionSegment[])
          : [],
        aiSummary: "",
        cuts: newCuts,
        edits: Array.isArray(item.edits)
          ? (item.edits as VideoEdit[])
          : [
              { type: "subtitle", enabled: true, config: {} },
              { type: "logo", enabled: false, config: { position: "bottom-right" } },
            ],
        analysis: item.gemini_analysis as VideoAnalysis | null,
        wordTimestamps: Array.isArray(item.word_timestamps)
          ? (item.word_timestamps as WordTimestamp[])
          : [],
        status: "analyzed",
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
      setProject(restored);
      setStatus("analyzed");
    },
    []
  );

  /**
   * Load a project by ID from the DB — used after TUS upload + job completion.
   * Fetches the latest data so editor has real transcription + cuts.
   *
   * NOTE: a tabela `video_projects` não possui coluna `video_url`. O bruto
   * fica em Storage (`videos/<storage_path>`), bucket privado. Geramos uma
   * signed URL on-demand (24h) para o `<VideoPlayer>` conseguir tocar.
   */
  const loadFromProjectId = useCallback(async (projectId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("video_projects")
        .select(
          "id, empresa_id, title, original_url, storage_path, duration_seconds, transcription, edits, gemini_analysis, word_timestamps, cuts, cut_suggestions, created_at, updated_at"
        )
        .eq("id", projectId)
        .single();

      if (error || !data) {
        console.warn("[useVideoProject] loadFromProjectId failed:", error?.message);
        return;
      }

      // Same new/legacy cuts fallback
      const newCuts = Array.isArray(data.cuts) && (data.cuts as unknown[]).length > 0
        ? (data.cuts as VideoCut[])
        : Array.isArray(data.cut_suggestions)
        ? (data.cut_suggestions as VideoCut[])
        : [];

      // Gerar signed URL para o vídeo bruto (bucket `videos` é privado).
      // Fallback para `original_url` (texto livre, ex.: nome do arquivo) se
      // não existir storage_path — não toca, mas evita videoUrl vazio total.
      let videoUrl = "";
      const storagePath = (data.storage_path as string | null) ?? null;
      if (storagePath) {
        const { data: signedUrlData, error: signedErr } = await supabase.storage
          .from("videos")
          .createSignedUrl(storagePath, 60 * 60 * 24); // 24h
        if (signedErr) {
          console.warn(
            "[useVideoProject] createSignedUrl failed:",
            signedErr.message
          );
        } else if (signedUrlData?.signedUrl) {
          videoUrl = signedUrlData.signedUrl;
        }
      } else if (typeof data.original_url === "string") {
        // Fallback legacy (alguns projetos antigos guardavam URL no original_url)
        videoUrl = data.original_url;
      }

      const restored: VideoProject = {
        id: data.id as string,
        empresaId: (data.empresa_id as string) ?? "",
        title: data.title as string,
        videoUrl,
        originalFileName: (data.title as string) ?? "",
        duration: (data.duration_seconds as number) ?? 0,
        transcription: Array.isArray(data.transcription)
          ? (data.transcription as TranscriptionSegment[])
          : [],
        aiSummary: "",
        cuts: newCuts,
        edits: Array.isArray(data.edits)
          ? (data.edits as VideoEdit[])
          : [
              { type: "subtitle", enabled: true, config: {} },
              { type: "logo", enabled: false, config: { position: "bottom-right" } },
            ],
        analysis: (data.gemini_analysis as VideoAnalysis) ?? null,
        wordTimestamps: Array.isArray(data.word_timestamps)
          ? (data.word_timestamps as WordTimestamp[])
          : [],
        status: "analyzed",
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
      };

      setProject(restored);
      setStatus("analyzed");
    } catch (err) {
      console.warn("[useVideoProject] loadFromProjectId exception:", err);
    }
  }, []);

  return {
    project,
    status,
    cuts: project?.cuts ?? [],
    edits: project?.edits ?? [],
    acceptCut,
    removeCut,
    adjustCut,
    toggleEdit,
    reset,
    loadFromHistory,
    loadFromProjectId,
  };
}
