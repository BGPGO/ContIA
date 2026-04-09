"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  Layers,
  Video,
  Mail,
  PenTool,
  Clock,
  Loader2,
} from "lucide-react";
import type { CopySessionStatus } from "@/types/copy-studio";
import type { ContentFormat } from "@/types/ai";
import type { CopySessionSummary } from "@/hooks/useCopySessions";

interface SessionHistoryProps {
  sessions: CopySessionSummary[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onNew: () => void;
  isLoading: boolean;
}

const FORMAT_ICON: Record<ContentFormat, typeof FileText> = {
  post: FileText,
  carrossel: Layers,
  reels: Video,
  email: Mail,
  copy: PenTool,
};

const FORMAT_LABEL: Record<ContentFormat, string> = {
  post: "Post",
  carrossel: "Carrossel",
  reels: "Reels",
  email: "Email",
  copy: "Copy",
};

const STATUS_CONFIG: Record<CopySessionStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "#5e6388" },
  approved: { label: "Aprovado", color: "#34d399" },
  designed: { label: "Desenhado", color: "#6c5ce7" },
  exported: { label: "Exportado", color: "#4ecdc4" },
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes}min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function SessionHistory({
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
  onNew,
  isLoading,
}: SessionHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-border">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-bg-card-hover/30 transition-colors cursor-pointer"
      >
        <Clock size={14} className="text-text-muted" />
        <span className="text-xs font-medium text-text-muted flex-1">
          Sessoes anteriores{sessions.length > 0 ? ` (${sessions.length})` : ""}
        </span>
        {isLoading && <Loader2 size={12} className="text-text-muted animate-spin" />}
        {expanded ? (
          <ChevronDown size={14} className="text-text-muted" />
        ) : (
          <ChevronRight size={14} className="text-text-muted" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5 max-h-[200px] overflow-y-auto">
              {/* New session button */}
              <button
                type="button"
                onClick={onNew}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                  text-accent hover:bg-accent/10 border border-dashed border-accent/20
                  hover:border-accent/40 transition-all cursor-pointer"
              >
                <Plus size={12} />
                Nova sessao
              </button>

              {/* Session list */}
              {sessions.map((session) => {
                const FmtIcon = FORMAT_ICON[session.format] || FileText;
                const status = STATUS_CONFIG[session.status];
                const isCurrent = session.id === currentSessionId;

                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer group ${
                      isCurrent
                        ? "bg-accent/10 border border-accent/20"
                        : "hover:bg-bg-card border border-transparent hover:border-border"
                    }`}
                    onClick={() => onSelect(session.id)}
                  >
                    <FmtIcon size={14} className={isCurrent ? "text-accent" : "text-text-muted"} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${isCurrent ? "text-accent-light" : "text-text-primary"}`}>
                        {session.title || "Sem titulo"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${status.color}15`, color: status.color }}
                        >
                          {status.label}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatDate(session.updated_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="p-1 rounded-md text-text-muted opacity-0 group-hover:opacity-100
                        hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}

              {!isLoading && sessions.length === 0 && (
                <p className="text-[11px] text-text-muted text-center py-3">
                  Nenhuma sessao salva
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
