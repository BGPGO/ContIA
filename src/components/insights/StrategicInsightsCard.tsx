"use client";

import { motion } from "motion/react";
import {
  TrendingUp,
  Heart,
  Image,
  Clock,
  AlertTriangle,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { StrategicInsight } from "@/types/analytics";

/* ── Props ──────────────────────────────────────────────────────── */

interface Props {
  insights: StrategicInsight[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}

/* ── Config maps ────────────────────────────────────────────────── */

const CATEGORY_ICON: Record<StrategicInsight["category"], LucideIcon> = {
  growth: TrendingUp,
  engagement: Heart,
  content: Image,
  timing: Clock,
  anomaly: AlertTriangle,
};

const SEVERITY_CONFIG: Record<
  StrategicInsight["severity"],
  {
    border: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    badgeText: string;
    strip: string;
  }
> = {
  positive: {
    border: "border-success/30",
    iconBg: "bg-success/10",
    iconColor: "text-success",
    badge: "bg-success/15 text-success",
    badgeText: "Forte",
    strip: "bg-success",
  },
  neutral: {
    border: "border-border",
    iconBg: "bg-bg-elevated",
    iconColor: "text-text-muted",
    badge: "bg-bg-elevated text-text-muted",
    badgeText: "Neutro",
    strip: "bg-border",
  },
  warning: {
    border: "border-warning/30",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    badge: "bg-warning/15 text-warning",
    badgeText: "Atenção",
    strip: "bg-warning",
  },
  critical: {
    border: "border-danger/30",
    iconBg: "bg-danger/10",
    iconColor: "text-danger",
    badge: "bg-danger/15 text-danger",
    badgeText: "Crítico",
    strip: "bg-danger",
  },
};

/* ── Single insight card ────────────────────────────────────────── */

function InsightCard({
  insight,
  index,
}: {
  insight: StrategicInsight;
  index: number;
}) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = CATEGORY_ICON[insight.category];

  return (
    <motion.article
      role="article"
      aria-label={insight.title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25, ease: "easeOut" }}
      className={`relative flex flex-col gap-3 p-4 rounded-xl bg-bg-card border ${cfg.border} overflow-hidden hover:border-opacity-60 transition-all duration-200`}
    >
      {/* Left severity strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${cfg.strip}`}
      />

      {/* Header: icon + badge */}
      <div className="flex items-center gap-2 pl-1">
        <div
          className={`shrink-0 w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center`}
        >
          <Icon size={15} className={cfg.iconColor} />
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${cfg.badge}`}
        >
          {cfg.badgeText}
        </span>
      </div>

      {/* Title + description */}
      <div className="pl-1 flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-text-primary leading-snug">
          {insight.title}
        </p>
        <p className="text-[12px] text-text-muted leading-relaxed">
          {insight.description}
        </p>
      </div>

      {/* Metric chip */}
      {insight.metric && (
        <div className="pl-1">
          <span className="inline-flex items-center bg-bg-secondary border border-border rounded-md px-2 py-0.5 text-xs font-mono text-text-primary">
            {insight.metric}
          </span>
        </div>
      )}

      {/* Actionable suggestion */}
      {insight.actionable && (
        <>
          <div className="border-t border-border/50 mx-1" />
          <div className="flex items-start gap-1.5 pl-1">
            <Sparkles
              size={12}
              className="text-accent shrink-0 mt-[1px]"
            />
            <p className="text-[11px] text-accent leading-snug">
              {insight.actionable}
            </p>
          </div>
        </>
      )}
    </motion.article>
  );
}

/* ── Empty state ────────────────────────────────────────────────── */

function InsightsEmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="col-span-full flex flex-col items-center justify-center py-14 text-center px-4 rounded-xl bg-bg-card border border-border"
    >
      <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center mb-4">
        <Search size={22} className="text-text-muted" />
      </div>
      <p className="text-[13px] text-text-muted max-w-xs leading-relaxed">
        {message}
      </p>
    </motion.div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function StrategicInsightsCard({
  insights,
  title = "Insights estratégicos",
  subtitle = "O que esses números dizem sobre o seu conteúdo",
  emptyMessage = "Aguardando dados suficientes para gerar insights.",
}: Props) {
  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div>
        <h2 className="text-[17px] font-semibold text-text-primary">{title}</h2>
        <p className="text-[13px] text-text-muted mt-0.5">{subtitle}</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.length === 0 ? (
          <InsightsEmptyState message={emptyMessage} />
        ) : (
          insights.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))
        )}
      </div>
    </section>
  );
}
