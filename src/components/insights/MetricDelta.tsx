"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricDeltaProps {
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "flat";
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function MetricDelta({
  delta,
  deltaPercent,
  trend,
  size = "sm",
  showIcon = true,
}: MetricDeltaProps) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";

  const colorClass = isPositive
    ? "text-success"
    : isNegative
    ? "text-danger"
    : "text-text-muted";

  const bgClass = isPositive
    ? "bg-success/10"
    : isNegative
    ? "bg-danger/10"
    : "bg-bg-elevated";

  const iconSize = size === "sm" ? 12 : 14;
  const textSize = size === "sm" ? "text-[11px]" : "text-[13px]";

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const sign = isPositive ? "+" : "";
  const formatted = Math.abs(deltaPercent) < 0.1 ? "0%" : `${sign}${deltaPercent.toFixed(1)}%`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${bgClass} ${colorClass} ${textSize} font-medium`}
      aria-label={`${trend === "up" ? "Aumento" : trend === "down" ? "Queda" : "Estavel"} de ${formatted}`}
    >
      {showIcon && <Icon size={iconSize} className="shrink-0" />}
      {formatted}
    </span>
  );
}
