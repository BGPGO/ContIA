"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  { label: "Visualizar", icon: Eye },
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
  nextLabel = "Proximo",
  nextDisabled = false,
  showBack = true,
  showNext = true,
  loading = false,
}: WizardShellProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Progress bar */}
      <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 pt-4 sm:pt-6 pb-2">
        {/* Desktop: full step indicators */}
        <div className="hidden sm:block bg-bg-card border border-border rounded-2xl px-6 py-5">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              const Icon = step.icon;

              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <motion.div
                      layout
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1 : 0.95,
                        boxShadow: isCurrent ? "0 0 25px rgba(78,205,196,0.4)" : "none",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={`
                        relative flex items-center justify-center rounded-full transition-colors duration-300
                        ${isCurrent
                          ? "w-10 h-10 bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] text-white"
                          : isCompleted
                            ? "w-9 h-9 bg-success/20 text-success border border-success/30"
                            : "w-9 h-9 border border-border-light text-text-muted"
                        }
                      `}
                    >
                      <AnimatePresence mode="wait">
                        {isCompleted ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </motion.div>
                        ) : isCurrent ? (
                          <motion.div
                            key="icon"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <Icon size={18} />
                          </motion.div>
                        ) : (
                          <motion.span
                            key="number"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs font-medium"
                          >
                            {i + 1}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
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

                  {i < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 mt-[-18px]">
                      <div className="h-[2px] rounded-full bg-border relative overflow-hidden">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-[#4ecdc4]/60 to-[#4ecdc4]/20 rounded-full"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: i < currentStep ? 1 : 0 }}
                          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                          style={{ transformOrigin: "left" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: compact "Step X de N" with progress dots */}
        <div className="sm:hidden bg-bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const CurrentIcon = STEPS[currentStep]?.icon ?? Sliders;
                return (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center">
                    <CurrentIcon size={14} className="text-white" />
                  </div>
                );
              })()}
              <div>
                <p className="text-xs font-semibold text-text-primary">
                  {STEPS[currentStep]?.label}
                </p>
                <p className="text-[10px] text-text-muted">
                  Etapa {currentStep + 1} de {STEPS.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  layout
                  className={`h-1.5 rounded-full ${
                    i < currentStep
                      ? "bg-success"
                      : i === currentStep
                        ? "bg-accent"
                        : "bg-border"
                  }`}
                  animate={{
                    width: i < currentStep ? 16 : i === currentStep ? 24 : 12,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation bar */}
      <div className="sticky bottom-0 w-full border-t border-border bg-bg-primary/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          {showBack && currentStep > 0 ? (
            <motion.button
              onClick={onBack}
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent hover:border-border-light transition-all duration-200"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </motion.button>
          ) : (
            <div />
          )}

          {showNext && (
            <motion.button
              onClick={onNext}
              disabled={nextDisabled || loading}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex-1 sm:flex-none sm:w-auto"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {nextLabel}
              {!loading && <ChevronRight size={16} />}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
