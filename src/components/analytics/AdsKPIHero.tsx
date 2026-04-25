"use client";

import { motion } from "motion/react";
import { DollarSign, TrendingUp, MousePointerClick, Repeat2 } from "lucide-react";

/* ── Types ── */

interface AdsKPIHeroProps {
  totalSpend: number;
  totalSpendDelta?: number | null;
  totalSpendDeltaPct?: number | null;

  avgROAS: number | null;
  avgROASDelta?: number | null;
  avgROASDeltaPct?: number | null;

  totalConversions: number;
  totalConversionsDelta?: number | null;
  totalConversionsDeltaPct?: number | null;

  avgCPC: number;
  avgCPCDelta?: number | null;
  avgCPCDeltaPct?: number | null;
}

/* ── Formatters ── */

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDeltaPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/* ── Delta indicator ── */

interface DeltaChipProps {
  delta?: number | null;
  deltaPercent?: number | null;
  /** true when a decrease is GOOD (e.g., CPC) */
  invertColor?: boolean;
}

function DeltaChip({ delta: _delta, deltaPercent, invertColor = false }: DeltaChipProps) {
  if (deltaPercent === null || deltaPercent === undefined) return null;

  const isPositive = deltaPercent >= 0;
  const isGood = invertColor ? !isPositive : isPositive;

  const colorClass = isGood
    ? "text-success bg-success/10"
    : "text-danger bg-danger/10";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorClass}`}
    >
      {isPositive ? "↑" : "↓"} {formatDeltaPct(Math.abs(deltaPercent))}
    </span>
  );
}

/* ── ROAS color logic ── */

function roasColorClass(roas: number | null): string {
  if (roas === null) return "text-text-muted";
  if (roas >= 2) return "text-success";
  if (roas >= 1) return "text-warning";
  return "text-danger";
}

/* ── Single Hero Card ── */

interface HeroCardProps {
  index: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColorClass?: string;
  delta?: number | null;
  deltaPercent?: number | null;
  invertColor?: boolean;
  hint?: string;
}

function HeroCard({
  index,
  icon,
  label,
  value,
  valueColorClass = "text-text-primary",
  delta,
  deltaPercent,
  invertColor = false,
  hint,
}: HeroCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className="bg-bg-card border border-border rounded-xl p-4 sm:p-5 hover:border-border-light hover:bg-bg-card-hover transition-all duration-200 flex flex-col gap-3"
    >
      {/* Top row: icon + delta */}
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          {icon}
        </div>
        <DeltaChip
          delta={delta}
          deltaPercent={deltaPercent}
          invertColor={invertColor}
        />
      </div>

      {/* Value */}
      <div>
        <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${valueColorClass}`}>
          {value}
        </p>
        <p className="text-[12px] text-text-muted mt-0.5">{label}</p>
        {hint && (
          <p className="text-[10px] text-text-muted/60 mt-0.5">{hint}</p>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main Component ── */

export function AdsKPIHero({
  totalSpend,
  totalSpendDelta,
  totalSpendDeltaPct,
  avgROAS,
  avgROASDelta,
  avgROASDeltaPct,
  totalConversions,
  totalConversionsDelta,
  totalConversionsDeltaPct,
  avgCPC,
  avgCPCDelta,
  avgCPCDeltaPct,
}: AdsKPIHeroProps) {
  const roasDisplay =
    avgROAS !== null ? `${avgROAS.toFixed(1)}×` : "—";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Investimento */}
      <HeroCard
        index={0}
        icon={<DollarSign size={20} className="text-accent" />}
        label="Investimento"
        value={formatBRL(totalSpend)}
        delta={totalSpendDelta}
        deltaPercent={totalSpendDeltaPct}
      />

      {/* ROAS */}
      <HeroCard
        index={1}
        icon={<TrendingUp size={20} className="text-accent" />}
        label="ROAS"
        value={roasDisplay}
        valueColorClass={roasColorClass(avgROAS)}
        delta={avgROASDelta}
        deltaPercent={avgROASDeltaPct}
        hint={
          avgROAS !== null
            ? avgROAS >= 2
              ? "Acima da meta"
              : avgROAS >= 1
              ? "Abaixo da meta"
              : "ROAS negativo"
            : undefined
        }
      />

      {/* Conversoes */}
      <HeroCard
        index={2}
        icon={<Repeat2 size={20} className="text-accent" />}
        label="Conversoes"
        value={totalConversions.toLocaleString("pt-BR")}
        delta={totalConversionsDelta}
        deltaPercent={totalConversionsDeltaPct}
      />

      {/* CPC */}
      <HeroCard
        index={3}
        icon={<MousePointerClick size={20} className="text-accent" />}
        label="CPC Medio"
        value={formatBRL(avgCPC)}
        delta={avgCPCDelta}
        deltaPercent={avgCPCDeltaPct}
        invertColor={true}
        hint="Menor e melhor"
      />
    </div>
  );
}
