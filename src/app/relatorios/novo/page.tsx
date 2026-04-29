"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Calendar,
  Radio,
  Palette,
  CheckSquare,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useConnections } from "@/hooks/useConnections";
import { useCreateAgencyReport } from "@/hooks/useAgencyReport";
import type { ProviderKey } from "@/types/providers";
import type { ReportType } from "@/types/reports";

/* ── Report kind selector ────────────────────────────────────── */

type ReportKind = "standard" | "agency";

const REPORT_KINDS: {
  id: ReportKind;
  label: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge?: string;
}[] = [
  {
    id: "standard",
    label: "Relatório Padrão",
    description:
      "Relatório customizável com período, plataformas e template à sua escolha.",
    icon: FileText,
  },
  {
    id: "agency",
    label: "Relatório Agência",
    description:
      "Relatório completo separado por rede social — Instagram, Facebook e Meta Ads — com análise estratégica por canal.",
    icon: BarChart3,
    badge: "Novo",
  },
];

/* ── Step config ────────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: "Período", icon: Calendar },
  { id: 2, label: "Redes", icon: Radio },
  { id: 3, label: "Template", icon: Palette },
  { id: 4, label: "Confirmação", icon: CheckSquare },
];

/* ── Period tabs ─────────────────────────────────────────────── */

type PeriodPreset = "week" | "month" | "quarter" | "custom";

const PERIOD_PRESETS: { id: PeriodPreset; label: string; type: ReportType }[] = [
  { id: "week", label: "Última semana", type: "weekly" },
  { id: "month", label: "Último mês", type: "monthly" },
  { id: "quarter", label: "Último trimestre", type: "quarterly" },
  { id: "custom", label: "Personalizado", type: "custom" },
];

function getPeriodDates(preset: PeriodPreset): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case "week": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end: mEnd };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3 - 3, 1);
      const qEnd = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
      return { start, end: qEnd };
    }
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }
}

/* ── Template cards ─────────────────────────────────────────── */

type TemplateId = "executive" | "technical" | "client";

const TEMPLATES: { id: TemplateId; label: string; description: string; preview: React.ReactNode }[] = [
  {
    id: "executive",
    label: "Executivo",
    description: "Resumido e direto ao ponto. Ideal para apresentar para sócios e diretoria.",
    preview: (
      <div className="w-full h-20 bg-gradient-to-br from-bg-card-hover to-bg-secondary rounded-lg border border-border p-2.5 space-y-1.5">
        <div className="h-2 bg-accent/40 rounded w-3/4" />
        <div className="h-1.5 bg-border rounded w-full" />
        <div className="h-1.5 bg-border rounded w-5/6" />
        <div className="flex gap-1.5 mt-1">
          <div className="h-5 bg-emerald-400/20 rounded w-1/3" />
          <div className="h-5 bg-blue-400/20 rounded w-1/3" />
          <div className="h-5 bg-purple-400/20 rounded w-1/3" />
        </div>
      </div>
    ),
  },
  {
    id: "technical",
    label: "Técnico",
    description: "Análise completa com todas as métricas, gráficos e comparações detalhadas.",
    preview: (
      <div className="w-full h-20 bg-gradient-to-br from-bg-card-hover to-bg-secondary rounded-lg border border-border p-2.5 space-y-1.5">
        <div className="h-1.5 bg-border rounded w-full" />
        <div className="h-1.5 bg-border rounded w-full" />
        <div className="flex gap-1 mt-1">
          {[40, 60, 45, 70, 55, 80].map((h, i) => (
            <div key={i} className="flex-1 bg-accent/30 rounded-sm" style={{ height: `${h * 0.4}px` }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "client",
    label: "Cliente",
    description: "Visual atraente com highlights e recomendações. Perfeito para enviar a clientes.",
    preview: (
      <div className="w-full h-20 bg-gradient-to-br from-bg-card-hover to-bg-secondary rounded-lg border border-border p-2.5">
        <div className="h-2 bg-gradient-to-r from-accent/40 to-secondary/40 rounded w-2/3 mb-2" />
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-5 bg-border rounded" />
          <div className="h-5 bg-border rounded" />
          <div className="h-5 bg-border rounded" />
          <div className="h-5 bg-border rounded" />
        </div>
      </div>
    ),
  },
];

/* ── Provider names ─────────────────────────────────────────── */

const PROVIDER_NAMES: Partial<Record<ProviderKey, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  ga4: "Google Analytics",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  greatpages: "Greatpages",
  crm: "CRM",
};

/* ── Page ───────────────────────────────────────────────────── */

export default function NovoRelatorioPage() {
  const router = useRouter();
  const { empresa } = useEmpresa();
  const { connections, isConnected, loading: connectionsLoading } = useConnections();
  const { create: createAgencyReport, loading: agencyLoading, error: agencyError } = useCreateAgencyReport();

  /* ── Report kind (step 0) ─────────────────────────────────── */
  const [reportKind, setReportKind] = useState<ReportKind | null>(null);
  const [kindSelected, setKindSelected] = useState(false);

  /* ── Agency-specific state ────────────────────────────────── */
  const [agencyStart, setAgencyStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [agencyEnd, setAgencyEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [agencyRecipients, setAgencyRecipients] = useState<string>("");

  async function handleCreateAgency() {
    const result = await createAgencyReport({
      periodStart: new Date(agencyStart).toISOString(),
      periodEnd: new Date(agencyEnd).toISOString(),
    });
    if (result) {
      router.push(`/relatorios/${result.reportId}`);
    }
  }

  const [step, setStep] = useState(1);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selectedProviders, setSelectedProviders] = useState<ProviderKey[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("executive");
  const [reportName, setReportName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Connected providers
  const connectedProviders = Object.keys(connections).filter((k) =>
    isConnected(k as ProviderKey)
  ) as ProviderKey[];

  // Auto-select all on step 2 entry
  const handleEnterStep2 = useCallback(() => {
    if (selectedProviders.length === 0) {
      setSelectedProviders(connectedProviders);
    }
    setStep(2);
  }, [connectedProviders, selectedProviders.length]);

  // Auto-fill name on step 4
  const handleEnterStep4 = useCallback(() => {
    if (!reportName) {
      const typeMap: Record<PeriodPreset, string> = {
        week: "Semanal",
        month: "Mensal",
        quarter: "Trimestral",
        custom: "Personalizado",
      };
      const dates = periodPreset === "custom"
        ? { start: new Date(customStart), end: new Date(customEnd) }
        : getPeriodDates(periodPreset);
      const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(dates.end);
      setReportName(`Relatório ${typeMap[periodPreset]} — ${empresa?.nome ?? "Empresa"} — ${month}`);
    }
    setStep(4);
  }, [reportName, periodPreset, customStart, customEnd, empresa?.nome]);

  function toggleProvider(key: ProviderKey) {
    setSelectedProviders((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  const periodDates = periodPreset === "custom"
    ? { start: new Date(customStart), end: new Date(customEnd) }
    : getPeriodDates(periodPreset);

  const reportType: ReportType = PERIOD_PRESETS.find((p) => p.id === periodPreset)?.type ?? "custom";

  async function handleGenerate() {
    if (!empresa?.id) return;
    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: periodDates.start.toISOString(),
          periodEnd: periodDates.end.toISOString(),
          providers: selectedProviders,
          reportType,
          name: reportName,
          empresaId: empresa.id,
        }),
      });

      const data = await res.json() as { reportId?: string; error?: string };

      if (!res.ok || !data.reportId) {
        throw new Error(data.error ?? "Erro ao gerar relatório");
      }

      router.push(`/relatorios/${data.reportId}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Erro ao gerar relatório");
      setGenerating(false);
    }
  }

  const canProceedStep1 = periodPreset !== "custom" || (customStart && customEnd && customStart <= customEnd);
  const canProceedStep2 = selectedProviders.length > 0;

  /* ── Kind not selected yet — show selector ───────────────── */
  if (!kindSelected) {
    return (
      <div className="max-w-2xl mx-auto p-2 sm:p-4 md:p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
              <FileText size={16} className="text-accent" />
            </div>
            <h1 className="text-lg font-bold text-text-primary">Novo Relatório</h1>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-[16px] font-semibold text-text-primary">Tipo de relatório</h2>
          <div className="space-y-3">
            {REPORT_KINDS.map((kind) => {
              const Icon = kind.icon;
              const selected = reportKind === kind.id;
              return (
                <button
                  key={kind.id}
                  onClick={() => setReportKind(kind.id)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    selected ? "border-accent bg-accent/5" : "border-border hover:border-accent/30"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selected ? "bg-accent/20" : "bg-bg-elevated"
                  }`}>
                    <Icon size={20} className={selected ? "text-accent" : "text-text-muted"} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[14px] font-semibold text-text-primary">{kind.label}</p>
                      {kind.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-bg-primary tracking-wide">
                          {kind.badge}
                        </span>
                      )}
                      {selected && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                          <Check size={9} />
                          Selecionado
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary">{kind.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        <div className="flex justify-end">
          <button
            disabled={!reportKind}
            onClick={() => setKindSelected(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-[14px] font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Continuar
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ── Agency report flow ──────────────────────────────────── */
  if (reportKind === "agency") {
    return (
      <div className="max-w-2xl mx-auto p-2 sm:p-4 md:p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button
            onClick={() => setKindSelected(false)}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
              <BarChart3 size={16} className="text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Relatório Agência</h1>
              <p className="text-[11px] text-text-muted">Instagram · Facebook · Meta Ads</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-bg-card border border-border rounded-xl p-5 space-y-5">
          <h2 className="text-[16px] font-semibold text-text-primary">Configurar período</h2>

          {/* Plataformas incluídas — fixas */}
          <div className="flex flex-wrap gap-2">
            {["Instagram", "Facebook", "Meta Ads"].map((p) => (
              <span key={p} className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                <Sparkles size={11} />
                {p}
              </span>
            ))}
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Data inicial</label>
              <input
                type="date"
                value={agencyStart}
                onChange={(e) => setAgencyStart(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Data final</label>
              <input
                type="date"
                value={agencyEnd}
                onChange={(e) => setAgencyEnd(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Recipients (opcional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
              Destinatários (opcional)
            </label>
            <input
              type="text"
              value={agencyRecipients}
              onChange={(e) => setAgencyRecipients(e.target.value)}
              placeholder="email1@exemplo.com, email2@exemplo.com"
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
            />
            <p className="text-[11px] text-text-muted">Separe múltiplos emails por vírgula</p>
          </div>

          {agencyError && (
            <div className="flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px]">
              <AlertCircle size={16} className="shrink-0" />
              {agencyError}
            </div>
          )}

          {agencyLoading && (
            <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/20 rounded-lg text-accent text-[13px]">
              <Loader2 size={18} className="animate-spin shrink-0" />
              <div>
                <p className="font-semibold">Gerando relatório agência com IA...</p>
                <p className="text-[11px] text-accent/70 mt-0.5">Isso pode levar entre 15 e 30 segundos</p>
              </div>
            </div>
          )}
        </motion.div>

        <div className="flex justify-between">
          <button
            onClick={() => setKindSelected(false)}
            disabled={agencyLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary border border-border rounded-xl hover:border-accent/30 transition-all disabled:opacity-40"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <button
            onClick={handleCreateAgency}
            disabled={agencyLoading || !agencyStart || !agencyEnd || agencyStart > agencyEnd}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accent to-secondary text-bg-primary text-[14px] font-bold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
          >
            {agencyLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <BarChart3 size={16} />
                Gerar Relatório Agência
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-2 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <button onClick={() => setKindSelected(false)} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
            <FileText size={16} className="text-accent" />
          </div>
          <h1 className="text-lg font-bold text-text-primary">Novo Relatório</h1>
        </div>
      </motion.div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  done ? "border-accent bg-accent text-bg-primary" :
                  active ? "border-accent bg-accent/10 text-accent" :
                  "border-border bg-bg-elevated text-text-muted"
                }`}>
                  {done ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-accent" : done ? "text-text-secondary" : "text-text-muted"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 transition-colors ${step > s.id ? "bg-accent/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Period */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-[16px] font-semibold text-text-primary">Selecionar período</h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodPreset(p.id)}
                    className={`px-3 py-2.5 rounded-lg text-[13px] font-medium border transition-all ${
                      periodPreset === p.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-accent/30"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {periodPreset === "custom" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Data inicial</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Data final</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent/50"
                    />
                  </div>
                </motion.div>
              )}

              {periodPreset !== "custom" && (
                <p className="text-[12px] text-text-muted">
                  Período: {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(periodDates.start)} –{" "}
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(periodDates.end)}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleEnterStep2}
                disabled={!canProceedStep1}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-[14px] font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Networks */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-[16px] font-semibold text-text-primary">Selecionar plataformas</h2>

              {connectionsLoading ? (
                <div className="flex items-center gap-2 text-text-muted text-[13px]">
                  <Loader2 size={16} className="animate-spin" />
                  Carregando conexões...
                </div>
              ) : connectedProviders.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400 text-[13px]">
                  <AlertCircle size={16} />
                  Nenhuma plataforma conectada. Vá em Conexões para conectar suas redes.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-text-muted">{selectedProviders.length} de {connectedProviders.length} selecionadas</p>
                    <button
                      onClick={() => setSelectedProviders(
                        selectedProviders.length === connectedProviders.length ? [] : connectedProviders
                      )}
                      className="text-[12px] text-accent hover:underline"
                    >
                      {selectedProviders.length === connectedProviders.length ? "Desmarcar todas" : "Selecionar todas"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {connectedProviders.map((key) => {
                      const selected = selectedProviders.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleProvider(key)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-[13px] font-medium transition-all ${
                            selected
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-bg-elevated text-text-secondary hover:border-accent/30"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            selected ? "border-accent bg-accent" : "border-border"
                          }`}>
                            {selected && <Check size={11} className="text-bg-primary" />}
                          </div>
                          {PROVIDER_NAMES[key] ?? key}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary border border-border rounded-xl hover:border-accent/30 transition-all">
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-[14px] font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Template */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-[16px] font-semibold text-text-primary">Escolher template</h2>
              <div className="space-y-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                      selectedTemplate === t.id
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/30"
                    }`}
                  >
                    <div className="w-32 shrink-0">{t.preview}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-text-primary">{t.label}</p>
                        {selectedTemplate === t.id && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                            <Check size={9} />
                            Selecionado
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-text-secondary mt-1">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary border border-border rounded-xl hover:border-accent/30 transition-all">
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button
                onClick={handleEnterStep4}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-[14px] font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-5">
              <h2 className="text-[16px] font-semibold text-text-primary">Confirmar e gerar</h2>

              {/* Summary */}
              <div className="space-y-3 text-[13px]">
                <div className="flex justify-between py-2.5 border-b border-border/50">
                  <span className="text-text-muted">Período</span>
                  <span className="text-text-primary font-medium">
                    {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(periodDates.start)} –{" "}
                    {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(periodDates.end)}
                  </span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-border/50">
                  <span className="text-text-muted">Plataformas</span>
                  <span className="text-text-primary font-medium">{selectedProviders.map((k) => PROVIDER_NAMES[k] ?? k).join(", ")}</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-border/50">
                  <span className="text-text-muted">Template</span>
                  <span className="text-text-primary font-medium">{TEMPLATES.find((t) => t.id === selectedTemplate)?.label}</span>
                </div>
              </div>

              {/* Report name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Nome do relatório</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              {genError && (
                <div className="flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px]">
                  <AlertCircle size={16} className="shrink-0" />
                  {genError}
                </div>
              )}

              {generating && (
                <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/20 rounded-lg text-accent text-[13px]">
                  <Loader2 size={18} className="animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold">Gerando relatório com IA...</p>
                    <p className="text-[11px] text-accent/70 mt-0.5">Isso pode levar entre 5 e 15 segundos</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} disabled={generating} className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary border border-border rounded-xl hover:border-accent/30 transition-all disabled:opacity-40">
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !reportName.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accent to-secondary text-bg-primary text-[14px] font-bold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Gerar Relatório
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
