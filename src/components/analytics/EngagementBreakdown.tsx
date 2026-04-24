"use client";

import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";

export interface EngagementBreakdownProps {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  title?: string;
}

interface Segment {
  key: "likes" | "comments" | "saves" | "shares";
  label: string;
  color: string;
  icon: typeof Heart;
}

const SEGMENTS: Segment[] = [
  { key: "likes",    label: "Curtidas",           color: "#ef4444", icon: Heart },
  { key: "comments", label: "Comentários",         color: "#3b82f6", icon: MessageCircle },
  { key: "saves",    label: "Salvamentos",          color: "#eab308", icon: Bookmark },
  { key: "shares",   label: "Compartilhamentos",   color: "#22c55e", icon: Share2 },
];

export function EngagementBreakdown({
  likes,
  comments,
  saves,
  shares,
  title = "Quebra do engajamento",
}: EngagementBreakdownProps) {
  const values: Record<string, number> = { likes, comments, saves, shares };
  const total = likes + comments + saves + shares;

  if (total === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-4">{title}</h3>
        <div className="flex items-center justify-center h-[100px] text-text-muted text-[13px]">
          Sem dados de engajamento
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold text-text-primary mb-4">{title}</h3>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-5">
        {SEGMENTS.map((seg) => {
          const pct = (values[seg.key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {SEGMENTS.map((seg) => {
          const val = values[seg.key];
          const pct = ((val / total) * 100).toFixed(1);
          const barWidth = (val / total) * 100;
          const Icon = seg.icon;

          return (
            <div key={seg.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color: seg.color }} />
                  <span className="text-[12px] text-text-secondary">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted tabular-nums">{pct}%</span>
                  <span className="text-[13px] font-semibold text-text-primary tabular-nums w-[60px] text-right">
                    {val.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, backgroundColor: seg.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-[11px] text-text-muted">Total de interações</span>
        <span className="text-[13px] font-semibold text-text-primary tabular-nums">
          {total.toLocaleString("pt-BR")}
        </span>
      </div>
    </div>
  );
}
