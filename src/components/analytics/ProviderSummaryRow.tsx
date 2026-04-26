"use client";

import { motion } from "motion/react";
import {
  ChevronRight,
  Cable,
  Loader,
  Users,
  Heart,
  Eye,
  Image,
  DollarSign,
  MousePointerClick,
  Target,
  TrendingUp,
  Percent,
  Activity,
  UserPlus,
  Clock,
  Camera,
  Share2,
  Play,
  BarChart3,
  Megaphone,
  LayoutTemplate,
  Database,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderSummary, ProviderKPI } from "@/types/analytics";

interface ProviderSummaryRowProps {
  summary: ProviderSummary;
  index: number;
}

/* ── Mapeamento de ícone por nome string → componente Lucide ── */
const ICON_MAP: Record<string, React.ElementType> = {
  "users": Users,
  "heart": Heart,
  "eye": Eye,
  "image": Image,
  "dollar-sign": DollarSign,
  "mouse-pointer-click": MousePointerClick,
  "target": Target,
  "trending-up": TrendingUp,
  "percent": Percent,
  "activity": Activity,
  "user-plus": UserPlus,
  "clock": Clock,
};

/* ── Ícones de logo por provider (lucide names usados em metadata.iconName) ─ */
/* lucide-react não exporta marcas (Instagram/Facebook/etc), usamos proxies. */
const PROVIDER_ICON_MAP: Record<string, React.ElementType> = {
  Instagram: Camera,
  Facebook: Share2,
  Linkedin: Users,
  Youtube: Play,
  BarChart3: BarChart3,
  Megaphone: Megaphone,
  Target: Target,
  LayoutTemplate: LayoutTemplate,
  Database: Database,
};

function ProviderLogo({ iconName, color }: { iconName?: string; color: string }) {
  const Icon: React.ElementType = (iconName ? PROVIDER_ICON_MAP[iconName] : undefined) ?? Globe;
  return <Icon size={14} style={{ color }} />;
}

function KpiIcon({ name }: { name?: string }) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={11} className="text-text-muted/70 shrink-0" />;
}

/* ── Mini-stat (cada KPI dentro do card) ── */
function MiniStat({ kpi }: { kpi: ProviderKPI }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <div className="flex items-center gap-1">
        <KpiIcon name={kpi.icon} />
        <p className="text-[13px] font-semibold text-text-primary tabular-nums leading-tight">
          {kpi.value}
        </p>
      </div>
      <p className="text-[10px] text-text-muted mt-0.5 whitespace-nowrap">{kpi.label}</p>
    </div>
  );
}

/* ── Badge "Atualizado há X" ── */
function LastSyncBadge({ isoStr }: { isoStr: string }) {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  let label: string;
  if (diffMin < 2) label = "Agora";
  else if (diffMin < 60) label = `${diffMin}min atrás`;
  else if (diffH < 24) label = `${diffH}h atrás`;
  else label = `${diffD}d atrás`;

  return (
    <span className="text-[10px] text-text-muted/60 bg-bg-elevated px-1.5 py-0.5 rounded-full shrink-0 hidden sm:block">
      {label}
    </span>
  );
}

export function ProviderSummaryRow({ summary, index }: ProviderSummaryRowProps) {
  const meta = METADATA_BY_PROVIDER[summary.provider];

  /* ── Não conectado ── */
  if (!summary.connected) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-bg-card/50 border border-border/50 opacity-60"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${summary.color}15` }}
        >
          <ProviderLogo iconName={meta.iconName} color={summary.color} />
        </div>
        <span className="text-[13px] text-text-muted flex-1">
          {summary.displayName}
        </span>
        <span className="text-[11px] text-text-muted italic">
          {meta.status === "coming_soon" ? "Em breve" : "Não conectado"}
        </span>
        {meta.status !== "coming_soon" && (
          <Link
            href="/conexoes"
            className="text-[11px] text-accent hover:underline flex items-center gap-1"
          >
            <Cable size={12} />
            Conectar
          </Link>
        )}
      </motion.div>
    );
  }

  /* ── Conectado mas aguardando primeiro sync ── */
  if (summary.awaitingFirstSync) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-bg-card border border-border/60 border-dashed"
      >
        {/* Provider icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${summary.color}20` }}
        >
          <ProviderLogo iconName={meta.iconName} color={summary.color} />
        </div>

        <span className="text-[13px] font-medium text-text-primary min-w-[100px]">
          {summary.displayName}
        </span>

        <div className="flex-1 flex items-center gap-2">
          <Loader size={13} className="text-text-muted animate-spin" />
          <span className="text-[12px] text-text-muted">
            Aguardando primeiro sync
          </span>
        </div>
      </motion.div>
    );
  }

  /* ── Conectado com dados ── */
  // Preferimos monthlyKpis; fallback para kpis legados
  const displayKpis = summary.monthlyKpis.length > 0 ? summary.monthlyKpis : summary.kpis;

  return (
    <Link href={`/analytics/${summary.provider}`}>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        whileHover={{ x: 4 }}
        className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-bg-card border border-border hover:border-border-light hover:bg-bg-card-hover transition-all duration-200 cursor-pointer group"
      >
        {/* Provider icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${summary.color}20` }}
        >
          <ProviderLogo iconName={meta.iconName} color={summary.color} />
        </div>

        {/* Provider name */}
        <span className="text-[13px] font-medium text-text-primary min-w-[100px]">
          {summary.displayName}
        </span>

        {/* KPIs do mês */}
        <div className="flex-1 flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-hide">
          {displayKpis.map((kpi) => (
            <MiniStat key={kpi.label} kpi={kpi} />
          ))}
        </div>

        {/* Badge de última sync */}
        {summary.lastSnapshotAt && (
          <LastSyncBadge isoStr={summary.lastSnapshotAt} />
        )}

        {/* Arrow */}
        <ChevronRight
          size={16}
          className="text-text-muted group-hover:text-accent transition-colors shrink-0"
        />
      </motion.div>
    </Link>
  );
}
