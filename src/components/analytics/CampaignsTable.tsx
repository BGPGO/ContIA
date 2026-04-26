"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Megaphone, PauseCircle } from "lucide-react";
import type { AdCampaignSummary } from "@/types/analytics";

/* ── Props ── */

interface CampaignsTableProps {
  campaigns: AdCampaignSummary[];
  emptyMessage?: string;
  pageSize?: number;
  onCampaignClick?: (campaign: AdCampaignSummary) => void;
}

/* ── Types ── */

type SortKey = "spend" | "impressions" | "ctr" | "cpc" | "conversions" | "roas";

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

function formatPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

/* ── Badge ── */

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; strikethrough?: boolean }
> = {
  ACTIVE: {
    label: "Ativa",
    className: "bg-success/15 text-success border border-success/30",
  },
  PAUSED: {
    label: "Pausada",
    className: "bg-bg-elevated text-text-muted border border-border",
  },
  DELETED: {
    label: "Excluida",
    className: "bg-danger/10 text-danger/70 border border-danger/20",
    strikethrough: true,
  },
  ARCHIVED: {
    label: "Arquivada",
    className: "bg-bg-elevated text-text-muted/60 border border-border/50",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status.toUpperCase()] ?? {
    label: status,
    className: "bg-bg-elevated text-text-muted border border-border",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${cfg.className} ${cfg.strikethrough ? "line-through" : ""}`}
    >
      {cfg.label}
    </span>
  );
}

/* ── Sort button ── */

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
      className={`inline-flex items-center gap-1 hover:text-text-secondary transition-colors ${active ? "text-text-primary" : "text-text-muted"}`}
    >
      {label}
      <ArrowUpDown size={10} className={active ? "opacity-100" : "opacity-40"} />
    </button>
  );
}

/* ── Row color logic ── */

function rowBgClass(roas: number | null, avgRoas: number): string {
  if (roas === null) return "";
  if (roas < 1.0) return "bg-danger/5";
  if (roas >= avgRoas && avgRoas > 0) return "bg-success/5";
  return "";
}

/* ── Main Component ── */

export function CampaignsTable({
  campaigns,
  emptyMessage = "Nenhuma campanha no periodo",
  pageSize = 10,
  onCampaignClick,
}: CampaignsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const avgRoas = useMemo(() => {
    const valid = campaigns.filter((c) => c.roas !== null && c.roas > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, c) => acc + (c.roas ?? 0), 0);
    return sum / valid.length;
  }, [campaigns]);

  const sorted = useMemo(() => {
    const arr = [...campaigns];
    arr.sort((a, b) => {
      let va: number;
      let vb: number;
      if (sortKey === "roas") {
        va = a.roas ?? -1;
        vb = b.roas ?? -1;
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
    "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right text-text-muted";

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
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-border bg-bg-elevated/40">
              <th className="px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider text-left w-[90px]">
                Status
              </th>
              <th className="px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider text-left">
                Campanha
              </th>
              <th className={thClass}>
                <SortBtn
                  label="Gasto"
                  colKey="spend"
                  current={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
              </th>
              <th className={thClass}>
                <SortBtn
                  label="Impressoes"
                  colKey="impressions"
                  current={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
              </th>
              <th className={thClass}>
                <SortBtn
                  label="CTR"
                  colKey="ctr"
                  current={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
              </th>
              <th className={thClass}>
                <SortBtn
                  label="CPC"
                  colKey="cpc"
                  current={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
              </th>
              <th className={thClass}>
                <SortBtn
                  label="Conv."
                  colKey="conversions"
                  current={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
              </th>
              <th className={thClass}>
                <SortBtn
                  label="ROAS"
                  colKey="roas"
                  current={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-2.5 w-[110px]" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((campaign) => {
              const bg = rowBgClass(campaign.roas, avgRoas);
              const nameDisplay = truncate(campaign.name, 35);
              const showTooltip = campaign.name.length > 35;

              return (
                <tr
                  key={campaign.campaignId}
                  onClick={() => onCampaignClick?.(campaign)}
                  className={`border-b border-border/50 transition-colors ${onCampaignClick ? "cursor-pointer hover:bg-bg-elevated/60" : "hover:bg-bg-elevated/30"} ${bg}`}
                >
                  <td className="px-3 py-2.5">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[12px] text-text-primary"
                      title={showTooltip ? campaign.name : undefined}
                    >
                      {nameDisplay}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatBRL(campaign.spend)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatNum(campaign.impressions)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatPct(campaign.ctr)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {formatBRL(campaign.cpc)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-text-secondary tabular-nums">
                    {campaign.conversions.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {campaign.roas === null ? (
                      <span className="text-[12px] text-text-muted">—</span>
                    ) : (
                      <span
                        className={`text-[12px] font-semibold ${
                          campaign.roas >= 2
                            ? "text-success"
                            : campaign.roas >= 1
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        {campaign.roas.toFixed(2)}×
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {campaign.roas !== null && campaign.roas < 1 && campaign.spend > 100 && (
                      <a
                        href={`https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.campaignId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap"
                        title="Abrir no Meta Ads Manager para pausar esta campanha"
                      >
                        <PauseCircle size={11} />
                        Pausar no Meta
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-[11px] text-text-muted">
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded-lg hover:bg-bg-elevated disabled:opacity-30 transition-all"
              aria-label="Pagina anterior"
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
              aria-label="Proxima pagina"
            >
              <ChevronRight size={16} className="text-text-muted" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
