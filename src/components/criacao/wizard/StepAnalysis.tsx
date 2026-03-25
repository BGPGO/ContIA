"use client";

import { useState } from "react";
import { Globe, AtSign, Loader2, Check, AlertCircle } from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { AnalyzeSiteResponse, FullInstagramAnalysis } from "@/types/ai";

interface StepAnalysisProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  setSiteAnalysis: (data: AnalyzeSiteResponse) => void;
  setIgAnalysis: (data: FullInstagramAnalysis) => void;
  setError: (error: string | null) => void;
}

const IG_LOADING_STEPS = [
  "Buscando perfil...",
  "Analisando posts...",
  "Processando estilo...",
];

export function StepAnalysis({
  state,
  setField,
  setSiteAnalysis,
  setIgAnalysis,
  setError,
}: StepAnalysisProps) {
  const [igStepIndex, setIgStepIndex] = useState(0);

  const analyzeSite = async () => {
    if (!state.siteUrl.trim()) return;
    setField("analyzingSite", true);
    setError(null);

    try {
      const res = await fetch("/api/ai/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.siteUrl.trim() }),
      });

      if (!res.ok) throw new Error("Falha ao analisar site");
      const data = await res.json();
      setSiteAnalysis(data);
    } catch (err: any) {
      setError(err.message || "Erro ao analisar site");
      setField("analyzingSite", false);
    }
  };

  const analyzeIg = async () => {
    if (!state.igUsername.trim()) return;
    setField("analyzingIg", true);
    setError(null);
    setIgStepIndex(0);

    // Progress simulation
    const interval = setInterval(() => {
      setIgStepIndex((prev) => Math.min(prev + 1, IG_LOADING_STEPS.length - 1));
    }, 3000);

    try {
      const res = await fetch("/api/ai/analyze-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: state.igUsername.trim().replace("@", "") }),
      });

      if (!res.ok) throw new Error("Falha ao analisar Instagram");
      const data = await res.json();
      setIgAnalysis(data);
    } catch (err: any) {
      setError(err.message || "Erro ao analisar Instagram");
      setField("analyzingIg", false);
    } finally {
      clearInterval(interval);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">
          Adicione suas referencias
        </h2>
        <p className="text-sm text-text-secondary">
          Analise seu site e Instagram para a IA entender seu estilo
        </p>
      </div>

      {state.error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
          <AlertCircle size={16} />
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Site Card */}
        <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
              <Globe size={18} className="text-info" />
            </div>
            <h3 className="font-semibold text-sm text-text-primary">Seu Site</h3>
            {state.siteAnalysis && (
              <Check size={16} className="text-success ml-auto" />
            )}
          </div>

          <input
            type="url"
            value={state.siteUrl}
            onChange={(e) => setField("siteUrl", e.target.value)}
            placeholder="https://seusite.com.br"
            disabled={state.analyzingSite}
            className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
          />

          {!state.siteAnalysis ? (
            <button
              onClick={analyzeSite}
              disabled={!state.siteUrl.trim() || state.analyzingSite}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {state.analyzingSite ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analisando...
                </>
              ) : (
                "Analisar"
              )}
            </button>
          ) : (
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Tom de voz</p>
                <p className="text-sm text-text-secondary">{state.siteAnalysis.tom_de_voz}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Publico-alvo</p>
                <p className="text-sm text-text-secondary">{state.siteAnalysis.publico_alvo}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {state.siteAnalysis.palavras_chave.slice(0, 5).map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instagram Card */}
        <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-instagram/10 flex items-center justify-center">
              <AtSign size={18} className="text-instagram" />
            </div>
            <h3 className="font-semibold text-sm text-text-primary">Seu Instagram</h3>
            {state.fullIgAnalysis && (
              <Check size={16} className="text-success ml-auto" />
            )}
          </div>

          <input
            type="text"
            value={state.igUsername}
            onChange={(e) => setField("igUsername", e.target.value)}
            placeholder="@seuperfil"
            disabled={state.analyzingIg}
            className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
          />

          {!state.fullIgAnalysis ? (
            <button
              onClick={analyzeIg}
              disabled={!state.igUsername.trim() || state.analyzingIg}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {state.analyzingIg ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {IG_LOADING_STEPS[igStepIndex]}
                </>
              ) : (
                "Analisar"
              )}
            </button>
          ) : (
            (() => {
              const igData = state.fullIgAnalysis!;
              const profile = igData.profile ?? igData;
              const vs = igData.visual_style;
              const estiloVisual = (profile as any).estilo_visual ?? (profile as any).resumo_visual ?? "Analisado";
              const tomLegendas = (profile as any).tom_legendas ?? "Não identificado";
              const formatos = (profile as any).formatos_mais_usados ?? [];
              const bgColors = vs?.background?.colors ?? [];
              return (
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Estilo visual</p>
                    <p className="text-sm text-text-secondary">{estiloVisual}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Tom das legendas</p>
                    <p className="text-sm text-text-secondary">{tomLegendas}</p>
                  </div>
                  {formatos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formatos.map((f: string) => (
                        <span
                          key={f}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-instagram/10 text-instagram font-medium"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {bgColors.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-text-muted">Paleta:</span>
                      {bgColors.map((c: string, i: number) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-md border border-border-light"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => { setField("fullIgAnalysis", null as any); }}
                    className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Re-analisar
                  </button>
                </div>
              );
            })()
          )}
        </div>
      </div>

      <p className="text-center text-xs text-text-muted">
        Esta etapa e opcional. Voce pode pular.
      </p>
    </div>
  );
}
