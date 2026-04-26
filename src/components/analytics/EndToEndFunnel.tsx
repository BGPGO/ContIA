"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { TrendingDown, Trophy } from "lucide-react";
import type { FunnelEndToEndStage } from "@/types/attribution";

/* ── Props ── */

interface EndToEndFunnelProps {
  stages: FunnelEndToEndStage[];
  totalRevenue?: number;
  title?: string;
}

/* ── Formatters ── */

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/* ── Stage color ── */

function stageColor(stage: string, index: number, total: number): string {
  if (stage === "won") return "#10b981"; // green
  if (stage === "lost") return "#ef4444"; // red

  // gradient blue → teal as index increases
  const progress = total > 1 ? index / (total - 1) : 0;
  const r = Math.round(99 + (16 - 99) * progress);   // 99 → 16
  const g = Math.round(102 + (185 - 102) * progress); // 102 → 185
  const b = Math.round(241 + (129 - 241) * progress); // 241 → 129
  return `rgb(${r},${g},${b})`;
}

/* ── Tooltip ── */

interface TooltipData {
  label: string;
  count: number;
  convFromTop: number | null;
  convFromPrev: number | null;
  valueSum?: number;
}

function StageTooltip({ data, color }: { data: TooltipData; color: string }) {
  return (
    <div className="absolute left-0 -bottom-[90px] z-20 hidden group-hover:flex flex-col bg-bg-card border border-border rounded-xl px-4 py-3 shadow-xl text-[11px] whitespace-nowrap pointer-events-none gap-1.5 min-w-[200px]">
      <span className="font-semibold text-text-primary" style={{ color }}>
        {data.label}
      </span>
      <div className="flex items-center justify-between gap-6">
        <span className="text-text-muted">Volume</span>
        <span className="font-medium text-text-secondary tabular-nums">
          {data.count.toLocaleString("pt-BR")} leads
        </span>
      </div>
      {data.convFromTop != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-text-muted">% do topo</span>
          <span className="font-medium text-text-secondary tabular-nums">
            {formatPct(data.convFromTop)}
          </span>
        </div>
      )}
      {data.convFromPrev != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-text-muted">Conv. do anterior</span>
          <span className="font-medium text-success tabular-nums">
            {formatPct(data.convFromPrev)}
          </span>
        </div>
      )}
      {data.valueSum != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-text-muted">Receita</span>
          <span className="font-bold text-success tabular-nums">
            {formatBRL(data.valueSum)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Stage Bar ── */

function StageBar({
  stage,
  maxCount,
  color,
  index,
  isWon,
  isLast,
  totalRevenue,
}: {
  stage: FunnelEndToEndStage;
  maxCount: number;
  color: string;
  index: number;
  isWon: boolean;
  isLast: boolean;
  totalRevenue: number;
}) {
  const [hovered, setHovered] = useState(false);
  const widthPct = maxCount > 0 ? Math.max(12, (stage.count / maxCount) * 100) : 12;

  const tooltipData: TooltipData = {
    label: stage.label,
    count: stage.count,
    convFromTop: stage.conversionFromTop ?? null,
    convFromPrev: stage.conversionFromPrev ?? null,
    valueSum: stage.valueSum,
  };

  return (
    <div className="flex flex-col gap-1">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.06 }}
        className="group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="article"
        aria-label={`${stage.label}: ${stage.count} leads`}
      >
        {/* Background track */}
        <div className="relative h-12 bg-bg-elevated rounded-lg overflow-hidden">
          {/* Animated fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.6, delay: index * 0.06 + 0.15, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full rounded-lg flex items-center px-4 gap-3"
            style={{
              backgroundColor: color,
              opacity: hovered ? 1 : 0.85,
            }}
          >
            {/* Count */}
            <span className="text-[13px] font-bold text-white tabular-nums whitespace-nowrap">
              {stage.count.toLocaleString("pt-BR")}
            </span>

            {/* Won trophy */}
            {isWon && (
              <Trophy size={14} className="text-white/80 shrink-0" />
            )}
          </motion.div>

          {/* Hover shimmer */}
          {hovered && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent 60%, ${color}33 100%)`,
              }}
            />
          )}
        </div>

        {/* Tooltip */}
        <StageTooltip data={tooltipData} color={color} />
      </motion.div>

      {/* Stage label + sub */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[12px] font-medium text-text-secondary">{stage.label}</span>
        <div className="flex items-center gap-3">
          {stage.conversionFromTop != null && (
            <span className="text-[11px] text-text-muted tabular-nums">
              {formatPct(stage.conversionFromTop)} do total
            </span>
          )}
          {isWon && (stage.valueSum != null || totalRevenue > 0) && (
            <span className="text-[11px] font-bold text-success tabular-nums">
              {formatBRL(stage.valueSum ?? totalRevenue)}
            </span>
          )}
        </div>
      </div>

      {/* Arrow between stages */}
      {!isLast && stage.conversionFromPrev != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.06 + 0.3 }}
          className="flex items-center gap-2 px-2 py-0.5"
        >
          <TrendingDown size={11} className="text-text-muted shrink-0" />
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[10px] text-text-muted tabular-nums">
            {formatPct(stage.conversionFromPrev)} passaram
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </motion.div>
      )}
    </div>
  );
}

/* ── Main ── */

export function EndToEndFunnel({
  stages,
  totalRevenue = 0,
  title = "Funil Ponta a Ponta",
}: EndToEndFunnelProps) {
  if (stages.length === 0 || stages.every((s) => s.count === 0)) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
          <TrendingDown size={18} className="text-text-muted" />
        </div>
        <p className="text-[13px] text-text-muted">Aguardando dados de funil</p>
      </div>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count));
  const topStage = stages[0];
  const wonStage = stages.find((s) => s.stage === "won");
  const topCount = topStage?.count ?? 1;
  const overallConversion =
    wonStage && topCount > 0
      ? (wonStage.count / topCount) * 100
      : null;

  // Separate won/lost from main flow
  const mainStages = stages.filter((s) => s.stage !== "lost");
  const lostStage = stages.find((s) => s.stage === "lost");
  const allDisplayStages = lostStage ? [...mainStages, lostStage] : mainStages;
  const total = allDisplayStages.length;

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
          <p className="text-[12px] text-text-muted mt-0.5">
            Jornada completa desde o primeiro contato até o fechamento
          </p>
        </div>
        {overallConversion !== null && (
          <div className="text-right">
            <p className="text-[11px] text-text-muted">Conversão geral</p>
            <p className="text-[18px] font-bold text-success tabular-nums">
              {overallConversion.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Bars */}
      <div className="flex flex-col gap-1 pb-2">
        {allDisplayStages.map((stage, idx) => {
          const isWon = stage.stage === "won";
          const isLast = idx === allDisplayStages.length - 1;
          const color = stageColor(stage.stage, idx, total);

          return (
            <StageBar
              key={stage.stage}
              stage={stage}
              maxCount={maxCount}
              color={color}
              index={idx}
              isWon={isWon}
              isLast={isLast}
              totalRevenue={totalRevenue}
            />
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] text-text-muted">Entrada</p>
          <p className="text-[18px] font-bold text-text-primary tabular-nums">
            {(topStage?.count ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-[11px] text-text-muted">leads</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-text-muted">Fechados</p>
          <p className="text-[18px] font-bold text-success tabular-nums">
            {(wonStage?.count ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-[11px] text-text-muted">deals won</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-text-muted">Receita</p>
          <p className="text-[18px] font-bold text-success tabular-nums">
            {formatBRL(wonStage?.valueSum ?? totalRevenue)}
          </p>
        </div>
      </div>
    </div>
  );
}
