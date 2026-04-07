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
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";
import { DNASourcesForm } from "@/components/marca/DNASourcesForm";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── types (match API route response) ────────────────────────────────────────

interface DNASintetizado {
  tom_de_voz?: string;
  personalidade_marca?: string;
  proposta_valor?: string;
  publico_alvo?: string;
  paleta_cores?: string[];
  estilo_visual?: string;
  pilares_conteudo?: string[];
  temas_recomendados?: string[];
  formatos_recomendados?: string[];
  hashtags_recomendadas?: string[];
  frequencia_ideal?: string;
  diferenciais_vs_concorrentes?: string[];
  oportunidades?: string[];
  palavras_usar?: string[];
  palavras_evitar?: string[];
  exemplos_legenda?: string[];
}

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
  const config: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    idle: { label: "Pendente", color: "text-warning", bg: "bg-warning/10", icon: <Clock size={12} /> },
    loading: { label: "Carregando...", color: "text-accent-light", bg: "bg-accent/15", icon: <Loader2 size={12} className="animate-spin" /> },
    analisando: { label: "Analisando...", color: "text-accent-light", bg: "bg-accent/15", icon: <Loader2 size={12} className="animate-spin" /> },
    completo: { label: "Completo", color: "text-success", bg: "bg-success/10", icon: <CheckCircle2 size={12} /> },
    erro: { label: "Erro", color: "text-danger", bg: "bg-danger/10", icon: <AlertCircle size={12} /> },
  };
  const c = config[status] || config.idle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold", c.color, c.bg)}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ─── skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-bg-elevated", className)} />;
}

function FullSkeleton() {
  return (
    <div className="space-y-8 fade-in">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    </div>
  );
}

// ─── section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon, title, subtitle, children, delay = 0, accentColor = "#6c5ce7",
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode; delay?: number; accentColor?: string;
}) {
  return (
    <section className="fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accentColor}18`, boxShadow: `0 0 20px ${accentColor}10` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── chip components ─────────────────────────────────────────────────────────

function Chip({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "danger" | "accent" | "warning" }) {
  const styles = {
    default: "bg-bg-elevated text-text-secondary border-border",
    success: "bg-success/10 text-success border-success/20",
    danger: "bg-danger/10 text-danger border-danger/20",
    accent: "bg-accent/15 text-accent-light border-accent/25",
    warning: "bg-warning/10 text-warning border-warning/20",
  };
  return (
    <span className={cn("inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 hover:scale-105", styles[variant])}>
      {children}
    </span>
  );
}

function HashChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent-light border border-accent/20 hover:bg-accent/20 transition-all duration-200 cursor-default">
      <Hash size={10} className="opacity-60" />
      {tag.replace(/^#/, "")}
    </span>
  );
}

// ─── color swatch ────────────────────────────────────────────────────────────

function ColorSwatch({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2.5 group">
      <div
        className="w-8 h-8 rounded-lg border border-border-light shadow-md group-hover:scale-110 transition-transform duration-200"
        style={{ backgroundColor: color, boxShadow: `0 2px 12px ${color}40` }}
      />
      <span className="text-xs font-mono text-text-secondary">{color}</span>
    </div>
  );
}

// ─── info row ────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0">
      <span className="text-accent-light mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-0.5">{label}</p>
        <div className="text-sm text-text-primary leading-relaxed">{value}</div>
      </div>
    </div>
  );
}

// ─── hex points for SVG radar ────────────────────────────────────────────────

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

// ─── analyzing progress card ─────────────────────────────────────────────────

function AnalyzingCard() {
  return (
    <div className="card-featured p-8 text-center max-w-lg mx-auto fade-in">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-accent/20 animate-ping" style={{ animationDelay: "200ms" }} />
        <div className="absolute inset-0 rounded-full bg-accent/15 flex items-center justify-center">
          <Brain size={32} className="text-accent-light animate-pulse" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-2">Analisando sua marca...</h3>
      <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
        A IA esta processando Instagram, website, concorrentes e referencias para criar o DNA completo da sua marca.
      </p>
      <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
        <Loader2 size={14} className="animate-spin text-accent-light" />
        <span>Isso pode levar alguns minutos</span>
      </div>
      <div className="flex justify-center gap-1.5 mt-5">
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
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ─── empty / onboarding state ────────────────────────────────────────────────

function EmptyState({ empresa, onAnalisar, analyzing }: { empresa: any; onAnalisar: () => void; analyzing: boolean }) {
  const [instagramHandle, setInstagramHandle] = useState(empresa?.instagram_handle || "");
  const [website, setWebsite] = useState(empresa?.website || "");
  const [concorrentesIg, setConcorrentesIg] = useState<string[]>(empresa?.concorrentes_ig || []);
  const [referenciasIg, setReferenciasIg] = useState<string[]>(empresa?.referencias_ig || []);
  const [referenciasSites, setReferenciasSites] = useState<string[]>(empresa?.referencias_sites || []);
  const { updateEmpresa } = useEmpresa();

  const hasSomething = instagramHandle || website || concorrentesIg.length > 0;

  const handleUpdate = (field: string, value: any) => {
    switch (field) {
      case "instagramHandle": setInstagramHandle(value); break;
      case "website": setWebsite(value); break;
      case "concorrentesIg": setConcorrentesIg(value); break;
      case "referenciasIg": setReferenciasIg(value); break;
      case "referenciasSites": setReferenciasSites(value); break;
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
    onAnalisar();
  };

  return (
    <div className="max-w-3xl mx-auto page-enter">
      {/* Hero */}
      <div className="text-center mb-8">
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-accent/8 blur-3xl" />
          </div>
          <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
            <Brain size={36} className="text-accent-light" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">DNA da Marca</h2>
        <p className="text-text-secondary text-sm max-w-lg mx-auto leading-relaxed">
          Preencha as fontes abaixo e a IA vai analisar tudo automaticamente para
          gerar o perfil completo da sua marca — tom de voz, pilares de conteudo,
          analise competitiva e guia de comunicacao.
        </p>
      </div>

      {/* Sources Form */}
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
          Preencha pelo menos o Instagram ou o site da empresa para iniciar a analise.
        </p>
      )}
    </div>
  );
}

// ─── brand identity section ──────────────────────────────────────────────────

function BrandIdentitySection({ dna }: { dna: DNASintetizado }) {
  return (
    <Section icon={<Brain size={20} />} title="Identidade da Marca" subtitle="Tom de voz, personalidade e proposta de valor" delay={100}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-6 space-y-1">
          {dna.tom_de_voz && <InfoRow icon={<MessageSquare size={16} />} label="Tom de voz" value={dna.tom_de_voz} />}
          {dna.personalidade_marca && <InfoRow icon={<Users size={16} />} label="Personalidade" value={dna.personalidade_marca} />}
          {dna.proposta_valor && <InfoRow icon={<Target size={16} />} label="Proposta de valor" value={dna.proposta_valor} />}
          {dna.publico_alvo && <InfoRow icon={<Megaphone size={16} />} label="Publico-alvo" value={dna.publico_alvo} />}
          {dna.estilo_visual && <InfoRow icon={<Palette size={16} />} label="Estilo visual" value={dna.estilo_visual} />}
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-accent-light" />
            <h3 className="text-sm font-semibold text-text-primary">Paleta de Cores</h3>
          </div>
          <div className="space-y-3">
            {dna.paleta_cores?.length ? (
              dna.paleta_cores.map((cor, i) => <ColorSwatch key={i} color={cor} />)
            ) : (
              <p className="text-xs text-text-muted">Nenhuma cor identificada ainda.</p>
            )}
          </div>
          {dna.personalidade_marca && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3 font-semibold">Resumo visual</p>
              <div className="relative w-full aspect-square max-w-[140px] mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {[40, 30, 20].map((r) => (
                    <polygon key={r} points={hexPoints(50, 50, r)} fill="none" stroke="#1e2348" strokeWidth="0.5" />
                  ))}
                  <polygon points={hexPoints(50, 50, 32)} fill="rgba(108,92,231,0.12)" stroke="#6c5ce7" strokeWidth="1" />
                  <circle cx="50" cy="50" r="2" fill="#6c5ce7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── content radar section ───────────────────────────────────────────────────

function ContentRadarSection({ dna }: { dna: DNASintetizado }) {
  return (
    <Section icon={<BarChart3 size={20} />} title="Radar de Conteudo" subtitle="Pilares, temas, formatos e hashtags recomendadas" delay={200} accentColor="#a29bfe">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pilares */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Target size={14} className="text-accent-light" /> Pilares de Conteudo
          </h3>
          <div className="flex flex-wrap gap-2">
            {dna.pilares_conteudo?.length ? dna.pilares_conteudo.map((p, i) => <Chip key={i} variant="accent">{p}</Chip>) : <p className="text-xs text-text-muted">Nenhum pilar definido.</p>}
          </div>
        </div>

        {/* Temas */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Lightbulb size={14} className="text-warning" /> Temas Recomendados
          </h3>
          <div className="space-y-2.5">
            {dna.temas_recomendados?.length ? dna.temas_recomendados.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-text-secondary hover:text-text-primary transition-colors">
                <ChevronRight size={12} className="text-accent-light shrink-0" />
                <span>{t}</span>
              </div>
            )) : <p className="text-xs text-text-muted">Nenhum tema sugerido.</p>}
          </div>
        </div>

        {/* Formatos */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <FileText size={14} className="text-info" /> Formatos Recomendados
          </h3>
          <div className="flex flex-wrap gap-2">
            {dna.formatos_recomendados?.map((fmt, i) => {
              const colors = ["#6c5ce7", "#e1306c", "#34d399", "#fbbf24", "#60a5fa"];
              const c = colors[i % colors.length];
              return (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-105"
                  style={{ backgroundColor: `${c}15`, borderColor: `${c}30`, color: c }}>
                  <Zap size={10} /> {fmt}
                </span>
              );
            })}
          </div>
          {dna.frequencia_ideal && (
            <div className="mt-4 pt-3 border-t border-border/50 flex items-start gap-2 text-xs text-text-muted">
              <Clock size={12} className="text-accent-light mt-0.5 shrink-0" />
              <span>Frequencia ideal: <strong className="text-text-secondary">{dna.frequencia_ideal}</strong></span>
            </div>
          )}
        </div>

        {/* Hashtags */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Hash size={14} className="text-accent-light" /> Hashtags Recomendadas
          </h3>
          <div className="flex flex-wrap gap-2">
            {dna.hashtags_recomendadas?.length ? dna.hashtags_recomendadas.map((tag, i) => <HashChip key={i} tag={tag} />) : <p className="text-xs text-text-muted">Nenhuma hashtag sugerida.</p>}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── competitive analysis section ────────────────────────────────────────────

function CompetitiveSection({ dna, concorrentes }: { dna: DNASintetizado; concorrentes: ConcorrenteInfo[] }) {
  return (
    <Section icon={<Shield size={20} />} title="Analise Competitiva" subtitle="Concorrentes, diferenciais e oportunidades" delay={300} accentColor="#f87171">
      <div className="space-y-4">
        {concorrentes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {concorrentes.map((comp, i) => (
              <div key={i} className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light transition-colors">{comp.nome}</h4>
                  {comp.seguidores && (
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Users size={10} />
                      {typeof comp.seguidores === "number" ? formatCompact(comp.seguidores) : comp.seguidores}
                    </span>
                  )}
                </div>
                {comp.estrategia && <p className="text-xs text-text-secondary leading-relaxed mb-3">{comp.estrategia}</p>}
                {comp.pontos_fortes && comp.pontos_fortes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {comp.pontos_fortes.map((pf, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/15">{pf}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dna.diferenciais_vs_concorrentes && dna.diferenciais_vs_concorrentes.length > 0 && (
            <div className="card-featured p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2 relative z-10">
                <TrendingUp size={14} className="text-success" /> Seus Diferenciais
              </h3>
              <div className="space-y-3 relative z-10">
                {dna.diferenciais_vs_concorrentes.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/10">
                    <ArrowUpRight size={14} className="text-success mt-0.5 shrink-0" />
                    <span className="text-sm text-text-secondary">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dna.oportunidades && dna.oportunidades.length > 0 && (
            <div className="card-featured p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2 relative z-10">
                <Lightbulb size={14} className="text-warning" /> Oportunidades Identificadas
              </h3>
              <div className="space-y-3 relative z-10">
                {dna.oportunidades.map((o, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/10">
                    <Lightbulb size={14} className="text-warning mt-0.5 shrink-0" />
                    <span className="text-sm text-text-secondary">{o}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── communication guide section ─────────────────────────────────────────────

function CommunicationGuideSection({ dna }: { dna: DNASintetizado }) {
  return (
    <Section icon={<PenTool size={20} />} title="Guia de Comunicacao" subtitle="Vocabulario, estilo e exemplos de legenda" delay={400} accentColor="#34d399">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-success" /> Palavras para Usar
          </h3>
          <div className="flex flex-wrap gap-2">
            {dna.palavras_usar?.length ? dna.palavras_usar.map((p, i) => <Chip key={i} variant="success">{p}</Chip>) : <p className="text-xs text-text-muted">Nenhuma palavra sugerida.</p>}
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <AlertCircle size={14} className="text-danger" /> Palavras para Evitar
          </h3>
          <div className="flex flex-wrap gap-2">
            {dna.palavras_evitar?.length ? dna.palavras_evitar.map((p, i) => <Chip key={i} variant="danger">{p}</Chip>) : <p className="text-xs text-text-muted">Nenhuma palavra listada.</p>}
          </div>
        </div>
      </div>

      {dna.exemplos_legenda && dna.exemplos_legenda.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <MessageSquare size={14} className="text-accent-light" /> Exemplos de Legenda
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dna.exemplos_legenda.map((ex, i) => (
              <div key={i} className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-all duration-200 group">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-[#e1306c] flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">IG</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">Sua Marca</p>
                    <p className="text-[10px] text-text-muted">Post sugerido</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {typeof ex === "string" ? ex : String(ex)}
                  </p>
                </div>
                <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-4 text-text-muted">
                  <span className="text-[10px] flex items-center gap-1 hover:text-danger transition-colors cursor-default">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    Curtir
                  </span>
                  <span className="text-[10px] flex items-center gap-1">
                    <MessageSquare size={10} /> Comentar
                  </span>
                  <span className="text-[10px] flex items-center gap-1">
                    <ArrowUpRight size={10} /> Enviar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── analyzed sources section ────────────────────────────────────────────────

function SourcesSection({ marcaDNA }: { marcaDNA: MarcaDNAResponse }) {
  const sources: FonteInfo[] = [];

  if (marcaDNA.analise_instagram) {
    sources.push({
      tipo: "instagram",
      nome: `@${marcaDNA.analise_instagram.username || "perfil"}`,
      resumo: marcaDNA.analise_instagram.resumo_visual || marcaDNA.analise_instagram.tom_legendas || "Perfil Instagram analisado",
      metricas: marcaDNA.analise_instagram.followers
        ? { seguidores: marcaDNA.analise_instagram.followers, engajamento: marcaDNA.analise_instagram.engajamento_medio || "N/A" }
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
    Object.entries(marcaDNA.analises_concorrentes).forEach(([nome, analise]) => {
      if (analise) {
        sources.push({
          tipo: "concorrente",
          nome,
          resumo: analise.resumo_visual || analise.tom_legendas || "Concorrente analisado",
          metricas: analise.followers ? { seguidores: analise.followers } : undefined,
        });
      }
    });
  }

  if (sources.length === 0) return null;

  const sourceIcons: Record<string, React.ReactNode> = {
    instagram: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/>
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
    <Section icon={<Eye size={20} />} title="Fontes Analisadas" subtitle="Dados que alimentaram esta analise" delay={500} accentColor="#60a5fa">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map((fonte, i) => {
          const tipo = fonte.tipo || "website";
          const color = sourceColors[tipo] || "#6c5ce7";
          return (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-200"
              style={{ borderTopColor: `${color}60`, borderTopWidth: "2px" }}>
              <div className="flex items-center gap-2.5 mb-3">
                <span style={{ color }}>{sourceIcons[tipo] || <Globe size={14} />}</span>
                <span className="text-xs font-semibold text-text-primary truncate">{fonte.nome}</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: `${color}15`, color }}>{tipo}</span>
              </div>
              {fonte.resumo && <p className="text-xs text-text-secondary leading-relaxed">{fonte.resumo}</p>}
              {fonte.metricas && (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4">
                  {Object.entries(fonte.metricas).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <p className="text-xs font-bold text-text-primary">{typeof v === "number" ? formatCompact(v) : String(v)}</p>
                      <p className="text-[10px] text-text-muted capitalize">{k}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
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
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function RelatorioPage() {
  const { empresa, loading: empresaLoading } = useEmpresa();
  const { dna: hookDna, loading: dnaLoading, analyzing, refreshing, error: dnaError, analisar, isStale } = useMarcaDNA(empresa?.id);
  const [igConnected, setIgConnected] = useState(false);

  // Check if Instagram is connected
  useEffect(() => {
    if (!empresa?.id) return;
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
      });
  }, [empresa?.id]);

  // Derive marcaDNA (MarcaDNAResponse-compatible) from the hook's dna
  const marcaDNA: MarcaDNAResponse | null = hookDna
    ? {
        id: hookDna.id,
        empresa_id: hookDna.empresa_id,
        status: hookDna.status === "pendente" ? "completo" : hookDna.status as MarcaDNAResponse["status"],
        analise_instagram: hookDna.instagram_analysis,
        analise_site: hookDna.site_analysis,
        analises_concorrentes: hookDna.concorrentes_analysis?.reduce(
          (acc: Record<string, any>, c: any) => { acc[c.nome || c.username || `concorrente`] = c; return acc; },
          {}
        ) || null,
        analises_referencias: hookDna.referencias_analysis?.reduce(
          (acc: Record<string, any>, r: any) => { acc[r.nome || r.url || `referencia`] = r; return acc; },
          {}
        ) || null,
        dna_sintetizado: hookDna.dna_sintetizado,
        created_at: hookDna.created_at,
        updated_at: hookDna.updated_at,
      }
    : null;

  // Derive page status from hook state
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
          <h2 className="text-lg font-bold text-text-primary mb-2">Nenhuma empresa selecionada</h2>
          <p className="text-sm text-text-secondary">Selecione uma empresa no menu lateral para ver o relatorio de inteligencia.</p>
        </div>
      </div>
    );
  }

  const hasDNA = status === "completo" && marcaDNA?.dna_sintetizado;
  const dna = marcaDNA?.dna_sintetizado;

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
                  <span className="text-text-muted">·</span>
                  <span className="text-text-muted flex items-center gap-1">
                    <Clock size={11} />
                    {formatDate(marcaDNA.updated_at)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
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
            {hasDNA && (
              <button
                onClick={analisar}
                disabled={analyzing}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                  analyzing
                    ? "bg-bg-elevated text-text-muted cursor-not-allowed"
                    : "bg-accent/15 text-accent-light hover:bg-accent/25 border border-accent/20 hover:border-accent/40"
                )}
              >
                <RefreshCw size={14} className={analyzing ? "animate-spin" : ""} />
                Atualizar DNA
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Instagram connection banner ── */}
      {igConnected ? (
        <div className="mb-6 p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3 fade-in">
          <CheckCircle2 size={16} className="text-success shrink-0" />
          <p className="text-xs text-success font-medium">
            Instagram conectado — DNA gerado com dados reais
          </p>
        </div>
      ) : !empresaLoading && empresa ? (
        <div className="mb-6 p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3 fade-in">
          <AlertCircle size={16} className="text-warning shrink-0" />
          <p className="text-xs text-warning font-medium">
            Conecte o Instagram para um DNA mais preciso.{" "}
            <Link href="/conexoes" className="underline hover:text-text-primary transition-colors">
              Conectar agora
            </Link>
          </p>
        </div>
      ) : null}

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

      {/* ── EMPTY / ONBOARDING STATE ── */}
      {(status === "idle" || (status === "erro" && !hasDNA)) && (
        <EmptyState empresa={empresa} onAnalisar={analisar} analyzing={analyzing} />
      )}

      {/* ── LOADING STATE ── */}
      {status === "loading" && <FullSkeleton />}

      {/* ── FULL REPORT ── */}
      {hasDNA && dna && marcaDNA && (
        <div className="space-y-10">
          <BrandIdentitySection dna={dna} />
          <ContentRadarSection dna={dna} />
          <CompetitiveSection dna={dna} concorrentes={extractConcorrentes(marcaDNA)} />
          <CommunicationGuideSection dna={dna} />
          <SourcesSection marcaDNA={marcaDNA} />

          {/* Footer branding */}
          <footer className="pt-6 pb-4 border-t border-border/30 text-center fade-in" style={{ animationDelay: "600ms" }}>
            <p className="text-xs text-text-muted flex items-center justify-center gap-1.5">
              <Sparkles size={10} className="text-accent-light" />
              Relatorio gerado por ContIA · Inteligencia de Marca
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
