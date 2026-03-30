"use client";

import { useState } from "react";
import {
  FileText,
  Layers,
  Video,
  Mail,
  PenTool,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { ContentFormat, ContentTone, SuggestedPost } from "@/types/ai";
import { SuggestedPosts } from "@/components/criacao/SuggestedPosts";
import { getPlataformaCor, getPlataformaLabel } from "@/lib/utils";

interface StepFormatProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  selectSuggestion: (suggestion: SuggestedPost) => void;
}

const FORMATS: { value: ContentFormat; label: string; icon: typeof FileText }[] = [
  { value: "post", label: "Post", icon: FileText },
  { value: "carrossel", label: "Carrossel", icon: Layers },
  { value: "reels", label: "Reels", icon: Video },
  { value: "email", label: "Email", icon: Mail },
  { value: "copy", label: "Copy", icon: PenTool },
];

const TONES: { value: ContentTone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "tecnico", label: "Tecnico" },
  { value: "divertido", label: "Divertido" },
  { value: "inspirador", label: "Inspirador" },
];

const PLATFORMS = ["instagram", "facebook", "linkedin", "twitter", "youtube", "tiktok"];

export function StepFormat({ state, setField, selectSuggestion }: StepFormatProps) {
  const [showInstructions, setShowInstructions] = useState(!!state.additionalInstructions);

  const togglePlatform = (platform: string) => {
    const current = state.platforms;
    if (current.includes(platform)) {
      if (current.length > 1) {
        setField("platforms", current.filter((p) => p !== platform));
      }
    } else {
      setField("platforms", [...current, platform]);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Suggestions from IG */}
      {state.fullIgAnalysis?.suggested_next_posts?.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-secondary">
            Sugestoes baseadas no seu Instagram
          </h3>
          <SuggestedPosts
            suggestions={state.fullIgAnalysis.suggested_next_posts}
            onSelect={selectSuggestion}
          />
        </div>
      ) : null}

      {/* Format selector */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">Formato</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {FORMATS.map((fmt) => {
            const isActive = state.format === fmt.value;
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.value}
                onClick={() => setField("format", fmt.value)}
                className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "border-[#4ecdc4] bg-gradient-to-br from-[#4ecdc4]/10 to-transparent text-[#4ecdc4] shadow-[0_0_15px_rgba(78,205,196,0.15)]"
                    : "border-border bg-bg-card text-text-secondary hover:border-border-light hover:bg-bg-card-hover"
                }`}
              >
                <Icon size={20} />
                <span className="text-xs">{fmt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tone selector */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">Tom</h3>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => {
            const isActive = state.tone === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setField("tone", t.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white shadow-[0_0_15px_rgba(78,205,196,0.2)]"
                    : "bg-bg-card border border-border text-text-secondary hover:border-border-light hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Platform checkboxes */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">Plataformas</h3>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const isActive = state.platforms.includes(p);
            const color = getPlataformaCor(p);
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-bg-card border-2 text-text-primary ring-1 ring-[#4ecdc4]/20"
                    : "bg-bg-input border border-border text-text-muted hover:text-text-secondary hover:border-border-light"
                }`}
                style={isActive ? { borderColor: `${color}60` } : undefined}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? color : undefined }}
                />
                {getPlataformaLabel(p)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic input */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">Tema do conteudo</h3>
        <textarea
          value={state.topic}
          onChange={(e) => setField("topic", e.target.value)}
          placeholder="Sobre o que quer criar? Descreva o tema, ideia ou objetivo do conteudo..."
          rows={3}
          className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Additional instructions (collapsible) */}
      <div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          {showInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Instrucoes adicionais para a IA
        </button>
        {showInstructions && (
          <textarea
            value={state.additionalInstructions}
            onChange={(e) => setField("additionalInstructions", e.target.value)}
            placeholder="Ex: Use dados estatisticos, inclua emoji, mencione concorrentes..."
            rows={2}
            className="w-full mt-2 bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50 transition-colors"
          />
        )}
      </div>

      {/* Visual mode toggle */}
      {state.fullIgAnalysis && (
        <div className="flex items-center justify-between bg-bg-card border border-border rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Modo Visual</p>
            <p className="text-xs text-text-muted mt-0.5">
              Gerar design visual baseado no estilo do Instagram
            </p>
          </div>
          <button
            onClick={() => setField("visualMode", !state.visualMode)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              state.visualMode ? "bg-accent" : "bg-border"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                state.visualMode ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
