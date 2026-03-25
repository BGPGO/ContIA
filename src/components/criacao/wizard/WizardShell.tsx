"use client";

import { ReactNode } from "react";
import {
  Sliders,
  Sparkles,
  Eye,
  Share2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

const STEPS = [
  { label: "Configurar", icon: Sliders },
  { label: "Gerar", icon: Sparkles },
  { label: "Preview", icon: Eye },
  { label: "Finalizar", icon: Share2 },
];

interface WizardShellProps {
  children: ReactNode;
  currentStep: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  loading?: boolean;
}

export function WizardShell({
  children,
  currentStep,
  onBack,
  onNext,
  nextLabel = "Próximo",
  nextDisabled = false,
  showBack = true,
  showNext = true,
  loading = false,
}: WizardShellProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Progress bar */}
      <div className="w-full max-w-4xl mx-auto px-4 pt-6 pb-2">
        <div className="bg-bg-card border border-border rounded-2xl px-6 py-5">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              const isFuture = i > currentStep;
              const Icon = step.icon;

              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Circle */}
                    <div
                      className={`
                        relative flex items-center justify-center rounded-full transition-all duration-300
                        ${isCurrent
                          ? "w-10 h-10 bg-accent text-white shadow-[0_0_20px_rgba(108,92,231,0.3)]"
                          : isCompleted
                            ? "w-9 h-9 bg-success/20 text-success border border-success/30"
                            : "w-9 h-9 border border-border-light text-text-muted"
                        }
                      `}
                    >
                      {isCompleted ? (
                        <Check size={16} strokeWidth={2.5} />
                      ) : isCurrent ? (
                        <Icon size={18} />
                      ) : (
                        <span className="text-xs font-medium">{i + 1}</span>
                      )}
                    </div>
                    {/* Label */}
                    <span
                      className={`text-[11px] font-medium transition-colors ${
                        isCurrent
                          ? "text-accent-light"
                          : isCompleted
                            ? "text-success"
                            : "text-text-muted"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 mt-[-18px]">
                      <div
                        className={`h-[2px] rounded-full transition-colors duration-300 ${
                          i < currentStep ? "bg-success/40" : "bg-border"
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        <div className="fade-in">{children}</div>
      </div>

      {/* Navigation bar */}
      <div className="sticky bottom-0 w-full border-t border-border bg-bg-primary/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          {showBack && currentStep > 0 ? (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          ) : (
            <div />
          )}

          {showNext && (
            <button
              onClick={onNext}
              disabled={nextDisabled || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(108,92,231,0.2)]"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {nextLabel}
              {!loading && <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
