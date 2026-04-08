"use client";

import { useState, useCallback, useRef } from "react";
import type {
  VideoProject,
  VideoProjectStatus,
  VideoCut,
  VideoEdit,
  VideoAnalysis,
  TranscriptionSegment,
} from "@/types/video";

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export function useVideoProject() {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [status, setStatus] = useState<VideoProjectStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const videoFileRef = useRef<File | null>(null);

  const upload = useCallback(
    async (file: File, empresaId: string) => {
      setStatus("uploading");
      setProgress(0);
      setError(null);

      // Store file ref for processing
      videoFileRef.current = file;

      // Create local video URL for preview
      const videoUrl = URL.createObjectURL(file);

      // Get video duration
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = videoUrl;

      const duration = await new Promise<number>((resolve) => {
        video.onloadedmetadata = () => resolve(video.duration);
        setTimeout(() => resolve(120), 3000);
      });

      setProgress(50);

      // Try uploading to server API
      let projectId: string | null = null;
      try {
        const formData = new FormData();
        formData.append("video", file);
        formData.append("empresa_id", empresaId);
        formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

        const res = await fetch("/api/video/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          projectId = data.project_id;
        }
      } catch {
        // If upload API fails, continue with local-only mode
        console.warn("Video upload API unavailable, using local mode");
      }

      const newProject: VideoProject = {
        id: projectId || generateId(),
        empresaId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        videoUrl,
        originalFileName: file.name,
        duration,
        transcription: [],
        aiSummary: "",
        cuts: [],
        edits: [],
        status: "uploading",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setProject(newProject);
      setProgress(100);

      // Auto-start processing
      setTimeout(() => processProject(newProject, file), 300);

      return newProject;
    },
    []
  );

  const processProject = useCallback(
    async (proj: VideoProject, file?: File) => {
      if (processingRef.current) return;
      processingRef.current = true;
      videoFileRef.current = file || videoFileRef.current;

      setStatus("processing");
      setProcessingStep(0);
      setProgress(10);

      try {
        // Step 1: Sending to transcription
        setProcessingStep(0);
        setProgress(15);

        let transcription: TranscriptionSegment[] = [];
        let aiSummary = "";

        // Try real Whisper transcription if we have the file
        if (videoFileRef.current) {
          try {
            setProcessingStep(1);
            setProgress(30);

            const formData = new FormData();
            formData.append("video", videoFileRef.current);

            const res = await fetch("/api/video/transcribe", {
              method: "POST",
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              transcription = (data.segments || []).map((s: any, i: number) => ({
                id: s.id || `seg-${i}`,
                start: s.start,
                end: s.end,
                text: s.text,
              }));
              aiSummary = `Transcrição real com ${transcription.length} segmentos. ${data.text?.substring(0, 200)}...`;
              console.log(`[process] Whisper OK: ${transcription.length} segments`);
            } else {
              const err = await res.json().catch(() => ({}));
              console.warn("[process] Whisper failed:", err.error || res.status);
            }
          } catch (err) {
            console.warn("[process] Whisper unavailable:", err);
          }
        }

        setProcessingStep(2);
        setProgress(70);

        // Fallback to mock if transcription failed
        if (transcription.length === 0) {
          console.warn("[process] Using mock transcription");
          transcription = generateLocalTranscription(proj.duration);
          aiSummary = `Video "${proj.title}" com ${Math.round(proj.duration)}s. Transcrição automática não disponível — usando legendas de exemplo.`;
        }

        // Step 3: AI-powered cut analysis
        setProcessingStep(2);
        setProgress(80);

        let cuts: VideoCut[] = [];
        let videoAnalysis: VideoAnalysis | null = null;

        try {
          const analyzeRes = await fetch("/api/video/analyze-cuts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcription: transcription.map(s => ({ start: s.start, end: s.end, text: s.text })),
              duration: proj.duration,
              title: proj.title,
            }),
          });

          if (analyzeRes.ok) {
            videoAnalysis = await analyzeRes.json();
            if (videoAnalysis?.cuts) {
              cuts = videoAnalysis.cuts.map((c: any, i: number) => ({
                id: `cut-${i}`,
                title: c.title,
                startTime: c.startTime,
                endTime: c.endTime,
                description: c.description,
                accepted: false,
              }));
            }
            if (videoAnalysis?.summary) {
              aiSummary = videoAnalysis.summary;
            }
            console.log(`[process] AI analysis OK: ${cuts.length} cuts, type: ${videoAnalysis?.type}`);
          }
        } catch (err) {
          console.warn("[process] AI analysis failed:", err);
        }

        // Fallback cuts if AI analysis failed
        if (cuts.length === 0) {
          cuts = generateSmartCuts(transcription);
        }

        setProcessingStep(3);
        setProgress(100);

        const updated: VideoProject = {
          ...proj,
          transcription,
          aiSummary,
          cuts,
          analysis: videoAnalysis,
          edits: [
            { type: "subtitle", enabled: true, config: {} },
            { type: "logo", enabled: false, config: { position: "bottom-right" } },
          ],
          status: "analyzed",
          updatedAt: new Date().toISOString(),
        };

        setProject(updated);
        setStatus("analyzed");
      } catch (err) {
        console.error("Processing error:", err);
        setError(err instanceof Error ? err.message : "Erro ao processar vídeo");
        setStatus("idle");
      } finally {
        processingRef.current = false;
      }
    },
    []
  );

  const uploadFromUrl = useCallback(
    async (url: string, empresaId: string) => {
      setStatus("uploading");
      setProgress(0);
      setError(null);

      const newProject: VideoProject = {
        id: generateId(),
        empresaId,
        title: "Video importado",
        videoUrl: url,
        originalFileName: url.split("/").pop() || "video",
        duration: 120,
        transcription: [],
        aiSummary: "",
        cuts: [],
        edits: [],
        status: "uploading",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setProject(newProject);
      setProgress(100);

      setTimeout(() => processProject(newProject), 300);

      return newProject;
    },
    []
  );

  // Keep process() for backward compat (page might call it)
  const process = useCallback(async () => {
    if (!project) return;
    await processProject(project);
  }, [project, processProject]);

  const acceptCut = useCallback(
    (cut: VideoCut) => {
      if (!project) return;
      setProject({
        ...project,
        cuts: project.cuts.map((c) =>
          c.id === cut.id ? { ...c, accepted: true } : c
        ),
        updatedAt: new Date().toISOString(),
      });
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
      setProject({
        ...project,
        edits: project.edits.map((e) =>
          e.type === type ? { ...e, enabled } : e
        ),
        updatedAt: new Date().toISOString(),
      });
    },
    [project]
  );

  const reset = useCallback(() => {
    if (project?.videoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(project.videoUrl);
    }
    setProject(null);
    setStatus("idle");
    setProgress(0);
    setProcessingStep(0);
    setError(null);
    processingRef.current = false;
  }, [project]);

  return {
    project,
    status,
    progress,
    processingStep,
    error,
    analysis: project?.analysis ?? null,
    cuts: project?.cuts ?? [],
    edits: project?.edits ?? [],
    upload,
    uploadFromUrl,
    process,
    acceptCut,
    removeCut,
    adjustCut,
    toggleEdit,
    reset,
  };
}

/* ── Local fallback helpers ── */

function generateLocalTranscription(duration: number): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = [];
  const phrases = [
    "Olá, bem-vindos ao nosso conteúdo de hoje.",
    "Vamos falar sobre estratégias que realmente funcionam.",
    "O primeiro ponto importante é entender o seu público.",
    "Quando você conhece quem te assiste, tudo muda.",
    "Vamos para a segunda dica que é super valiosa.",
    "Consistência é a chave de todo crescimento.",
    "Poste todos os dias, mesmo que seja simples.",
    "Agora, o terceiro ponto que vai mudar o jogo.",
    "Engajamento é mais importante que visualizações.",
    "Responda comentários, faça perguntas, crie conexão.",
    "Para finalizar, lembre-se: autenticidade vende.",
    "Se gostou, compartilha com alguém que precisa ouvir isso.",
  ];

  const segDuration = Math.min(duration / phrases.length, 8);
  for (let i = 0; i < phrases.length && i * segDuration < duration; i++) {
    segments.push({
      id: generateId(),
      start: i * segDuration,
      end: Math.min((i + 1) * segDuration, duration),
      text: phrases[i],
    });
  }
  return segments;
}

function generateSmartCuts(transcription: TranscriptionSegment[]): VideoCut[] {
  if (transcription.length < 4) return [];
  return [
    {
      id: generateId(),
      title: "Hook Inicial",
      startTime: transcription[0].start,
      endTime: transcription[Math.min(2, transcription.length - 1)].end,
      description: "Abertura com gancho para prender a audiência",
      accepted: false,
    },
    {
      id: generateId(),
      title: "Momento Principal",
      startTime: transcription[Math.floor(transcription.length * 0.3)].start,
      endTime: transcription[Math.min(Math.floor(transcription.length * 0.5), transcription.length - 1)].end,
      description: "O ponto mais forte do vídeo",
      accepted: false,
    },
    {
      id: generateId(),
      title: "CTA Final",
      startTime: transcription[Math.max(0, transcription.length - 3)].start,
      endTime: transcription[transcription.length - 1].end,
      description: "Chamada para ação no final",
      accepted: false,
    },
  ];
}
