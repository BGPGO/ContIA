"use client";

import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { motion } from "motion/react";
import { GitMerge } from "lucide-react";
import type { ChannelROI, FunnelEndToEndStage } from "@/types/attribution";

/* ── Props ── */

interface SankeyAttributionProps {
  channelROI: ChannelROI[];
  funnel: FunnelEndToEndStage[];
  totalRevenue: number;
  title?: string;
  emptyMessage?: string;
}

/* ── Colors ── */

const CHANNEL_COLORS: Record<string, string> = {
  meta_ads: "#3b82f6",
  google_ads: "#f59e0b",
  instagram: "#ec4899",
  facebook: "#6366f1",
  linkedin: "#0ea5e9",
  google: "#10b981",
  direto: "#8b5cf6",
  referral: "#f97316",
  outro: "#6b7280",
};

function channelColor(source: string): string {
  return CHANNEL_COLORS[source] ?? "#6b7280";
}

function channelLabel(source: string): string {
  const map: Record<string, string> = {
    meta_ads: "Meta Ads",
    google_ads: "Google Ads",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    google: "Google Organic",
    direto: "Direto",
    referral: "Referral",
    outro: "Outro",
  };
  return map[source] ?? source;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

/* ── Column Item ── */

interface ColumnItem {
  id: string;
  label: string;
  count: number;
  color: string;
  sublabel?: string;
}

/* ── SVG Bezier connector overlay ── */

interface ConnectorPath {
  d: string;
  color: string;
  strokeWidth: number;
  fromId: string; // ID do item da coluna de origem
}

interface ColRect {
  id: string;
  top: number;   // relativo ao container
  height: number;
  color: string;
  count: number;
}

function buildPaths(
  leftRects: ColRect[],
  rightRects: ColRect[],
  x1: number, // right edge da coluna esquerda
  x2: number, // left edge da coluna direita
  totalCount: number
): ConnectorPath[] {
  if (leftRects.length === 0 || rightRects.length === 0) return [];

  const paths: ConnectorPath[] = [];

  leftRects.forEach((lItem) => {
    const lMid = lItem.top + lItem.height / 2;
    const lPct = totalCount > 0 ? lItem.count / totalCount : 1 / leftRects.length;
    const sw = Math.max(2, Math.min(16, lPct * 80));

    rightRects.forEach((rItem) => {
      const rMid = rItem.top + rItem.height / 2;
      const cx = (x1 + x2) / 2;
      const d = `M ${x1} ${lMid} C ${cx} ${lMid} ${cx} ${rMid} ${x2} ${rMid}`;
      paths.push({
        d,
        color: lItem.color,
        strokeWidth: sw,
        fromId: lItem.id,
      });
    });
  });

  return paths;
}

/* ── FlowColumn with ref tracking ── */

interface FlowColumnProps {
  title: string;
  items: ColumnItem[];
  totalCount: number;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onRectsReady?: (rects: ColRect[]) => void;
}

function FlowColumn({
  title,
  items,
  totalCount,
  activeId,
  onHover,
  onRectsReady,
}: FlowColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!onRectsReady || !containerRef.current) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const rects: ColRect[] = items.map((item, i) => {
      const el = itemRefs.current[i];
      if (!el) return { id: item.id, top: 0, height: 40, color: item.color, count: item.count };
      const r = el.getBoundingClientRect();
      return {
        id: item.id,
        top: r.top - containerTop,
        height: r.height,
        color: item.color,
        count: item.count,
      };
    });
    onRectsReady(rects);
  });

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1 text-center">
        {title}
      </p>
      {items.map((item, i) => {
        const pct = totalCount > 0 ? Math.max(12, (item.count / totalCount) * 100) : 12;
        const isActive = activeId === null || activeId === item.id;
        return (
          <motion.div
            key={item.id}
            ref={(el) => { itemRefs.current[i] = el; }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover(null)}
            className={`relative rounded-lg p-3 border cursor-default transition-all duration-200 ${
              isActive
                ? "border-border bg-bg-elevated"
                : "border-border/30 bg-bg-elevated/30 opacity-40"
            }`}
          >
            {/* Color accent bar (left) */}
            <div
              className="absolute left-0 top-0 bottom-0 rounded-l-lg"
              style={{ width: 4, backgroundColor: item.color }}
            />

            {/* Fill bar (proportional) */}
            <div
              className="absolute left-[4px] top-0 bottom-0 rounded-r-lg opacity-10"
              style={{ width: `${pct}%`, backgroundColor: item.color }}
            />

            <div className="relative flex items-center justify-between gap-2 pl-1">
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-semibold text-text-primary truncate">
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="text-[10px] text-text-muted">{item.sublabel}</span>
                )}
              </div>
              <span
                className="text-[13px] font-bold tabular-nums shrink-0"
                style={{ color: item.color }}
              >
                {formatNum(item.count)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Main ── */

export function SankeyAttribution({
  channelROI,
  funnel,
  totalRevenue,
  title = "Fluxo de Canais",
  emptyMessage = "Nenhum dado de atribuição no período",
}: SankeyAttributionProps) {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  // Refs to SVG overlay dimensions
  const wrapperRef = useRef<HTMLDivElement>(null);
  const col1Ref = useRef<HTMLDivElement>(null);
  const col2Ref = useRef<HTMLDivElement>(null);
  const col3Ref = useRef<HTMLDivElement>(null);

  const [leftRects, setLeftRects] = useState<ColRect[]>([]);
  const [midRects, setMidRects] = useState<ColRect[]>([]);
  const [rightRects, setRightRects] = useState<ColRect[]>([]);
  const [svgDim, setSvgDim] = useState({ w: 0, h: 0 });
  const [x1, setX1] = useState(0); // right edge col1
  const [x2, setX2] = useState(0); // left edge col2
  const [x3, setX3] = useState(0); // right edge col2
  const [x4, setX4] = useState(0); // left edge col3

  const updateLayout = useCallback(() => {
    if (!wrapperRef.current || !col1Ref.current || !col2Ref.current || !col3Ref.current) return;
    const wRect = wrapperRef.current.getBoundingClientRect();
    const c1 = col1Ref.current.getBoundingClientRect();
    const c2 = col2Ref.current.getBoundingClientRect();
    const c3 = col3Ref.current.getBoundingClientRect();
    setSvgDim({ w: wRect.width, h: wRect.height });
    setX1(c1.right - wRect.left);
    setX2(c2.left - wRect.left);
    setX3(c2.right - wRect.left);
    setX4(c3.left - wRect.left);
  }, []);

  useLayoutEffect(() => {
    updateLayout();
  });

  if (channelROI.length === 0 && funnel.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
          <GitMerge size={18} className="text-text-muted" />
        </div>
        <p className="text-[13px] text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  const totalLeads = channelROI.reduce((s, c) => s + c.leads, 0);

  /* Column 1 — Canais */
  const channelItems: ColumnItem[] = channelROI
    .filter((c) => c.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 8)
    .map((c) => ({
      id: c.source,
      label: channelLabel(c.source),
      count: c.leads,
      color: channelColor(c.source),
      sublabel: c.roas != null ? `ROAS ${c.roas.toFixed(1)}×` : undefined,
    }));

  /* Column 2 — Funil */
  const funnelItems: ColumnItem[] = funnel
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .map((s, i) => {
      const colors = [
        "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#10b981", "#84cc16",
      ];
      return {
        id: s.stage,
        label: s.label,
        count: s.count,
        color: colors[i % colors.length] ?? "#6b7280",
        sublabel: s.conversionFromPrev != null
          ? `${(s.conversionFromPrev * 100).toFixed(0)}% conv.`
          : undefined,
      };
    });

  /* Column 3 — Resultados */
  const wonStage = funnel.find((s) => s.stage === "won");
  const lostStage = funnel.find((s) => s.stage === "lost");
  const resultItems: ColumnItem[] = [];
  if (wonStage && wonStage.count > 0) {
    resultItems.push({
      id: "won",
      label: "Ganhos",
      count: wonStage.count,
      color: "#10b981",
      sublabel: wonStage.valueSum != null ? formatBRL(wonStage.valueSum) : formatBRL(totalRevenue),
    });
  }
  if (lostStage && lostStage.count > 0) {
    resultItems.push({
      id: "lost",
      label: "Perdidos",
      count: lostStage.count,
      color: "#ef4444",
      sublabel: lostStage.conversionFromTop != null
        ? `${(lostStage.conversionFromTop * 100).toFixed(1)}% do total`
        : undefined,
    });
  }
  if (resultItems.length === 0 && totalRevenue > 0) {
    resultItems.push({
      id: "revenue",
      label: "Receita Total",
      count: channelROI.reduce((s, c) => s + c.dealsWon, 0),
      color: "#10b981",
      sublabel: formatBRL(totalRevenue),
    });
  }

  /* Build SVG paths */
  const paths12 = buildPaths(leftRects, midRects, x1, x2, totalLeads);
  const paths23 = buildPaths(midRects, rightRects, x3, x4, totalLeads);
  const allPaths = [...paths12, ...paths23];

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
          <p className="text-[12px] text-text-muted mt-0.5">
            Canal → Estágio do Funil → Resultado
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-text-muted">
          <GitMerge size={14} />
          <span>{formatNum(totalLeads)} leads mapeados</span>
        </div>
      </div>

      {/* 3-column flow com SVG overlay de conectores Bezier */}
      <div ref={wrapperRef} className="relative">
        {/* SVG overlay — paths Bezier entre colunas */}
        {svgDim.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgDim.w}
            height={svgDim.h}
            style={{ zIndex: 0 }}
          >
            {allPaths.map((p, i) => {
              const isHighlighted =
                activeChannel === null || p.fromId === activeChannel;
              return (
                <path
                  key={i}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={p.strokeWidth}
                  opacity={isHighlighted ? 0.22 : 0.05}
                  strokeLinecap="round"
                  style={{ transition: "opacity 0.2s" }}
                />
              );
            })}
          </svg>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-0 items-start relative z-10">
          {/* Column 1 */}
          <div ref={col1Ref}>
            <FlowColumn
              title="Canais de Entrada"
              items={channelItems}
              totalCount={totalLeads}
              activeId={activeChannel}
              onHover={setActiveChannel}
              onRectsReady={setLeftRects}
            />
          </div>

          {/* Spacer 1→2 */}
          <div className="w-8" />

          {/* Column 2 */}
          <div ref={col2Ref}>
            <FlowColumn
              title="Estágios do Funil"
              items={funnelItems}
              totalCount={totalLeads}
              activeId={null}
              onHover={() => {}}
              onRectsReady={setMidRects}
            />
          </div>

          {/* Spacer 2→3 */}
          <div className="w-8" />

          {/* Column 3 */}
          <div ref={col3Ref}>
            <FlowColumn
              title="Resultado"
              items={resultItems}
              totalCount={totalLeads}
              activeId={null}
              onHover={() => {}}
              onRectsReady={setRightRects}
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      {channelItems.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border/60 flex flex-wrap gap-3">
          {channelItems.map((c) => (
            <button
              key={c.id}
              className="flex items-center gap-1.5 group"
              onMouseEnter={() => setActiveChannel(c.id)}
              onMouseLeave={() => setActiveChannel(null)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full transition-transform duration-150 group-hover:scale-125"
                style={{ backgroundColor: c.color }}
              />
              <span
                className="text-[11px] text-text-muted group-hover:text-text-primary transition-colors duration-150"
              >
                {c.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
