"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Link2, FileVideo, AlertCircle, Loader2 } from "lucide-react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_DURATION_SECONDS = 9000; // 2h30
const DURATION_TIMEOUT_MS = 15000; // 15s
const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB

interface UploadTUSPanelProps {
  empresaId: string;
  onUploadComplete: (projectId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      video.src = "";
      reject(new Error("Não conseguimos ler a duração do vídeo — verifique o formato."));
    }, DURATION_TIMEOUT_MS);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = video.duration;
      URL.revokeObjectURL(url);
      video.src = "";
      if (!isFinite(dur) || dur <= 0) {
        reject(new Error("Não conseguimos ler a duração do vídeo — verifique o formato."));
      } else {
        resolve(dur);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.src = "";
      reject(new Error("Não conseguimos ler a duração do vídeo — verifique o formato."));
    };

    video.src = url;
  });
}

export function UploadTUSPanel({ empresaId, onUploadComplete }: UploadTUSPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "validating" | "uploading" | "starting">("idle");
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes/s
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tusUploadRef = useRef<tus.Upload | null>(null);
  const lastProgressRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: Date.now() });

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith("video/")) {
        setError("Apenas arquivos de vídeo são permitidos (MP4, MOV, WebM, etc).");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`O arquivo é muito grande. Limite: 5 GB. Tamanho: ${formatBytes(file.size)}.`);
        return;
      }

      // Validate duration
      setPhase("validating");
      let duration: number;
      try {
        duration = await getVideoDuration(file);
      } catch (err) {
        setPhase("idle");
        setError(err instanceof Error ? err.message : "Erro ao validar o vídeo.");
        return;
      }

      if (duration > MAX_DURATION_SECONDS) {
        setPhase("idle");
        const h = Math.floor(duration / 3600);
        const m = Math.floor((duration % 3600) / 60);
        setError(`O vídeo é muito longo (${h}h${m}m). Limite máximo: 2h30.`);
        return;
      }

      // Get upload URL from server
      let projectId: string;
      let storagePath: string;
      let uploadToken: string;
      try {
        const res = await fetch("/api/video/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empresa_id: empresaId,
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
            title: file.name.replace(/\.[^/.]+$/, ""),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Erro ao obter URL de upload (${res.status}).`);
        }
        const data = await res.json() as {
          project_id: string;
          storage_path: string;
          upload_url: string;
          upload_token: string;
        };
        projectId = data.project_id;
        storagePath = data.storage_path;
        uploadToken = data.upload_token;
      } catch (err) {
        setPhase("idle");
        setError(err instanceof Error ? err.message : "Erro ao iniciar upload.");
        return;
      }

      // Get session token for TUS auth
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? uploadToken;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

      setPhase("uploading");
      setTotalBytes(file.size);
      setUploadedBytes(0);
      setUploadProgress(0);
      setUploadSpeed(0);
      lastProgressRef.current = { bytes: 0, time: Date.now() };

      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: TUS_CHUNK_SIZE,
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: "videos",
          objectName: storagePath,
          contentType: file.type,
        },
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(pct);
          setUploadedBytes(bytesUploaded);
          setTotalBytes(bytesTotal);

          const now = Date.now();
          const elapsed = (now - lastProgressRef.current.time) / 1000;
          if (elapsed > 0.5) {
            const speed = (bytesUploaded - lastProgressRef.current.bytes) / elapsed;
            setUploadSpeed(speed);
            lastProgressRef.current = { bytes: bytesUploaded, time: now };
          }
        },
        onSuccess: async () => {
          setPhase("starting");
          try {
            const startRes = await fetch("/api/video/start-job", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId }),
            });
            if (!startRes.ok) {
              const body = await startRes.json().catch(() => ({})) as { error?: string };
              throw new Error(body.error ?? `Erro ao iniciar processamento (${startRes.status}).`);
            }
          } catch (err) {
            // Job start failed but upload succeeded — still proceed
            console.warn("[UploadTUSPanel] start-job failed:", err);
          }
          onUploadComplete(projectId);
        },
        onError: (err: Error) => {
          setPhase("idle");
          setError(`Erro durante o upload: ${err.message}`);
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onShouldRetry: (_err: Error, _retryAttempt: number, _options: tus.UploadOptions) => {
          return true;
        },
      });

      tusUploadRef.current = upload;
      upload.start();
    },
    [empresaId, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const isActive = phase !== "idle";

  return (
    <div className="space-y-4">
      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isActive) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !isActive && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          isActive
            ? "border-secondary/40 bg-secondary/5 cursor-default"
            : dragActive
            ? "border-accent bg-accent/5 scale-[1.02] cursor-pointer"
            : "border-border hover:border-secondary/40 hover:bg-bg-card/30 cursor-pointer"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // Reset input so same file can be re-selected after an error
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div
                className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-colors ${
                  dragActive ? "bg-accent/20" : "bg-bg-card border border-border"
                }`}
              >
                <Upload className={`w-7 h-7 ${dragActive ? "text-accent" : "text-text-muted"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  Arraste e solte seu vídeo aqui
                </p>
                <p className="text-xs text-text-muted">ou clique para selecionar</p>
              </div>
              <div className="flex items-center justify-center gap-3 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <FileVideo className="w-3 h-3" />
                  MP4, MOV, WebM
                </span>
                <span className="w-1 h-1 rounded-full bg-text-muted/40" />
                <span>Até 5 GB</span>
                <span className="w-1 h-1 rounded-full bg-text-muted/40" />
                <span>Máx. 2h30</span>
              </div>
            </motion.div>
          )}

          {phase === "validating" && (
            <motion.div
              key="validating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <Loader2 className="w-10 h-10 mx-auto text-secondary-light animate-spin" />
              <p className="text-sm text-text-secondary">Verificando vídeo...</p>
            </motion.div>
          )}

          {phase === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 text-secondary-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary text-left">
                    Enviando vídeo...
                  </p>
                  <p className="text-[11px] text-text-muted text-left tabular-nums">
                    {formatBytes(uploadedBytes)} de {formatBytes(totalBytes)}
                    {uploadSpeed > 0 && ` · ${formatSpeed(uploadSpeed)}`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-secondary-light tabular-nums shrink-0">
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-2 bg-bg-card rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-secondary to-accent rounded-full"
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}

          {phase === "starting" && (
            <motion.div
              key="starting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <Loader2 className="w-10 h-10 mx-auto text-accent animate-spin" />
              <p className="text-sm text-text-secondary">Iniciando processamento...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20"
          >
            <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger leading-snug">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OR divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted font-medium">OU</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* URL input — disabled in MVP */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-bg-input border border-border rounded-xl px-4 py-3 opacity-50 cursor-not-allowed">
          <Link2 className="w-4 h-4 text-text-muted shrink-0" />
          <input
            type="url"
            disabled
            placeholder="Import por URL em breve (YouTube, Instagram, TikTok...)"
            className="flex-1 bg-transparent text-sm text-text-muted placeholder:text-text-muted outline-none cursor-not-allowed"
          />
        </div>
        <button
          type="button"
          disabled
          className="px-6 py-3 rounded-xl bg-secondary text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Importar
        </button>
      </div>
      <p className="text-[11px] text-text-muted text-center">
        Import por URL disponível em breve
      </p>
    </div>
  );
}
