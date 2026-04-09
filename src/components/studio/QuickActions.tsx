"use client";

import {
  Zap,
  Minimize2,
  Maximize2,
  Palette,
  MousePointerClick,
  Hash,
  Smile,
  SmilePlus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { QuickAction, QuickActionConfig } from "@/types/copy-studio";

/* ── Icon map ── */
const ICON_MAP: Record<string, LucideIcon> = {
  Zap,
  Minimize2,
  Maximize2,
  Palette,
  MousePointerClick,
  Hash,
  HashIcon: Hash,
  Smile,
  SmilePlus,
  RefreshCw,
};

interface QuickActionsProps {
  actions: QuickActionConfig[];
  onAction: (action: QuickAction) => void;
  disabled?: boolean;
}

export function QuickActions({ actions, onAction, disabled }: QuickActionsProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {actions.map((action) => {
        const Icon = ICON_MAP[action.icon] || Zap;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap
              bg-[#141736] text-text-secondary border border-white/10
              hover:bg-[#1a1f45] hover:text-text-primary hover:border-accent/20
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 shrink-0 cursor-pointer"
          >
            <Icon size={12} />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
