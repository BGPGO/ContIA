"use client";

import { motion } from "motion/react";
import type { CrmFunnelStage } from "@/types/analytics";

interface SalesFunnelChartProps {
  funnel: CrmFunnelStage[];
  title?: string;
}

interface TooltipInfo {
  label: string;
  count: number;
  pct: number;
  dropPct: number | null;
}

function FunnelBar({
  stage,
  maxCount,
  tooltipInfo,
  index,
  isBottleneck,
}: {
  stage: CrmFunnelStage;
  maxCount: number;
  tooltipInfo: TooltipInfo;
  index: number;
  isBottleneck: boolean;
}) {
  const widthPct = maxCount > 0 ? Math.max(8, (stage.count / maxCount) * 100) : 8;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={`flex items-center gap-3 group rounded-lg pr-1 ${isBottleneck ? "border-l-4 border-danger pl-2" : "pl-0"}`}
    >
      {/* Label */}
      <div className="w-44 shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-[12px] text-text-secondary text-right truncate max-w-full">
          {stage.label}
        </span>
        {isBottleneck && (
          <span className="text-[9px] font-semibold text-danger bg-danger/10 border border-danger/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            Maior perda: {tooltipInfo.dropPct != null ? `${tooltipInfo.dropPct.toFixed(0)}% drop` : "—"}
          </span>
        )}
      </div>

      {/* Bar + count */}
      <div className="relative flex-1 flex items-center gap-2">
        <div className="w-full bg-bg-elevated rounded-full h-7 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.5, delay: index * 0.05 + 0.1, ease: "easeOut" }}
            className="h-full rounded-full flex items-center px-3"
            style={{ backgroundColor: stage.color }}
          >
            {stage.count > 0 && (
              <span className="text-[11px] font-semibold text-white tabular-nums whitespace-nowrap">
                {stage.count.toLocaleString("pt-BR")}
              </span>
            )}
          </motion.div>
        </div>

        {/* Tooltip on hover */}
        <div className="absolute left-0 -bottom-9 z-10 hidden group-hover:flex bg-bg-card border border-border rounded-lg px-3 py-2 shadow-lg gap-4 text-[11px] whitespace-nowrap pointer-events-none">
          <span className="text-text-primary font-medium">{tooltipInfo.label}</span>
          <span className="text-text-muted">{tooltipInfo.count.toLocaleString("pt-BR")} leads</span>
          <span style={{ color: stage.color }}>{tooltipInfo.pct.toFixed(1)}% do funil</span>
          {tooltipInfo.dropPct !== null && (
            <span className="text-danger">
              -{tooltipInfo.dropPct.toFixed(1)}% do anterior
            </span>
          )}
        </div>
      </div>

      {/* Pct */}
      <span className="w-14 shrink-0 text-[11px] text-text-muted tabular-nums text-right">
        {tooltipInfo.pct.toFixed(1)}%
      </span>
    </motion.div>
  );
}

export function SalesFunnelChart({ funnel, title = "Funil de Vendas" }: SalesFunnelChartProps) {
  if (funnel.length === 0 || funnel.every((s) => s.count === 0)) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">{title}</h3>
        <div className="flex items-center justify-center h-40 text-[13px] text-text-muted">
          Nenhum dado de funil no período selecionado.
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...funnel.map((s) => s.count));
  const topCount = funnel[0]?.count || 1;

  const tooltipInfos: TooltipInfo[] = funnel.map((stage, idx) => {
    const pct = topCount > 0 ? (stage.count / topCount) * 100 : 0;
    const prev = funnel[idx - 1];
    const dropPct =
      prev && prev.count > 0
        ? ((prev.count - stage.count) / prev.count) * 100
        : null;
    return { label: stage.label, count: stage.count, pct, dropPct };
  });

  /* Encontrar o gargalo: stage com maior dropPct (excluindo o primeiro) */
  let bottleneckIdx = -1;
  let maxDrop = -Infinity;
  for (let i = 0; i < tooltipInfos.length; i++) {
    const d = tooltipInfos[i].dropPct;
    if (d !== null && d > maxDrop) {
      maxDrop = d;
      bottleneckIdx = i;
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="mb-5">
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
        <p className="text-[12px] text-text-muted mt-0.5">
          Distribuição de leads por etapa — da entrada ao fechamento
        </p>
      </div>

      <div className="flex flex-col gap-2 pb-2">
        {funnel.map((stage, idx) => (
          <FunnelBar
            key={stage.stage}
            stage={stage}
            maxCount={maxCount}
            tooltipInfo={tooltipInfos[idx]}
            index={idx}
            isBottleneck={idx === bottleneckIdx && maxDrop > 10}
          />
        ))}
      </div>

      {/* Resumo de conversão geral */}
      <div className="mt-5 flex items-center gap-6 pt-4 border-t border-border/60">
        <div>
          <p className="text-[11px] text-text-muted">Entrada</p>
          <p className="text-[16px] font-bold text-text-primary tabular-nums">
            {funnel[0]?.count.toLocaleString("pt-BR") ?? 0}
          </p>
        </div>
        <div className="flex-1 h-px bg-border/60" />
        <div className="text-center">
          <p className="text-[11px] text-text-muted">Conversão geral</p>
          <p className="text-[16px] font-bold text-success tabular-nums">
            {topCount > 0
              ? `${(((funnel[funnel.length - 1]?.count ?? 0) / topCount) * 100).toFixed(1)}%`
              : "—"}
          </p>
        </div>
        <div className="flex-1 h-px bg-border/60" />
        <div className="text-right">
          <p className="text-[11px] text-text-muted">Fechados</p>
          <p className="text-[16px] font-bold text-success tabular-nums">
            {(funnel[funnel.length - 1]?.count ?? 0).toLocaleString("pt-BR")}
          </p>
        </div>
      </div>
    </div>
  );
}
