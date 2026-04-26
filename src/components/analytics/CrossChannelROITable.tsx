"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Megaphone, Check, X } from "lucide-react";
import type { CampaignAttribution } from "@/types/attribution";

/* ── Props ── */

interface CrossChannelROITableProps {
  campaigns: CampaignAttribution[];
  emptyMessage?: string;
  onRowClick?: (campaign: CampaignAttribution) => void;
}

/* ── Types ── */

type SortKey = "spend" | "clicks" | "crmLeads" | "crmDealsWon" | "crmRevenue" | "cac" | "roas";

/* ── Formatters ── */

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    meta_ads: "Meta",
    google_ads: "Google Ads",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    google: "Google",
    direto: "Direto",
    referral: "Referral",
    outro: "Outro",
  };
  return map[source] ?? source;
}

/* ── ROAS Badge ── */

function RoasBadge({ roas }: { roas: number | null }) {
  if (roas === null) return <span className="text-[12px] text-text-muted">—</span>;
  const color =
    roas >= 3 ? "text-success" : roas >= 1 ? "text-warning" : "text-danger";
  return (
    <span className={`text-[12px] font-bold tabular-nums ${color}`}>
      {roas.toFixed(2)}×
    </span>
  );
}

/* ── Match Badge ── */

function MatchBadge({ matched }: { matched: boolean }) {
  if (matched) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-success/15 text-success border border-success/30">
        <Check size={9} />
        Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30">
      <X size={9} />
      Sem match
    </span>
  );
}

/* ── Row color ── */

function rowBgClass(roas: number | null, spend: number): string {
  if (roas === null) return "";
  if (roas > 2) return "bg-success/5";
  if (roas < 1 && spend > 50) return "bg-danger/5";
  return "";
}

/* ── Sort Button ── */

function SortBtn({
  label,
  colKey,
  current,
  dir,
  onToggle,
}: {
  label: string;
  colKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onToggle: (k: SortKey) => void;
}) {
  const active = current === colKey;
  return (
    <button
      onClick={() => onToggle(colKey)}
      className={`inline-flex items-center gap-1 hover:text-text-secondary transition-colors ${
        active ? "text-text-primary" : "text-text-muted"
      }`}
    >
      {label}
      <ArrowUpDown size={10} className={active ? "opacity-100" : "opacity-40"} />
    </button>
  );
}

/* ── Main Component ── */

export function CrossChannelROITable({
  campaigns,
  emptyMessage = "Nenhuma campanha no período",
  onRowClick,
}: CrossChannelROITableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const sorted = useMemo(() => {
    const arr = [...campaigns];
    arr.sort((a, b) => {
      let va: number;
      let vb: number;
      if (sortKey === "roas") {
        va = a.roas ?? -1;
        vb = b.roas ?? -1;
      } else if (sortKey === "cac") {
        va = a.cac ?? Number.MAX_VALUE;
        vb = b.cac ?? Number.MAX_VALUE;
      } else {
        va = a[sortKey] as number;
        vb = b[sortKey] as number;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [campaigns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const thClass =
    "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right text-text-muted whitespace-nowrap";
  const thLeftClass =
    "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-left text-text-muted whitespace-nowrap";

  if (campaigns.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
          <Megaphone size={18} className="text-text-muted" />
        </div>
        <p className="text-[13px] text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]" role="table" aria-label="Tabela de ROI por campanha">
          <thead>
            <tr className="border-b border-border bg-bg-elevated/40">
              <th className="px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider text-center w-[60px]">
                #
              </th>
              <th className={thLeftClass}>Campanha</th>
              <th className={thLeftClass}>Source</th>
              <th className={thClass}>
                <SortBtn label="Gasto" colKey="spend" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Cliques" colKey="clicks" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Leads CRM" colKey="crmLeads" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Vendas" colKey="crmDealsWon" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="Revenue" colKey="crmRevenue" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="CAC" colKey="cac" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>
                <SortBtn label="ROAS" colKey="roas" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className={thClass}>Match</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((campaign, idx) => {
              const bg = rowBgClass(campaign.roas, campaign.spend);
              const globalIdx = page * pageSize + idx + 1;
              const nameDisplay = truncate(campaign.campaignName, 40);
              const showTooltip = campaign.campaignName.length > 40;

              return (
                <tr
                  key={campaign.metaCampaignId ?? `${campaign.campaignName}-${idx}`}
                  onClick={() => onRowClick?.(campaign)}
                  className={`border-b border-border/50 transition-colors ${
                    onRowClick
                      ? "cursor-pointer hover:bg-bg-elevated/60"
                      : "hover:bg-bg-elevated/30"
                  } ${bg}`}
                >
                  <td className="px-3 py-2.5 text-center text-[11px] text-text-muted tabular-nums">
                    {globalIdx}
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <span
                      className="text-[12px] text-text-primary"
                      title={showTooltip ? campaign.campaignName : undefined}
                    >
                      {nameDisplay}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded-md border border-border/50">
                      {sourceLabel(campaign.source)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatBRL(campaign.spend)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNum(campaign.clicks)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {campaign.crmLeads.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {campaign.crmDealsWon.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatBRL(campaign.crmRevenue)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {campaign.cac != null ? formatBRL(campaign.cac) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <RoasBadge roas={campaign.roas} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <MatchBadge matched={campaign.matched} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <span className="text-[11px] text-text-muted">
          {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded-lg hover:bg-bg-elevated disabled:opacity-30 transition-all"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} className="text-text-muted" />
            </button>
            <span className="text-[11px] text-text-secondary tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded-lg hover:bg-bg-elevated disabled:opacity-30 transition-all"
              aria-label="Próxima página"
            >
              <ChevronRight size={16} className="text-text-muted" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
