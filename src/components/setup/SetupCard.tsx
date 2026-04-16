"use client";

import { useState } from "react";
import { ChevronDown, Clock, type LucideIcon } from "lucide-react";
import { StepIndicator } from "./StepIndicator";

interface SetupCardProps {
  id: string;
  icon: LucideIcon;
  title: string;
  reason: string;
  estimatedTime: string;
  done: boolean;
  onToggleDone: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SetupCard({
  id,
  icon: Icon,
  title,
  reason,
  estimatedTime,
  done,
  onToggleDone,
  children,
  defaultOpen = false,
}: SetupCardProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 ${
        done
          ? "bg-bg-card/50 border-success/20 opacity-75"
          : "bg-bg-card border-border hover:border-border-light"
      }`}
    >
      {/* Header — always visible */}
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <StepIndicator done={done} onClick={onToggleDone} />

        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            done
              ? "bg-success/10"
              : "bg-gradient-to-br from-accent/15 to-secondary/15"
          }`}
        >
          <Icon
            size={20}
            className={done ? "text-success" : "text-accent"}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`text-[14px] font-semibold leading-tight ${
              done
                ? "text-text-secondary line-through decoration-success/40"
                : "text-text-primary"
            }`}
          >
            {title}
          </h3>
          <p className="text-[12px] text-text-muted mt-0.5 truncate">
            {reason}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-text-muted">
            <Clock size={12} />
            {estimatedTime}
          </span>

          {done ? (
            <span className="text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
              Concluido
            </span>
          ) : (
            <span className="text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
              Pendente
            </span>
          )}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-border/50">
          <div className="pt-4 space-y-4">{children}</div>

          {!done && (
            <button
              onClick={onToggleDone}
              className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-secondary) 0%, var(--color-accent) 100%)",
                boxShadow: "0 4px 15px rgba(78, 205, 196, 0.2)",
              }}
            >
              Marcar como concluido
            </button>
          )}
        </div>
      )}
    </div>
  );
}
