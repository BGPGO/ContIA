"use client";

import { motion } from "motion/react";
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Info,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { ReportAnalysis, Highlight, Recommendation, Insight, Warning } from "@/types/reports";
import Link from "next/link";

interface AnalysisCardProps {
  analysis: ReportAnalysis | null;
  compact?: boolean;
  showGenerateButton?: boolean;
  generateHref?: string;
}

const INSIGHT_ICONS = {
  positive: CheckCircle2,
  negative: AlertTriangle,
  neutral: Info,
  warning: AlertTriangle,
};

const INSIGHT_COLORS = {
  positive: "text-success bg-success/10 border-success/20",
  negative: "text-danger bg-danger/10 border-danger/20",
  neutral: "text-info bg-info/10 border-info/20",
  warning: "text-warning bg-warning/10 border-warning/20",
};

const PRIORITY_COLORS = {
  high: "text-danger bg-danger/10",
  medium: "text-warning bg-warning/10",
  low: "text-info bg-info/10",
};

export function AnalysisCard({
  analysis,
  compact = false,
  showGenerateButton = false,
  generateHref = "/relatorios/novo",
}: AnalysisCardProps) {
  if (!analysis && showGenerateButton) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-featured p-6 sm:p-8 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-accent" />
        </div>
        <h3 className="text-[16px] font-semibold text-text-primary mb-2">
          Analise com IA
        </h3>
        <p className="text-[13px] text-text-muted max-w-md mx-auto mb-5">
          Gere uma analise completa dos seus canais com inteligencia artificial.
          Identifique padroes, oportunidades e receba recomendacoes personalizadas.
        </p>
        <Link
          href={generateHref}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Sparkles size={16} />
          Gerar analise IA
        </Link>
      </motion.div>
    );
  }

  if (!analysis) return null;

  const { summary, highlights, insights, recommendations, warnings } = analysis;
  const displayHighlights = compact ? highlights.slice(0, 3) : highlights;
  const displayInsights = compact ? insights.slice(0, 2) : insights;
  const displayRecs = compact ? recommendations.slice(0, 3) : recommendations;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-featured p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
          <Sparkles size={20} className="text-accent" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary">
            Analise de Inteligencia
          </h3>
          <p className="text-[11px] text-text-muted">Gerada por IA</p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-[13px] text-text-secondary leading-relaxed">{summary}</p>

      {/* Highlights */}
      {displayHighlights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Destaques
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {displayHighlights.map((h, i) => (
              <div
                key={i}
                className="bg-bg-card/50 border border-border rounded-lg p-3"
              >
                <p className="text-[12px] font-semibold text-text-primary mb-1">
                  {h.title}
                </p>
                {h.metric && (
                  <p className="text-[18px] font-bold text-accent mb-0.5">
                    {h.metric.value}
                    {h.metric.delta && (
                      <span className={`ml-1.5 text-[11px] font-medium ${
                        h.metric.delta.startsWith("+") ? "text-success" : "text-danger"
                      }`}>
                        {h.metric.delta}
                      </span>
                    )}
                  </p>
                )}
                <p className="text-[11px] text-text-muted line-clamp-2">
                  {h.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {displayInsights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Insights
          </h4>
          {displayInsights.map((ins, i) => {
            const Icon = INSIGHT_ICONS[ins.type];
            const colors = INSIGHT_COLORS[ins.type];
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${colors}`}
              >
                <Icon size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold">{ins.title}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{ins.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && !compact && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold">{w.title}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{w.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {displayRecs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Recomendacoes
          </h4>
          {displayRecs.map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-bg-card/50 border border-border"
            >
              <Lightbulb size={16} className="shrink-0 mt-0.5 text-accent" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[12px] font-semibold text-text-primary">
                    {rec.action}
                  </p>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${PRIORITY_COLORS[rec.priority]}`}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">{rec.rationale}</p>
                {rec.estimatedImpact && (
                  <p className="text-[10px] text-accent mt-1">
                    Impacto estimado: {rec.estimatedImpact}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
