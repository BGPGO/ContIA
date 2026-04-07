"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  Calendar,
  Hash,
  Type,
  Image,
  Video,
  LayoutGrid,
  Clock,
  Target,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Cable,
  AlertCircle,
  ChevronRight,
  BarChart3,
  Star,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import Link from "next/link";
import type {
  ContentIntelligence,
  ContentPillar,
  Opportunity,
  CalendarSuggestion,
} from "@/lib/ai/content-intelligence";

/* ── Helpers ─────────────────────────────────────── */

function getCacheKey(empresaId: string) {
  return `contia_intelligence_${empresaId}`;
}

function getCachedIntelligence(empresaId: string): ContentIntelligence | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getCacheKey(empresaId));
    if (!raw) return null;
    const data = JSON.parse(raw) as ContentIntelligence;
    // Cache valid for 24h
    const age = Date.now() - new Date(data.analyzedAt).getTime();
    if (age > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

function cacheIntelligence(empresaId: string, data: ContentIntelligence) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getCacheKey(empresaId), JSON.stringify(data));
  } catch {
    // localStorage full — ignore
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getImpactColor(impact: string) {
  if (impact === "high") return { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Alto" };
  if (impact === "medium") return { bg: "bg-amber-500/15", text: "text-amber-400", label: "Medio" };
  return { bg: "bg-slate-500/15", text: "text-slate-400", label: "Baixo" };
}

function getMediaIcon(type: string) {
  if (type === "VIDEO" || type === "Video" || type === "Reels") return Video;
  if (type === "CAROUSEL_ALBUM" || type === "Carrossel") return LayoutGrid;
  return Image;
}

const DAY_ORDER = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];

function sortCalendar(suggestions: CalendarSuggestion[]) {
  return [...suggestions].sort((a, b) => {
    const ai = DAY_ORDER.findIndex((d) => a.dayOfWeek.startsWith(d));
    const bi = DAY_ORDER.findIndex((d) => b.dayOfWeek.startsWith(d));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/* ── Score Ring ──────────────────────────────────── */

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color =
    score >= 7 ? "#4ecdc4" : score >= 4 ? "#feca57" : "#ff6b6b";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="5"
        />
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-text-primary tabular-nums">
          {score}
        </span>
        <span className="text-[10px] text-text-muted">/10</span>
      </div>
    </div>
  );
}

/* ── Loading Animation ───────────────────────────── */

function AnalyzingLoader({ postCount }: { postCount?: number }) {
  const steps = [
    "Buscando posts do Instagram...",
    `Analisando ${postCount ?? 50} posts com IA...`,
    "Identificando pilares de conteudo...",
    "Calculando padroes de engajamento...",
    "Gerando calendario sugerido...",
    "Preparando oportunidades...",
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 2500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center shadow-lg shadow-[#6c5ce7]/20"
      >
        <Brain className="w-8 h-8 text-white" />
      </motion.div>

      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">
          Analisando seu conteudo
        </h2>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-sm text-text-secondary"
          >
            {steps[step]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            animate={{
              backgroundColor: i <= step ? "#4ecdc4" : "var(--color-border)",
              scale: i === step ? 1.3 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Not Connected State ─────────────────────────── */

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-16 h-16 rounded-2xl bg-[#6c5ce7]/10 flex items-center justify-center">
        <Cable className="w-8 h-8 text-[#6c5ce7]" />
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-lg font-semibold text-text-primary">
          Conecte seu Instagram
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Para analisar seus padroes de conteudo e gerar insights com IA,
          primeiro conecte sua conta do Instagram na pagina de Conexoes.
        </p>
      </div>
      <Link
        href="/conexoes"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Cable className="w-4 h-4" />
        Ir para Conexoes
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

/* ── Pillar Card ─────────────────────────────────── */

function PillarCard({ pillar, index }: { pillar: ContentPillar; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${pillar.color}18`,
            boxShadow: `0 0 16px ${pillar.color}10`,
          }}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: pillar.color }}
          />
        </div>
        <span
          className="text-xs font-bold tabular-nums px-2 py-1 rounded-lg"
          style={{
            color: pillar.color,
            backgroundColor: `${pillar.color}12`,
          }}
        >
          {pillar.percentage}%
        </span>
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">
        {pillar.name}
      </h3>
      <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
        {pillar.description}
      </p>
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>{pillar.postCount} posts</span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {pillar.avgEngagement.toFixed(0)} eng. medio
        </span>
      </div>
      {/* Bottom bar */}
      <div className="mt-3 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pillar.percentage}%` }}
          transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: pillar.color }}
        />
      </div>
    </motion.div>
  );
}

/* ── Engagement Bar ──────────────────────────────── */

function EngagementBar({
  type,
  avgEngagement,
  count,
  maxEngagement,
  index,
}: {
  type: string;
  avgEngagement: number;
  count: number;
  maxEngagement: number;
  index: number;
}) {
  const Icon = getMediaIcon(type);
  const pct = maxEngagement > 0 ? (avgEngagement / maxEngagement) * 100 : 0;
  const colors = ["#6c5ce7", "#4ecdc4", "#ff6b6b", "#feca57"];
  const color = colors[index % colors.length];
  const labels: Record<string, string> = {
    IMAGE: "Imagem",
    VIDEO: "Video",
    CAROUSEL_ALBUM: "Carrossel",
    REELS: "Reels",
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-primary font-medium">
            {labels[type] ?? type}
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color }}
          >
            {avgEngagement.toFixed(0)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: index * 0.12 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color}, ${color}99)`,
            }}
          />
        </div>
      </div>
      <span className="text-[11px] text-text-muted tabular-nums shrink-0 w-12 text-right">
        {count} posts
      </span>
    </div>
  );
}

/* ── Opportunity Card ────────────────────────────── */

function OpportunityCard({
  opp,
  index,
}: {
  opp: Opportunity;
  index: number;
}) {
  const impact = getImpactColor(opp.expectedImpact);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-bg-card border border-border rounded-xl p-4 hover:border-border-light transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[#feca57]" />
          <h4 className="text-sm font-semibold text-text-primary">
            {opp.title}
          </h4>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${impact.bg} ${impact.text}`}
        >
          {impact.label}
        </span>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed mb-3">
        {opp.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted px-2 py-0.5 rounded bg-bg-elevated">
          {opp.category}
        </span>
        <Link
          href="/criacao"
          className="inline-flex items-center gap-1 text-[11px] text-[#4ecdc4] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Criar conteudo
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  );
}

/* ── Calendar Grid ───────────────────────────────── */

function CalendarGrid({ suggestions }: { suggestions: CalendarSuggestion[] }) {
  const sorted = sortCalendar(suggestions);
  const dayColors: Record<string, string> = {
    Segunda: "#6c5ce7",
    Terca: "#4ecdc4",
    Quarta: "#ff6b6b",
    Quinta: "#feca57",
    Sexta: "#54a0ff",
    Sabado: "#5f27cd",
    Domingo: "#01a3a4",
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sorted.map((s, i) => {
        const dayKey = DAY_ORDER.find((d) => s.dayOfWeek.startsWith(d)) ?? s.dayOfWeek;
        const color = dayColors[dayKey] ?? "#6c5ce7";
        const Icon = getMediaIcon(s.format);

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="bg-bg-card border border-border rounded-xl p-4 hover:border-border-light transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-md"
                style={{
                  color,
                  backgroundColor: `${color}15`,
                }}
              >
                {s.dayOfWeek}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-text-muted">
                <Clock className="w-3 h-3" />
                {s.time}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs text-text-secondary font-medium">
                {s.format}
              </span>
              <span className="text-[10px] text-text-muted">|</span>
              <span className="text-xs text-text-secondary">{s.pillar}</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
              {s.description}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────── */

export default function InteligenciaPage() {
  const { empresa } = useEmpresa();
  const [intelligence, setIntelligence] = useState<ContentIntelligence | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  // Load cached data on mount
  useEffect(() => {
    if (!empresa) return;
    const cached = getCachedIntelligence(empresa.id);
    if (cached) {
      setIntelligence(cached);
      setNotConnected(false);
    }
  }, [empresa]);

  const runAnalysis = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    setError(null);
    setNotConnected(false);

    try {
      const res = await fetch("/api/ai/content-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresa.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "NOT_CONNECTED") {
          setNotConnected(true);
          setLoading(false);
          return;
        }
        if (data.code === "AI_NOT_CONFIGURED") {
          setError("__AI_NOT_CONFIGURED__");
          setLoading(false);
          return;
        }
        throw new Error(data.error ?? "Erro desconhecido");
      }

      const result = data.intelligence as ContentIntelligence;
      setIntelligence(result);
      cacheIntelligence(empresa.id, result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao analisar");
    } finally {
      setLoading(false);
    }
  }, [empresa]);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  // ── Render states ──

  const showNotConnected = notConnected && !loading;
  const showResults = intelligence && !loading && !showNotConnected;
  const showEmpty = !intelligence && !loading && !showNotConnected && !error;

  return (
    <div className="fade-in space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center shadow-lg shadow-[#6c5ce7]/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">
                Inteligencia de Conteudo
              </h1>
              <span className="text-[10px] font-medium text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Powered by IA
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-0.5">
              {empresa.nome} &middot; Analise profunda do seu Instagram
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {intelligence && (
            <span className="text-[11px] text-text-muted">
              Ultima analise: {formatDate(intelligence.analyzedAt)}
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-[#6c5ce7]/20"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {loading ? "Analisando..." : "Analisar Agora"}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            error === "__AI_NOT_CONFIGURED__"
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {error === "__AI_NOT_CONFIGURED__" ? (
            <>
              <Zap className="w-4 h-4 shrink-0" />
              <span>
                A IA nao esta configurada no servidor. A variavel <strong>OPENAI_API_KEY</strong> precisa estar definida. Se voce acabou de configurar, um novo deploy pode resolver.
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </>
          )}
        </motion.div>
      )}

      {/* ── Loading ── */}
      {loading && <AnalyzingLoader />}

      {/* ── Not connected ── */}
      {showNotConnected && <NotConnectedState />}

      {/* ── Empty — first visit, no cache ── */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="w-14 h-14 rounded-2xl bg-[#6c5ce7]/10 flex items-center justify-center">
            <Brain className="w-7 h-7 text-[#6c5ce7]" />
          </div>
          <div className="text-center space-y-1.5 max-w-md">
            <h2 className="text-lg font-semibold text-text-primary">
              Descubra os padroes do seu conteudo
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Nossa IA analisa seus ultimos posts, identifica pilares de
              conteudo, padroes de engajamento e sugere um calendario otimizado.
            </p>
          </div>
          <button
            onClick={runAnalysis}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#6c5ce7]/20"
          >
            <Zap className="w-4 h-4" />
            Iniciar Analise
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {showResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Summary + Score */}
          <div className="bg-bg-card border border-border rounded-xl p-6 hover:border-border-light transition-colors">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <ScoreRing score={intelligence.contentScore} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-text-primary">
                    Score de Conteudo
                  </h2>
                  <span className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded">
                    {intelligence.analyzedPostsCount} posts analisados
                  </span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {intelligence.summary}
                </p>
                {/* Engagement Drivers */}
                {intelligence.engagementDrivers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {intelligence.engagementDrivers.slice(0, 4).map((d, i) => (
                      <span
                        key={i}
                        className="text-[11px] text-text-secondary bg-bg-elevated px-2.5 py-1 rounded-lg"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Pillars */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#6c5ce7]" />
              <h2 className="text-sm font-semibold text-text-primary">
                Pilares de Conteudo
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {intelligence.pillars.map((p, i) => (
                <PillarCard key={i} pillar={p} index={i} />
              ))}
            </div>
          </section>

          {/* Performance + Caption Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Performance */}
            <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#4ecdc4]" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Performance por Formato
                </h3>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-text-primary tabular-nums">
                    {intelligence.performance.bestDayOfWeek}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Melhor dia
                  </p>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-text-primary tabular-nums">
                    {intelligence.performance.bestTimeOfDay}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Melhor horario
                  </p>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-[#4ecdc4] tabular-nums">
                    {intelligence.performance.avgEngagementRate.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Eng. medio
                  </p>
                </div>
              </div>

              {/* Bars */}
              <div className="space-y-3">
                {intelligence.performance.engagementByType.map((e, i) => (
                  <EngagementBar
                    key={e.type}
                    type={e.type}
                    avgEngagement={e.avgEngagement}
                    count={e.count}
                    maxEngagement={Math.max(
                      ...intelligence.performance.engagementByType.map(
                        (x) => x.avgEngagement
                      )
                    )}
                    index={i}
                  />
                ))}
              </div>
            </div>

            {/* Caption Intelligence */}
            <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors space-y-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-[#ff6b6b]" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Inteligencia de Legendas
                </h3>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-elevated rounded-lg p-3">
                  <p className="text-lg font-bold text-text-primary tabular-nums">
                    {intelligence.captionIntelligence.avgLength}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Caracteres medio
                  </p>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3">
                  <p className="text-lg font-bold text-text-primary tabular-nums">
                    {intelligence.captionIntelligence.hashtagAnalysis.avgPerPost}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Hashtags/post
                  </p>
                </div>
              </div>

              {/* Tone */}
              <div>
                <p className="text-xs text-text-muted mb-1">Tom de voz</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {intelligence.captionIntelligence.toneDescription}
                </p>
              </div>

              {/* Emoji */}
              <div>
                <p className="text-xs text-text-muted mb-1">Uso de emojis</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {intelligence.captionIntelligence.emojiUsage}
                </p>
              </div>

              {/* Top Words */}
              <div>
                <p className="text-xs text-text-muted mb-2">
                  Palavras mais usadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {intelligence.captionIntelligence.topWords
                    .slice(0, 12)
                    .map((w, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:border-border-light transition-colors"
                        style={{
                          fontSize: `${Math.max(10, Math.min(14, 10 + w.count * 0.5))}px`,
                        }}
                      >
                        {w.word}
                        <span className="ml-1 text-text-muted text-[9px]">
                          {w.count}
                        </span>
                      </span>
                    ))}
                </div>
              </div>

              {/* CTAs */}
              {intelligence.captionIntelligence.ctaPatterns.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-1.5">
                    Padroes de CTA
                  </p>
                  <div className="space-y-1">
                    {intelligence.captionIntelligence.ctaPatterns
                      .slice(0, 4)
                      .map((cta, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs text-text-secondary"
                        >
                          <span className="w-1 h-1 rounded-full bg-[#4ecdc4]" />
                          {cta}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hashtag Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-[#54a0ff]" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Hashtags Mais Usadas
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {intelligence.captionIntelligence.hashtagAnalysis.mostUsed
                  .slice(0, 15)
                  .map((h, i) => (
                    <span
                      key={i}
                      className="text-xs text-[#54a0ff] bg-[#54a0ff]/10 px-2.5 py-1 rounded-lg"
                    >
                      {h}
                    </span>
                  ))}
              </div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-[#feca57]" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Hashtags com Melhor Performance
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {intelligence.captionIntelligence.hashtagAnalysis.bestPerforming
                  .slice(0, 15)
                  .map((h, i) => (
                    <span
                      key={i}
                      className="text-xs text-[#feca57] bg-[#feca57]/10 px-2.5 py-1 rounded-lg"
                    >
                      {h}
                    </span>
                  ))}
              </div>
              <p className="text-[11px] text-text-muted mt-3">
                {intelligence.captionIntelligence.ctaEffectiveness}
              </p>
            </div>
          </div>

          {/* Content Calendar */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-[#4ecdc4]" />
              <h2 className="text-sm font-semibold text-text-primary">
                Calendario Sugerido
              </h2>
              <span className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded">
                Baseado na sua analise
              </span>
            </div>
            <CalendarGrid suggestions={intelligence.calendarSuggestions} />
          </section>

          {/* Opportunities */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-[#feca57]" />
              <h2 className="text-sm font-semibold text-text-primary">
                Oportunidades Identificadas
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {intelligence.opportunities.map((opp, i) => (
                <OpportunityCard key={i} opp={opp} index={i} />
              ))}
            </div>
          </section>
        </motion.div>
      )}
    </div>
  );
}
