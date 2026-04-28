"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Palette,
  Users,
  MessageSquare,
  Eye,
  Globe,
  Sparkles,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Pencil,
  Link as LinkIcon,
  Shield,
  TrendingUp,
  ArrowUpRight,
  Save,
  Building2,
  Image,
  Gauge,
  Camera,
  Type,
  BarChart3,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";
import { DNAEditor } from "@/components/marca/DNAEditor";
import { DNASourcesForm } from "@/components/marca/DNASourcesForm";
import { LogoCard } from "@/components/marca/LogoCard";
import { FontsSection } from "@/components/marca/FontsSection";
import { OtherAssetsGrid } from "@/components/marca/OtherAssetsGrid";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DNASintetizado } from "@/types";

// ---- Types ----

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
type TabId = "identidade" | "design";

// ---- Small helpers ----

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
    </div>
  );
}

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

// ---- Shared styles ----

const inputClass =
  "w-full h-9 bg-bg-card border border-border text-text-primary placeholder:text-text-muted rounded-lg px-3 text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200";
const labelClass =
  "block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5";
const glassCard =
  "bg-bg-card/60 backdrop-blur-xl border border-border rounded-xl p-5";

// ---- Analyzing progress card ----

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

// ---- Generate DNA CTA (Instagram connected, no DNA yet) ----

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

      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium mb-8">
        <CheckCircle2 size={14} />
        Instagram conectado — dados reais serao usados
      </div>

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

// ---- ConcorrenteInput helper ----

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
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), handleAdd())
          }
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

// ---- Connect Instagram CTA (not connected) ----

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

      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 border-t border-border/50" />
        <span className="text-xs text-text-muted font-medium">
          ou preencha manualmente
        </span>
        <div className="flex-1 border-t border-border/50" />
      </div>

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

// ---- Competitive Section (view only) ----

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

// ---- Sources Section ----

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

// ---- Company Info Section ----

function CompanyInfoSection() {
  const { empresa, updateEmpresa } = useEmpresa();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    nome: empresa?.nome ?? "",
    descricao: empresa?.descricao ?? "",
    nicho: empresa?.nicho ?? "",
    website: empresa?.website ?? "",
  });

  useEffect(() => {
    if (empresa) {
      setForm({
        nome: empresa.nome,
        descricao: empresa.descricao,
        nicho: empresa.nicho,
        website: empresa.website ?? "",
      });
    }
  }, [empresa]);

  const handleSave = async () => {
    if (!empresa) return;
    setSaving(true);
    try {
      await updateEmpresa(empresa.id, {
        nome: form.nome,
        descricao: form.descricao,
        nicho: form.nicho,
        website: form.website || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#4ecdc418",
            boxShadow: "0 0 20px #4ecdc410",
          }}
        >
          <Building2 size={20} style={{ color: "#4ecdc4" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Informacoes da Empresa
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Dados basicos que alimentam toda a plataforma
          </p>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Nome da empresa</label>
            <input
              type="text"
              className={inputClass}
              value={form.nome}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nome: e.target.value }))
              }
              placeholder="Ex: TechFlow Solutions"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Descricao</label>
            <textarea
              className={cn(inputClass, "h-auto py-2 resize-none")}
              rows={3}
              value={form.descricao}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, descricao: e.target.value }))
              }
              placeholder="Descreva sua empresa, proposta de valor, publico-alvo..."
            />
          </div>

          <div>
            <label className={labelClass}>Nicho / Segmento</label>
            <input
              type="text"
              className={inputClass}
              value={form.nicho}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nicho: e.target.value }))
              }
              placeholder="Ex: Tecnologia / SaaS"
            />
          </div>

          <div>
            <label className={labelClass}>Website</label>
            <input
              type="url"
              className={inputClass}
              value={form.website}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, website: e.target.value }))
              }
              placeholder="https://suaempresa.com.br"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 h-8 rounded-lg font-medium text-xs transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed",
              saved
                ? "bg-success/15 text-success border border-success/20"
                : "bg-accent hover:bg-accent/90 text-white"
            )}
          >
            {saving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 size={12} />
                Salvo
              </>
            ) : (
              <>
                <Save size={12} />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---- Design Tab: Color Palette Section ----

function DesignColorsSection({
  dna,
  editing,
  draftColors,
  onColorsChange,
  empresa,
  empresaColors,
  onEmpresaColorsChange,
}: {
  dna: DNASintetizado | null;
  editing: boolean;
  draftColors: string[];
  onColorsChange: (colors: string[]) => void;
  empresa: any;
  empresaColors: { cor_primaria: string; cor_secundaria: string };
  onEmpresaColorsChange: (field: "cor_primaria" | "cor_secundaria", value: string) => void;
}) {
  const colors = editing ? draftColors : dna?.paleta_cores || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#6c5ce718",
            boxShadow: "0 0 20px #6c5ce710",
          }}
        >
          <Palette size={20} style={{ color: "#6c5ce7" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Paleta de Cores
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Cores da marca detectadas pelo DNA e cores da empresa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DNA colors */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Sparkles size={14} className="text-accent-light" />
            Cores do DNA
          </h3>
          {colors.length > 0 ? (
            <div className="space-y-3">
              {/* Large swatches */}
              <div className="flex gap-2 mb-4">
                {colors.map((cor, i) => (
                  <div
                    key={i}
                    className="flex-1 aspect-square max-w-[64px] rounded-xl border border-border-light shadow-md hover:scale-105 transition-transform duration-200"
                    style={{
                      backgroundColor: cor,
                      boxShadow: `0 4px 16px ${cor}40`,
                    }}
                  />
                ))}
              </div>

              {/* Hex inputs when editing */}
              {editing ? (
                <div className="space-y-2">
                  {colors.map((cor, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => {
                          const next = [...colors];
                          next[i] = e.target.value;
                          onColorsChange(next);
                        }}
                        className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={cor}
                        onChange={(e) => {
                          const next = [...colors];
                          next[i] = e.target.value;
                          onColorsChange(next);
                        }}
                        className="w-24 h-8 px-2 text-xs font-mono bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
                      />
                      <button
                        onClick={() =>
                          onColorsChange(colors.filter((_, j) => j !== i))
                        }
                        className="text-text-muted hover:text-danger transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {colors.length < 8 && (
                    <button
                      onClick={() => onColorsChange([...colors, "#6c5ce7"])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 border border-dashed border-accent/30 rounded-lg transition-colors"
                    >
                      <Plus size={12} />
                      Adicionar cor
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {colors.map((cor, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-md border border-border-light"
                        style={{ backgroundColor: cor }}
                      />
                      <span className="text-xs font-mono text-text-secondary">
                        {cor}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">
              Nenhuma cor detectada ainda. Gere o DNA para extrair as cores.
            </p>
          )}
        </div>

        {/* Empresa brand colors */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Building2 size={14} className="text-[#4ecdc4]" />
            Cores da Empresa
          </h3>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Cor primaria</label>
              <div className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-xl border border-border-light shadow-md"
                  style={{
                    backgroundColor: empresaColors.cor_primaria,
                    boxShadow: `0 4px 16px ${empresaColors.cor_primaria}40`,
                  }}
                />
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={empresaColors.cor_primaria}
                      onChange={(e) =>
                        onEmpresaColorsChange("cor_primaria", e.target.value)
                      }
                      className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={empresaColors.cor_primaria}
                      onChange={(e) =>
                        onEmpresaColorsChange("cor_primaria", e.target.value)
                      }
                      className="w-24 h-8 px-2 text-xs font-mono bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all uppercase"
                      maxLength={7}
                    />
                  </div>
                ) : (
                  <span className="text-xs font-mono text-text-secondary">
                    {empresaColors.cor_primaria}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>Cor secundaria</label>
              <div className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-xl border border-border-light shadow-md"
                  style={{
                    backgroundColor: empresaColors.cor_secundaria,
                    boxShadow: `0 4px 16px ${empresaColors.cor_secundaria}40`,
                  }}
                />
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={empresaColors.cor_secundaria}
                      onChange={(e) =>
                        onEmpresaColorsChange("cor_secundaria", e.target.value)
                      }
                      className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={empresaColors.cor_secundaria}
                      onChange={(e) =>
                        onEmpresaColorsChange("cor_secundaria", e.target.value)
                      }
                      className="w-24 h-8 px-2 text-xs font-mono bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all uppercase"
                      maxLength={7}
                    />
                  </div>
                ) : (
                  <span className="text-xs font-mono text-text-secondary">
                    {empresaColors.cor_secundaria}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---- Design Tab: Visual Style Section ----

function DesignVisualStyleSection({
  dna,
  editing,
  draftEstilo,
  onEstiloChange,
}: {
  dna: DNASintetizado | null;
  editing: boolean;
  draftEstilo: string;
  onEstiloChange: (v: string) => void;
}) {
  const value = editing ? draftEstilo : dna?.estilo_visual || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#a29bfe18",
            boxShadow: "0 0 20px #a29bfe10",
          }}
        >
          <Camera size={20} style={{ color: "#a29bfe" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Estilo Visual</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Descricao do estilo visual da marca
          </p>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        {editing ? (
          <textarea
            value={value}
            onChange={(e) => onEstiloChange(e.target.value)}
            placeholder="Descreva o estilo visual da marca..."
            rows={4}
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 resize-y"
          />
        ) : value ? (
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {value}
          </p>
        ) : (
          <p className="text-xs text-text-muted italic">
            Nenhum estilo visual definido. Gere o DNA para detectar automaticamente.
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ---- Design Tab: Logo Section ----

function DesignLogoSection({
  empresa,
  editing,
  logoUrl,
  onLogoUrlChange,
}: {
  empresa: any;
  editing: boolean;
  logoUrl: string;
  onLogoUrlChange: (v: string) => void;
}) {
  const displayUrl = editing ? logoUrl : empresa?.logo_url || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.16 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#fbbf2418",
            boxShadow: "0 0 20px #fbbf2410",
          }}
        >
          <Image size={20} style={{ color: "#fbbf24" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Logo da Marca</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Logo principal da empresa
          </p>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-6">
          {/* Preview */}
          <div className="shrink-0">
            {displayUrl ? (
              <div className="w-24 h-24 rounded-xl border border-border-light overflow-hidden bg-bg-elevated">
                <img
                  src={displayUrl}
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-xl border border-dashed border-border flex items-center justify-center bg-bg-elevated/50">
                <Image size={24} className="text-text-muted" />
              </div>
            )}
          </div>

          {/* URL input */}
          <div className="flex-1">
            {editing ? (
              <div>
                <label className={labelClass}>URL do logo</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => onLogoUrlChange(e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                  className={inputClass}
                />
                <p className="text-[11px] text-text-muted mt-1.5">
                  Cole a URL da imagem do logo (PNG, JPG, SVG)
                </p>
              </div>
            ) : displayUrl ? (
              <div>
                <p className="text-xs text-text-muted mb-1">URL do logo</p>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-light hover:underline flex items-center gap-1 break-all"
                >
                  {displayUrl}
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic mt-2">
                Nenhum logo definido. Edite para adicionar uma URL.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---- Design Tab: Brand Assets Section ----

function DesignBrandAssetsSection({
  editing,
  assets,
  onAssetsChange,
}: {
  editing: boolean;
  assets: string[];
  onAssetsChange: (assets: string[]) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.24 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#34d39918",
            boxShadow: "0 0 20px #34d39910",
          }}
        >
          <Image size={20} style={{ color: "#34d399" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Elementos Visuais
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Imagens adicionais da marca (ate 5)
          </p>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        {assets.length > 0 || editing ? (
          <div className="space-y-3">
            {/* Thumbnails preview */}
            {assets.length > 0 && (
              <div className="flex gap-3 flex-wrap mb-4">
                {assets.map(
                  (url, i) =>
                    url && (
                      <div
                        key={i}
                        className="relative w-20 h-20 rounded-lg border border-border overflow-hidden bg-bg-elevated group"
                      >
                        <img
                          src={url}
                          alt={`Asset ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        {editing && (
                          <button
                            onClick={() =>
                              onAssetsChange(assets.filter((_, j) => j !== i))
                            }
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-danger/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    )
                )}
              </div>
            )}

            {/* URL inputs when editing */}
            {editing && (
              <div className="space-y-2">
                {assets.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const next = [...assets];
                        next[i] = e.target.value;
                        onAssetsChange(next);
                      }}
                      placeholder={`URL da imagem ${i + 1}...`}
                      className={cn(inputClass, "flex-1")}
                    />
                    <button
                      onClick={() =>
                        onAssetsChange(assets.filter((_, j) => j !== i))
                      }
                      className="text-text-muted hover:text-danger transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {assets.length < 5 && (
                  <button
                    onClick={() => onAssetsChange([...assets, ""])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 border border-dashed border-accent/30 rounded-lg transition-colors"
                  >
                    <Plus size={12} />
                    Adicionar imagem
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted italic">
            Nenhum elemento visual adicionado. Edite para adicionar URLs de imagens.
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ---- Design Tab: Visual Analysis Section ----

function DesignVisualAnalysisSection({
  marcaDNA,
}: {
  marcaDNA: MarcaDNAResponse | null;
}) {
  const igAnalysis = marcaDNA?.analise_instagram;
  if (!igAnalysis) return null;

  const hasVisualData =
    igAnalysis.resumo_visual ||
    igAnalysis.estilo_visual ||
    igAnalysis.tom_legendas;

  if (!hasVisualData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.32 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#e1306c18",
            boxShadow: "0 0 20px #e1306c10",
          }}
        >
          <Eye size={20} style={{ color: "#e1306c" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Estilos de Post Detectados
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Analise visual dos posts do Instagram
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {igAnalysis.resumo_visual && (
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Camera size={14} className="text-[#e1306c]" />
              <h3 className="text-sm font-semibold text-text-primary">
                Estilo Fotografico
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {igAnalysis.resumo_visual}
            </p>
          </div>
        )}

        {igAnalysis.estilo_visual && (
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette size={14} className="text-accent-light" />
              <h3 className="text-sm font-semibold text-text-primary">
                Atmosfera / Mood
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {igAnalysis.estilo_visual}
            </p>
          </div>
        )}

        {igAnalysis.tom_legendas && (
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Type size={14} className="text-warning" />
              <h3 className="text-sm font-semibold text-text-primary">
                Tipografia / Texto nos Posts
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {igAnalysis.tom_legendas}
            </p>
          </div>
        )}

        {igAnalysis.formatos_mais_usados &&
          igAnalysis.formatos_mais_usados.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-info" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Tipos de Conteudo
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {igAnalysis.formatos_mais_usados.map(
                  (f: string, i: number) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-lg bg-accent/10 text-accent-light border border-accent/20"
                    >
                      {f}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
      </div>
    </motion.div>
  );
}

// ---- Helpers ----

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

export default function MarcaPage() {
  const { empresa, loading: empresaLoading, updateEmpresa } = useEmpresa();
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
  const [activeTab, setActiveTab] = useState<TabId>("identidade");

  // Design tab draft state
  const [designDraftColors, setDesignDraftColors] = useState<string[]>([]);
  const [designDraftEstilo, setDesignDraftEstilo] = useState("");
  const [designDraftLogoUrl, setDesignDraftLogoUrl] = useState("");
  const [designDraftAssets, setDesignDraftAssets] = useState<string[]>([]);
  const [designDraftEmpresaColors, setDesignDraftEmpresaColors] = useState({
    cor_primaria: "#6c5ce7",
    cor_secundaria: "#a29bfe",
  });

  // Live state for logo and fonts (updated by upload components without full page reload)
  const [liveLogo, setLiveLogo] = useState<string | null>(null);
  const [liveLogoInitialized, setLiveLogoInitialized] = useState(false);
  const [brandFonts, setBrandFonts] = useState<string[]>([]);

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

  // Sync design draft state when DNA or empresa changes
  useEffect(() => {
    if (hookDna?.dna_sintetizado) {
      setDesignDraftColors(hookDna.dna_sintetizado.paleta_cores || []);
      setDesignDraftEstilo(hookDna.dna_sintetizado.estilo_visual || "");
    }
  }, [hookDna]);

  useEffect(() => {
    if (empresa) {
      setDesignDraftLogoUrl(empresa.logo_url || "");
      setDesignDraftEmpresaColors({
        cor_primaria: empresa.cor_primaria || "#6c5ce7",
        cor_secundaria: empresa.cor_secundaria || "#a29bfe",
      });
      // Load assets from empresa metadata (if stored there)
      const brandAssets = (empresa as any).brand_assets;
      if (brandAssets?.additional_images) {
        setDesignDraftAssets(brandAssets.additional_images);
      } else {
        setDesignDraftAssets([]);
      }
      // Initialize live logo from empresa (only on first load)
      if (!liveLogoInitialized) {
        setLiveLogo(empresa.logo_url ?? null);
        setLiveLogoInitialized(true);
      }
      // Initialize brand fonts
      const fonts = (empresa as any).brand_fonts;
      if (Array.isArray(fonts)) {
        setBrandFonts(fonts as string[]);
      }
    }
  }, [empresa, liveLogoInitialized]);

  // Derive marcaDNA
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

  // Handle save from DNAEditor (Identidade tab)
  const handleSaveDNA = async (updated: DNASintetizado) => {
    const ok = await saveDNA(updated);
    if (ok) {
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Handle save from Design tab
  const handleSaveDesign = async () => {
    if (!empresa) return;

    // Save DNA fields (paleta_cores, estilo_visual)
    if (hookDna?.dna_sintetizado) {
      await saveDNA({
        paleta_cores: designDraftColors,
        estilo_visual: designDraftEstilo,
      });
    }

    // Save empresa fields (cor_primaria, cor_secundaria, logo_url, brand_assets)
    await updateEmpresa(empresa.id, {
      cor_primaria: designDraftEmpresaColors.cor_primaria,
      cor_secundaria: designDraftEmpresaColors.cor_secundaria,
      logo_url: designDraftLogoUrl || null,
    } as any);

    setEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ---- Loading ----
  if (empresaLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <FullSkeleton />
      </div>
    );
  }

  // ---- No empresa ----
  if (!empresa) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto page-enter">
        <div className="text-center py-20">
          <AlertCircle size={40} className="text-text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold text-text-primary mb-2">
            Nenhuma empresa selecionada
          </h2>
          <p className="text-sm text-text-secondary">
            Selecione uma empresa no menu lateral para ver o DNA da marca.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "identidade", label: "Identidade", icon: <Brain size={16} /> },
    { id: "design", label: "Design", icon: <Palette size={16} /> },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto page-enter">
      {/* ---- HEADER ---- */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="glow-text">DNA da Marca</span>
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

            {/* Edit toggle */}
            {(hasDNA || activeTab === "design") && (
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
                {editing ? "Editando" : "Editar"}
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
                Atualizar DNA
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---- TABS ---- */}
      <div className="mb-8">
        <div className="flex gap-1 p-1 bg-bg-card/60 backdrop-blur-xl border border-border rounded-xl w-fit">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (editing) setEditing(false);
                }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="marcaTab"
                    className="absolute inset-0 bg-gradient-to-r from-accent/15 to-purple-500/10 border border-accent/20 rounded-lg"
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Instagram connection banner ---- */}
      {igChecked && igConnected && hasDNA && !editing && activeTab === "identidade" && (
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

      {/* ---- ANALYZING STATE ---- */}
      {status === "analisando" && <AnalyzingCard />}

      {/* ---- ERROR STATE ---- */}
      {status === "erro" && error && !hasDNA && (
        <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 fade-in">
          <AlertCircle size={18} className="text-danger shrink-0" />
          <div>
            <p className="text-sm font-semibold text-danger">Erro na analise</p>
            <p className="text-xs text-text-secondary mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ---- NO DNA: CTAs ---- */}
      {(status === "idle" || (status === "erro" && !hasDNA)) &&
        !analyzing &&
        igChecked &&
        activeTab === "identidade" && (
          <>
            {igConnected ? (
              <GenerateDNACTA
                empresa={empresa}
                onGenerate={analisar}
                analyzing={analyzing}
              />
            ) : (
              <ConnectInstagramCTA
                empresa={empresa}
                onFallbackAnalyze={analisar}
                analyzing={analyzing}
              />
            )}
          </>
        )}

      {/* ---- LOADING STATE ---- */}
      {(status === "loading" || (!igChecked && status === "idle")) &&
        activeTab === "identidade" && <FullSkeleton />}

      {/* ============================================================= */}
      {/* TAB: IDENTIDADE                                                */}
      {/* ============================================================= */}
      {activeTab === "identidade" && (
        <div className="space-y-10">
          {/* Company Info (always visible) */}
          <CompanyInfoSection />

          {/* DNA Content */}
          {hasDNA && dna && marcaDNA && (
            <>
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

              {/* Competitive + Sources sections (view only) */}
              {!editing && (
                <>
                  <CompetitiveSection
                    dna={dna}
                    concorrentes={extractConcorrentes(marcaDNA)}
                  />
                  <SourcesSection marcaDNA={marcaDNA} />
                </>
              )}
            </>
          )}

          {/* Generate CTA when no DNA and empresa exists */}
          {!hasDNA && !analyzing && igChecked && status !== "idle" && status !== "erro" && (
            <div className="text-center py-10">
              <button
                onClick={analisar}
                disabled={analyzing}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-accent to-purple-500 text-white shadow-xl shadow-accent/25 hover:shadow-2xl hover:shadow-accent/35 hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
              >
                <Sparkles size={20} />
                Gerar DNA com IA
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB: DESIGN                                                    */}
      {/* ============================================================= */}
      {activeTab === "design" && (
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
                  Modo de edicao ativo — altere os campos visuais e salve.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Color Palette */}
          <DesignColorsSection
            dna={dna || null}
            editing={editing}
            draftColors={designDraftColors}
            onColorsChange={setDesignDraftColors}
            empresa={empresa}
            empresaColors={designDraftEmpresaColors}
            onEmpresaColorsChange={(field, value) =>
              setDesignDraftEmpresaColors((prev) => ({
                ...prev,
                [field]: value,
              }))
            }
          />

          {/* Visual Style */}
          <DesignVisualStyleSection
            dna={dna || null}
            editing={editing}
            draftEstilo={designDraftEstilo}
            onEstiloChange={setDesignDraftEstilo}
          />

          {/* Logo — upload-based rich card */}
          <LogoCard
            empresaId={empresa.id}
            logoUrl={liveLogo}
            onLogoUpdated={(url) => {
              setLiveLogo(url);
              setDesignDraftLogoUrl(url || "");
            }}
          />

          {/* Fontes */}
          <FontsSection
            empresaId={empresa.id}
            brandFonts={brandFonts}
            onFontsUpdated={setBrandFonts}
          />

          {/* Outros assets: elementos, texturas, fotos */}
          <OtherAssetsGrid empresaId={empresa.id} />

          {/* Visual Analysis (from Instagram) */}
          <DesignVisualAnalysisSection marcaDNA={marcaDNA} />

          {/* Save bar for design tab */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="sticky bottom-4 z-30 flex items-center justify-end gap-3 p-4 bg-bg-card/90 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/30"
              >
                <button
                  onClick={() => {
                    setEditing(false);
                    // Reset drafts
                    if (hookDna?.dna_sintetizado) {
                      setDesignDraftColors(
                        hookDna.dna_sintetizado.paleta_cores || []
                      );
                      setDesignDraftEstilo(
                        hookDna.dna_sintetizado.estilo_visual || ""
                      );
                    }
                    if (empresa) {
                      setDesignDraftLogoUrl(empresa.logo_url || "");
                      setDesignDraftEmpresaColors({
                        cor_primaria: empresa.cor_primaria || "#6c5ce7",
                        cor_secundaria: empresa.cor_secundaria || "#a29bfe",
                      });
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary bg-bg-elevated border border-border hover:bg-bg-input transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDesign}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-accent to-purple-500 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.02] transition-all duration-200"
                >
                  <Save size={14} />
                  Salvar alteracoes
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---- Footer ---- */}
      {!editing && (
        <footer
          className="pt-6 pb-4 border-t border-border/30 text-center fade-in mt-10"
          style={{ animationDelay: "600ms" }}
        >
          <p className="text-xs text-text-muted flex items-center justify-center gap-1.5">
            <Sparkles size={10} className="text-accent-light" />
            DNA da Marca por GO Studio &middot; Inteligencia de Marca
          </p>
        </footer>
      )}
    </div>
  );
}
