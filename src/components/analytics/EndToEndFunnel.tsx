"use client";

import { useState } from "react";
import { Filter, Trophy, AlertCircle } from "lucide-react";
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

/* ── Color ramp: azul-royal → teal → verde ── */

function stageGradient(index: number, total: number): { fill: string; text: string } {
  // Mapeamento de posição 0..1 → cor
  const progress = total > 1 ? index / (total - 1) : 0;

  // Paleta: #3b82f6 (azul) → #0ea5e9 (sky) → #10b981 (emerald)
  let r: number, g: number, b: number;
  if (progress < 0.5) {
    const t = progress / 0.5;
    r = Math.round(59 + (14 - 59) * t);   // 59→14
    g = Math.round(130 + (165 - 130) * t); // 130→165
    b = Math.round(246 + (233 - 246) * t); // 246→233
  } else {
    const t = (progress - 0.5) / 0.5;
    r = Math.round(14 + (16 - 14) * t);   // 14→16
    g = Math.round(165 + (185 - 165) * t); // 165→185
    b = Math.round(233 + (129 - 233) * t); // 233→129
  }
  return {
    fill: `rgb(${r},${g},${b})`,
    text: "white",
  };
}

/* ── Tooltip flutuante ── */

interface TooltipState {
  stage: FunnelEndToEndStage;
  color: string;
  x: number;
  y: number;
}

function FunnelTooltip({ tip }: { tip: TooltipState }) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: tip.x + 12, top: tip.y - 10 }}
    >
      <div className="bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-[11px] min-w-[200px]">
        <p className="font-bold text-[13px] mb-2" style={{ color: tip.color }}>
          {tip.stage.label}
        </p>
        <div className="flex flex-col gap-1.5">
          <Row label="Volume" value={`${tip.stage.count.toLocaleString("pt-BR")} leads`} />
          {tip.stage.conversionFromTop != null && (
            <Row label="% do topo" value={formatPct(tip.stage.conversionFromTop)} />
          )}
          {tip.stage.conversionFromPrev != null && (
            <Row
              label="Conv. do anterior"
              value={formatPct(tip.stage.conversionFromPrev)}
              highlight
            />
          )}
          {tip.stage.valueSum != null && tip.stage.valueSum > 0 && (
            <Row label="Receita" value={formatBRL(tip.stage.valueSum)} highlight />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-white/50">{label}</span>
      <span className={`font-semibold tabular-nums ${highlight ? "text-emerald-400" : "text-white/80"}`}>
        {value}
      </span>
    </div>
  );
}

/* ── Pirâmide invertida (div-based) ── */

interface PyramidSliceProps {
  stage: FunnelEndToEndStage;
  widthPct: number;
  color: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onHover: (e: React.MouseEvent, stage: FunnelEndToEndStage | null, color: string) => void;
}

function PyramidSlice({
  stage,
  widthPct,
  color,
  index,
  isFirst,
  isLast,
  onHover,
}: PyramidSliceProps) {
  // Cada "fatia" é um div centrado com largura proporcional + clip-path trapézio
  // Topo mais largo, base um pouco mais estreita para simular funil
  const nextWidthDelta = 3; // Diferença de clip em % para criar o efeito trapezoidal

  const clipTop = isFirst ? 0 : nextWidthDelta;
  const clipBottom = isLast ? 0 : nextWidthDelta;

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer transition-all duration-200"
      style={{
        width: `${widthPct}%`,
        height: "52px",
        backgroundColor: color,
        clipPath: `polygon(${clipTop}% 0%, ${100 - clipTop}% 0%, ${100 - clipBottom}% 100%, ${clipBottom}% 100%)`,
        opacity: 0.9,
        animationDelay: `${index * 60}ms`,
        animationFillMode: "both",
      }}
      onMouseEnter={(e) => onHover(e, stage, color)}
      onMouseLeave={(e) => onHover(e, null, color)}
    >
      {/* Shimmer overlay on hover */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)",
        }}
      />
      {/* Conteúdo da fatia */}
      <div className="relative flex items-center gap-2 px-4 z-10 select-none">
        <span className="text-white font-bold text-[14px] tabular-nums drop-shadow">
          {stage.count.toLocaleString("pt-BR")}
        </span>
        {stage.stage === "won" && (
          <Trophy size={13} className="text-white/80 shrink-0" />
        )}
        <span className="text-white/75 text-[11px] font-medium hidden sm:inline truncate max-w-[120px]">
          {stage.label}
        </span>
      </div>
    </div>
  );
}

/* ── Seta de conversão entre etapas ── */

function ConversionArrow({
  conversionFromPrev,
  index,
}: {
  conversionFromPrev: number | undefined;
  index: number;
}) {
  if (conversionFromPrev == null) return null;
  const pct = conversionFromPrev * 100;
  const isGood = pct >= 50;
  const color = isGood ? "#34d399" : pct >= 25 ? "#fbbf24" : "#f87171";

  return (
    <div
      className="flex items-center justify-center gap-2 text-[10px] font-semibold py-0.5"
      style={{ animationDelay: `${index * 60 + 30}ms` }}
    >
      <div className="h-px w-8 bg-white/10" />
      <span style={{ color }} className="tabular-nums whitespace-nowrap">
        ↓ {pct.toFixed(1)}% avançaram
      </span>
      <div className="h-px w-8 bg-white/10" />
    </div>
  );
}

/* ── Mobile: lista vertical ── */

function MobileStageRow({
  stage,
  topCount,
  color,
  index,
}: {
  stage: FunnelEndToEndStage;
  topCount: number;
  color: string;
  index: number;
}) {
  const barPct = topCount > 0 ? Math.max(8, (stage.count / topCount) * 100) : 8;
  return (
    <div className="flex flex-col gap-1" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/50 w-[90px] shrink-0 truncate">{stage.label}</span>
        <div className="flex-1 h-7 bg-white/5 rounded overflow-hidden">
          <div
            className="h-full rounded flex items-center px-2 transition-all duration-700"
            style={{ width: `${barPct}%`, backgroundColor: color }}
          >
            <span className="text-white text-[10px] font-bold tabular-nums whitespace-nowrap">
              {stage.count.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
        {stage.conversionFromTop != null && (
          <span className="text-[10px] text-white/40 tabular-nums w-[36px] text-right shrink-0">
            {formatPct(stage.conversionFromTop)}
          </span>
        )}
      </div>
      {stage.conversionFromPrev != null && (
        <div className="pl-[98px] text-[10px] text-white/30">
          ↓ {formatPct(stage.conversionFromPrev)} do anterior
        </div>
      )}
    </div>
  );
}

/* ── Empty state ── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Filter size={20} className="text-white/30" />
      </div>
      <p className="text-[14px] font-semibold text-white/60">Aguardando dados do CRM</p>
      <p className="text-[12px] text-white/30 max-w-[240px] leading-relaxed">
        Conecte o CRM BGPGO para visualizar o funil de conversão completo.
      </p>
    </div>
  );
}

/* ── Main ── */

export function EndToEndFunnel({
  stages,
  totalRevenue = 0,
  title = "Funil Ponta a Ponta",
}: EndToEndFunnelProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Separar lost do fluxo principal
  const mainStages = stages.filter((s) => !s.isLost);
  const lostStage = stages.find((s) => s.isLost);

  const isEmpty = stages.length === 0 || stages.every((s) => s.count === 0);

  if (isEmpty) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-white/40" />
          <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
        </div>
        <EmptyState />
      </div>
    );
  }

  const topCount = mainStages[0]?.count ?? 1;
  const wonStage = mainStages.find((s) => s.stage === "won");
  const overallConv = wonStage && topCount > 0 ? (wonStage.count / topCount) * 100 : null;
  const total = mainStages.length;

  function handleHover(
    e: React.MouseEvent,
    stage: FunnelEndToEndStage | null,
    color: string
  ) {
    if (!stage) {
      setTooltip(null);
      return;
    }
    setTooltip({ stage, color, x: e.clientX, y: e.clientY });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (tooltip) {
      setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  }

  return (
    <div
      className="bg-bg-card border border-border rounded-xl p-5 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
          <p className="text-[12px] text-text-muted mt-0.5">
            Do lead inicial até a venda fechada
          </p>
        </div>
        {overallConv !== null && (
          <div className="text-right shrink-0">
            <p className="text-[11px] text-text-muted">Conversão geral</p>
            <p className="text-[20px] font-bold text-emerald-400 tabular-nums leading-tight">
              {overallConv.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* ── Desktop: pirâmide invertida centrada ── */}
      <div className="hidden sm:flex flex-col items-center gap-0 py-2">
        {mainStages.map((stage, idx) => {
          const { fill } = stageGradient(idx, total);
          // Largura proporcional ao count cumulativo
          // Primeiro estágio = 100%, último = min 12%
          const pct = Math.max(12, (stage.count / topCount) * 100);

          return (
            <div key={stage.stage} className="w-full flex flex-col items-center">
              <PyramidSlice
                stage={stage}
                widthPct={pct}
                color={fill}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === total - 1}
                onHover={handleHover}
              />
              {idx < total - 1 && (
                <ConversionArrow
                  conversionFromPrev={mainStages[idx + 1]?.conversionFromPrev}
                  index={idx}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile: barras horizontais ── */}
      <div className="flex sm:hidden flex-col gap-2 py-2">
        {mainStages.map((stage, idx) => {
          const { fill } = stageGradient(idx, total);
          return (
            <MobileStageRow
              key={stage.stage}
              stage={stage}
              topCount={topCount}
              color={fill}
              index={idx}
            />
          );
        })}
      </div>

      {/* ── Estágio Lost — barra separada, vermelha ── */}
      {lostStage && lostStage.count > 0 && (
        <div className="mt-5 pt-5 border-t border-white/8">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <span className="text-[12px] text-white/50 font-medium">Perdidos</span>
          </div>
          <div className="h-8 bg-white/5 rounded overflow-hidden">
            <div
              className="h-full rounded flex items-center px-3 gap-2 transition-all duration-700"
              style={{
                width: `${Math.max(8, (lostStage.count / topCount) * 100)}%`,
                backgroundColor: "#ef4444",
                opacity: 0.75,
              }}
            >
              <span className="text-white font-bold text-[12px] tabular-nums whitespace-nowrap">
                {lostStage.count.toLocaleString("pt-BR")}
              </span>
              <span className="text-white/70 text-[11px] hidden sm:inline">{lostStage.label}</span>
            </div>
          </div>
          {lostStage.conversionFromTop != null && (
            <p className="text-[10px] text-white/30 mt-1 pl-1">
              {formatPct(lostStage.conversionFromTop)} do total de leads
            </p>
          )}
        </div>
      )}

      {/* ── Footer: KPIs resumo ── */}
      <div className="mt-5 pt-4 border-t border-white/8 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] text-text-muted">Entrada</p>
          <p className="text-[18px] font-bold text-text-primary tabular-nums leading-tight">
            {topCount.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-text-muted">leads únicos</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-text-muted">Vendas</p>
          <p className="text-[18px] font-bold text-emerald-400 tabular-nums leading-tight">
            {(wonStage?.count ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-text-muted">fechamentos</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-text-muted">Receita</p>
          <p className="text-[16px] font-bold text-emerald-400 tabular-nums leading-tight">
            {formatBRL(wonStage?.valueSum ?? totalRevenue)}
          </p>
        </div>
      </div>

      {/* Tooltip flutuante */}
      {tooltip && <FunnelTooltip tip={tooltip} />}
    </div>
  );
}
