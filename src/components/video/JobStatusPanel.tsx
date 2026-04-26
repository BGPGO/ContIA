"use client";

import { motion } from "motion/react";
import {
  CheckCircle2,
  Loader2,
  Circle,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { ProcessingStep } from "@/types/video-pipeline";
import type { UseVideoJobReturn } from "@/hooks/useVideoJob";

interface StepDefinition {
  label: string;
  steps: ProcessingStep[];
}

const PIPELINE_STAGES: StepDefinition[] = [
  { label: "Subindo vídeo", steps: [] }, // completed before this component mounts
  { label: "Extraindo áudio", steps: ["queued", "extracting_audio", "chunking_audio"] },
  { label: "Transcrevendo (chunks paralelos)", steps: ["transcribing", "merging_transcription"] },
  { label: "Detectando cortes virais", steps: ["detecting_cuts", "refining_cuts"] },
  { label: "Renderizando cortes", steps: ["rendering", "uploading_clips"] },
  { label: "Pronto!", steps: ["completed"] },
];

function getStageIndex(step: ProcessingStep | null): number {
  if (!step) return 0;
  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    if ((PIPELINE_STAGES[i].steps as string[]).includes(step)) return i;
  }
  return 0;
}

type StageStatus = "done" | "active" | "idle";

function getStageStatus(stageIndex: number, currentStageIndex: number): StageStatus {
  if (stageIndex < currentStageIndex) return "done";
  if (stageIndex === currentStageIndex) return "active";
  return "idle";
}

interface JobStatusPanelProps {
  job: UseVideoJobReturn;
}

export function JobStatusPanel({ job }: JobStatusPanelProps) {
  const { step, progress, errorMessage, isFailed, isReady, costCents, retry } = job;

  const currentStageIndex = isReady ? PIPELINE_STAGES.length - 1 : getStageIndex(step);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        {isFailed ? (
          <div className="w-16 h-16 mx-auto rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-danger" />
          </div>
        ) : isReady ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center"
          >
            <CheckCircle2 className="w-7 h-7 text-success" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-secondary/20 to-accent/20 border border-secondary/20 flex items-center justify-center"
          >
            <Sparkles className="w-7 h-7 text-secondary-light" />
          </motion.div>
        )}

        <h2 className="text-xl font-bold text-text-primary">
          {isFailed ? "Erro no processamento" : isReady ? "Vídeo pronto!" : "Processando vídeo..."}
        </h2>

        {!isFailed && !isReady && (
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Isso pode levar 10–20 minutos para um podcast de 2h. Você pode fechar esta aba — vamos te avisar quando terminar.
          </p>
        )}
      </div>

      {/* Error card */}
      {isFailed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-danger/5 border border-danger/20 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger leading-snug">
              {errorMessage ?? "Ocorreu um erro durante o processamento do vídeo."}
            </p>
          </div>
          <button
            onClick={() => void retry()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger text-sm font-medium transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar de novo
          </button>
        </motion.div>
      )}

      {/* Progress bar */}
      {!isFailed && (
        <div className="space-y-2">
          <div className="h-2 bg-bg-card rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-secondary to-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${isReady ? 100 : progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-text-muted text-right tabular-nums">
            {isReady ? 100 : progress}%
          </p>
        </div>
      )}

      {/* Pipeline stages */}
      <div className="space-y-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const stStatus: StageStatus = isFailed
            ? i < currentStageIndex ? "done" : "idle"
            : getStageStatus(i, currentStageIndex);

          return (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                stStatus === "done"
                  ? "bg-success/5 border-success/20"
                  : stStatus === "active"
                  ? "bg-secondary/5 border-secondary/20"
                  : "bg-bg-card/50 border-border"
              }`}
            >
              {stStatus === "done" ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              ) : stStatus === "active" ? (
                <Loader2 className="w-5 h-5 text-secondary-light shrink-0 animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-border shrink-0" />
              )}
              <span
                className={`text-sm ${
                  stStatus === "done"
                    ? "text-success"
                    : stStatus === "active"
                    ? "text-text-primary font-medium"
                    : "text-text-muted"
                }`}
              >
                {stage.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Cost estimate */}
      {costCents !== null && costCents > 0 && (
        <p className="text-[11px] text-text-muted text-center">
          Estimativa de custo: R$ {(costCents * 6).toFixed(2)}
        </p>
      )}
    </div>
  );
}
