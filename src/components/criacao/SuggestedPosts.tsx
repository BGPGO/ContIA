"use client";

import { Layers, FileText, Video, MessageSquare, Sparkles } from "lucide-react";
import type { SuggestedPost } from "@/types/ai";

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const FORMAT_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  carrossel: { icon: Layers, color: "#a29bfe", label: "Carrossel" },
  post: { icon: FileText, color: "#60a5fa", label: "Post" },
  imagem: { icon: FileText, color: "#60a5fa", label: "Imagem" },
  reels: { icon: Video, color: "#f87171", label: "Reels" },
  video: { icon: Video, color: "#f87171", label: "Video" },
  stories: { icon: MessageSquare, color: "#fbbf24", label: "Stories" },
};

function getFormatConfig(format: string) {
  const key = format.toLowerCase();
  return FORMAT_CONFIG[key] ?? { icon: FileText, color: "#8b8fb0", label: format };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SuggestedPosts Component
   ═══════════════════════════════════════════════════════════════════════════ */

interface SuggestedPostsProps {
  suggestions: SuggestedPost[];
  onSelect: (suggestion: SuggestedPost) => void;
}

export function SuggestedPosts({ suggestions, onSelect }: SuggestedPostsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={13} className="text-accent-light" />
        <span className="text-xs font-semibold text-text-secondary tracking-wide uppercase">
          Sugestoes de Posts
        </span>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const fmt = getFormatConfig(suggestion.format);
          const Icon = fmt.icon;

          return (
            <button
              key={index}
              onClick={() => onSelect(suggestion)}
              className="w-full text-left bg-bg-input border border-border rounded-xl p-3 hover:border-accent/40 hover:bg-bg-card-hover transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {/* Format icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${fmt.color}15` }}
                >
                  <Icon size={14} style={{ color: fmt.color }} />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Topic + badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary group-hover:text-accent-light transition-colors truncate">
                      {suggestion.topic}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium"
                      style={{
                        backgroundColor: `${fmt.color}15`,
                        color: fmt.color,
                      }}
                    >
                      {fmt.label}
                    </span>
                  </div>

                  {/* Reasoning */}
                  <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
                    {suggestion.reasoning}
                  </p>

                  {/* Hook preview */}
                  {suggestion.hook && (
                    <p className="text-[11px] text-text-secondary italic leading-snug mt-1 line-clamp-1">
                      &ldquo;{suggestion.hook}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
