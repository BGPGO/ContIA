"use client";

import { motion } from "motion/react";
import { ChevronRight, Cable } from "lucide-react";
import Link from "next/link";
import { METADATA_BY_PROVIDER } from "@/lib/drivers/metadata";
import type { ProviderKey } from "@/types/providers";
import type { ProviderSummary } from "@/types/analytics";

interface ProviderSummaryRowProps {
  summary: ProviderSummary;
  index: number;
}

export function ProviderSummaryRow({ summary, index }: ProviderSummaryRowProps) {
  const meta = METADATA_BY_PROVIDER[summary.provider];

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
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: summary.color }}
          />
        </div>
        <span className="text-[13px] text-text-muted flex-1">
          {summary.displayName}
        </span>
        <span className="text-[11px] text-text-muted italic">
          {meta.status === "coming_soon" ? "Em breve" : "Nao conectado"}
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
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: summary.color }}
          />
        </div>

        {/* Provider name */}
        <span className="text-[13px] font-medium text-text-primary min-w-[100px]">
          {summary.displayName}
        </span>

        {/* KPIs inline */}
        <div className="flex-1 flex items-center gap-4 sm:gap-6">
          {summary.kpis.map((kpi) => (
            <div key={kpi.label} className="text-center min-w-[60px]">
              <p className="text-[13px] font-semibold text-text-primary tabular-nums">
                {kpi.value}
              </p>
              <p className="text-[10px] text-text-muted">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <ChevronRight
          size={16}
          className="text-text-muted group-hover:text-accent transition-colors shrink-0"
        />
      </motion.div>
    </Link>
  );
}
