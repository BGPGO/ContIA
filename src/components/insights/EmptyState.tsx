"use client";

import { motion } from "motion/react";
import { Cable, BarChart3, type LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = BarChart3,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/10 to-secondary/10 flex items-center justify-center mb-5">
        <Icon size={28} className="text-text-muted" />
      </div>
      <h3 className="text-[16px] font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-[13px] text-text-muted max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Cable size={16} />
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="btn-primary inline-flex items-center gap-2"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
