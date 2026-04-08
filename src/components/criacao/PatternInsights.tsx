"use client";

import {
  TrendingUp, Clock, Heart, MessageCircle, Hash,
  Type, Smile, RefreshCw, ImageIcon, Film, Layers
} from "lucide-react";
import type { StyleProfile } from "@/types/patterns";

interface PatternInsightsProps {
  styleProfile: StyleProfile | null;
  loading: boolean;
  onRefresh: () => void;
}

const FORMAT_LABELS: Record<string, { icon: typeof ImageIcon; label: string }> = {
  IMAGE: { icon: ImageIcon, label: "Imagem" },
  VIDEO: { icon: Film, label: "Vídeo" },
  CAROUSEL_ALBUM: { icon: Layers, label: "Carrossel" },
};

export function PatternInsights({ styleProfile, loading, onRefresh }: PatternInsightsProps) {
  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-bg-input rounded w-1/3 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-bg-input rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!styleProfile) return null;

  const sp = styleProfile;
  const fmtConfig = FORMAT_LABELS[sp.best_format] || FORMAT_LABELS.IMAGE;
  const FmtIcon = fmtConfig.icon;

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-accent-light" />
          <span className="text-xs font-semibold text-text-primary">
            Insights dos seus posts ({sp.analyzed_posts_count} analisados)
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 rounded hover:bg-bg-input transition-colors"
          title="Atualizar análise"
        >
          <RefreshCw size={12} className="text-text-muted" />
        </button>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard
          icon={<Heart size={12} className="text-pink-400" />}
          label="Média likes"
          value={sp.avg_likes.toLocaleString()}
        />
        <MetricCard
          icon={<MessageCircle size={12} className="text-blue-400" />}
          label="Média comentários"
          value={sp.avg_comments.toLocaleString()}
        />
        <MetricCard
          icon={<Clock size={12} className="text-amber-400" />}
          label="Melhor horário"
          value={sp.best_time_to_post}
        />
        <MetricCard
          icon={<FmtIcon size={12} className="text-green-400" />}
          label="Melhor formato"
          value={fmtConfig.label}
        />
      </div>

      {/* Quick insights */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Smile size={11} className="text-text-muted shrink-0" />
          <span className="text-[11px] text-text-secondary">
            Emojis: <span className="text-text-primary font-medium">{sp.emoji_usage}</span>
            {sp.emoji_examples?.length > 0 && (
              <span className="ml-1 text-text-muted">({sp.emoji_examples.slice(0, 5).join(" ")})</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Type size={11} className="text-text-muted shrink-0" />
          <span className="text-[11px] text-text-secondary">
            Legenda média: <span className="text-text-primary font-medium">{sp.caption_avg_length} caracteres</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Hash size={11} className="text-text-muted shrink-0" />
          <span className="text-[11px] text-text-secondary">
            Hashtags: <span className="text-text-primary font-medium">{sp.hashtag_avg_count} por post</span>
          </span>
        </div>
      </div>

      {/* Top hashtags */}
      {sp.top_hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sp.top_hashtags.slice(0, 8).map((tag, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-light font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg-input rounded-lg p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-text-muted">{label}</span>
      </div>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
