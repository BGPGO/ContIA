"use client";

/**
 * AgencyReportView — visualização web do Relatório Agência
 * Wave 3, Squad G
 *
 * Recebe AgencyReportData + AgencyReportAnalysis e renderiza:
 *  - Hero com KPIs do panorama
 *  - Tabs: Panorama / Instagram / Facebook / Meta Ads
 *  - Cada tab: narrativa + KPIs + tabelas + recomendações
 *  - Botão "Baixar PDF"
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  Image,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Megaphone,
  Users,
  Eye,
  Heart,
  DollarSign,
  Target,
  MousePointerClick,
  Star,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react";

// Platform icon aliases — semantically meaningful
const Instagram = Image;  // Instagram = conteúdo visual / fotos
const Facebook = Globe;   // Facebook = rede social global
import { formatNumber } from "@/lib/utils";
import type { AgencyReportData, KpiValue, AgencyRecommendation } from "@/types/agency-report";
import type { AgencyReportAnalysis } from "@/lib/ai/agency-report-generator";

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmt(d: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function fmtKpi(kv: KpiValue): string {
  const v = kv.value;
  if (v === null) return "—";
  switch (kv.format) {
    case "percent":
      return `${v.toFixed(2)}%`;
    case "currency_brl":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(v);
    case "decimal":
      return v.toFixed(2);
    default:
      return formatNumber(Math.round(v));
  }
}

function Delta({ kv }: { kv: KpiValue }) {
  if (kv.deltaPercent === null) return null;
  const pct = kv.deltaPercent * 100;
  if (kv.trend === "up")
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-emerald-400 font-medium">
        <TrendingUp size={11} />
        {pct.toFixed(1)}%
      </span>
    );
  if (kv.trend === "down")
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-red-400 font-medium">
        <TrendingDown size={11} />
        {Math.abs(pct).toFixed(1)}%
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-[11px] text-text-muted font-medium">
      <Minus size={11} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function KpiCard({
  label,
  kv,
  icon: Icon,
}: {
  label: string;
  kv: KpiValue;
  icon: React.FC<{ size?: number; className?: string }>;
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-accent" />
        </div>
        <span className="text-[11px] text-text-muted uppercase tracking-wide leading-tight">
          {label}
        </span>
      </div>
      <p className="text-[20px] font-bold text-text-primary tracking-tight">
        {fmtKpi(kv)}
      </p>
      <Delta kv={kv} />
    </div>
  );
}

function NarrativeBlock({ text }: { text: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Info size={14} className="text-accent" />
        <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
          Análise IA
        </span>
      </div>
      <p className="text-[14px] text-text-secondary leading-relaxed whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

function RecommendationsList({
  recs,
}: {
  recs: AgencyRecommendation[];
}) {
  if (!recs || recs.length === 0) return null;

  const colors: Record<AgencyRecommendation["priority"], string> = {
    high: "text-red-400 bg-red-400/10",
    medium: "text-amber-400 bg-amber-400/10",
    low: "text-emerald-400 bg-emerald-400/10",
  };
  const labels: Record<AgencyRecommendation["priority"], string> = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={14} className="text-accent" />
        <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
          Recomendações
        </span>
      </div>
      <div className="space-y-3">
        {recs.map((rec, i) => (
          <div
            key={i}
            className="border border-border rounded-xl p-4 bg-bg-elevated/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-text-primary">
                  {rec.action}
                </p>
                <p className="text-[12px] text-text-secondary mt-1">
                  {rec.rationale}
                </p>
                {rec.estimatedImpact && (
                  <p className="text-[11px] text-accent mt-1.5">
                    Impacto: {rec.estimatedImpact}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${colors[rec.priority]}`}
              >
                {labels[rec.priority]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab: Panorama ───────────────────────────────────────────────────────── */

function PanoramaTab({
  data,
  analysis,
}: {
  data: AgencyReportData["panorama"];
  analysis: AgencyReportAnalysis["panorama"] | undefined;
}) {
  return (
    <div className="space-y-5">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Alcance total" kv={data.totalReach} icon={Eye} />
        <KpiCard label="Engajamento" kv={data.totalEngagement} icon={Heart} />
        <KpiCard label="Investimento" kv={data.totalSpend} icon={DollarSign} />
        <KpiCard label="Leads" kv={data.totalLeads} icon={Target} />
        <KpiCard label="Custo por Lead" kv={data.costPerLead} icon={MousePointerClick} />
      </div>

      {/* Por rede */}
      {data.byNetwork && data.byNetwork.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-accent" />
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
              Por rede social
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {data.byNetwork.map((net) => (
              <div
                key={net.provider}
                className="flex items-center justify-between py-3"
              >
                <span className="text-[13px] font-medium text-text-primary">
                  {net.label}
                </span>
                <div className="flex items-center gap-6 text-[13px]">
                  <div className="text-right">
                    <p className="text-text-secondary text-[11px]">Alcance</p>
                    <p className="font-semibold text-text-primary">
                      {fmtKpi(net.reach)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-text-secondary text-[11px]">Engajamento</p>
                    <p className="font-semibold text-text-primary">
                      {fmtKpi(net.engagement)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrativa */}
      {analysis?.narrative && <NarrativeBlock text={analysis.narrative} />}

      {/* Bullets executivos */}
      {analysis?.executiveBullets && analysis.executiveBullets.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-accent" />
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
              Destaques executivos
            </span>
          </div>
          <ul className="space-y-2">
            {analysis.executiveBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="text-[13px] text-text-secondary">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Tab: Instagram ─────────────────────────────────────────────────────── */

function InstagramTab({
  data,
  analysis,
}: {
  data: AgencyReportData["instagram"];
  analysis: AgencyReportAnalysis["instagram"] | undefined;
}) {
  return (
    <div className="space-y-5">
      {/* KPIs perfil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Seguidores" kv={data.perfil.followers} icon={Users} />
        <KpiCard label="Alcance" kv={data.perfil.reach} icon={Eye} />
        <KpiCard label="Visitas ao Perfil" kv={data.perfil.profileVisits} icon={Target} />
        <KpiCard label="Views" kv={data.perfil.viewsTotal} icon={Heart} />
      </div>

      {/* Feed */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Instagram size={14} className="text-pink-400" />
          <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Feed
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Posts" kv={data.feed.postsCount} icon={BarChart3} />
          <KpiCard label="Curtidas" kv={data.feed.likes} icon={Heart} />
          <KpiCard label="Comentários" kv={data.feed.comments} icon={Target} />
          <KpiCard label="Salvamentos" kv={data.feed.saves} icon={Star} />
        </div>
      </div>

      {/* Reels */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye size={14} className="text-purple-400" />
          <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Reels
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Reels" kv={data.reels.reelsCount} icon={BarChart3} />
          <KpiCard label="Views" kv={data.reels.views} icon={Eye} />
          <KpiCard label="Alcance" kv={data.reels.reach} icon={Target} />
          <KpiCard label="Interações" kv={data.reels.interactions} icon={Heart} />
        </div>

        {/* Top Reels */}
        {data.reels.topReels && data.reels.topReels.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Top Reels
            </p>
            <div className="space-y-2">
              {data.reels.topReels.slice(0, 3).map((reel, i) => (
                <div
                  key={reel.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated border border-border/50"
                >
                  <span className="shrink-0 w-5 text-center text-[11px] font-bold text-text-muted">
                    {i + 1}
                  </span>
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-bg-card overflow-hidden flex items-center justify-center">
                    {reel.thumbnail ? (
                      <img
                        src={reel.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Eye size={14} className="text-text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-text-secondary truncate">
                      {reel.caption ?? "Sem legenda"}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      }).format(new Date(reel.publishedAt))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-bold text-accent">
                      {formatNumber(reel.views)}
                    </p>
                    <p className="text-[10px] text-text-muted">views</p>
                  </div>
                  {reel.permalink && (
                    <a
                      href={reel.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 rounded hover:bg-bg-card transition-colors"
                    >
                      <ExternalLink size={11} className="text-text-muted" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Narrativa */}
      {analysis?.narrative && <NarrativeBlock text={analysis.narrative} />}
      {analysis?.recommendations && (
        <RecommendationsList recs={analysis.recommendations} />
      )}
    </div>
  );
}

/* ── Tab: Facebook ─────────────────────────────────────────────────────── */

function FacebookTab({
  data,
  analysis,
}: {
  data: AgencyReportData["facebook"];
  analysis: AgencyReportAnalysis["facebook"] | undefined;
}) {
  return (
    <div className="space-y-5">
      {/* KPIs perfil */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Seguidores da Página" kv={data.perfil.pageFollowers} icon={Users} />
        <KpiCard label="Novos Seguidores" kv={data.perfil.newFollowers} icon={TrendingUp} />
        <KpiCard label="Alcance" kv={data.perfil.pageReach} icon={Eye} />
        <KpiCard label="Mensagens" kv={data.perfil.pageMessagesNew} icon={Target} />
      </div>

      {/* Posts */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Facebook size={14} className="text-blue-400" />
          <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Posts
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard label="Posts" kv={data.posts.postsCount} icon={BarChart3} />
          <KpiCard label="Alcance Total" kv={data.posts.totalReach} icon={Eye} />
          <KpiCard label="Reações" kv={data.posts.reactions} icon={Heart} />
        </div>

        {/* Top posts */}
        {data.posts.topPosts && data.posts.topPosts.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Top Posts
            </p>
            <div className="space-y-2">
              {data.posts.topPosts.slice(0, 3).map((post, i) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated border border-border/50"
                >
                  <span className="shrink-0 w-5 text-center text-[11px] font-bold text-text-muted">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-text-secondary truncate">
                      {post.caption ?? "Sem legenda"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-bold text-accent">
                      {formatNumber(post.totalReach)}
                    </p>
                    <p className="text-[10px] text-text-muted">alcance</p>
                  </div>
                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 rounded hover:bg-bg-card"
                    >
                      <ExternalLink size={11} className="text-text-muted" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Narrativa */}
      {analysis?.narrative && <NarrativeBlock text={analysis.narrative} />}
      {analysis?.recommendations && (
        <RecommendationsList recs={analysis.recommendations} />
      )}
    </div>
  );
}

/* ── Tab: Meta Ads ──────────────────────────────────────────────────────── */

function MetaAdsTab({
  data,
  analysis,
}: {
  data: AgencyReportData["metaAds"];
  analysis: AgencyReportAnalysis["metaAds"] | undefined;
}) {
  return (
    <div className="space-y-5">
      {/* KPIs overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Investimento" kv={data.overview.spend} icon={DollarSign} />
        <KpiCard label="Leads" kv={data.overview.leads} icon={Target} />
        <KpiCard label="Custo por Lead" kv={data.overview.costPerLead} icon={MousePointerClick} />
        <KpiCard label="Alcance" kv={data.overview.reach} icon={Eye} />
        <KpiCard label="Impressões" kv={data.overview.impressions} icon={BarChart3} />
        <KpiCard label="Cliques" kv={data.overview.linkClicks} icon={MousePointerClick} />
        <KpiCard label="CTR" kv={data.overview.ctr} icon={TrendingUp} />
        <KpiCard label="CPM" kv={data.overview.cpm} icon={DollarSign} />
      </div>

      {/* Top Campanhas */}
      {data.topCampaigns && data.topCampaigns.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={14} className="text-indigo-400" />
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
              Top Campanhas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-text-muted font-medium">Campanha</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Alcance</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Gasto</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Resultados</th>
                  <th className="text-right py-2 pl-2 text-text-muted font-medium">CPR</th>
                </tr>
              </thead>
              <tbody>
                {data.topCampaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/30 hover:bg-bg-elevated/30 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <p className="text-text-primary font-medium truncate max-w-[160px]">
                        {c.name}
                      </p>
                      {c.objective && (
                        <p className="text-[10px] text-text-muted">{c.objective}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-text-secondary">
                      {formatNumber(c.reach)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-text-secondary">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(c.spend)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-accent">
                      {c.results}
                    </td>
                    <td className="py-2.5 pl-2 text-right text-text-secondary">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 2,
                      }).format(c.costPerResult)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Narrativa */}
      {analysis?.narrative && <NarrativeBlock text={analysis.narrative} />}
      {analysis?.recommendations && (
        <RecommendationsList recs={analysis.recommendations} />
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

type TabId = "panorama" | "instagram" | "facebook" | "meta_ads";

const TABS: { id: TabId; label: string; icon: React.FC<{ size?: number; className?: string }> }[] =
  [
    { id: "panorama", label: "Panorama", icon: BarChart3 },
    { id: "instagram", label: "Instagram", icon: Instagram },
    { id: "facebook", label: "Facebook", icon: Facebook },
    { id: "meta_ads", label: "Meta Ads", icon: Megaphone },
  ];

export interface AgencyViewProps {
  data: AgencyReportData;
  analysis: AgencyReportAnalysis | null;
  pdfUrl: string | null;
}

export function AgencyReportView({ data, analysis, pdfUrl }: AgencyViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("panorama");

  const { meta, panorama, instagram, facebook, metaAds } = data;

  return (
    <div className="space-y-5">
      {/* Period banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-accent/10 to-secondary/10 border border-accent/20 rounded-xl px-5 py-4">
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium mb-1">
            Período analisado
          </p>
          <p className="text-[15px] font-semibold text-text-primary">
            {fmt(meta.periodStart)} – {fmt(meta.periodEnd)}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            vs. {fmt(meta.previousStart)} – {fmt(meta.previousEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold bg-accent text-bg-primary rounded-lg hover:opacity-90 transition-opacity"
            >
              <Download size={14} />
              Baixar PDF
            </a>
          ) : (
            <button
              disabled
              title="PDF em geração..."
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-text-muted border border-border rounded-lg opacity-50 cursor-not-allowed"
            >
              <Download size={14} />
              PDF em geração...
            </button>
          )}
        </div>
      </div>

      {/* KPIs Hero */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Alcance total" kv={panorama.totalReach} icon={Eye} />
        <KpiCard label="Engajamento" kv={panorama.totalEngagement} icon={Heart} />
        <KpiCard label="Investimento" kv={panorama.totalSpend} icon={DollarSign} />
        <KpiCard label="Leads" kv={panorama.totalLeads} icon={Target} />
        <KpiCard label="Custo por Lead" kv={panorama.costPerLead} icon={MousePointerClick} />
      </div>

      {/* Tabs */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div role="tablist" className="flex border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-all shrink-0 ${
                  active
                    ? "border-accent text-accent bg-accent/5"
                    : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-elevated/40"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="p-5"
          >
            {activeTab === "panorama" && (
              <PanoramaTab
                data={panorama}
                analysis={analysis?.panorama}
              />
            )}
            {activeTab === "instagram" && (
              <InstagramTab
                data={instagram}
                analysis={analysis?.instagram}
              />
            )}
            {activeTab === "facebook" && (
              <FacebookTab
                data={facebook}
                analysis={analysis?.facebook}
              />
            )}
            {activeTab === "meta_ads" && (
              <MetaAdsTab
                data={metaAds}
                analysis={analysis?.metaAds}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Warning se sem análise */}
      {!analysis && (
        <div className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400 text-[13px]">
          <AlertTriangle size={16} className="shrink-0" />
          Análise IA não disponível para este relatório. Os dados brutos estão exibidos acima.
        </div>
      )}
    </div>
  );
}
