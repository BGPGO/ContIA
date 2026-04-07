"use client";

import { useState, useCallback } from "react";
import type {
  VideoProject,
  VideoProjectStatus,
  VideoCut,
  VideoEdit,
  TranscriptionSegment,
} from "@/types/video";

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

// Mock transcription for demo
function generateMockTranscription(duration: number): TranscriptionSegment[] {
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

function generateMockCuts(
  transcription: TranscriptionSegment[]
): VideoCut[] {
  if (transcription.length < 4) return [];
  return [
    {
      id: generateId(),
      title: "Hook Inicial",
      startTime: transcription[0].start,
      endTime: transcription[1].end,
      description: "Abertura com gancho para prender a audiência",
      accepted: false,
    },
    {
      id: generateId(),
      title: "Dica Principal",
      startTime: transcription[3].start,
      endTime: transcription[5]?.end ?? transcription[3].end + 15,
      description: "O ponto mais viral do vídeo com dica prática",
      accepted: false,
    },
    {
      id: generateId(),
      title: "CTA Final",
      startTime: transcription[transcription.length - 2]?.start ?? 0,
      endTime: transcription[transcription.length - 1].end,
      description: "Chamada para ação no final do vídeo",
      accepted: false,
    },
  ];
}

export function useVideoProject() {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [status, setStatus] = useState<VideoProjectStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);

  const upload = useCallback(
    async (file: File, empresaId: string) => {
      setStatus("uploading");
      setProgress(0);

      // Simulate upload progress
      const videoUrl = URL.createObjectURL(file);

      for (let i = 0; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 150));
        setProgress(i);
      }

      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = videoUrl;

      const duration = await new Promise<number>((resolve) => {
        video.onloadedmetadata = () => resolve(video.duration);
        // Fallback for cases where metadata doesn't load
        setTimeout(() => resolve(120), 2000);
      });

      const newProject: VideoProject = {
        id: generateId(),
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
      setStatus("uploading");
      setProgress(100);

      return newProject;
    },
    []
  );

  const uploadFromUrl = useCallback(
    async (url: string, empresaId: string) => {
      setStatus("uploading");
      setProgress(0);

      for (let i = 0; i <= 100; i += 20) {
        await new Promise((r) => setTimeout(r, 200));
        setProgress(i);
      }

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

      return newProject;
    },
    []
  );

  const process = useCallback(async () => {
    if (!project) return;

    setStatus("processing");
    setProcessingStep(0);
    setProgress(0);

    // Step 1: Upload to storage
    await new Promise((r) => setTimeout(r, 1500));
    setProcessingStep(1);
    setProgress(33);

    // Step 2: Transcription
    await new Promise((r) => setTimeout(r, 2000));
    const transcription = generateMockTranscription(project.duration);
    setProcessingStep(2);
    setProgress(66);

    // Step 3: AI analysis
    await new Promise((r) => setTimeout(r, 2000));
    const cuts = generateMockCuts(transcription);
    setProcessingStep(3);
    setProgress(100);

    const updated: VideoProject = {
      ...project,
      transcription,
      aiSummary:
        "Vídeo de conteúdo educacional com 3 pontos principais sobre estratégias de crescimento em redes sociais. Tom conversacional e direto, ideal para Reels e TikTok. Duração total permite 2-3 cortes virais.",
      cuts,
      edits: [
        { type: "subtitle", enabled: true, config: {} },
        { type: "logo", enabled: false, config: { position: "bottom-right" } },
      ],
      status: "analyzed",
      updatedAt: new Date().toISOString(),
    };

    setProject(updated);
    setStatus("analyzed");
  }, [project]);

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
  }, [project]);

  return {
    project,
    status,
    progress,
    processingStep,
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
