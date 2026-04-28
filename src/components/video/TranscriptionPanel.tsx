"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { FileText, Pencil, Check, X, Copy, CheckCheck } from "lucide-react";
import type { TranscriptionSegment } from "@/types/video";

interface TranscriptionPanelProps {
  segments: TranscriptionSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onUpdateSegment: (index: number, text: string) => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptionPanel({
  segments,
  currentTime,
  onSeek,
  onUpdateSegment,
}: TranscriptionPanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Find current active segment index
  const activeIndex = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Auto-scroll to active segment
  useEffect(() => {
    if (autoScrollRef.current && activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeIndex]);

  // Detect manual scroll to pause auto-scroll
  const handleScroll = useCallback(() => {
    autoScrollRef.current = false;
    // Re-enable auto-scroll after 3s of no manual scroll
    const timer = setTimeout(() => {
      autoScrollRef.current = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(segments[index].text);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      onUpdateSegment(editingIndex, editText);
      setEditingIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const copyFullText = () => {
    const fullText = segments.map((s) => s.text).join(" ");
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Transcricao</p>
          <p className="text-[10px] text-text-muted">
            {segments.length} segmentos
          </p>
        </div>
        <button
          onClick={copyFullText}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] text-text-secondary hover:text-text-primary transition-all"
          title="Copiar texto completo"
        >
          {copied ? (
            <>
              <CheckCheck className="w-3 h-3 text-success" />
              <span className="text-success">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copiar tudo
            </>
          )}
        </button>
      </div>

      {/* Segments */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
      >
        {segments.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            Nenhuma transcricao disponivel
          </div>
        )}

        {segments.map((seg, index) => {
          const isActive = index === activeIndex;
          const isEditing = editingIndex === index;

          return (
            <motion.div
              key={seg.id || index}
              ref={isActive ? activeRef : undefined}
              initial={false}
              animate={{
                backgroundColor: isActive
                  ? "rgba(139, 92, 246, 0.08)"
                  : "transparent",
              }}
              className={`group flex gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer dark:hover:bg-white/[0.03] hover:bg-bg-card-hover/50 ${
                isActive ? "border-l-2 border-accent" : "border-l-2 border-transparent"
              }`}
              onClick={() => {
                if (!isEditing) {
                  onSeek(seg.start);
                }
              }}
            >
              {/* Timestamp */}
              <span
                className={`shrink-0 text-[10px] font-mono pt-0.5 w-10 ${
                  isActive ? "text-accent font-medium" : "text-text-muted"
                }`}
              >
                {formatTimestamp(seg.start)}
              </span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-bg-input border border-border rounded-md px-2 py-1.5 text-[12px] text-text-primary resize-none outline-none focus:border-accent/40"
                      rows={2}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEdit();
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] hover:bg-accent/25 transition-all"
                      >
                        <Check className="w-2.5 h-2.5" />
                        Salvar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-card-hover text-text-muted text-[10px] hover:text-text-primary transition-all"
                      >
                        <X className="w-2.5 h-2.5" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <p
                      className={`text-[12px] leading-relaxed flex-1 ${
                        isActive
                          ? "text-text-primary font-medium"
                          : "text-text-secondary"
                      }`}
                    >
                      {seg.text}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(index);
                      }}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-all"
                      title="Editar segmento"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
