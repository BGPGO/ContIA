"use client";

import { Plus, Trash2, AtSign } from "lucide-react";
import type { CreationTemplate } from "@/types/ai";
import { getPlataformaCor } from "@/lib/utils";

interface StepTemplateProps {
  templates: CreationTemplate[];
  loading: boolean;
  onSelect: (template: CreationTemplate) => void;
  onCreate: () => void;
  onDelete: (templateId: string) => void;
}

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  casual: "Casual",
  tecnico: "Tecnico",
  divertido: "Divertido",
  inspirador: "Inspirador",
};

export function StepTemplate({
  templates,
  loading,
  onSelect,
  onCreate,
  onDelete,
}: StepTemplateProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">
          Como voce quer comecar?
        </h2>
        <p className="text-sm text-text-secondary">
          Selecione um template salvo ou crie um novo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Create new card */}
        <button
          onClick={onCreate}
          className="group bg-bg-card border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[140px] hover:border-accent/50 hover:bg-bg-card-hover transition-all cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Plus size={24} className="text-accent-light" />
          </div>
          <span className="text-sm font-semibold text-text-primary group-hover:text-accent-light transition-colors">
            Criar do zero
          </span>
        </button>

        {/* Template cards */}
        {loading ? (
          <div className="bg-bg-card border border-border rounded-xl p-5 flex items-center justify-center min-h-[140px]">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="group relative bg-bg-card border border-border rounded-xl p-5 text-left hover:border-border-light hover:bg-bg-card-hover transition-all cursor-pointer"
            >
              {/* Delete button */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(template.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    onDelete(template.id);
                  }
                }}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-text-muted hover:text-danger transition-all"
              >
                <Trash2 size={14} />
              </div>

              <div className="space-y-3">
                {/* Name */}
                <h3 className="font-semibold text-sm text-text-primary pr-6">
                  {template.name}
                </h3>

                {/* Tone badge */}
                <span className="inline-block text-[10px] px-2.5 py-1 rounded-full bg-accent/10 text-accent-light font-medium">
                  {TONE_LABELS[template.tone] || template.tone}
                </span>

                {/* Platform dots */}
                <div className="flex items-center gap-1.5">
                  {template.platforms.map((p) => (
                    <div
                      key={p}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getPlataformaCor(p) }}
                      title={p}
                    />
                  ))}
                </div>

                {/* IG analysis indicator */}
                {template.instagram_username && (
                  <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                    <AtSign size={11} />
                    <span>{template.instagram_username}</span>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {!loading && templates.length === 0 && (
        <p className="text-center text-sm text-text-muted pt-2">
          Voce ainda nao tem templates salvos. Crie seu primeiro conteudo!
        </p>
      )}
    </div>
  );
}
