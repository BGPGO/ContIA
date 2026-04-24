"use client";

import { Bookmark, TrendingUp, TrendingDown, Info } from "lucide-react";

export interface SaveRateCardProps {
  saveRate: number;
  previous?: number;
  benchmark?: number;
  tooltip?: string;
}

function formatPct(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

export function SaveRateCard({
  saveRate,
  previous,
  benchmark,
  tooltip = "Taxa de salvamentos por alcance — quanto maior, mais seu conteúdo é visto como referência.",
}: SaveRateCardProps) {
  const savePct = saveRate * 100;

  const delta =
    previous != null ? saveRate - previous : null;
  const deltaPositive = delta != null && delta >= 0;

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#eab30820" }}>
          <Bookmark size={16} style={{ color: "#eab308" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-text-primary">
            Save Rate
          </h3>
          <p className="text-[11px] text-text-muted">
            Saves / Alcance
          </p>
        </div>
        {/* Tooltip icon */}
        <div className="group relative">
          <Info size={14} className="text-text-muted cursor-help" />
          <div className="absolute right-0 top-5 z-10 w-56 p-2.5 rounded-lg bg-bg-card border border-border shadow-lg text-[11px] text-text-secondary leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {tooltip}
          </div>
        </div>
      </div>

      {/* Main metric */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-3xl font-bold text-text-primary tabular-nums">
          {savePct.toFixed(2)}%
        </span>

        {delta != null && (
          <span
            className="flex items-center gap-0.5 text-[12px] font-medium tabular-nums"
            style={{ color: deltaPositive ? "#22c55e" : "#ef4444" }}
          >
            {deltaPositive ? (
              <TrendingUp size={13} />
            ) : (
              <TrendingDown size={13} />
            )}
            {deltaPositive ? "+" : ""}
            {formatPct(delta)}
            <span className="text-text-muted font-normal ml-1 text-[11px]">vs período anterior</span>
          </span>
        )}
      </div>

      {/* Benchmark */}
      {benchmark != null && (
        <div className="flex items-center gap-2 mt-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] text-text-muted whitespace-nowrap">
            Benchmark do nicho:{" "}
            <span className="text-text-secondary font-medium">
              {formatPct(benchmark)}
            </span>
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Explanatory text */}
      <p className="mt-3 text-[11px] text-text-muted leading-relaxed">
        {tooltip}
      </p>
    </div>
  );
}
