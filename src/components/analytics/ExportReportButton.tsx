"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useCreateAgencyReport } from "@/hooks/useAgencyReport";
import { useConnections } from "@/hooks/useConnections";

/* ── Local types ─────────────────────────────────────────────────────────── */

type AgencyReportProvider = "instagram" | "facebook" | "meta_ads";

/* ── Props ───────────────────────────────────────────────────────────────── */

export type ExportScope = "panorama" | "instagram" | "facebook" | "meta_ads";

export interface ExportReportButtonProps {
  empresaId: string;
  periodStart: string;
  periodEnd: string;
  scope: ExportScope;
}

/* ── Helper: scope → default providers ──────────────────────────────────── */

function scopeToProviders(scope: ExportScope): AgencyReportProvider[] {
  if (scope === "panorama") return ["instagram", "facebook", "meta_ads"];
  return [scope as AgencyReportProvider];
}

/* ── Loading steps text ──────────────────────────────────────────────────── */

const STEPS = [
  "Coletando dados...",
  "Gerando análise IA...",
  "Renderizando PDF...",
] as const;

/* ── Sub-component: Checkbox row ─────────────────────────────────────────── */

const PROVIDER_LABELS: Record<AgencyReportProvider, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  meta_ads: "Meta Ads",
};

function ProviderCheckbox({
  provider,
  checked,
  onChange,
  disabled,
}: {
  provider: AgencyReportProvider;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
          checked
            ? "bg-accent border-accent"
            : "border-border group-hover:border-accent/50 bg-transparent"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg
            width="8"
            height="6"
            viewBox="0 0 8 6"
            fill="none"
            className="text-white"
          >
            <path
              d="M1 3L3 5L7 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-[13px] text-text-primary">
        {PROVIDER_LABELS[provider]}
      </span>
    </label>
  );
}

/* ── Sub-component: Step progress ───────────────────────────────────────── */

function LoadingSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-2">
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={label} className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {done ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : active ? (
                <Loader2 size={14} className="text-accent animate-spin" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-border/60" />
              )}
            </div>
            <span
              className={`text-[12px] transition-colors ${
                done
                  ? "text-emerald-400 line-through"
                  : active
                  ? "text-text-primary font-medium"
                  : "text-text-muted"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function ExportReportButton({
  empresaId,
  periodStart,
  periodEnd,
  scope,
}: ExportReportButtonProps) {
  const router = useRouter();
  const { isConnected } = useConnections();
  const { create, loading, error } = useCreateAgencyReport();

  const [open, setOpen] = useState(false);
  const [outputMode, setOutputMode] = useState<"view" | "pdf">("view");
  const [selectedProviders, setSelectedProviders] = useState<
    AgencyReportProvider[]
  >(scopeToProviders(scope));
  const [localPeriodStart, setLocalPeriodStart] = useState(periodStart);
  const [localPeriodEnd, setLocalPeriodEnd] = useState(periodEnd);
  const [loadingStep, setLoadingStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  /* Sync period when prop changes */
  useEffect(() => {
    setLocalPeriodStart(periodStart);
  }, [periodStart]);

  useEffect(() => {
    setLocalPeriodEnd(periodEnd);
  }, [periodEnd]);

  /* Reset state when modal opens */
  function handleOpen() {
    setSelectedProviders(scopeToProviders(scope));
    setLocalPeriodStart(periodStart);
    setLocalPeriodEnd(periodEnd);
    setOutputMode("view");
    setLoadingStep(0);
    setSuccess(false);
    setLocalError(null);
    setOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
    setTimeout(() => {
      setLoadingStep(0);
      setSuccess(false);
      setLocalError(null);
    }, 300);
  }

  function toggleProvider(p: AgencyReportProvider, checked: boolean) {
    setSelectedProviders((prev) =>
      checked ? [...prev, p] : prev.filter((x) => x !== p)
    );
  }

  /* Simula steps de progresso durante a geração */
  const simulateSteps = useCallback((): (() => void) => {
    let step = 0;
    setLoadingStep(0);

    const t1 = setTimeout(() => {
      step = 1;
      setLoadingStep(1);
    }, 2500);

    const t2 = setTimeout(() => {
      step = 2;
      setLoadingStep(2);
    }, 5500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      void step;
    };
  }, []);

  async function handleSubmit() {
    if (selectedProviders.length === 0) {
      setLocalError("Selecione ao menos uma rede social.");
      return;
    }

    setLocalError(null);
    const cleanup = simulateSteps();

    try {
      const result = await create({
        periodStart: localPeriodStart,
        periodEnd: localPeriodEnd,
        providers: selectedProviders,
        recipients: [],
      });

      cleanup();

      if (!result) {
        setLocalError(error ?? "Erro desconhecido ao gerar relatório.");
        setLoadingStep(0);
        return;
      }

      setSuccess(true);
      setLoadingStep(STEPS.length);

      /* Pequena pausa para mostrar o sucesso */
      await new Promise((r) => setTimeout(r, 800));

      if (outputMode === "pdf" && result.pdfUrl) {
        /* Abre PDF em nova aba */
        const a = document.createElement("a");
        a.href = result.pdfUrl;
        a.target = "_blank";
        a.download = `relatorio-agencia-${localPeriodStart}-${localPeriodEnd}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        handleClose();
      } else {
        /* Redireciona para a tela de visualização */
        if (result.reportId) {
          handleClose();
          router.push(`/relatorios/${result.reportId}`);
        } else {
          handleClose();
          router.push("/relatorios");
        }
      }
    } catch (err) {
      cleanup();
      setLocalError(
        err instanceof Error ? err.message : "Erro ao gerar relatório."
      );
      setLoadingStep(0);
    }
  }

  /* Providers disponíveis: filtra por conectados (exceto se scope for específico) */
  const ALL_PROVIDERS: AgencyReportProvider[] = [
    "instagram",
    "facebook",
    "meta_ads",
  ];

  const availableProviders =
    scope === "panorama"
      ? ALL_PROVIDERS.filter((p) => isConnected(p))
      : ([scope] as AgencyReportProvider[]);

  const showProviderList = scope === "panorama" && availableProviders.length > 1;

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary border border-border/60 hover:border-border hover:bg-bg-elevated transition-all duration-150"
        aria-label="Exportar relatório"
      >
        <Download size={13} />
        <span className="hidden sm:inline">Exportar Relatório</span>
      </button>

      {/* ── Modal ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div
            className="relative w-full max-w-[480px] bg-bg-input border border-border/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                  <Download size={14} className="text-accent" />
                </div>
                <h2
                  id="export-dialog-title"
                  className="text-[15px] font-semibold text-text-primary"
                >
                  Exportar Relatório
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors duration-150 disabled:opacity-40"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Loading state */}
              {loading && (
                <div className="space-y-3">
                  <p className="text-[12px] text-text-secondary">
                    Gerando seu relatório... isso pode levar até 30 segundos.
                  </p>
                  <LoadingSteps currentStep={loadingStep} />
                </div>
              )}

              {/* Success state */}
              {success && !loading && (
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 size={16} />
                  <p className="text-[13px] font-medium">
                    Relatório gerado com sucesso!
                  </p>
                </div>
              )}

              {/* Form state */}
              {!loading && !success && (
                <>
                  {/* Período */}
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-2">
                      Período
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={localPeriodStart}
                        onChange={(e) => setLocalPeriodStart(e.target.value)}
                        className="flex-1 h-9 bg-bg-card border border-border text-text-primary rounded-lg px-3 text-[13px] outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                      />
                      <span className="flex items-center text-[12px] text-text-muted px-1">
                        até
                      </span>
                      <input
                        type="date"
                        value={localPeriodEnd}
                        onChange={(e) => setLocalPeriodEnd(e.target.value)}
                        className="flex-1 h-9 bg-bg-card border border-border text-text-primary rounded-lg px-3 text-[13px] outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Redes sociais (só mostra no panorama com múltiplas opções) */}
                  {showProviderList && (
                    <div>
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-2">
                        Incluir redes
                      </label>
                      <div className="space-y-2.5 pl-0.5">
                        {availableProviders.map((p) => (
                          <ProviderCheckbox
                            key={p}
                            provider={p}
                            checked={selectedProviders.includes(p)}
                            onChange={(v) => toggleProvider(p, v)}
                            disabled={false}
                          />
                        ))}
                      </div>
                      {availableProviders.length === 0 && (
                        <p className="text-[12px] text-text-muted">
                          Nenhuma rede conectada compatível com o relatório de
                          agência.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Output mode */}
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-2">
                      Formato de saída
                    </label>
                    <div className="space-y-2 pl-0.5">
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="outputMode"
                          value="view"
                          checked={outputMode === "view"}
                          onChange={() => setOutputMode("view")}
                          className="mt-0.5 accent-[var(--color-accent)]"
                        />
                        <div>
                          <p className="text-[13px] text-text-primary font-medium">
                            Visualizar em /relatorios
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Abre o relatório completo na plataforma
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="outputMode"
                          value="pdf"
                          checked={outputMode === "pdf"}
                          onChange={() => setOutputMode("pdf")}
                          className="mt-0.5 accent-[var(--color-accent)]"
                        />
                        <div>
                          <p className="text-[13px] text-text-primary font-medium">
                            Baixar PDF agora
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Gera e faz download do PDF diretamente
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Error */}
                  {(localError ?? error) && (
                    <div className="flex items-start gap-2 text-[12px] text-[#f87171] px-3 py-2.5 bg-[#f87171]/[0.06] border border-[#f87171]/20 rounded-lg">
                      <AlertCircle
                        size={13}
                        className="shrink-0 mt-0.5 text-[#f87171]"
                      />
                      <span>{localError ?? error}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!loading && !success && (
              <div className="flex items-center justify-end gap-2 px-5 pb-5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 h-9 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border rounded-lg transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={selectedProviders.length === 0}
                  className="flex items-center gap-1.5 px-4 h-9 text-[12px] font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={13} />
                  Gerar Relatório
                </button>
              </div>
            )}

            {/* Footer during loading */}
            {loading && (
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <Loader2 size={11} className="animate-spin" />
                  Por favor, aguarde...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
