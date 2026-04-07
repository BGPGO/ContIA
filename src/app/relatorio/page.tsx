"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Target,
  Palette,
  Users,
  TrendingUp,
  Hash,
  MessageSquare,
  Eye,
  Zap,
  Shield,
  BarChart3,
  Globe,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Megaphone,
  PenTool,
  Loader2,
  FileText,
  Pencil,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";
import { DNAEditor } from "@/components/marca/DNAEditor";
import { DNASourcesForm } from "@/components/marca/DNASourcesForm";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DNASintetizado } from "@/types";

// ─── types (match API route response) ────────────────────────────────────────

interface FonteInfo {
  tipo?: string;
  nome?: string;
  url?: string;
  resumo?: string;
  metricas?: Record<string, number | string>;
}

interface ConcorrenteInfo {
  nome: string;
  seguidores?: number | string;
  estrategia?: string;
  pontos_fortes?: string[];
}

interface MarcaDNAResponse {
  id?: string;
  empresa_id: string;
  status: "processando" | "completo" | "erro";
  analise_instagram?: any | null;
  analise_site?: any | null;
  analises_concorrentes?: Record<string, any> | null;
  analises_referencias?: Record<string, any> | null;
  dna_sintetizado?: DNASintetizado | null;
  erro?: string | null;
  created_at?: string;
  updated_at?: string;
}

type PageStatus = "idle" | "loading" | "analisando" | "completo" | "erro";

// ─── status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PageStatus }) {
  const config: Record<
    string,
    { label: string; color: string; bg: string; icon: React.ReactNode }
  > = {
    idle: {
      label: "Pendente",
      color: "text-warning",
      bg: "bg-warning/10",
      icon: <Clock size={12} />,
    },
    loading: {
      label: "Carregando...",
      color: "text-accent-light",
      bg: "bg-accent/15",
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    analisando: {
      label: "Analisando...",
      color: "text-accent-light",
      bg: "bg-accent/15",
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    completo: {
      label: "Completo",
      color: "text-success",
      bg: "bg-success/10",
      icon: <CheckCircle2 size={12} />,
    },
    erro: {
      label: "Erro",
      color: "text-danger",
      bg: "bg-danger/10",
      icon: <AlertCircle size={12} />,
    },
  };
  const c = config[status] || config.idle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
        c.color,
        c.bg
      )}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ─── skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-bg-elevated", className)} />
  );
}

function FullSkeleton() {
  return (
    <div className="space-y-8 fade-in">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

// ─── analyzing progress card ─────────────────────────────────────────────────

const PROGRESS_STEPS = [
  "Analisando posts recentes...",
  "Processando com IA...",
  "Gerando DNA da marca...",
  "Finalizando...",
];

function AnalyzingCard() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-featured p-8 text-center max-w-lg mx-auto"
    >
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
        <div
          className="absolute inset-2 rounded-full border-2 border-accent/20 animate-ping"
          style={{ animationDelay: "200ms" }}
        />
        <div className="absolute inset-0 rounded-full bg-accent/15 flex items-center justify-center">
          <Brain size={32} className="text-accent-light animate-pulse" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-2">
        Gerando DNA da Marca...
      </h3>
      <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
        A IA esta processando seus dados para criar o DNA completo da sua marca.
      </p>

      {/* Progress steps */}
      <div className="space-y-2 text-left max-w-xs mx-auto mb-6">
        {PROGRESS_STEPS.map((label, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 text-xs transition-all duration-500",
              i < step
                ? "text-success"
                : i === step
                ? "text-accent-light"
                : "text-text-muted"
            )}
          >
            {i < step ? (
              <CheckCircle2 size={14} />
            ) : i === step ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-border" />
            )}
            {label}
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-accent-light"
            style={{
              animation: "dotPulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes dotPulse {
          0%,
          80%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </motion.div>
  );
}

// ─── Instagram connected + no DNA: CTA to generate ──────────────────────────

function GenerateDNACTA({
  empresa,
  onGenerate,
  analyzing,
}: {
  empresa: any;
  onGenerate: () => void;
  analyzing: boolean;
}) {
  const { updateEmpresa } = useEmpresa();
  const [website, setWebsite] = useState(empresa?.website || "");
  const [concorrentesIg, setConcorrentesIg] = useState<string[]>(
    empresa?.concorrentes_ig || []
  );
  const [showExtras, setShowExtras] = useState(false);

  const handleGenerate = async () => {
    // Save optional extras to empresa before generating
    if (website !== empresa?.website || concorrentesIg.length > 0) {
      await updateEmpresa(empresa.id, {
        website: website || empresa.website,
        concorrentes_ig: concorrentesIg,
      } as any);
    }
    onGenerate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto text-center"
    >
      {/* Hero */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full bg-accent/8 blur-3xl" />
        </div>
        <div className="relative w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/20 flex items-center justify-center mb-6">
          <Brain size={44} className="text-accent-light" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-3">
          Gerar DNA da Marca
        </h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          Vamos analisar seus posts, engajamento e estilo visual para criar o
          DNA da sua marca.
        </p>
      </div>

      {/* Instagram connected badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium mb-8">
        <CheckCircle2 size={14} />
        Instagram conectado — dados reais serao usados
      </div>

      {/* Optional extras toggle */}
      <div className="mb-8">
        <button
          onClick={() => setShowExtras(!showExtras)}
          className="text-xs text-text-muted hover:text-accent-light transition-colors underline underline-offset-2"
        >
          {showExtras
            ? "Ocultar fontes extras"
            : "Adicionar fontes extras (site, concorrentes)"}
        </button>

        <AnimatePresence>
          {showExtras && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4 text-left"
            >
              {/* Site URL */}
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} className="text-accent-light" />
                  <span className="text-xs font-semibold text-text-primary">
                    Site (opcional)
                  </span>
                </div>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://suaempresa.com.br"
                  className="w-full h-10 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
                />
              </div>

              {/* Competitors */}
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-accent-light" />
                  <span className="text-xs font-semibold text-text-primary">
                    Concorrentes Instagram (opcional)
                  </span>
                </div>
                <ConcorrenteInput
                  items={concorrentesIg}
                  onChange={setConcorrentesIg}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={analyzing}
        className={cn(
          "inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold transition-all duration-300",
          "bg-gradient-to-r from-accent to-purple-500 text-white shadow-xl shadow-accent/25",
          "hover:shadow-2xl hover:shadow-accent/35 hover:scale-[1.02]",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        )}
      >
        {analyzing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Gerando DNA...
          </>
        ) : (
          <>
            <Sparkles size={20} />
            Gerar DNA da Marca
          </>
        )}
      </button>
    </motion.div>
  );
}

// ─── Concorrente input helper ────────────────────────────────────────────────

function ConcorrenteInput({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const trimmed = draft
      .trim()
      .replace(/^@/, "")
      .replace(/https?:\/\/(www\.)?instagram\.com\//, "")
      .replace(/\/+$/, "");
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-bg-input border border-border rounded-lg text-text-secondary"
            >
              @{item}
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 text-text-muted hover:text-danger"
              >
                <span className="sr-only">Remover</span>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder="@concorrente"
          className="flex-1 h-9 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="px-3 h-9 text-xs font-medium text-accent hover:bg-accent/10 border border-border rounded-lg transition-colors disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

// ─── Not connected: connect Instagram CTA ───────────────────────────────────

function ConnectInstagramCTA({
  empresa,
  onFallbackAnalyze,
  analyzing,
}: {
  empresa: any;
  onFallbackAnalyze: () => void;
  analyzing: boolean;
}) {
  const [instagramHandle, setInstagramHandle] = useState(
    empresa?.instagram_handle || ""
  );
  const [website, setWebsite] = useState(empresa?.website || "");
  const [concorrentesIg, setConcorrentesIg] = useState<string[]>(
    empresa?.concorrentes_ig || []
  );
  const [referenciasIg, setReferenciasIg] = useState<string[]>(
    empresa?.referencias_ig || []
  );
  const [referenciasSites, setReferenciasSites] = useState<string[]>(
    empresa?.referencias_sites || []
  );
  const { updateEmpresa } = useEmpresa();

  const hasSomething =
    instagramHandle || website || concorrentesIg.length > 0;

  const handleUpdate = (field: string, value: any) => {
    switch (field) {
      case "instagramHandle":
        setInstagramHandle(value);
        break;
      case "website":
        setWebsite(value);
        break;
      case "concorrentesIg":
        setConcorrentesIg(value);
        break;
      case "referenciasIg":
        setReferenciasIg(value);
        break;
      case "referenciasSites":
        setReferenciasSites(value);
        break;
    }
  };

  const handleAnalyze = async () => {
    if (empresa && updateEmpresa) {
      await updateEmpresa(empresa.id, {
        instagram_handle: instagramHandle,
        website: website || empresa.website,
        concorrentes_ig: concorrentesIg,
        referencias_ig: referenciasIg,
        referencias_sites: referenciasSites,
      } as any);
    }
    onFallbackAnalyze();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      {/* Connect CTA */}
      <div className="text-center mb-10">
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-accent/8 blur-3xl" />
          </div>
          <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
            <Brain size={36} className="text-accent-light" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-3">
          DNA da Marca
        </h2>
        <p className="text-text-secondary text-sm max-w-lg mx-auto leading-relaxed mb-6">
          Conecte seu Instagram para gerar um DNA preciso baseado nos seus dados
          reais.
        </p>
        <Link
          href="/conexoes"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent to-purple-500 text-white shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.02] transition-all duration-200"
        >
          <LinkIcon size={16} />
          Conectar Instagram
        </Link>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 border-t border-border/50" />
        <span className="text-xs text-text-muted font-medium">
          ou preencha manualmente
        </span>
        <div className="flex-1 border-t border-border/50" />
      </div>

      {/* Legacy form */}
      <DNASourcesForm
        instagramHandle={instagramHandle}
        website={website || empresa?.website || ""}
        concorrentesIg={concorrentesIg}
        referenciasIg={referenciasIg}
        referenciasSites={referenciasSites}
        onUpdate={handleUpdate}
        onAnalyze={hasSomething ? handleAnalyze : undefined}
        analyzing={analyzing}
      />

      {!hasSomething && (
        <p className="text-center text-xs text-text-muted mt-4">
          Preencha pelo menos o Instagram ou o site da empresa para iniciar a
          analise.
        </p>
      )}
    </motion.div>
  );
}

// ─── competitive section (view only) ────────────────────────────────────────

function CompetitiveSection({
  dna,
  concorrentes,
}: {
  dna: DNASintetizado;
  concorrentes: ConcorrenteInfo[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#f8717118",
            boxShadow: "0 0 20px #f8717110",
          }}
        >
          <Shield size={20} style={{ color: "#f87171" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Analise Competitiva
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Concorrentes, diferenciais e oportunidades
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {concorrentes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {concorrentes.map((comp, i) => (
              <div
                key={i}
                className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light transition-colors">
                    {comp.nome}
                  </h4>
                  {comp.seguidores && (
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Users size={10} />
                      {typeof comp.seguidores === "number"
                        ? formatCompact(comp.seguidores)
                        : comp.seguidores}
                    </span>
                  )}
                </div>
                {comp.estrategia && (
                  <p className="text-xs text-text-secondary leading-relaxed mb-3">
                    {comp.estrategia}
                  </p>
                )}
                {comp.pontos_fortes && comp.pontos_fortes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {comp.pontos_fortes.map((pf, j) => (
                      <span
                        key={j}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/15"
                      >
                        {pf}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dna.diferenciais_vs_concorrentes &&
            dna.diferenciais_vs_concorrentes.length > 0 && (
              <div className="card-featured p-6">
                <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2 relative z-10">
                  <TrendingUp size={14} className="text-success" /> Seus
                  Diferenciais
                </h3>
                <div className="space-y-3 relative z-10">
                  {dna.diferenciais_vs_concorrentes.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/10"
                    >
                      <ArrowUpRight
                        size={14}
                        className="text-success mt-0.5 shrink-0"
                      />
                      <span className="text-sm text-text-secondary">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {dna.oportunidades && dna.oportunidades.length > 0 && (
            <div className="card-featured p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2 relative z-10">
                <Lightbulb size={14} className="text-warning" /> Oportunidades
                Identificadas
              </h3>
              <div className="space-y-3 relative z-10">
                {dna.oportunidades.map((o, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/10"
                  >
                    <Lightbulb
                      size={14}
                      className="text-warning mt-0.5 shrink-0"
                    />
                    <span className="text-sm text-text-secondary">{o}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── analyzed sources section ────────────────────────────────────────────────

function SourcesSection({ marcaDNA }: { marcaDNA: MarcaDNAResponse }) {
  const sources: FonteInfo[] = [];

  if (marcaDNA.analise_instagram) {
    sources.push({
      tipo: "instagram",
      nome: `@${marcaDNA.analise_instagram.username || "perfil"}`,
      resumo:
        marcaDNA.analise_instagram.resumo_visual ||
        marcaDNA.analise_instagram.tom_legendas ||
        "Perfil Instagram analisado",
      metricas: marcaDNA.analise_instagram.followers
        ? {
            seguidores: marcaDNA.analise_instagram.followers,
            engajamento:
              marcaDNA.analise_instagram.engajamento_medio || "N/A",
          }
        : undefined,
    });
  }

  if (marcaDNA.analise_site) {
    sources.push({
      tipo: "website",
      nome: marcaDNA.analise_site.url || "Website",
      resumo: marcaDNA.analise_site.resumo || "Website analisado",
    });
  }

  if (marcaDNA.analises_concorrentes) {
    Object.entries(marcaDNA.analises_concorrentes).forEach(
      ([nome, analise]) => {
        if (analise) {
          sources.push({
            tipo: "concorrente",
            nome,
            resumo:
              analise.resumo_visual ||
              analise.tom_legendas ||
              "Concorrente analisado",
            metricas: analise.followers
              ? { seguidores: analise.followers }
              : undefined,
          });
        }
      }
    );
  }

  if (sources.length === 0) return null;

  const sourceIcons: Record<string, React.ReactNode> = {
    instagram: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" />
      </svg>
    ),
    website: <Globe size={14} />,
    concorrente: <Shield size={14} />,
    referencia: <Sparkles size={14} />,
  };

  const sourceColors: Record<string, string> = {
    instagram: "#e1306c",
    website: "#60a5fa",
    concorrente: "#f87171",
    referencia: "#fbbf24",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#60a5fa18",
            boxShadow: "0 0 20px #60a5fa10",
          }}
        >
          <Eye size={20} style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Fontes Analisadas
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Dados que alimentaram esta analise
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map((fonte, i) => {
          const tipo = fonte.tipo || "website";
          const color = sourceColors[tipo] || "#6c5ce7";
          return (
            <div
              key={i}
              className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-200"
              style={{
                borderTopColor: `${color}60`,
                borderTopWidth: "2px",
              }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span style={{ color }}>
                  {sourceIcons[tipo] || <Globe size={14} />}
                </span>
                <span className="text-xs font-semibold text-text-primary truncate">
                  {fonte.nome}
                </span>
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {tipo}
                </span>
              </div>
              {fonte.resumo && (
                <p className="text-xs text-text-secondary leading-relaxed">
                  {fonte.resumo}
                </p>
              )}
              {fonte.metricas && (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4">
                  {Object.entries(fonte.metricas).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <p className="text-xs font-bold text-text-primary">
                        {typeof v === "number"
                          ? formatCompact(v)
                          : String(v)}
                      </p>
                      <p className="text-[10px] text-text-muted capitalize">
                        {k}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function extractConcorrentes(marcaDNA: MarcaDNAResponse): ConcorrenteInfo[] {
  if (!marcaDNA.analises_concorrentes) return [];
  return Object.entries(marcaDNA.analises_concorrentes)
    .filter(([, v]) => v)
    .map(([nome, analise]) => ({
      nome,
      seguidores: analise?.followers,
      estrategia: analise?.tom_legendas || analise?.resumo_visual,
      pontos_fortes: analise?.pontos_fortes,
    }));
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function RelatorioPage() {
  const { empresa, loading: empresaLoading } = useEmpresa();
  const {
    dna: hookDna,
    loading: dnaLoading,
    analyzing,
    refreshing,
    error: dnaError,
    analisar,
    saveDNA,
    isStale,
  } = useMarcaDNA(empresa?.id);

  const [igConnected, setIgConnected] = useState(false);
  const [igChecked, setIgChecked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check if Instagram is connected
  useEffect(() => {
    if (!empresa?.id) return;
    setIgChecked(false);
    const supabase = createClient();
    supabase
      .from("social_connections")
      .select("id")
      .eq("empresa_id", empresa.id)
      .eq("provider", "instagram")
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setIgConnected(!!data);
        setIgChecked(true);
      });
  }, [empresa?.id]);

  // Derive marcaDNA (MarcaDNAResponse-compatible) from the hook's dna
  const marcaDNA: MarcaDNAResponse | null = hookDna
    ? {
        id: hookDna.id,
        empresa_id: hookDna.empresa_id,
        status:
          hookDna.status === "pendente"
            ? "completo"
            : (hookDna.status as MarcaDNAResponse["status"]),
        analise_instagram: hookDna.instagram_analysis,
        analise_site: hookDna.site_analysis,
        analises_concorrentes:
          hookDna.concorrentes_analysis?.reduce(
            (acc: Record<string, any>, c: any) => {
              acc[c.nome || c.username || "concorrente"] = c;
              return acc;
            },
            {}
          ) || null,
        analises_referencias:
          hookDna.referencias_analysis?.reduce(
            (acc: Record<string, any>, r: any) => {
              acc[r.nome || r.url || "referencia"] = r;
              return acc;
            },
            {}
          ) || null,
        dna_sintetizado: hookDna.dna_sintetizado,
        created_at: hookDna.created_at,
        updated_at: hookDna.updated_at,
      }
    : null;

  // Derive page status
  const status: PageStatus = analyzing
    ? "analisando"
    : dnaLoading
    ? "loading"
    : dnaError
    ? "erro"
    : hookDna?.dna_sintetizado
    ? "completo"
    : "idle";

  const error = dnaError;
  const hasDNA = status === "completo" && marcaDNA?.dna_sintetizado;
  const dna = marcaDNA?.dna_sintetizado;

  // Handle save from DNAEditor
  const handleSaveDNA = async (updated: DNASintetizado) => {
    const ok = await saveDNA(updated);
    if (ok) {
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // ── loading empresa ──
  if (empresaLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <FullSkeleton />
      </div>
    );
  }

  // ── no empresa selected ──
  if (!empresa) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto page-enter">
        <div className="text-center py-20">
          <AlertCircle size={40} className="text-text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold text-text-primary mb-2">
            Nenhuma empresa selecionada
          </h2>
          <p className="text-sm text-text-secondary">
            Selecione uma empresa no menu lateral para ver o relatorio de
            inteligencia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto page-enter">
      {/* ── HEADER ── */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="glow-text">Relatorio de Inteligencia</span>
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 flex items-center gap-2 flex-wrap">
              <span>{empresa.nome}</span>
              {marcaDNA?.updated_at && (
                <>
                  <span className="text-text-muted">&middot;</span>
                  <span className="text-text-muted flex items-center gap-1">
                    <Clock size={11} />
                    {formatDate(marcaDNA.updated_at)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={status} />

            {/* Save success toast */}
            <AnimatePresence>
              {saveSuccess && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-success/10 text-success font-medium"
                >
                  <CheckCircle2 size={12} />
                  Salvo com sucesso
                </motion.span>
              )}
            </AnimatePresence>

            {refreshing && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-accent/10 text-accent-light">
                <Loader2 size={12} className="animate-spin" />
                Atualizando...
              </span>
            )}
            {isStale && !refreshing && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-warning/10 text-warning">
                <Clock size={12} />
                DNA desatualizado
              </span>
            )}

            {/* Edit / View toggle */}
            {hasDNA && (
              <button
                onClick={() => setEditing(!editing)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                  editing
                    ? "bg-warning/15 text-warning border border-warning/25 hover:bg-warning/25"
                    : "bg-accent/15 text-accent-light hover:bg-accent/25 border border-accent/20 hover:border-accent/40"
                )}
              >
                <Pencil size={14} />
                {editing ? "Editando DNA" : "Editar DNA"}
              </button>
            )}

            {hasDNA && !editing && (
              <button
                onClick={analisar}
                disabled={analyzing}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                  analyzing
                    ? "bg-bg-elevated text-text-muted cursor-not-allowed"
                    : "bg-bg-elevated text-text-secondary hover:bg-bg-input border border-border hover:border-border-light"
                )}
              >
                <RefreshCw
                  size={14}
                  className={analyzing ? "animate-spin" : ""}
                />
                Atualizar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Instagram connection banner ── */}
      {igChecked && igConnected && hasDNA && !editing && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3"
        >
          <CheckCircle2 size={16} className="text-success shrink-0" />
          <p className="text-xs text-success font-medium">
            Instagram conectado — DNA gerado com dados reais
          </p>
        </motion.div>
      )}

      {/* ── ANALYZING STATE ── */}
      {status === "analisando" && <AnalyzingCard />}

      {/* ── ERROR STATE ── */}
      {status === "erro" && error && !hasDNA && (
        <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 fade-in">
          <AlertCircle size={18} className="text-danger shrink-0" />
          <div>
            <p className="text-sm font-semibold text-danger">Erro na analise</p>
            <p className="text-xs text-text-secondary mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── FLOW DECISION: what to show when no DNA ── */}
      {(status === "idle" || (status === "erro" && !hasDNA)) &&
        !analyzing &&
        igChecked && (
          <>
            {igConnected ? (
              /* Instagram IS connected, no DNA yet -> big CTA */
              <GenerateDNACTA
                empresa={empresa}
                onGenerate={analisar}
                analyzing={analyzing}
              />
            ) : (
              /* Instagram NOT connected -> connect CTA + fallback form */
              <ConnectInstagramCTA
                empresa={empresa}
                onFallbackAnalyze={analisar}
                analyzing={analyzing}
              />
            )}
          </>
        )}

      {/* ── LOADING STATE ── */}
      {(status === "loading" || (!igChecked && status === "idle")) && (
        <FullSkeleton />
      )}

      {/* ── FULL REPORT (with DNAEditor for edit/view) ── */}
      {hasDNA && dna && marcaDNA && (
        <div className="space-y-10">
          {/* Edit mode banner */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3"
              >
                <Pencil size={16} className="text-warning shrink-0" />
                <p className="text-xs text-warning font-medium">
                  Modo de edicao ativo — altere os campos e clique em
                  &ldquo;Salvar alteracoes&rdquo; no final da pagina.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DNA Editor (handles both view and edit modes) */}
          <DNAEditor
            dna={dna}
            editing={editing}
            onSave={handleSaveDNA}
            onCancel={() => setEditing(false)}
          />

          {/* Competitive + Sources sections (view only — not editable) */}
          {!editing && (
            <>
              <CompetitiveSection
                dna={dna}
                concorrentes={extractConcorrentes(marcaDNA)}
              />
              <SourcesSection marcaDNA={marcaDNA} />
            </>
          )}

          {/* Footer branding */}
          {!editing && (
            <footer
              className="pt-6 pb-4 border-t border-border/30 text-center fade-in"
              style={{ animationDelay: "600ms" }}
            >
              <p className="text-xs text-text-muted flex items-center justify-center gap-1.5">
                <Sparkles size={10} className="text-accent-light" />
                Relatorio gerado por ContIA &middot; Inteligencia de Marca
              </p>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}
