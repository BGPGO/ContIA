"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Scissors,
  Upload,
  Link2,
  CheckCircle2,
  Loader2,
  FileVideo,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  MessageSquare,
  FileText,
  Palette,
  Film,
  Trash2,
  Clock,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useVideoProject } from "@/hooks/useVideoProject";
import { useVideoHistory } from "@/hooks/useVideoHistory";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { ChatPanel } from "@/components/video/ChatPanel";
import { CutsPanel } from "@/components/video/CutsPanel";
import { SubtitleStylePanel } from "@/components/video/SubtitleStylePanel";
import { TranscriptionPanel } from "@/components/video/TranscriptionPanel";
import type { VideoCut, SubtitleStyle } from "@/types/video";
import { DEFAULT_SUBTITLE_STYLE } from "@/types/video";
import type { CaptionStyle, Keyword, WordTimestamp } from '@/types/captions';
import { captionStyleToLegacySubtitleStyle } from '@/types/captions';
import { CaptionStyleGallery } from '@/components/video/CaptionStyleGallery';
import { KeywordEditor } from '@/components/video/KeywordEditor';
import { createClient } from '@/lib/supabase/client';
import { renderCutInBrowser, downloadBlobAsFile, getBrowserRenderCapabilities } from '@/lib/captions/browser-render';
import { RenderProgressModal } from '@/components/video/RenderProgressModal';

/* ── Processing step labels ── */
const processingSteps = [
  "Enviando video...",
  "Transcrevendo audio...",
  "Analisando conteudo com IA...",
];

type RightPanelTab = "chat" | "transcricao" | "estilo";

export default function CortesPage() {
  const { empresa } = useEmpresa();
  const {
    project,
    status,
    progress,
    processingStep,
    cuts,
    edits,
    upload,
    uploadFromUrl,
    process,
    acceptCut,
    removeCut,
    adjustCut,
    toggleEdit,
    reset,
    loadFromHistory,
  } = useVideoProject();

  const {
    projects: historyProjects,
    loading: historyLoading,
    refetch: refetchHistory,
    deleteProject: deleteHistoryProject,
  } = useVideoHistory(empresa?.id);

  const [urlInput, setUrlInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [activeCut, setActiveCut] = useState<VideoCut | null>(null);
  const [showExportToast, setShowExportToast] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>("chat");
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [captionStyles, setCaptionStyles] = useState<CaptionStyle[]>([]);
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<CaptionStyle | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoSeekRef = useRef<((time: number) => void) | null>(null);
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

  const subtitlesEnabled = edits.find((e) => e.type === "subtitle")?.enabled ?? true;

  /* ── Step: determine which view to show ── */
  const step =
    status === "idle"
      ? 1
      : status === "uploading" || status === "processing"
      ? 2
      : 3;

  /* ── File upload handler ── */
  const handleFile = useCallback(
    async (file: File) => {
      if (!empresa) return;
      if (!file.type.startsWith("video/")) return;
      await upload(file, empresa.id);
    },
    [empresa, upload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleUrlSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!empresa || !urlInput.trim()) return;
      await uploadFromUrl(urlInput.trim(), empresa.id);
    },
    [empresa, urlInput, uploadFromUrl]
  );

  /* ── Subtitle style update (from AI or panel) ── */
  const handleSubtitleStyleUpdate = useCallback(
    (partial: Partial<SubtitleStyle>) => {
      setSubtitleStyle((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  /* ── Transcription segment edit ── */
  const handleUpdateSegment = useCallback(
    (index: number, text: string) => {
      // Note: This updates project in local state only.
      // The useVideoProject hook doesn't expose setProject directly,
      // but transcription is used from the project object.
      // For now we update via a workaround — the segments are passed by reference.
      if (project && project.transcription[index]) {
        project.transcription[index] = {
          ...project.transcription[index],
          text,
        };
      }
    },
    [project]
  );

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
        /* ignore — galeria fica vazia silenciosamente */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Select caption style from gallery ── */
  const handleSelectCaptionStyle = useCallback((cs: CaptionStyle) => {
    setSelectedCaptionStyle(cs);
    setSubtitleStyle(captionStyleToLegacySubtitleStyle(cs));
  }, []);

  /* ── Regenerate keywords via GPT-4o-mini ── */
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

  /* ── Persist keywords to Supabase (fire-and-forget) ──
     Persiste também lista vazia (ex: usuário removeu todas as palavras).
     Só pula o primeiro efeito após (re)carregar um projeto para não
     sobrescrever o valor recém-carregado com o state inicial ([]).  */
  const supabaseClient = useMemo(() => createClient(), []);
  const lastPersistedProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (!project?.id) return;
    if (lastPersistedProjectId.current !== project.id) {
      // Primeira execução para este projeto — ignora (é hidratação do load).
      lastPersistedProjectId.current = project.id;
      return;
    }
    supabaseClient
      .from('video_projects')
      .update({ keywords })
      .eq('id', project.id)
      .then(() => {}, () => {});
  }, [keywords, project?.id, supabaseClient]);

  /* ── Export toast (stub para onExportAll) ── */
  const showExportMessage = () => {
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

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
      setRenderState({ open: true, progress: 0, message: '', status: 'error', error: 'Vídeo não disponível. Re-faça o upload.' });
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

  /* ── No empresa selected ── */
  if (!empresa) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-secondary text-sm">
            Selecione uma empresa para comecar
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
                          onClick={() => loadFromHistory(item)}
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
                    Novo Video
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
                Cortes & Edicao de Video
              </h1>
              <p className="text-text-secondary text-sm md:text-base max-w-md mx-auto">
                Envie um video e deixe a IA ajudar a criar cortes virais e editar
              </p>
            </div>

            {/* Drag & drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                dragActive
                  ? "border-accent bg-accent/5 scale-[1.02]"
                  : "border-border hover:border-secondary/40 hover:bg-bg-card/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <div className="space-y-4">
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-colors ${
                    dragActive
                      ? "bg-accent/20"
                      : "bg-bg-card border border-border"
                  }`}
                >
                  <Upload
                    className={`w-7 h-7 ${
                      dragActive ? "text-accent" : "text-text-muted"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary mb-1">
                    Arraste e solte seu video aqui
                  </p>
                  <p className="text-xs text-text-muted">
                    ou clique para selecionar
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <FileVideo className="w-3 h-3" />
                    MP4, MOV, WebM
                  </span>
                  <span className="w-1 h-1 rounded-full bg-text-muted/40" />
                  <span>Ate 500MB</span>
                </div>
              </div>
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted font-medium">OU</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* URL input */}
            <form onSubmit={handleUrlSubmit} className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-bg-input border border-border rounded-xl px-4 py-3 focus-within:border-accent/40 transition-colors">
                  <Link2 className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Cole uma URL (YouTube, Instagram, TikTok...)"
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="px-6 py-3 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Importar
                </button>
              </div>
              <p className="text-[11px] text-text-muted text-center">
                YouTube, Instagram, TikTok e mais
              </p>
            </form>
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
            className="max-w-lg mx-auto space-y-8 pt-16"
          >
            <div className="text-center space-y-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center border border-secondary/20"
              >
                <Sparkles className="w-7 h-7 text-secondary-light" />
              </motion.div>
              <h2 className="text-xl font-bold text-text-primary">
                Processando video...
              </h2>
              <p className="text-sm text-text-secondary">
                {project?.originalFileName}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-2 bg-bg-card rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-secondary to-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-xs text-text-muted text-right">{progress}%</p>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {processingSteps.map((label, i) => {
                const done = processingStep > i;
                const active = processingStep === i;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.3 }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      done
                        ? "bg-success/5 border-success/20"
                        : active
                        ? "bg-secondary/5 border-secondary/20"
                        : "bg-bg-card/50 border-border"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    ) : active ? (
                      <Loader2 className="w-5 h-5 text-secondary-light shrink-0 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        done
                          ? "text-success"
                          : active
                          ? "text-text-primary font-medium"
                          : "text-text-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
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
                onClick={() => { reset(); refetchHistory(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Novo video
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
                      { key: "transcricao", label: "Transcricao", icon: FileText },
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
                        // The VideoPlayer listens to activeCut for seeking.
                        // We create a temporary "seek cut" to trigger it.
                        setActiveCut({
                          id: "seek-temp",
                          title: "seek",
                          startTime: time,
                          endTime: time + 9999,
                          description: "",
                          accepted: false,
                        });
                        // Clear after a tick so it doesn't lock playback
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

            {/* Cuts panel */}
            <CutsPanel
              cuts={cuts}
              onPreview={(cut) => setActiveCut(cut)}
              onEdit={(index) => {
                setActiveCut(cuts[index]);
              }}
              onRender={handleRenderCut}
              onExportAll={showExportMessage}
              renderingIndex={renderingIndex}
            />
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
              Exportacao em breve! Estamos finalizando essa funcionalidade.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
