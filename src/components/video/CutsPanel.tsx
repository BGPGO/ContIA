"use client";

import { useCallback } from "react";
import { motion } from "motion/react";
import {
  Play,
  Pencil,
  Download,
  Scissors,
  Clock,
  Film,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { VideoCut } from "@/types/video";
import type { VideoCutV2 } from "@/types/video-pipeline";

/**
 * Union que aceita tanto cortes novos (VideoCutV2) quanto legados (VideoCut).
 * Campos de renderização server-side são opcionais para manter backward-compat.
 */
type CutForPanel = (VideoCutV2 | VideoCut) & {
  rendered_url?: string;
  render_status?: string;
  render_error?: string;
};

interface CutsPanelProps {
  cuts: CutForPanel[];
  onPreview: (cut: CutForPanel) => void;
  onEdit: (index: number) => void;
  /** Chamado apenas para cortes legacy sem rendered_url (browser-render) */
  onRender: (index: number) => void;
  /** @deprecated Use o botão "Baixar todos" embutido no painel */
  onExportAll?: () => void;
  renderingIndex?: number | null;
  progressPercent?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(start: number, end: number): string {
  const diff = end - start;
  if (diff < 60) return `${Math.round(diff)}s`;
  return `${Math.floor(diff / 60)}m${Math.round(diff % 60)}s`;
}

/** Retorna os campos normalizados independente de ser V1 ou V2 */
function normalizeCut(cut: CutForPanel): {
  startTime: number;
  endTime: number;
  hook?: string;
  viralScore?: number;
  category?: string;
  accepted?: boolean;
} {
  if ("start_time" in cut) {
    // VideoCutV2
    return {
      startTime: cut.start_time,
      endTime: cut.end_time,
      hook: cut.hook,
      viralScore: cut.viral_score,
      category: cut.category,
    };
  }
  // VideoCut legacy
  return {
    startTime: cut.startTime,
    endTime: cut.endTime,
    accepted: cut.accepted,
  };
}

const gradients = [
  "from-violet-600/30 to-indigo-600/30",
  "from-cyan-600/30 to-teal-600/30",
  "from-rose-600/30 to-pink-600/30",
  "from-amber-600/30 to-orange-600/30",
  "from-emerald-600/30 to-green-600/30",
];

function viralScoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-success/20 text-success";
  if (score >= 50) return "bg-amber-500/20 text-amber-400";
  return "bg-text-muted/20 text-text-muted";
}

export function CutsPanel({
  cuts,
  onPreview,
  onEdit,
  onRender,
  onExportAll,
  renderingIndex,
  progressPercent,
}: CutsPanelProps) {
  if (cuts.length === 0) return null;

  const readyCuts = cuts.filter(
    (c) => c.rendered_url && c.render_status === "ready"
  );
  const readyCount = readyCuts.length;

  /** Dispara download de cada corte pronto com 200ms de intervalo */
  const handleDownloadAll = useCallback(() => {
    readyCuts.forEach((cut, i) => {
      if (!cut.rendered_url) return;
      const url = cut.rendered_url;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `corte-${cut.id}.mp4`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 200);
    });
  }, [readyCuts]);

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-secondary-light" />
          <h3 className="text-sm font-semibold text-text-primary">
            Cortes ({cuts.length})
          </h3>
        </div>
        {readyCount > 0 ? (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-[12px] font-medium hover:bg-accent/25 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar todos os {readyCount} cortes prontos
          </button>
        ) : (
          onExportAll && (
            <button
              onClick={onExportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-[12px] font-medium hover:bg-accent/25 transition-all opacity-50 cursor-not-allowed"
              disabled
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Todos
            </button>
          )
        )}
      </div>

      {/* Horizontal scrollable cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {cuts.map((cut, index) => {
          const norm = normalizeCut(cut);
          const isReady = cut.rendered_url && cut.render_status === "ready";
          const isRendering = cut.render_status === "rendering";
          const isFailed = cut.render_status === "failed";
          const isLegacy = !cut.render_status;

          return (
            <motion.div
              key={cut.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className="shrink-0 w-[220px] rounded-xl border border-border overflow-hidden bg-bg-card hover:border-border-light transition-all group"
            >
              {/* Thumbnail / Video preview */}
              <div
                className={`h-24 bg-gradient-to-br ${
                  gradients[index % gradients.length]
                } flex items-center justify-center relative overflow-hidden`}
              >
                {isReady && cut.rendered_url ? (
                  <video
                    src={cut.rendered_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                    playsInline
                  />
                ) : (
                  <Scissors className="w-8 h-8 text-white/20" />
                )}

                {/* Duration badge */}
                <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-white font-mono z-10">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(norm.startTime, norm.endTime)}
                </span>

                {/* Accepted badge (legacy) */}
                {norm.accepted && (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-success/80 text-[9px] text-white font-medium z-10">
                    Aceito
                  </span>
                )}

                {/* Ready badge */}
                {isReady && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/80 text-[9px] text-white font-medium z-10">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Pronto
                  </span>
                )}

                {/* Play overlay */}
                <button
                  onClick={() => onPreview(cut)}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors z-10"
                >
                  <div className="w-10 h-10 rounded-full bg-white/0 group-hover:bg-white/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="p-3">
                <h4 className="text-[13px] font-medium text-text-primary mb-0.5 truncate">
                  {cut.title}
                </h4>

                {/* Hook (V2) */}
                {norm.hook && (
                  <p className="text-[11px] text-accent/80 leading-snug mb-1 line-clamp-1 italic">
                    &ldquo;{norm.hook}&rdquo;
                  </p>
                )}

                <p className="text-[10px] text-text-muted font-mono mb-1">
                  {formatTime(norm.startTime)} - {formatTime(norm.endTime)}
                </p>

                {/* Description (legacy) or reason (V2) */}
                {"description" in cut && cut.description && (
                  <p className="text-[11px] text-text-secondary leading-snug mb-2 line-clamp-2">
                    {cut.description}
                  </p>
                )}
                {"reason" in cut && cut.reason && (
                  <p className="text-[11px] text-text-secondary leading-snug mb-2 line-clamp-2">
                    {cut.reason}
                  </p>
                )}

                {/* Viral score + category badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {norm.viralScore !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${viralScoreBadgeClass(
                        norm.viralScore
                      )}`}
                    >
                      🔥 {norm.viralScore}/100
                    </span>
                  )}
                  {norm.category && (
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary/15 text-secondary-light text-[10px] font-medium capitalize">
                      {norm.category}
                    </span>
                  )}
                </div>

                {/* Render status indicator */}
                {isFailed && (
                  <div
                    className="flex items-center gap-1 mb-2 cursor-help"
                    title={cut.render_error ?? "Erro desconhecido na renderização"}
                  >
                    <AlertTriangle className="w-3 h-3 text-danger" />
                    <span className="text-[10px] text-danger font-medium">
                      Renderização falhou
                    </span>
                  </div>
                )}

                {/* Rendering progress */}
                {isRendering && (
                  <div className="mb-2">
                    {progressPercent !== undefined ? (
                      <div className="h-1 bg-border rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-yellow-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-1 bg-border rounded-full overflow-hidden mb-1">
                        <div className="h-full w-1/3 bg-yellow-400 animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onPreview(cut)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-bg-card-hover text-[11px] text-text-secondary hover:text-text-primary transition-all"
                  >
                    <Play className="w-3 h-3" />
                    Preview
                  </button>
                  <button
                    onClick={() => onEdit(index)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-secondary/10 text-[11px] text-secondary-light hover:bg-secondary/20 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>

                  {/* Action button: depends on render status */}
                  {isReady && cut.rendered_url ? (
                    <a
                      href={cut.rendered_url}
                      download={`corte-${cut.id}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-accent/10 text-[11px] text-accent hover:bg-accent/20 transition-all"
                    >
                      <Download className="w-3 h-3" />
                      Baixar MP4
                    </a>
                  ) : isRendering ? (
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-yellow-400/20 text-[11px] text-yellow-400 cursor-wait"
                    >
                      <Film className="w-3 h-3 animate-pulse" />
                      Renderizando...
                    </button>
                  ) : isFailed ? (
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-danger/10 text-[11px] text-danger cursor-default"
                      title={cut.render_error ?? "Erro na renderização"}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Falhou
                    </button>
                  ) : isLegacy ? (
                    // Corte legacy sem render_status — mantém botão de renderizar no browser
                    <button
                      onClick={() => onRender(index)}
                      disabled={renderingIndex !== null && renderingIndex !== undefined}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] transition-all ${
                        renderingIndex === index
                          ? "bg-yellow-400/20 text-yellow-400 cursor-wait"
                          : renderingIndex !== null && renderingIndex !== undefined
                          ? "bg-accent/5 text-accent/40 cursor-not-allowed"
                          : "bg-accent/10 text-accent hover:bg-accent/20"
                      }`}
                    >
                      {renderingIndex === index ? (
                        <Film className="w-3 h-3 animate-pulse" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {renderingIndex === index ? "Renderizando..." : "Renderizar"}
                    </button>
                  ) : (
                    // pending — aguardando fila
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-border text-[11px] text-text-muted cursor-default"
                    >
                      <Clock className="w-3 h-3" />
                      Na fila...
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
