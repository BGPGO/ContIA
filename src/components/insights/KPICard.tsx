"use client";

import { motion } from "motion/react";
import {
  Users,
  Heart,
  FileText,
  UserPlus,
  Eye,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { MetricDelta } from "./MetricDelta";

const ICON_MAP: Record<string, LucideIcon> = {
  users: Users,
  heart: Heart,
  file: FileText,
  user_plus: UserPlus,
  eye: Eye,
  click: MousePointerClick,
  dollar: DollarSign,
  trending: TrendingUp,
};

interface KPICardProps {
  label: string;
  value: number | null;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  trend: "up" | "down" | "flat" | "unknown";
  icon: string;
  animationDelay?: number;
}

export function KPICard({
  label,
  value,
  previousValue: _previousValue,
  delta,
  deltaPercent,
  trend,
  icon,
  animationDelay = 0,
}: KPICardProps) {
  const Icon = ICON_MAP[icon] ?? TrendingUp;
  const isUnavailable = value === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.3 }}
      className="bg-bg-card border border-border rounded-xl p-4 sm:p-5 hover:border-border-light hover:bg-bg-card-hover transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon size={18} className="text-accent" />
        </div>
        {isUnavailable ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-bg-elevated text-text-muted text-[11px] font-medium">
            Indisponível
          </span>
        ) : (
          <MetricDelta
            delta={delta ?? 0}
            deltaPercent={deltaPercent ?? 0}
            trend={trend === "unknown" ? "flat" : trend}
          />
        )}
      </div>
      <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${isUnavailable ? "text-text-muted" : "text-text-primary"}`}>
        {isUnavailable ? "—" : formatNumber(value)}
      </p>
      <p className="text-[12px] text-text-muted mt-1">{label}</p>
    </motion.div>
  );
}
