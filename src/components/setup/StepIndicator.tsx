"use client";

import { Check } from "lucide-react";

interface StepIndicatorProps {
  done: boolean;
  onClick: () => void;
}

export function StepIndicator({ done, onClick }: StepIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
        done
          ? "bg-success border-success text-white"
          : "border-border-light hover:border-accent bg-transparent"
      }`}
      title={done ? "Marcar como pendente" : "Marcar como concluido"}
    >
      {done && <Check size={14} strokeWidth={3} />}
    </button>
  );
}
