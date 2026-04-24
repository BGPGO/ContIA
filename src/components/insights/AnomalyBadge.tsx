"use client";

import { TrendingUp, TrendingDown, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ── Types ─────────────────────────────────────────────────────── */

export interface Anomaly {
  metric: string;
  metricLabel: string;
  direction: "spike" | "drop";
  severity: "low" | "medium" | "high";
  currentValue: number;
  expectedValue: number;
  deviationPercent: number; // ex: -45 para queda de 45%
  detectedAt: string; // ISO
}

export interface AnomalyBadgeProps {
  anomalies: Anomaly[];
  onDismiss?: (metric: string) => void;
}

/* ── Severity config ────────────────────────────────────────────── */

const SEVERITY_CONFIG = {
  low: {
    border: "border-blue-500/40",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300",
    label: "Baixa",
  },
  medium: {
    border: "border-yellow-500/40",
    iconBg: "bg-yellow-500/10",
    iconColor: "text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-300",
    label: "Média",
  },
  high: {
    border: "border-red-500/40",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    badge: "bg-red-500/20 text-red-300",
    label: "Alta",
  },
} as const;

/* ── Relative time helper (PT-BR) ───────────────────────────────── */

function relativeTime(isoDate: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 2) return "Agora mesmo";
    if (diffMin < 60) return `Há ${diffMin} minutos`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `Há ${diffH} hora${diffH !== 1 ? "s" : ""}`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 30) return `Há ${diffD} dia${diffD !== 1 ? "s" : ""}`;
    const diffMo = Math.round(diffD / 30);
    return `Há ${diffMo} ${diffMo === 1 ? "mês" : "meses"}`;
  } catch {
    return "";
  }
}

/* ── Format number ──────────────────────────────────────────────── */

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString("pt-BR");
}

/* ── Single badge ───────────────────────────────────────────────── */

function SingleAnomaly({
  anomaly,
  onDismiss,
}: {
  anomaly: Anomaly;
  onDismiss?: (metric: string) => void;
}) {
  const cfg = SEVERITY_CONFIG[anomaly.severity];
  const Icon = anomaly.direction === "spike" ? TrendingUp : TrendingDown;

  const directionLabel =
    anomaly.direction === "spike" ? "Pico em" : "Queda forte em";

  const devAbs = Math.abs(anomaly.deviationPercent);
  const devSign = anomaly.deviationPercent >= 0 ? "+" : "-";
  const descriptionLine = `Valor atual ${fmt(anomaly.currentValue)} — esperado ~${fmt(
    anomaly.expectedValue
  )} (${devSign}${devAbs.toFixed(0)}% vs média)`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`relative flex items-start gap-3 p-3.5 rounded-xl bg-bg-card border ${cfg.border} overflow-hidden`}
    >
      {/* Severity glow strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${
          anomaly.severity === "high"
            ? "bg-red-500"
            : anomaly.severity === "medium"
              ? "bg-yellow-500"
              : "bg-blue-500"
        }`}
      />

      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
        <Icon size={17} className={cfg.iconColor} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-[13px] font-semibold text-text-primary">
            {directionLabel} {anomaly.metricLabel}
          </p>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-[12px] text-text-muted leading-relaxed">{descriptionLine}</p>
        <p className="text-[11px] text-text-muted/60 mt-1">{relativeTime(anomaly.detectedAt)}</p>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(anomaly.metric)}
          aria-label="Dispensar alerta"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </motion.div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function AnomalyBadge({ anomalies, onDismiss }: AnomalyBadgeProps) {
  if (anomalies.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {anomalies.map((anomaly) => (
          <SingleAnomaly
            key={anomaly.metric}
            anomaly={anomaly}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
