"use client";

import { motion } from "motion/react";
import {
  Play,
  Pencil,
  Download,
  Scissors,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { VideoCut } from "@/types/video";

interface CutsPanelProps {
  cuts: VideoCut[];
  onPreview: (cut: VideoCut) => void;
  onEdit: (index: number) => void;
  onExport: (index: number) => void;
  onExportAll: () => void;
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

const gradients = [
  "from-violet-600/30 to-indigo-600/30",
  "from-cyan-600/30 to-teal-600/30",
  "from-rose-600/30 to-pink-600/30",
  "from-amber-600/30 to-orange-600/30",
  "from-emerald-600/30 to-green-600/30",
];

export function CutsPanel({
  cuts,
  onPreview,
  onEdit,
  onExport,
  onExportAll,
}: CutsPanelProps) {
  if (cuts.length === 0) return null;

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
        <button
          onClick={onExportAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-[12px] font-medium hover:bg-accent/25 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Todos
        </button>
      </div>

      {/* Horizontal scrollable cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {cuts.map((cut, index) => (
          <motion.div
            key={cut.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            className="shrink-0 w-[220px] rounded-xl border border-border overflow-hidden bg-bg-card hover:border-border-light transition-all group"
          >
            {/* Thumbnail placeholder */}
            <div
              className={`h-24 bg-gradient-to-br ${
                gradients[index % gradients.length]
              } flex items-center justify-center relative`}
            >
              <Scissors className="w-8 h-8 text-white/20" />
              {/* Duration badge */}
              <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-white font-mono">
                <Clock className="w-2.5 h-2.5" />
                {formatDuration(cut.startTime, cut.endTime)}
              </span>
              {/* Accepted badge */}
              {cut.accepted && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-success/80 text-[9px] text-white font-medium">
                  Aceito
                </span>
              )}
              {/* Play overlay */}
              <button
                onClick={() => onPreview(cut)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors"
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
              <p className="text-[10px] text-text-muted font-mono mb-2">
                {formatTime(cut.startTime)} - {formatTime(cut.endTime)}
              </p>
              <p className="text-[11px] text-text-secondary leading-snug mb-3 line-clamp-2">
                {cut.description}
              </p>

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
                <button
                  onClick={() => onExport(index)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-accent/10 text-[11px] text-accent hover:bg-accent/20 transition-all"
                >
                  <Download className="w-3 h-3" />
                  Exportar
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
