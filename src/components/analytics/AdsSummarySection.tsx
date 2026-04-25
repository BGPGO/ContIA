"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  DollarSign,
  Target,
  BarChart2,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from "recharts";
import type { ProviderAnalyticsData, AdCampaignSummary } from "@/types/analytics";

/* ── Formatadores ── */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR");

function fBRL(v: number): string {
  return BRL.format(v);
}

function fNum(v: number): string {
  return NUM.format(v);
}

function fDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
      new Date(dateStr)
    );
  } catch {
    return dateStr;
  }
}

/* ── Cor dinâmica ROAS ── */
function roasColor(roas: number | null): string {
  if (roas === null) return "text-text-muted";
  if (roas >= 3.0) return "text-success";
  if (roas >= 2.0) return "text-success/80";
  if (roas >= 1.0) return "text-warning";
  return "text-danger";
}

/* ── Status badge de campanha ── */
function CampaignStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const config =
    normalized === "ACTIVE"
      ? { label: "Ativo", color: "bg-success/15 text-success" }
      : normalized === "PAUSED"
      ? { label: "Pausado", color: "bg-warning/15 text-warning" }
      : { label: status, color: "bg-bg-elevated text-text-muted" };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide shrink-0 ${config.color}`}
    >
      {config.label}
    </span>
  );
}

/* ── Delta inline ── */
interface DeltaProps {
  value: number | null;
  inverse?: boolean; // true = menor é melhor (custo por conversão)
}

function Delta({ value, inverse = false }: DeltaProps) {
  if (value === null) return null;

  const positive = inverse ? value < 0 : value > 0;
  const neutral = value === 0;

  if (neutral) {
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-text-muted">
        <Minus size={11} />
        0%
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
        positive ? "text-success" : "text-danger"
      }`}
    >
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

/* ── Mini KPI card ── */
interface MiniCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  deltaInverse?: boolean;
  valueClassName?: string;
}

function MiniCard({ icon, label, value, delta, deltaInverse, valueClassName }: MiniCardProps) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
          {icon}
        </div>
        {delta !== undefined && delta !== null && (
          <Delta value={delta} inverse={deltaInverse} />
        )}
      </div>
      <div>
        <p className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${valueClassName ?? "text-text-primary"}`}>
          {value}
        </p>
        <p className="text-[12px] text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ── Tooltip do mini chart ── */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function SpendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-[11px]">
      <p className="text-text-muted mb-1">{label ? fDate(label) : ""}</p>
      <p className="font-semibold text-text-primary">{fBRL(payload[0].value)}</p>
    </div>
  );
}

/* ── Loading skeleton ── */
function AdsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="h-36 bg-bg-card border border-border rounded-xl" />
      <div className="h-32 bg-bg-card border border-border rounded-xl" />
    </div>
  );
}

/* ── Empty state ── */
function AdsEmpty() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
        <DollarSign size={22} className="text-purple-400" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-text-primary mb-1">
          Sem dados de mídia paga
        </p>
        <p className="text-[13px] text-text-muted max-w-xs mx-auto">
          Conecte o Meta Ads na página de Conexões para ver seus investimentos em anúncios aqui.
        </p>
      </div>
      <Link
        href="/conexoes"
        className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-[13px] font-medium transition-colors"
      >
        Conectar Meta Ads
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

/* ── Linha de campanha ── */
function CampaignRow({ campaign }: { campaign: AdCampaignSummary }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <CampaignStatusBadge status={campaign.status} />
      <span
        className="flex-1 text-[13px] text-text-primary truncate min-w-0"
        title={campaign.name}
      >
        {campaign.name}
      </span>
      <span className="text-[12px] font-medium text-text-secondary tabular-nums shrink-0">
        {fBRL(campaign.spend)}
      </span>
      {campaign.roas !== null ? (
        <span className={`text-[12px] font-semibold tabular-nums shrink-0 ${roasColor(campaign.roas)}`}>
          {campaign.roas.toFixed(1)}×
        </span>
      ) : (
        <span className="text-[12px] text-text-muted shrink-0">—</span>
      )}
    </div>
  );
}

/* ── Props ── */
export interface AdsSummarySectionProps {
  data: ProviderAnalyticsData | null;
  loading: boolean;
  error: string | null;
  hasMetaAdsConnection: boolean;
}

/* ── Componente principal ── */
export function AdsSummarySection({
  data,
  loading,
  error,
  hasMetaAdsConnection,
}: AdsSummarySectionProps) {
  // Se não tem conexão ativa: empty state específico
  if (!hasMetaAdsConnection) {
    return <AdsEmpty />;
  }

  // Loading
  if (loading && !data) {
    return <AdsSkeleton />;
  }

  // Erro
  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-[13px] text-danger">
        Erro ao carregar dados de Meta Ads: {error}
      </div>
    );
  }

  const ads = data?.metaAdsAdvanced;

  if (!ads) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-[13px] text-text-muted">
        Nenhum dado de Meta Ads disponível para o período selecionado.
      </div>
    );
  }

  /* ── KPI deltas via analytics kpis ──
   * Wave 1 expõe: spend, impressions, clicks, ctr, cpc, conversions, roas.
   * NÃO há `cpa` — então computamos o delta de "Custo por conversão"
   * localmente a partir de spend e conversions (current vs previous).
   */
  const kpiMap = Object.fromEntries((data?.kpis ?? []).map((k) => [k.key, k]));
  const spendKpi = kpiMap["spend"];
  const conversionsKpi = kpiMap["conversions"];
  const roasKpi = kpiMap["roas"];

  function computeCpaDeltaPct(): number | null {
    const curSpend = spendKpi?.value ?? null;
    const curConv = conversionsKpi?.value ?? null;
    const prevSpend = spendKpi?.previousValue ?? null;
    const prevConv = conversionsKpi?.previousValue ?? null;
    if (curSpend === null || curConv === null || prevSpend === null || prevConv === null) {
      return null;
    }
    if (curConv <= 0 || prevConv <= 0) return null;
    const curCpa = curSpend / curConv;
    const prevCpa = prevSpend / prevConv;
    if (prevCpa <= 0) return null;
    return Math.round(((curCpa - prevCpa) / prevCpa) * 1000) / 10;
  }
  const cpaDeltaPct = computeCpaDeltaPct();

  /* ── Top 3 campanhas por spend ── */
  const top3 = [...(ads.campaigns ?? [])]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Grid 4 mini cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <MiniCard
            icon={<DollarSign size={16} />}
            label="Investimento total"
            value={fBRL(ads.totalSpend)}
            delta={spendKpi?.deltaPercent ?? null}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
        >
          <MiniCard
            icon={<Target size={16} />}
            label="Conversões"
            value={fNum(ads.totalConversions)}
            delta={conversionsKpi?.deltaPercent ?? null}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
        >
          <MiniCard
            icon={<BarChart2 size={16} />}
            label="ROAS médio"
            value={ads.avgROAS !== null ? `${ads.avgROAS.toFixed(1)}×` : "—"}
            delta={roasKpi?.deltaPercent ?? null}
            valueClassName={roasColor(ads.avgROAS)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18 }}
        >
          <MiniCard
            icon={<Zap size={16} />}
            label="Custo por conversão"
            value={
              ads.totalConversions > 0
                ? fBRL(ads.totalSpend / ads.totalConversions)
                : "—"
            }
            delta={cpaDeltaPct}
            deltaInverse
          />
        </motion.div>
      </div>

      {/* Mini chart de spend */}
      {ads.spendByDay && ads.spendByDay.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="bg-bg-card border border-border rounded-xl p-4"
        >
          <p className="text-[12px] text-text-muted mb-3">Investimento por dia</p>
          <ResponsiveContainer width="100%" height={148}>
            <BarChart
              data={ads.spendByDay}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={fDate}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip content={<SpendTooltip />} cursor={{ fill: "var(--color-bg-elevated)" }} />
              <Bar
                dataKey="spend"
                fill="#a855f7"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Top 3 campanhas */}
      {top3.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.28 }}
          className="bg-bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] font-semibold text-text-primary">Top campanhas</p>
            <span className="text-[11px] text-text-muted">Spend · ROAS</span>
          </div>

          <div className="mt-2">
            {top3.map((c) => (
              <CampaignRow key={c.campaignId} campaign={c} />
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href="/analytics/meta_ads"
              className="inline-flex items-center gap-1 text-[12px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              Ver todas as campanhas
              <ArrowRight size={13} />
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
