"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Scissors,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  MessageSquare,
  FileText,
  Palette,
  Film,
  Trash2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useVideoProject } from "@/hooks/useVideoProject";
import { useVideoJob } from "@/hooks/useVideoJob";
import { useVideoHistory } from "@/hooks/useVideoHistory";
import { UploadTUSPanel } from "@/components/video/UploadTUSPanel";
import { JobStatusPanel } from "@/components/video/JobStatusPanel";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { ChatPanel } from "@/components/video/ChatPanel";
import { CutsPanel } from "@/components/video/CutsPanel";
import { SubtitleStylePanel } from "@/components/video/SubtitleStylePanel";
import { TranscriptionPanel } from "@/components/video/TranscriptionPanel";
import type { VideoCut, SubtitleStyle } from "@/types/video";
import type { VideoCutV2 } from "@/types/video-pipeline";
import { DEFAULT_SUBTITLE_STYLE } from "@/types/video";
import type { CaptionStyle, Keyword, WordTimestamp } from '@/types/captions';
import { captionStyleToLegacySubtitleStyle } from '@/types/captions';
import { CaptionStyleGallery } from '@/components/video/CaptionStyleGallery';
import { KeywordEditor } from '@/components/video/KeywordEditor';
import { createClient } from '@/lib/supabase/client';
import { renderCutInBrowser, downloadBlobAsFile, getBrowserRenderCapabilities } from '@/lib/captions/browser-render';
import { RenderProgressModal } from '@/components/video/RenderProgressModal';

type RightPanelTab = "chat" | "transcricao" | "estilo";

/**
 * Which main view to show:
 *  1 = upload
 *  2 = processing (job in flight)
 *  3 = editor (job ready)
 */
type AppStep = 1 | 2 | 3;

export default function CortesPage() {
  const { empresa } = useEmpresa();
  const {
    project,
    cuts,
    edits,
    acceptCut,
    removeCut,
    adjustCut,
    toggleEdit,
    reset,
    loadFromHistory,
    loadFromProjectId,
  } = useVideoProject();

  const job = useVideoJob();

  const {
    projects: historyProjects,
    loading: historyLoading,
    refetch: refetchHistory,
    deleteProject: deleteHistoryProject,
  } = useVideoHistory(empresa?.id);

  /* ── Supabase client (shared for cuts polling + keyword persistence) ── */
  const supabaseClient = useMemo(() => createClient(), []);

  const [step, setStep] = useState<AppStep>(1);
  const [activeCut, setActiveCut] = useState<VideoCut | null>(null);
  const [showExportToast, setShowExportToast] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>("chat");
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [captionStyles, setCaptionStyles] = useState<CaptionStyle[]>([]);
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<CaptionStyle | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Render state ── */
  const [renderState, setRenderState] = useState<{
    open: boolean;
    progress: number;
    message: string;
    status: 'rendering' | 'success' | 'error' | 'cancelled';
    error?: string;
    blob?: Blob;
    mimeType?: string;
    cutIndex?: number;
  }>({ open: false, progress: 0, message: '', status: 'rendering' });
  const renderAbortRef = useRef<AbortController | null>(null);
  const [renderingIndex, setRenderingIndex] = useState<number | null>(null);

  /* ── Re-render state ── */
  const [reRenderLoading, setReRenderLoading] = useState(false);
  const [reRenderMessage, setReRenderMessage] = useState<string | null>(null);

  /* ── Cuts from DB (V2 pipeline with rendered_url) ── */
  const [cutsV2, setCutsV2] = useState<VideoCutV2[] | null>(null);
  const cutsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subtitlesEnabled = edits.find((e) => e.type === "subtitle")?.enabled ?? true;

  // Track the projectId being processed so the ready-effect can use it
  const [trackingProjectId, setTrackingProjectId] = useState<string | null>(null);

  /* ── Upload complete: start job tracking & move to step 2 ── */
  const handleUploadCompleteStable = useCallback(
    (projectId: string) => {
      setTrackingProjectId(projectId);
      job.startTracking(projectId);
      setStep(2);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job.startTracking]
  );

  /* ── When job becomes ready → fetch full project + move to editor ── */
  useEffect(() => {
    if (job.isReady && trackingProjectId && step === 2) {
      void loadFromProjectId(trackingProjectId).then(() => {
        setStep(3);
      });
    }
  }, [job.isReady, trackingProjectId, step, loadFromProjectId]);

  /* ── Poll cuts from DB while job is rendering (to show per-cut progress) ── */
  const fetchCutsV2 = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from("video_projects")
        .select("cuts")
        .eq("id", projectId)
        .single();
      if (!error && data && Array.isArray(data.cuts) && (data.cuts as unknown[]).length > 0) {
        setCutsV2(data.cuts as VideoCutV2[]);
      }
    } catch {
      /* silent fail — polling will retry */
    }
  }, [supabaseClient]);

  useEffect(() => {
    const pid = trackingProjectId ?? project?.id ?? null;
    if (!pid) return;

    if (job.status === "rendering") {
      // Start polling cuts every 5s
      if (!cutsPollingRef.current) {
        void fetchCutsV2(pid);
        cutsPollingRef.current = setInterval(() => {
          void fetchCutsV2(pid);
        }, 5000);
      }
    } else {
      // Stop polling when not rendering
      if (cutsPollingRef.current) {
        clearInterval(cutsPollingRef.current);
        cutsPollingRef.current = null;
      }
    }

    return () => {
      if (cutsPollingRef.current) {
        clearInterval(cutsPollingRef.current);
        cutsPollingRef.current = null;
      }
    };
  }, [job.status, trackingProjectId, project?.id, fetchCutsV2]);

  /* ── When project loads in step 3, fetch V2 cuts if available ── */
  useEffect(() => {
    if (step === 3 && project?.id) {
      void fetchCutsV2(project.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, project?.id]);

  /* ── Load caption styles from API ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/video/styles');
        if (!res.ok) return;
        const json = await res.json() as { styles: CaptionStyle[] };
        if (!cancelled && Array.isArray(json.styles)) {
          setCaptionStyles(json.styles);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Subtitle style update ── */
  const handleSubtitleStyleUpdate = useCallback(
    (partial: Partial<SubtitleStyle>) => {
      setSubtitleStyle((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  /* ── Transcription segment edit ── */
  const handleUpdateSegment = useCallback(
    (index: number, text: string) => {
      if (project && project.transcription[index]) {
        project.transcription[index] = {
          ...project.transcription[index],
          text,
        };
      }
    },
    [project]
  );

  /* ── Select caption style from gallery ── */
  const handleSelectCaptionStyle = useCallback((cs: CaptionStyle) => {
    setSelectedCaptionStyle(cs);
    setSubtitleStyle(captionStyleToLegacySubtitleStyle(cs));
  }, []);

  /* ── Regenerate keywords ── */
  const handleRegenerateKeywords = useCallback(async () => {
    if (!project?.transcription) return;
    setKeywordsLoading(true);
    try {
      const transcriptionText = Array.isArray(project.transcription)
        ? project.transcription.map((s: { text: string }) => s.text).join(' ')
        : (typeof project.transcription === 'string' ? project.transcription : '');
      const res = await fetch('/api/video/keywords/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription_text: transcriptionText,
          language: 'pt-BR',
        }),
      });
      if (res.ok) {
        const json = await res.json() as { keywords?: unknown };
        if (Array.isArray(json.keywords)) setKeywords(json.keywords as Keyword[]);
      }
    } catch {
      /* silent fail */
    } finally {
      setKeywordsLoading(false);
    }
  }, [project?.transcription]);

  /* ── Load persisted keywords when project loads ── */
  useEffect(() => {
    if (project?.keywords && Array.isArray(project.keywords)) {
      setKeywords(project.keywords);
    } else {
      setKeywords([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  /* ── Persist keywords to Supabase ── */
  const lastPersistedProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (!project?.id) return;
    if (lastPersistedProjectId.current !== project.id) {
      lastPersistedProjectId.current = project.id;
      return;
    }
    supabaseClient
      .from('video_projects')
      .update({ keywords })
      .eq('id', project.id)
      .then(() => {}, () => {});
  }, [keywords, project?.id, supabaseClient]);

  /* ── Export toast ── */
  const showExportMessage = () => {
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

  /* ── Reset: go back to upload ── */
  const handleReset = useCallback(() => {
    job.stopTracking();
    reset();
    setStep(1);
    setTrackingProjectId(null);
    setCutsV2(null);
    setReRenderMessage(null);
    if (cutsPollingRef.current) {
      clearInterval(cutsPollingRef.current);
      cutsPollingRef.current = null;
    }
    refetchHistory();
  }, [job, reset, refetchHistory]);

  /* ── Load from history ── */
  const handleLoadFromHistory = useCallback(
    (item: Parameters<typeof loadFromHistory>[0]) => {
      loadFromHistory(item);
      setStep(3);
    },
    [loadFromHistory]
  );

  /* ── Render cut in browser ── */
  const handleRenderCut = useCallback(async (index: number) => {
    const cut = cuts[index];
    if (!cut) return;

    if (!selectedCaptionStyle) {
      setShowExportToast(true);
      setTimeout(() => setShowExportToast(false), 3000);
      return;
    }

    const caps = getBrowserRenderCapabilities();
    if (!caps.supported) {
      setRenderState({
        open: true,
        progress: 0,
        message: '',
        status: 'error',
        error: `Seu navegador não suporta render: ${caps.reason ?? 'não suportado'}. Use Chrome ou Edge atualizado.`,
      });
      return;
    }

    const videoUrl = project?.videoUrl;
    if (!videoUrl) {
      setRenderState({ open: true, progress: 0, message: '', status: 'error', error: 'Vídeo não disponível.' });
      return;
    }

    const words: WordTimestamp[] = project?.wordTimestamps ?? [];
    if (words.length === 0) {
      setRenderState({ open: true, progress: 0, message: '', status: 'error', error: 'Sem word-timestamps. Re-processe o vídeo.' });
      return;
    }

    setRenderingIndex(index);
    const abortCtl = new AbortController();
    renderAbortRef.current = abortCtl;
    setRenderState({ open: true, progress: 0, message: 'Iniciando...', status: 'rendering', cutIndex: index });

    try {
      const result = await renderCutInBrowser({
        videoUrl,
        cutStart: cut.startTime,
        cutEnd: cut.endTime,
        style: selectedCaptionStyle,
        words,
        keywords,
        onProgress: (pct: number, msg: string) => {
          setRenderState(prev => ({ ...prev, progress: pct, message: msg }));
        },
        signal: abortCtl.signal,
      });

      setRenderState({
        open: true,
        progress: 100,
        message: 'Pronto!',
        status: 'success',
        blob: result.blob,
        mimeType: result.mimeType,
        cutIndex: index,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setRenderState({
        open: true,
        progress: 0,
        message: '',
        status: msg === 'Cancelado' ? 'cancelled' : 'error',
        error: msg !== 'Cancelado' ? msg : undefined,
        cutIndex: index,
      });
    } finally {
      setRenderingIndex(null);
      renderAbortRef.current = null;
    }
  }, [cuts, selectedCaptionStyle, project, keywords]);

  const handleRenderCancel = useCallback(() => {
    renderAbortRef.current?.abort();
  }, []);

  const handleRenderDownload = useCallback(() => {
    if (!renderState.blob || !renderState.mimeType) return;
    const ext = renderState.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `corte-${selectedCaptionStyle?.slug ?? 'legenda'}-${ts}.${ext}`;
    downloadBlobAsFile(renderState.blob, filename);
  }, [renderState.blob, renderState.mimeType, selectedCaptionStyle?.slug]);

  const handleRenderClose = useCallback(() => {
    setRenderState(prev => ({ ...prev, open: false }));
  }, []);

  /* ── Re-render all clips with new caption style ── */
  const handleReRenderAll = useCallback(async () => {
    if (!project?.id || !selectedCaptionStyle) return;
    setReRenderLoading(true);
    setReRenderMessage(null);
    try {
      const res = await fetch("/api/video/rerender-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          caption_style_id: selectedCaptionStyle.id,
        }),
      });
      const json = await res.json() as { message?: string };
      setReRenderMessage(json.message ?? "Solicitação enviada.");
    } catch {
      setReRenderMessage("Erro ao solicitar re-renderização. Tente novamente.");
    } finally {
      setReRenderLoading(false);
    }
  }, [project?.id, selectedCaptionStyle]);

  /* ── No empresa selected ── */
  if (!empresa) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-secondary text-sm">
            Selecione uma empresa para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen p-4 md:p-6 lg:p-8">
      <AnimatePresence mode="wait">
        {/* ════════════════════════════════════════════════ */}
        {/* STEP 1 — Upload                                  */}
        {/* ════════════════════════════════════════════════ */}
        {step === 1 && (
          <motion.div
            key="step-upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            {/* ── History section ── */}
            {(historyLoading || historyProjects.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="flex items-center gap-1.5 text-xs text-text-muted font-medium uppercase tracking-wide">
                    <Clock className="w-3.5 h-3.5" />
                    Projetos Anteriores
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {historyLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-xl bg-bg-card border border-border"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyProjects.map((item) => {
                      const cutCount = Array.isArray(item.cut_suggestions)
                        ? item.cut_suggestions.length
                        : 0;
                      const dateStr = new Date(item.created_at).toLocaleDateString(
                        "pt-BR",
                        { day: "2-digit", month: "2-digit" }
                      );
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 py-3 group hover:border-secondary/40 transition-all cursor-pointer"
                          onClick={() => handleLoadFromHistory(item)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
                            <Film className="w-4 h-4 text-secondary-light" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-text-muted">
                              {cutCount} {cutCount === 1 ? "corte" : "cortes"} sugeridos
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] text-text-muted tabular-nums">
                              {dateStr}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteHistoryProject(item.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                              title="Remover do histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-muted font-medium uppercase tracking-wide">
                    Novo Vídeo
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </div>
            )}

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-4">
                <Scissors className="w-5 h-5 text-secondary-light" />
                <span className="text-sm font-medium text-secondary-light">
                  Novo Projeto
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                Cortes & Edição de Vídeo
              </h1>
              <p className="text-text-secondary text-sm md:text-base max-w-md mx-auto">
                Envie um vídeo e deixe a IA ajudar a criar cortes virais e editar
              </p>
            </div>

            {/* TUS Upload panel */}
            <UploadTUSPanel
              empresaId={empresa.id}
              onUploadComplete={handleUploadCompleteStable}
            />
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* STEP 2 — Processing                              */}
        {/* ════════════════════════════════════════════════ */}
        {step === 2 && (
          <motion.div
            key="step-processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="max-w-lg mx-auto pt-16"
          >
            <JobStatusPanel job={job} />
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* STEP 3 — Editor                                  */}
        {/* ════════════════════════════════════════════════ */}
        {step === 3 && project && (
          <motion.div
            key="step-editor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Top bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Novo vídeo
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-text-primary truncate">
                  {project.title}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Analisado
              </div>
            </div>

            {/* Split layout: Video + Right Panel */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left: Video Player (60%) */}
              <div className="w-full lg:w-[60%] space-y-3">
                <VideoPlayer
                  src={project.videoUrl}
                  subtitles={project.transcription}
                  showSubtitles={subtitlesEnabled}
                  subtitleStyle={subtitleStyle}
                  logo={empresa?.logo_url ?? undefined}
                  logoPosition="bottom-right"
                  cuts={cuts}
                  activeCut={activeCut}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                  selectedCaptionStyle={selectedCaptionStyle}
                  wordTimestamps={project.wordTimestamps ?? []}
                  captionKeywords={keywords}
                />

                {/* Video Analysis Summary */}
                {project.analysis && (
                  <div className="bg-bg-secondary border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent" />
                        <span className="text-sm font-semibold text-text-primary">Análise do Vídeo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary-light text-[11px] font-medium">
                          {project.analysis.type}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-medium">
                          🔥 {project.analysis.viral_potential.score}/10
                        </span>
                      </div>
                    </div>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      {project.analysis.summary}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.analysis.strengths.map((s, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-success/10 text-success text-[11px]">
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {project.analysis.viral_potential.reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Tabbed Panel (40%) */}
              <div className="w-full lg:w-[40%] h-[500px] lg:h-auto lg:min-h-[500px] flex flex-col">
                {/* Tab bar */}
                <div className="flex bg-bg-secondary rounded-t-xl border border-b-0 border-border overflow-hidden">
                  {(
                    [
                      { key: "chat", label: "Chat", icon: MessageSquare },
                      { key: "transcricao", label: "Transcrição", icon: FileText },
                      { key: "estilo", label: "Estilo", icon: Palette },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition-all border-b-2 ${
                        activeTab === tab.key
                          ? "border-accent text-accent bg-accent/5"
                          : "border-transparent text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0">
                  {activeTab === "chat" && (
                    <ChatPanel
                      videoSummary={project.aiSummary}
                      transcription={project.transcription}
                      cuts={cuts}
                      subtitleStyle={subtitleStyle}
                      onAcceptCut={(cut) => acceptCut(cut)}
                      onAdjustCut={(index, changes) => adjustCut(index, changes)}
                      onToggleSubtitles={(enabled) =>
                        toggleEdit("subtitle", enabled)
                      }
                      onUpdateSubtitleStyle={handleSubtitleStyleUpdate}
                      subtitlesEnabled={subtitlesEnabled}
                    />
                  )}
                  {activeTab === "transcricao" && (
                    <TranscriptionPanel
                      segments={project.transcription}
                      currentTime={currentTime}
                      onSeek={(time) => {
                        setActiveCut({
                          id: "seek-temp",
                          title: "seek",
                          startTime: time,
                          endTime: time + 9999,
                          description: "",
                          accepted: false,
                        });
                        setTimeout(() => setActiveCut(null), 100);
                      }}
                      onUpdateSegment={handleUpdateSegment}
                    />
                  )}
                  {activeTab === "estilo" && (
                    <div className="space-y-6 flex-1 overflow-y-auto p-3">
                      <section>
                        <h3 className="text-white font-semibold text-base mb-1">Galeria de estilos virais</h3>
                        <p className="text-xs text-zinc-500 mb-3">
                          Clique num estilo para aplicar. Você pode ajustar detalhes abaixo.
                        </p>
                        <CaptionStyleGallery
                          styles={captionStyles}
                          selectedId={selectedCaptionStyle?.id ?? null}
                          onSelect={handleSelectCaptionStyle}
                          previewKeywords={keywords}
                        />
                      </section>

                      {/* Re-render button */}
                      {selectedCaptionStyle && project && (
                        <section className="border border-border rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-secondary-light" />
                            <span className="text-sm font-medium text-text-primary">Aplicar estilo</span>
                          </div>
                          <p className="text-[11px] text-text-muted">
                            Estilo selecionado: <strong className="text-text-secondary">{selectedCaptionStyle.name}</strong>
                          </p>
                          {reRenderMessage && (
                            <p className="text-[11px] text-accent bg-accent/10 rounded-lg px-2 py-1.5">
                              {reRenderMessage}
                            </p>
                          )}
                          <button
                            onClick={() => void handleReRenderAll()}
                            disabled={reRenderLoading}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary/15 text-secondary-light text-[12px] font-medium hover:bg-secondary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {reRenderLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Aplicar e re-renderizar todos
                          </button>
                        </section>
                      )}

                      <section>
                        <KeywordEditor
                          keywords={keywords}
                          loading={keywordsLoading}
                          onChange={setKeywords}
                          onRegenerate={handleRegenerateKeywords}
                        />
                      </section>

                      <SubtitleStylePanel
                        style={subtitleStyle}
                        onChange={setSubtitleStyle}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cuts panel — use V2 cuts (with rendered_url) if available, else legacy */}
            {(cutsV2 && cutsV2.length > 0 ? cutsV2 : cuts).length > 0 && (
              <CutsPanel
                cuts={cutsV2 && cutsV2.length > 0 ? cutsV2 : cuts}
                onPreview={(cut) => {
                  // Normalise to VideoCut shape for the player (uses startTime/endTime)
                  if ("start_time" in cut) {
                    setActiveCut({
                      id: cut.id,
                      title: cut.title,
                      startTime: cut.start_time,
                      endTime: cut.end_time,
                      description: cut.reason ?? "",
                      accepted: false,
                    });
                  } else {
                    setActiveCut(cut as VideoCut);
                  }
                }}
                onEdit={(index) => {
                  const c = cutsV2 && cutsV2.length > 0 ? cutsV2[index] : cuts[index];
                  if (!c) return;
                  if ("start_time" in c) {
                    setActiveCut({
                      id: c.id,
                      title: c.title,
                      startTime: c.start_time,
                      endTime: c.end_time,
                      description: c.reason ?? "",
                      accepted: false,
                    });
                  } else {
                    setActiveCut(c as VideoCut);
                  }
                }}
                onRender={handleRenderCut}
                onExportAll={showExportMessage}
                renderingIndex={renderingIndex}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render progress modal */}
      <RenderProgressModal
        open={renderState.open}
        progress={renderState.progress}
        message={renderState.message}
        status={renderState.status}
        error={renderState.error}
        onCancel={handleRenderCancel}
        onClose={handleRenderClose}
        onDownload={renderState.blob ? handleRenderDownload : undefined}
      />

      {/* Export toast */}
      <AnimatePresence>
        {showExportToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-bg-card border border-border rounded-xl px-5 py-3 shadow-xl flex items-center gap-3"
          >
            <Sparkles className="w-4 h-4 text-secondary-light" />
            <span className="text-sm text-text-primary">
              {selectedCaptionStyle
                ? "Exportação em breve! Estamos finalizando essa funcionalidade."
                : "Selecione um estilo de legenda antes de renderizar."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
