"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type {
  GeneratedContent,
  EmpresaContext,
} from "@/types/ai";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";

interface StepGenerateProps {
  state: WizardState;
  dispatch: React.Dispatch<any>;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  setGenerationResult: (result: GeneratedContent) => void;
  setVisualResult: (slides: any[], legenda: string, hashtags: string[], cta: string) => void;
  setError: (error: string | null) => void;
  empresaContext: EmpresaContext | null;
}

const PROGRESS_STEPS = [
  "Entendendo contexto...",
  "Criando texto...",
  "Refinando...",
  "Finalizando...",
];

export function StepGenerate({
  state,
  dispatch,
  setField,
  setGenerationResult,
  setVisualResult,
  setError,
  empresaContext,
}: StepGenerateProps) {
  const { empresa } = useEmpresa();
  const { dna } = useMarcaDNA(empresa?.id);
  const [progressIndex, setProgressIndex] = useState(0);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.generating) return;
    const interval = setInterval(() => {
      setProgressIndex((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [state.generating]);

  const generate = async () => {
    setField("generating", true);
    setError(null);
    setProgressIndex(0);

    if (!empresa) {
      setError("Selecione uma empresa primeiro");
      setField("generating", false);
      return;
    }

    const context: EmpresaContext = empresaContext || {
      nome: "",
      descricao: "",
      nicho: "",
    };

    if (state.siteAnalysis) {
      context.siteAnalysis = JSON.stringify(state.siteAnalysis);
    }
    if (state.fullIgAnalysis) {
      context.instagramAnalysis = JSON.stringify(state.fullIgAnalysis);
    }

    // Enrich with DNA da Marca if available
    if (dna?.dna_sintetizado) {
      const ds = dna.dna_sintetizado;
      context.tom = ds.tom_de_voz as any || context.tom;
      context.dnaMarca = JSON.stringify(ds);
      // Backfill site/ig analysis from DNA if not already set
      if (!context.siteAnalysis && dna.site_analysis) {
        context.siteAnalysis = JSON.stringify(dna.site_analysis);
      }
      if (!context.instagramAnalysis && dna.instagram_analysis) {
        context.instagramAnalysis = JSON.stringify(dna.instagram_analysis);
      }
    }

    try {
      if (state.visualMode && state.fullIgAnalysis) {
        const res = await fetch("/api/ai/generate-post-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: state.format,
            topic: state.topic,
            empresaContext: context,
            plataformas: state.platforms,
            tone: state.tone,
            additionalInstructions: state.additionalInstructions || undefined,
            visualStyle: state.fullIgAnalysis.visual_style,
            empresa_id: empresa.id,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Falha ao gerar conteudo visual");
        }
        const data = await res.json();

        setVisualResult(
          data.slides || [],
          data.legenda || "",
          data.hashtags || [],
          data.cta || ""
        );
      } else {
        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: state.format,
            topic: state.topic,
            empresaContext: context,
            plataformas: state.platforms,
            tone: state.tone,
            additionalInstructions: state.additionalInstructions || undefined,
            empresa_id: empresa.id,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Falha ao gerar conteudo");
        }
        const data = await res.json();
        setGenerationResult(data);
      }

      dispatch({ type: "SET_STEP", step: 4 });
    } catch (err: any) {
      setError(err.message || "Erro inesperado na geracao");
      setField("generating", false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
      {state.error ? (
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center">
            <AlertCircle size={32} className="text-danger" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-text-primary">Erro na geracao</h3>
            <p className="text-sm text-text-secondary max-w-md">{state.error}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-card border border-border transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                triggeredRef.current = false;
                generate();
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {/* Animated sparkle icon */}
          <div className="relative">
            <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-accent/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-[0_0_40px_rgba(108,92,231,0.3)]">
              <Sparkles size={36} className="text-white" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-text-primary">
              Gerando conteudo...
            </h3>
            <div className="flex items-center gap-2 justify-center text-sm text-text-secondary">
              <Loader2 size={14} className="animate-spin text-accent-light" />
              {PROGRESS_STEPS[progressIndex]}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {PROGRESS_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= progressIndex
                    ? "w-8 bg-accent"
                    : "w-4 bg-border"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
            className="mt-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
