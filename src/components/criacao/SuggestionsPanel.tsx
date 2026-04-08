"use client";

import { useState } from "react";
import {
  Sparkles, RefreshCw, TrendingUp, Newspaper, Target,
  Calendar, BarChart3, Zap, ChevronRight, Layers,
  FileText, Video, Database, Globe, Brain
} from "lucide-react";
import type { EnrichedSuggestion } from "@/types/suggestions";
import type { SuggestedPost } from "@/types/ai";

// Source config
const SOURCE_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  trending: { icon: TrendingUp, color: "#a855f7", label: "Tendência" },
  news: { icon: Newspaper, color: "#3b82f6", label: "Notícia" },
  gap: { icon: Target, color: "#22c55e", label: "Oportunidade" },
  seasonal: { icon: Calendar, color: "#f97316", label: "Sazonal" },
  engagement: { icon: BarChart3, color: "#ec4899", label: "Engajamento" },
};

const FORMAT_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  carrossel: { icon: Layers, color: "#a29bfe", label: "Carrossel" },
  post: { icon: FileText, color: "#60a5fa", label: "Post" },
  reels: { icon: Video, color: "#f87171", label: "Reels" },
};

// Engagement colors
const ENGAGEMENT_CONFIG: Record<string, { color: string; label: string }> = {
  alto: { color: "#22c55e", label: "Alto" },
  "médio": { color: "#f59e0b", label: "Médio" },
  baixo: { color: "#6b7280", label: "Baixo" },
};

interface SuggestionsPanelProps {
  suggestions: EnrichedSuggestion[];
  loading: boolean;
  error: string | null;
  context: {
    news_count: number;
    recent_posts_analyzed: number;
    dna_available: boolean;
  } | null;
  onSelect: (suggestion: SuggestedPost) => void;
  onRefresh: () => void;
}

export function SuggestionsPanel({ suggestions, loading, error, context, onSelect, onRefresh }: SuggestionsPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (error) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={onRefresh} className="text-xs text-accent-light hover:underline">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Brain size={16} className="text-accent-light" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Sugestões Inteligentes</h3>
            <p className="text-[11px] text-text-muted">Baseadas no DNA, padrões e notícias do mercado</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-input border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Gerando..." : "Atualizar"}
        </button>
      </div>

      {/* Context badges */}
      {context && (
        <div className="flex flex-wrap gap-2">
          {context.dna_available && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-green-500/10 text-green-400">
              <Database size={10} /> DNA ativo
            </span>
          )}
          {context.news_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-400">
              <Globe size={10} /> {context.news_count} notícias analisadas
            </span>
          )}
          {context.recent_posts_analyzed > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-purple-500/10 text-purple-400">
              <BarChart3 size={10} /> {context.recent_posts_analyzed} posts recentes
            </span>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !suggestions.length && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-bg-input" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-bg-input rounded w-3/4" />
                  <div className="h-3 bg-bg-input rounded w-1/2" />
                  <div className="h-3 bg-bg-input rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !suggestions.length && !error && (
        <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
          <Sparkles size={32} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary mb-1">Nenhuma sugestão ainda</p>
          <p className="text-xs text-text-muted mb-4">Clique em &quot;Atualizar&quot; para gerar sugestões baseadas no seu perfil</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Gerar sugestões
          </button>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => {
            const src = SOURCE_CONFIG[suggestion.source?.type] || SOURCE_CONFIG.gap;
            const fmt = FORMAT_CONFIG[suggestion.format] || FORMAT_CONFIG.post;
            const eng = ENGAGEMENT_CONFIG[suggestion.estimated_engagement] || ENGAGEMENT_CONFIG["médio"];
            const SrcIcon = src.icon;
            const FmtIcon = fmt.icon;
            const isExpanded = expandedId === index;

            return (
              <div
                key={index}
                className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-all group"
              >
                {/* Main card (clickable) */}
                <button
                  onClick={() => onSelect(suggestion)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Source icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${src.color}15` }}
                    >
                      <SrcIcon size={16} style={{ color: src.color }} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Topic + badges */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-light transition-colors leading-snug">
                          {suggestion.topic}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Format badge */}
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${fmt.color}15`, color: fmt.color }}
                          >
                            {fmt.label}
                          </span>
                          {/* Engagement indicator */}
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${eng.color}15`, color: eng.color }}
                          >
                            {eng.label}
                          </span>
                        </div>
                      </div>

                      {/* Hook preview */}
                      {suggestion.hook && (
                        <p className="text-xs text-text-secondary italic leading-snug line-clamp-1">
                          &ldquo;{suggestion.hook}&rdquo;
                        </p>
                      )}

                      {/* Source + confidence */}
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium"
                          style={{ color: src.color }}
                        >
                          <SrcIcon size={10} />
                          {suggestion.source?.label || src.label}
                        </span>

                        {/* Confidence bar */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-bg-input overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${suggestion.confidence || 50}%`,
                                backgroundColor: suggestion.confidence >= 75 ? "#22c55e" : suggestion.confidence >= 50 ? "#f59e0b" : "#6b7280",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-text-muted">{suggestion.confidence}%</span>
                        </div>

                        {/* Category */}
                        {suggestion.category && (
                          <span className="text-[10px] text-text-muted">
                            {suggestion.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expand toggle for reasoning */}
                <div className="px-4 pb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : index);
                    }}
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <ChevronRight size={10} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    {isExpanded ? "Menos detalhes" : "Ver detalhes"}
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-2 fade-in">
                      <p className="text-xs text-text-secondary leading-relaxed">{suggestion.reasoning}</p>
                      {suggestion.related_news && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-bg-input">
                          <Newspaper size={12} className="text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] text-text-primary leading-snug">{suggestion.related_news.titulo}</p>
                            <p className="text-[10px] text-text-muted">{suggestion.related_news.fonte}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
