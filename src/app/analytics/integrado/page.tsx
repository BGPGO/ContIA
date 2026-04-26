"use client";

import React, { Suspense, useMemo } from "react";
import { motion } from "motion/react";
import {
  GitMerge,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Users,
  Trophy,
  TrendingUp,
  Percent,
  Target,
  Megaphone,
  Camera,
  Globe,
  BarChart3,
  ExternalLink,
  Plug,
} from "lucide-react";
import Link from "next/link";

import { useEmpresa } from "@/hooks/useEmpresa";
import { usePeriodSelector } from "@/hooks/usePeriodSelector";
import { useAttribution } from "@/hooks/useAttribution";
import { PeriodSelector } from "@/components/insights/PeriodSelector";
import { StrategicInsightsCard } from "@/components/insights/StrategicInsightsCard";
import { SectionHeader } from "@/components/insights/SectionHeader";

import type { ChannelROI, CampaignAttribution } from "@/types/attribution";

/* ── Imports dos componentes Delta (Wave 2) ───────────────────────── */
import { SankeyAttribution } from "@/components/analytics/SankeyAttribution";
import { CrossChannelROITable } from "@/components/analytics/CrossChannelROITable";
import { EndToEndFunnel } from "@/components/analytics/EndToEndFunnel";
import { CreativeROIGrid } from "@/components/analytics/CreativeROIGrid";

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtNum(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(v);
}

function fmtPct(v: number, decimals = 1): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* ── Skeleton ────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse p-4 md:p-6">
      {/* Header skeleton */}
      <div className="h-10 bg-bg-elevated rounded-xl w-2/3" />
      {/* Hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-bg-elevated rounded-xl" />
        ))}
      </div>
      {/* Sections */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-48 bg-bg-elevated rounded-xl" />
      ))}
    </div>
  );
}

/* ── Hero KPI Card ───────────────────────────────────────────────── */

interface HeroCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean | null;
  accent?: "green" | "yellow" | "red" | "blue" | "default";
}

function HeroCard({ icon, label, value, delta, deltaPositive, accent = "default" }: HeroCardProps) {
  const borderMap: Record<string, string> = {
    green: "border-emerald-500/30",
    yellow: "border-amber-400/30",
    red: "border-red-500/30",
    blue: "border-blue-400/30",
    default: "border-border",
  };
  const bgMap: Record<string, string> = {
    green: "bg-emerald-500/10",
    yellow: "bg-amber-400/10",
    red: "bg-red-500/10",
    blue: "bg-blue-400/10",
    default: "bg-bg-card",
  };

  return (
    <div
      className={`flex flex-col gap-2 p-4 rounded-xl border ${borderMap[accent]} ${bgMap[accent]} transition-all duration-200`}
    >
      <div className="flex items-center gap-2 text-text-muted">{icon}</div>
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider truncate">
        {label}
      </p>
      <p className="text-[22px] font-bold text-text-primary leading-none">{value}</p>
      {delta !== undefined && (
        <p
          className={`text-[11px] font-medium ${
            deltaPositive === true
              ? "text-emerald-400"
              : deltaPositive === false
              ? "text-red-400"
              : "text-text-muted"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

/* ── Channel ROI Card ────────────────────────────────────────────── */

interface ChannelROICardProps {
  channel: ChannelROI;
  isBest: boolean;
}

function channelIcon(source: string): React.ReactNode {
  switch (source) {
    case "meta_ads":
      return <Target className="w-4 h-4" />;
    case "google_ads":
      return <Megaphone className="w-4 h-4" />;
    case "instagram":
      return <Camera className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

function channelLabel(source: string): string {
  const MAP: Record<string, string> = {
    meta_ads: "Meta Ads",
    google_ads: "Google Ads",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    google: "Google Orgânico",
    direto: "Direto",
    referral: "Referral",
    outro: "Outros",
  };
  return MAP[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

function ChannelROICard({ channel, isBest }: ChannelROICardProps) {
  const roas = channel.roas ?? 0;
  // Bar: max 5x ROAS = 100%
  const barPct = Math.min((roas / 5) * 100, 100);
  const barColor =
    roas >= 3
      ? "bg-emerald-500"
      : roas >= 1
      ? "bg-amber-400"
      : "bg-red-500";

  return (
    <div className="relative flex flex-col gap-3 p-4 rounded-xl bg-bg-card border border-border hover:border-border/80 transition-all duration-200">
      {isBest && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          Maior ROI
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-muted">
          {channelIcon(channel.source)}
        </span>
        <span className="text-[13px] font-semibold text-text-primary">
          {channelLabel(channel.source)}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-bold text-text-primary">{fmtNum(channel.leads)}</span>
          <span className="text-[10px] text-text-muted">Leads</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-bold text-text-primary">{fmtNum(channel.dealsWon)}</span>
          <span className="text-[10px] text-text-muted">Vendas</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-bold text-text-primary">{fmtBRL(channel.revenue)}</span>
          <span className="text-[10px] text-text-muted">Receita</span>
        </div>
      </div>

      {/* ROAS bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-text-muted">ROAS</span>
          <span
            className={`text-[11px] font-bold ${
              roas >= 3 ? "text-emerald-400" : roas >= 1 ? "text-amber-400" : "text-red-400"
            }`}
          >
            {channel.spend ? `${roas.toFixed(1)}x` : "—"}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-700`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Empty States ────────────────────────────────────────────────── */

/** Estado vazio completo: sem leads E sem spend */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-20 text-center px-4 rounded-xl bg-bg-card border border-border"
    >
      <div className="w-14 h-14 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
        <BarChart3 className="w-7 h-7 text-text-muted" />
      </div>
      <p className="text-[16px] font-semibold text-text-primary mb-1">Sem dados ainda</p>
      <p className="text-[13px] text-text-muted max-w-xs leading-relaxed mb-6">
        Conecte o CRM, Meta Ads e configure UTMs para ver a jornada cruzada completa.
      </p>
      <Link
        href="/setup"
        className="px-4 py-2 rounded-xl bg-accent text-bg-primary text-[13px] font-semibold hover:opacity-90 transition-opacity"
      >
        Ir para Setup
      </Link>
    </motion.div>
  );
}

/** Tem leads mas sem gasto: falta conectar Meta Ads */
function EmptyStateNoSpend() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center px-4 rounded-xl bg-bg-card border border-border"
    >
      <div className="w-14 h-14 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
        <Plug className="w-7 h-7 text-text-muted" />
      </div>
      <p className="text-[16px] font-semibold text-text-primary mb-1">Leads detectados, gasto não rastreado</p>
      <p className="text-[13px] text-text-muted max-w-sm leading-relaxed mb-6">
        Conecte o Meta Ads para cruzar investimento com leads do CRM e ver ROAS, CAC e atribuição real.
      </p>
      <Link
        href="/conexoes"
        className="px-4 py-2 rounded-xl bg-accent text-bg-primary text-[13px] font-semibold hover:opacity-90 transition-opacity"
      >
        Conectar Meta Ads
      </Link>
    </motion.div>
  );
}

/** Tem gasto mas sem leads: falta CRM + UTMs */
function EmptyStateNoLeads() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center px-4 rounded-xl bg-bg-card border border-border"
    >
      <div className="w-14 h-14 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-text-muted" />
      </div>
      <p className="text-[16px] font-semibold text-text-primary mb-1">Gasto detectado, leads não rastreados</p>
      <p className="text-[13px] text-text-muted max-w-sm leading-relaxed mb-6">
        Conecte o CRM e configure UTMs nos anúncios para ver quais campanhas geram leads e deals reais.
      </p>
      <Link
        href="/setup"
        className="px-4 py-2 rounded-xl bg-accent text-bg-primary text-[13px] font-semibold hover:opacity-90 transition-opacity"
      >
        Configurar UTMs
      </Link>
    </motion.div>
  );
}

/* ── Match Rate Warning ───────────────────────────────────────────── */

function MatchRateWarning({ matchRate }: { matchRate: number }) {
  if (matchRate >= 0.7) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 rounded-xl bg-amber-400/10 border border-amber-400/30"
    >
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[13px] text-amber-300 leading-relaxed">
        <strong>{fmtPct(matchRate)}</strong> dos leads chegaram com UTM rastreável e
        cruzando com campanhas Meta. Acima de 70% indica tracking saudável.
      </p>
    </motion.div>
  );
}

/* ── Mega-card: Campanha #1 ──────────────────────────────────────── */

interface TopCampaignCardProps {
  campaign: CampaignAttribution;
}

function TopCampaignCard({ campaign }: TopCampaignCardProps) {
  const metaUrl = campaign.metaCampaignId
    ? `https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.metaCampaignId}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-bg-card to-bg-card p-5"
    >
      {/* Subtle glow background */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/8 blur-2xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Badge + título */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
              Campanha de melhor performance
            </p>
            <p
              className="text-[15px] font-bold text-text-primary truncate max-w-[420px]"
              title={campaign.campaignName}
            >
              {campaign.campaignName}
            </p>
          </div>
        </div>

        {/* KPIs inline */}
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {campaign.roas !== null && (
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-bold text-emerald-400 leading-none">
                {campaign.roas.toFixed(1)}x
              </span>
              <span className="text-[10px] text-text-muted mt-0.5">ROAS</span>
            </div>
          )}
          {campaign.cac !== null && (
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-bold text-text-primary leading-none">
                {fmtBRL(campaign.cac)}
              </span>
              <span className="text-[10px] text-text-muted mt-0.5">CAC</span>
            </div>
          )}
          <div className="flex flex-col items-center">
            <span className="text-[18px] font-bold text-text-primary leading-none">
              {fmtNum(campaign.crmDealsWon)}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">Vendas</span>
          </div>
          {campaign.crmRevenue > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-bold text-text-primary leading-none">
                {fmtBRL(campaign.crmRevenue)}
              </span>
              <span className="text-[10px] text-text-muted mt-0.5">Receita</span>
            </div>
          )}

          {/* CTA */}
          {metaUrl && (
            <a
              href={metaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/25 transition-all duration-200"
            >
              Ver no Meta Ads
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

function IntegradoPage() {
  const { empresa } = useEmpresa();
  const { preset, range, previousRange, setPreset, setCustomRange, label } = usePeriodSelector();

  const periodStart = toISODate(range.start);
  const periodEnd = toISODate(range.end);

  const { data, loading, error, refresh } = useAttribution(
    empresa?.id,
    periodStart,
    periodEnd,
    true
  );

  /* ── Sort channel ROI by ROAS desc, canais com spend primeiro ── */
  const sortedChannels = useMemo(() => {
    if (!data) return [];
    return [...data.channelROI].sort((a, b) => {
      const aHasSpend = a.spend !== null && a.spend > 0;
      const bHasSpend = b.spend !== null && b.spend > 0;
      if (aHasSpend && !bHasSpend) return -1;
      if (!aHasSpend && bHasSpend) return 1;
      const aRoas = a.roas ?? 0;
      const bRoas = b.roas ?? 0;
      return bRoas - aRoas;
    });
  }, [data]);

  const bestChannelSource = sortedChannels[0]?.source ?? null;

  /* ── Campanha de melhor ROAS (para mega-card) ── */
  const topCampaign = useMemo<CampaignAttribution | null>(() => {
    if (!data) return null;
    const candidates = data.campaignAttribution
      .filter((c) => c.matched && c.roas !== null)
      .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
    return candidates[0] ?? null;
  }, [data]);

  /* ── Delta KPIs for hero cards ── */
  const prevPeriodStart = toISODate(previousRange.start);
  const prevPeriodEnd = toISODate(previousRange.end);

  const { data: prevData } = useAttribution(
    empresa?.id,
    prevPeriodStart,
    prevPeriodEnd,
    !!empresa?.id
  );

  function calcDelta(curr: number, prev: number | undefined): string | undefined {
    if (prev === undefined || prev === 0) return undefined;
    const pct = ((curr - prev) / prev) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}% vs período anterior`;
  }

  function isPositiveDelta(curr: number, prev: number | undefined): boolean | null {
    if (prev === undefined) return null;
    return curr >= prev;
  }

  /* ── ROAS card accent ── */
  function roasAccent(roas: number | null): "green" | "yellow" | "red" | "default" {
    if (roas === null) return "default";
    if (roas >= 3) return "green";
    if (roas >= 1) return "yellow";
    return "red";
  }

  /* ── Loading ── */
  if (loading && !data) {
    return <PageSkeleton />;
  }

  /* ── Error ── */
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <AlertTriangle className="w-8 h-8 text-danger mb-3" />
        <p className="text-[14px] text-danger font-medium">Erro ao carregar dados</p>
        <p className="text-[12px] text-text-muted mt-1 mb-4">{error}</p>
        <button
          onClick={() => refresh(true)}
          className="px-4 py-2 rounded-xl bg-accent text-bg-primary text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const totals = data?.totals;

  /* ── Empty state logic ── */
  const hasLeads = (totals?.leads ?? 0) > 0;
  const hasSpend = (totals?.spend ?? 0) > 0;
  const isEmpty = !hasLeads && !hasSpend;
  const onlyLeads = hasLeads && !hasSpend;
  const onlySpend = !hasLeads && hasSpend;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto">

      {/* ── 1. HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 * 0.07 }}
        className="flex flex-col sm:flex-row sm:items-start gap-4"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4ecdc4]/20 to-[#6c5ce7]/20 border border-[#4ecdc4]/20 flex items-center justify-center shrink-0">
            <GitMerge className="w-5 h-5 text-[#4ecdc4]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-text-primary leading-tight">
              Visão Integrada
            </h1>
            <p className="text-[13px] text-text-muted">
              ROI real cruzando Meta Ads, Instagram e CRM
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <PeriodSelector
            preset={preset}
            onPresetChange={setPreset}
            onCustomRange={setCustomRange}
            label={label}
          />
          <button
            onClick={() => refresh(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-elevated border border-border text-[13px] text-text-secondary hover:text-text-primary hover:border-border/60 transition-all duration-200 disabled:opacity-50"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </motion.div>

      {/* ── 2. MATCH RATE WARNING ── */}
      {totals && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 * 0.07 }}
        >
          <MatchRateWarning matchRate={totals.matchRate} />
        </motion.div>
      )}

      {/* ── 3. MEGA-CARD CAMPANHA #1 ── */}
      {topCampaign && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 * 0.07 }}
        >
          <TopCampaignCard campaign={topCampaign} />
        </motion.div>
      )}

      {/* ── EMPTY STATES ── */}
      {data && totals && isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 * 0.07 }}
        >
          <EmptyState />
        </motion.div>
      )}
      {data && totals && onlyLeads && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 * 0.07 }}
        >
          <EmptyStateNoSpend />
        </motion.div>
      )}
      {data && totals && onlySpend && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 * 0.07 }}
        >
          <EmptyStateNoLeads />
        </motion.div>
      )}

      {/* ── 4. STRATEGIC INSIGHTS ── */}
      {data && data.insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 * 0.07 }}
        >
          <StrategicInsightsCard
            insights={data.insights}
            title="Insights Estratégicos"
            subtitle="Padrões detectados no cruzamento Meta Ads × Instagram × CRM"
          />
        </motion.div>
      )}

      {/* ── 5. HERO KPIs (6 cards) ── */}
      {totals && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3 * 0.07 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3"
        >
          {/* Investimento — gasto maior é neutro (não é bom nem ruim por si só) */}
          <HeroCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Investimento"
            value={fmtBRL(totals.spend)}
            delta={calcDelta(totals.spend, prevData?.totals.spend)}
            deltaPositive={null} // gasto maior não é bom nem ruim — sempre cinza neutro
            accent="default"
          />
          <HeroCard
            icon={<Users className="w-4 h-4" />}
            label="Leads"
            value={fmtNum(totals.leads)}
            delta={calcDelta(totals.leads, prevData?.totals.leads)}
            deltaPositive={isPositiveDelta(totals.leads, prevData?.totals.leads)}
          />
          <HeroCard
            icon={<Trophy className="w-4 h-4" />}
            label="Vendas"
            value={fmtNum(totals.dealsWon)}
            delta={calcDelta(totals.dealsWon, prevData?.totals.dealsWon)}
            deltaPositive={isPositiveDelta(totals.dealsWon, prevData?.totals.dealsWon)}
          />
          <HeroCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Receita"
            value={fmtBRL(totals.revenue)}
            delta={calcDelta(totals.revenue, prevData?.totals.revenue)}
            deltaPositive={isPositiveDelta(totals.revenue, prevData?.totals.revenue)}
          />
          <HeroCard
            icon={<Percent className="w-4 h-4" />}
            label="CAC"
            value={totals.cac !== null ? fmtBRL(totals.cac) : "—"}
            delta={
              totals.cac !== null && prevData?.totals.cac !== null && prevData?.totals.cac !== undefined
                ? calcDelta(totals.cac, prevData.totals.cac)
                : undefined
            }
            // Lower CAC is better
            deltaPositive={
              totals.cac !== null && prevData?.totals.cac != null
                ? totals.cac <= prevData.totals.cac
                : null
            }
          />
          <HeroCard
            icon={<GitMerge className="w-4 h-4" />}
            label="ROAS"
            value={totals.roas !== null ? `${totals.roas.toFixed(1)}x` : "—"}
            delta={
              totals.roas !== null && prevData?.totals.roas != null
                ? calcDelta(totals.roas, prevData.totals.roas)
                : undefined
            }
            deltaPositive={
              totals.roas !== null && prevData?.totals.roas != null
                ? totals.roas >= prevData.totals.roas
                : null
            }
            accent={roasAccent(totals.roas)}
          />
        </motion.div>
      )}

      {/* ── 6. CAMPANHAS (subiu — conteúdo mais importante) ── */}
      {data && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 4 * 0.07 }}
        >
          <SectionHeader
            title="Performance por Campanha"
            subtitle="Spend Meta vs Leads CRM vs Receita real"
          />
          <CrossChannelROITable campaigns={data.campaignAttribution} />
        </motion.section>
      )}

      {/* ── 7. FUNIL END-TO-END ── */}
      {data && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 5 * 0.07 }}
        >
          <SectionHeader
            title="Funil End-to-End"
            subtitle="Do lead inicial até a venda fechada"
          />
          <EndToEndFunnel
            stages={data.funnelEndToEnd}
            totalRevenue={data.totals.revenue}
          />
        </motion.section>
      )}

      {/* ── 8. ROI POR CANAL ── */}
      {data && sortedChannels.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 6 * 0.07 }}
        >
          <SectionHeader
            title="ROI por Canal"
            subtitle="Qual canal te dá o melhor retorno?"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedChannels.map((ch) => (
              <ChannelROICard
                key={`${ch.source}_${ch.medium ?? "none"}`}
                channel={ch}
                isBest={ch.source === bestChannelSource}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* ── 9. FLUXO DE CANAIS (ex-Sankey — rebrand honesto) ── */}
      {data && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 7 * 0.07 }}
        >
          <SectionHeader
            title="Fluxo de Canais"
            subtitle="Como cada canal alimenta as etapas do funil até o resultado"
          />
          <SankeyAttribution
            channelROI={data.channelROI}
            funnel={data.funnelEndToEnd}
            totalRevenue={data.totals.revenue}
            title="Fluxo de Canais"
          />
        </motion.section>
      )}

      {/* ── 10. CRIATIVOS ── */}
      {data && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 8 * 0.07 }}
        >
          <SectionHeader
            title="Criativos que Convertem"
            subtitle="Quais criativos geram mais leads e deals"
          />
          <CreativeROIGrid
            creatives={data.creativePerformance}
            topIGPosts={data.topIGPosts}
          />
        </motion.section>
      )}
    </div>
  );
}

/* ── Error Boundary ─────────────────────────────────────────────── */

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[/analytics/integrado] crash:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 max-w-2xl mx-auto">
          <AlertTriangle className="w-8 h-8 text-danger mb-3" />
          <p className="text-[14px] text-danger font-medium mb-2">
            Erro ao renderizar a tela
          </p>
          <p className="text-[12px] text-text-muted mb-2">
            Detalhes técnicos (mande pro suporte):
          </p>
          <pre className="text-[11px] text-text-muted bg-bg-card border border-border rounded-lg p-3 max-w-full overflow-auto whitespace-pre-wrap break-words text-left">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack?.split("\n").slice(0, 6).join("\n")}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 rounded-xl bg-accent text-bg-primary text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Export with Suspense + ErrorBoundary ─────────────────────── */

export default function IntegradoPageWrapper() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <IntegradoPage />
      </Suspense>
    </ErrorBoundary>
  );
}
