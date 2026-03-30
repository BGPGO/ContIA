"use client";

import { useState } from "react";
import { Settings, LayoutTemplate } from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePosts } from "@/hooks/usePosts";
import { useTemplates } from "@/hooks/useTemplates";
import { useCreationWizard } from "@/hooks/useCreationWizard";
import { WizardShell } from "@/components/criacao/wizard/WizardShell";
import { StepTemplate } from "@/components/criacao/wizard/StepTemplate";
import { StepAnalysis } from "@/components/criacao/wizard/StepAnalysis";
import { StepFormat } from "@/components/criacao/wizard/StepFormat";
import { StepGenerate } from "@/components/criacao/wizard/StepGenerate";
import { StepVisualizar } from "@/components/criacao/wizard/StepVisualizar";
import { StepExport } from "@/components/criacao/wizard/StepExport";
import type { EmpresaContext } from "@/types/ai";

export default function CriacaoPage() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id || "";
  const { createPost } = usePosts(empresaId || undefined);
  const { templates, loading: templatesLoading, saveTemplate, removeTemplate } = useTemplates(empresaId || undefined);

  const wizard = useCreationWizard();
  const { state, dispatch } = wizard;

  // Show config panel (templates + analysis) as overlay
  const [showConfig, setShowConfig] = useState(false);

  const empresaContext: EmpresaContext | null = empresa
    ? {
        nome: empresa.nome,
        descricao: empresa.descricao || "",
        nicho: empresa.nicho || "",
        website: empresa.website || undefined,
      }
    : null;

  // ── The wizard starts at step 2 (Configurar) by default ──
  // Steps 0 (Template) and 1 (Referências) are accessible via "Configurações" button
  // Remapped steps for the main flow: 2=Configurar, 3=Gerar, 4=Preview, 5=Finalizar

  const handleBack = () => {
    if (showConfig) {
      setShowConfig(false);
      return;
    }
    if (state.currentStep === 3 || state.currentStep === 4) {
      wizard.setStep(2);
      return;
    }
    if (state.currentStep === 5) {
      wizard.setStep(4);
      return;
    }
    if (state.currentStep === 2) {
      // Already at start — do nothing
      return;
    }
    wizard.setStep(Math.max(2, state.currentStep - 1));
  };

  const handleNext = () => {
    if (state.currentStep === 2) {
      wizard.clearResults();
      wizard.setStep(3);
      return;
    }
    if (state.currentStep === 4) {
      wizard.setStep(5);
      return;
    }
    wizard.setStep(Math.min(5, state.currentStep + 1));
  };

  const getNextConfig = () => {
    switch (state.currentStep) {
      case 2:
        return { show: true, label: "Gerar conteúdo", disabled: !state.topic.trim() };
      case 3:
        return { show: false, label: "", disabled: false };
      case 4:
        return { show: true, label: "Finalizar", disabled: false };
      case 5:
        return { show: false, label: "", disabled: false };
      default:
        return { show: true, label: "Próximo", disabled: false };
    }
  };

  const nextConfig = getNextConfig();

  // ── Config overlay (Templates + Analysis) ──
  if (showConfig) {
    const configStep = state.currentStep < 2 ? state.currentStep : 0;
    return (
      <div className="fade-in space-y-6 p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Configurações de Criação</h1>
            <p className="text-sm text-text-secondary mt-1">Templates e referências para a IA</p>
          </div>
          <button
            onClick={() => {
              setShowConfig(false);
              if (state.currentStep < 2) wizard.setStep(2);
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Voltar ao Criador
          </button>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { if (state.currentStep !== 0) wizard.setStep(0); }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              configStep === 0
                ? "bg-bg-card border border-border-light text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-card/50"
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => { if (state.currentStep !== 1) wizard.setStep(1); }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              configStep === 1
                ? "bg-bg-card border border-border-light text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-card/50"
            }`}
          >
            Referências (Site + Instagram)
          </button>
        </div>

        {configStep === 0 ? (
          <StepTemplate
            templates={templates}
            loading={templatesLoading}
            onSelect={(template) => {
              wizard.loadTemplate(template);
              setShowConfig(false);
              wizard.setStep(2);
            }}
            onCreate={() => {
              wizard.setStep(1);
            }}
            onDelete={(id) => removeTemplate(id)}
          />
        ) : (
          <StepAnalysis
            state={state}
            setField={wizard.setField}
            setSiteAnalysis={wizard.setSiteAnalysis}
            setIgAnalysis={wizard.setIgAnalysis}
            setError={wizard.setError}
          />
        )}
      </div>
    );
  }

  // ── Main creation flow (starts at step 2) ──
  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
      case 1:
        // Redirect to step 2
        wizard.setStep(2);
        return null;
      case 2:
        return (
          <StepFormat
            state={state}
            setField={wizard.setField}
            selectSuggestion={wizard.selectSuggestion}
          />
        );
      case 3:
        return (
          <StepGenerate
            state={state}
            dispatch={dispatch}
            setField={wizard.setField}
            setGenerationResult={wizard.setGenerationResult}
            setVisualResult={wizard.setVisualResult}
            setError={wizard.setError}
            empresaContext={empresaContext}
          />
        );
      case 4:
        return (
          <StepVisualizar
            state={state}
            setField={wizard.setField}
            empresa={empresa}
            onRegenerate={() => {
              wizard.clearResults();
              wizard.setStep(3);
            }}
          />
        );
      case 5:
        return (
          <StepExport
            state={state}
            setField={wizard.setField}
            createPost={createPost}
            saveTemplate={saveTemplate}
            empresaId={empresaId}
            onReset={wizard.reset}
          />
        );
      default:
        return null;
    }
  };

  // Remap steps for progress display (only show 4 main steps)
  const mainSteps = [
    { fromStep: 2, label: "Configurar" },
    { fromStep: 3, label: "Gerar" },
    { fromStep: 4, label: "Visualizar" },
    { fromStep: 5, label: "Finalizar" },
  ];
  const mappedStep = mainSteps.findIndex((s) => s.fromStep === state.currentStep);

  return (
    <div className="fade-in">
      {/* Top bar with config button */}
      <div className="flex items-center justify-between px-6 pt-4 max-w-4xl mx-auto">
        <div className="page-header !border-0 !pb-0 !mb-0">
          <h1 className="!text-xl">Criar Conteúdo</h1>
          {empresa && <p className="!text-sm">{empresa.nome}</p>}
        </div>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <button
              onClick={() => { setShowConfig(true); wizard.setStep(0); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-colors"
            >
              <LayoutTemplate size={14} />
              Templates ({templates.length})
            </button>
          )}
          <button
            onClick={() => { setShowConfig(true); wizard.setStep(1); }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-colors"
          >
            <Settings size={14} />
            Configurações
            {(state.siteAnalysis || state.fullIgAnalysis) && (
              <span className="w-2 h-2 rounded-full bg-success" />
            )}
          </button>
        </div>
      </div>

      <WizardShell
        currentStep={mappedStep >= 0 ? mappedStep : 0}
        onBack={handleBack}
        onNext={handleNext}
        nextLabel={nextConfig.label}
        nextDisabled={nextConfig.disabled}
        showBack={state.currentStep > 2 && state.currentStep !== 3}
        showNext={nextConfig.show}
        loading={state.generating}
      >
        {renderStep()}
      </WizardShell>
    </div>
  );
}
