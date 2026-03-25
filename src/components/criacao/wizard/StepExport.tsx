"use client";

import { useState } from "react";
import {
  Save,
  Calendar,
  Copy,
  Check,
  BookmarkPlus,
  RefreshCw,
  FileText,
  Layers,
  Video,
  Mail,
  PenTool,
} from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { CreationTemplate, ContentFormat } from "@/types/ai";
import type { Post } from "@/types";
import { getPlataformaLabel } from "@/lib/utils";

interface StepExportProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  createPost: (data: Omit<Post, "id" | "created_at" | "metricas">) => Promise<Post | null>;
  saveTemplate: (template: CreationTemplate) => CreationTemplate;
  empresaId: string;
  onReset: () => void;
}

const FORMAT_ICONS: Record<ContentFormat, typeof FileText> = {
  post: FileText,
  carrossel: Layers,
  reels: Video,
  email: Mail,
  copy: PenTool,
};

const FORMAT_LABELS: Record<ContentFormat, string> = {
  post: "Post",
  carrossel: "Carrossel",
  reels: "Reels",
  email: "Email",
  copy: "Copy",
};

export function StepExport({
  state,
  setField,
  createPost,
  saveTemplate,
  empresaId,
  onReset,
}: StepExportProps) {
  const [copied, setCopied] = useState(false);
  const [savedPost, setSavedPost] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [templateName, setTemplateName] = useState(state.templateName || "");

  const { result, visualMode, visualLegenda, visualCta } = state;

  const getTitle = () => {
    if (visualMode && state.visualSlides.length > 0) {
      return state.visualSlides[0]?.titulo || "Conteudo visual";
    }
    return result?.titulo || "Conteudo gerado";
  };

  const getContent = () => {
    if (visualMode) return visualLegenda;
    return result?.conteudo || "";
  };

  const FormatIcon = FORMAT_ICONS[state.format];

  const handleSaveDraft = async () => {
    setField("saving", true);
    const post = await createPost({
      empresa_id: empresaId,
      titulo: getTitle(),
      conteudo: getContent(),
      midia_url: state.generatedImageUrl || null,
      plataformas: state.platforms,
      status: "rascunho",
      agendado_para: null,
      publicado_em: null,
      tematica: state.topic,
    });
    setField("saving", false);
    if (post) {
      setSavedPost(true);
      setField("saved", true);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setField("saving", true);
    const post = await createPost({
      empresa_id: empresaId,
      titulo: getTitle(),
      conteudo: getContent(),
      midia_url: state.generatedImageUrl || null,
      plataformas: state.platforms,
      status: "agendado",
      agendado_para: new Date(scheduleDate).toISOString(),
      publicado_em: null,
      tematica: state.topic,
    });
    setField("saving", false);
    if (post) {
      setSavedPost(true);
      setField("saved", true);
    }
  };

  const handleCopy = async () => {
    const text = [
      getTitle(),
      "",
      getContent(),
      "",
      result?.hashtags?.map((h) => `#${h.replace("#", "")}`).join(" ") || "",
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;

    const template: CreationTemplate = {
      id: state.templateId || crypto.randomUUID(),
      empresa_id: empresaId,
      name: templateName.trim(),
      tone: state.tone,
      platforms: state.platforms,
      site_url: state.siteUrl || undefined,
      instagram_username: state.igUsername || undefined,
      site_analysis: state.siteAnalysis,
      ig_analysis: state.fullIgAnalysis,
      visual_style: state.fullIgAnalysis?.visual_style || null,
      brand_colors: state.fullIgAnalysis?.visual_style?.background?.colors || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveTemplate(template);
    setSavedTemplate(true);
  };

  if (state.saved && savedPost) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
          <Check size={32} className="text-success" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Conteudo salvo!</h3>
          <p className="text-sm text-text-secondary">
            Seu conteudo foi salvo com sucesso.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all"
        >
          <RefreshCw size={14} />
          Criar outro conteudo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-text-primary text-center">
        Finalizar
      </h2>

      {/* Summary card */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <FormatIcon size={22} className="text-accent-light" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {getTitle()}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-light font-medium">
                {FORMAT_LABELS[state.format]}
              </span>
              <span className="text-xs text-text-muted">
                {state.platforms.map(getPlataformaLabel).join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Save as draft */}
        <button
          onClick={handleSaveDraft}
          disabled={state.saving}
          className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-bg-card-hover transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Save size={18} className="text-accent-light" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">Salvar como Rascunho</p>
            <p className="text-xs text-text-muted mt-0.5">Salvar para editar depois</p>
          </div>
        </button>

        {/* Schedule */}
        <div>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-bg-card-hover transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
              <Calendar size={18} className="text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">Agendar Publicacao</p>
              <p className="text-xs text-text-muted mt-0.5">Escolha data e horario</p>
            </div>
          </button>
          {showSchedule && (
            <div className="mt-2 flex items-center gap-3 bg-bg-card border border-border rounded-xl p-4">
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={handleSchedule}
                disabled={!scheduleDate || state.saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-warning text-bg-primary hover:bg-warning/90 disabled:opacity-40 transition-all"
              >
                Agendar
              </button>
            </div>
          )}
        </div>

        {/* Copy text */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-bg-card-hover transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
            {copied ? (
              <Check size={18} className="text-success" />
            ) : (
              <Copy size={18} className="text-info" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {copied ? "Copiado!" : "Copiar Texto"}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Copiar conteudo para a area de transferencia</p>
          </div>
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Save as template */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <BookmarkPlus size={16} className="text-accent-light" />
          <h3 className="text-sm font-semibold text-text-primary">Salvar como Template</h3>
        </div>

        {savedTemplate ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <Check size={14} />
            Template salvo!
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nome do template..."
              className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-40 transition-all shrink-0"
            >
              {state.templateId ? "Atualizar" : "Salvar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
