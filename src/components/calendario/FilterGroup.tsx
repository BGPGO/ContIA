"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

interface FilterGroupProps {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (value: string) => void;
  multi?: boolean;
}

export function FilterGroup({ label, options, selected, onChange }: FilterGroupProps) {
  return (
    <div className="flex items-center gap-2 min-h-[24px]">
      <span className="text-[9px] font-medium text-white/35 uppercase tracking-wider w-20 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
        {options.map((opt) => {
          const isActive = selected.has(opt.value);
          return (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.92 }}
              onClick={() => onChange(opt.value)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-150 shrink-0 whitespace-nowrap",
                isActive
                  ? "text-black border-transparent"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              )}
              style={
                isActive
                  ? opt.color
                    ? {
                        backgroundColor: opt.color,
                        borderColor: opt.color,
                        color: "#000",
                      }
                    : {
                        backgroundColor: "#4ecdc4",
                        borderColor: "#4ecdc4",
                        color: "#000",
                      }
                  : undefined
              }
            >
              {opt.color && (
                <span
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? "rgba(0,0,0,0.5)" : opt.color }}
                />
              )}
              {opt.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
