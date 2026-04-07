"use client";

import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useVideoProject } from "@/hooks/useVideoProject";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { ChatPanel } from "@/components/video/ChatPanel";
import { CutsPanel } from "@/components/video/CutsPanel";
import type { VideoCut } from "@/types/video";

/* ── Processing step labels ── */
const processingSteps = [
  "Enviando video...",
  "Transcrevendo audio...",
  "Analisando conteudo com IA...",
];

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
  } = useVideoProject();

  const [urlInput, setUrlInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [activeCut, setActiveCut] = useState<VideoCut | null>(null);
  const [showExportToast, setShowExportToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /* ── Auto-advance from upload to processing ── */
  const hasTriggeredProcess = useRef(false);
  if (status === "uploading" && progress >= 100 && !hasTriggeredProcess.current) {
    hasTriggeredProcess.current = true;
    setTimeout(() => {
      process();
    }, 500);
  }
  if (status === "idle") {
    hasTriggeredProcess.current = false;
  }

  /* ── Export toast ── */
  const showExportMessage = () => {
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

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
                onClick={reset}
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

            {/* Split layout: Video + Chat */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left: Video Player (60%) */}
              <div className="w-full lg:w-[60%] space-y-3">
                <VideoPlayer
                  src={project.videoUrl}
                  subtitles={project.transcription}
                  showSubtitles={subtitlesEnabled}
                  logo={empresa?.logo_url ?? undefined}
                  logoPosition="bottom-right"
                  cuts={cuts}
                  activeCut={activeCut}
                  onTimeUpdate={() => {
                    // Could track position for subtitle sync
                  }}
                />
              </div>

              {/* Right: Chat Panel (40%) */}
              <div className="w-full lg:w-[40%] h-[500px] lg:h-auto lg:min-h-[500px]">
                <ChatPanel
                  videoSummary={project.aiSummary}
                  cuts={cuts}
                  onAcceptCut={(cut) => acceptCut(cut)}
                  onAdjustCut={(index, changes) => adjustCut(index, changes)}
                  onToggleSubtitles={(enabled) =>
                    toggleEdit("subtitle", enabled)
                  }
                  subtitlesEnabled={subtitlesEnabled}
                />
              </div>
            </div>

            {/* Cuts panel */}
            <CutsPanel
              cuts={cuts}
              onPreview={(cut) => setActiveCut(cut)}
              onEdit={(index) => {
                // Focus on the cut in the chat
                setActiveCut(cuts[index]);
              }}
              onExport={() => showExportMessage()}
              onExportAll={showExportMessage}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
