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
  value: number;
  previousValue: number;
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "flat";
  icon: string;
  animationDelay?: number;
}

export function KPICard({
  label,
  value,
  previousValue,
  delta,
  deltaPercent,
  trend,
  icon,
  animationDelay = 0,
}: KPICardProps) {
  const Icon = ICON_MAP[icon] ?? TrendingUp;

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
        <MetricDelta delta={delta} deltaPercent={deltaPercent} trend={trend} />
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
        {formatNumber(value)}
      </p>
      <p className="text-[12px] text-text-muted mt-1">{label}</p>
    </motion.div>
  );
}
