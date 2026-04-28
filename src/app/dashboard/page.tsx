"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useSpring, useMotionValue } from "motion/react";
import {
  Users,
  ImageIcon,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Sparkles,
  ExternalLink,
  Plus,
  BarChart3,
  Clock,
  Zap,
  AlertCircle,
  RefreshCw,
  Calendar,
  Video,
  Images,
  Camera,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useDashboard } from "@/hooks/useDashboard";
import { cn, formatNumber } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatLabel(type: string): string {
  const map: Record<string, string> = {
    IMAGE: "Imagem",
    VIDEO: "Vídeo",
    CAROUSEL_ALBUM: "Carrossel",
    REELS: "Reels",
  };
  return map[type] ?? type;
}

function formatTypeIcon(type: string) {
  switch (type) {
    case "VIDEO":
    case "REELS":
      return <Video size={12} />;
    case "CAROUSEL_ALBUM":
      return <Images size={12} />;
    default:
      return <ImageIcon size={12} />;
  }
}

// ─── animated number ────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  format = false,
}: {
  value: number;
  format?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = springVal.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = format
          ? formatNumber(Math.round(latest))
          : Math.round(latest).toLocaleString("pt-BR");
      }
    });
    return unsubscribe;
  }, [springVal, format]);

  return <span ref={ref} className="tabular-nums">0</span>;
}

// ─── skeleton ───────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-bg-elevated" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-20 bg-bg-elevated rounded" />
          <div className="h-3 w-28 bg-bg-elevated rounded" />
        </div>
      </div>
    </div>
  );
}

function PostGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-bg-card border border-border rounded-xl overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-bg-elevated" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-full bg-bg-elevated rounded" />
            <div className="h-3 w-2/3 bg-bg-elevated rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── stat card ──────────────────────────────────────────────────────────────

interface OverviewCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: string;
  suffix?: string;
  delay: number;
  formatVal?: boolean;
}

function OverviewCard({
  icon,
  label,
  value,
  tint,
  suffix,
  delay,
  formatVal,
}: OverviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-bg-card border border-border rounded-xl p-5 transition-colors duration-300 hover:border-border-light cursor-default group"
    >
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundColor: `${tint}18`,
            boxShadow: `0 0 24px ${tint}20`,
          }}
        >
          <span style={{ color: tint }}>{icon}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-2xl font-bold text-text-primary leading-none -tracking-tight">
            <AnimatedNumber value={value} format={formatVal} />
            {suffix && (
              <span className="text-sm font-medium text-text-secondary ml-0.5">
                {suffix}
              </span>
            )}
          </span>
          <span className="text-xs text-text-secondary mt-1.5">{label}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { empresa } = useEmpresa();
  const { connected, profile, recentPosts, dna, loading, stats, refresh } =
    useDashboard(empresa?.id);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const firstName = empresa.nome.split(" ")[0];

  return (
    <div className="space-y-5 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Welcome Header ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-text-secondary mt-1 capitalize">
            {formatDate()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Instagram connection badge */}
          {connected && profile ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e1306c]/30 bg-[#e1306c]/10 text-[#e1306c]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Camera size={13} />
              @{profile.username}
            </span>
          ) : !loading ? (
            <Link
              href="/conexoes"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-border text-text-muted hover:text-text-secondary hover:border-border-light transition-colors"
            >
              <AlertCircle size={13} />
              Instagram desconectado
            </Link>
          ) : null}

          {/* Quick actions */}
          <Link
            href="/criacao"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-lg hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus size={13} />
            Criar Conteudo
          </Link>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-card border border-border rounded-lg hover:border-border-light hover:-translate-y-0.5 transition-all duration-300"
          >
            <BarChart3 size={13} />
            Ver Analytics
          </Link>
        </div>
      </motion.div>

      {/* ── Instagram Overview Cards ───────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : connected && profile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <OverviewCard
            icon={<Users size={20} />}
            label="Seguidores"
            value={profile.followers_count}
            tint="#6c5ce7"
            delay={0}
            formatVal
          />
          <OverviewCard
            icon={<ImageIcon size={20} />}
            label="Posts"
            value={profile.media_count}
            tint="#4ecdc4"
            delay={0.1}
            formatVal
          />
          <OverviewCard
            icon={<TrendingUp size={20} />}
            label="Taxa de Engajamento"
            value={Math.round(stats.engagementRate * 100) / 100}
            tint="#fbbf24"
            suffix="%"
            delay={0.2}
          />
          <OverviewCard
            icon={<Eye size={20} />}
            label="Alcance"
            value={stats.reachValue ?? 0}
            tint="#f093fb"
            delay={0.3}
            formatVal
          />
        </div>
      ) : (
        /* Not connected — CTA card */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden bg-gradient-to-br from-[#6c5ce7]/20 via-bg-card to-[#4ecdc4]/10 border border-[#6c5ce7]/30 rounded-2xl p-6 sm:p-10 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(108,92,231,0.15),transparent_60%)]" />
          <div className="relative">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#4ecdc4] flex items-center justify-center"
            >
              <Camera size={32} className="text-white" />
            </motion.div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Conecte seu Instagram
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-5">
              Desbloqueie todo o potencial da plataforma com dados reais de
              seguidores, posts, engajamento e alcance.
            </p>
            <Link
              href="/conexoes"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-xl hover:shadow-[0_0_30px_rgba(108,92,231,0.4)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <Zap size={16} />
              Conectar Instagram
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Recent Posts Grid ──────────────────────────────────── */}
      {loading ? (
        <div>
          <span className="section-title mb-3 block text-text-primary">
            Posts recentes
          </span>
          <PostGridSkeleton />
        </div>
      ) : connected && recentPosts.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="section-title text-text-primary">
              Posts recentes
            </span>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentPosts.map((post, index) => {
              const thumbUrl =
                post.media_type === "VIDEO"
                  ? post.thumbnail_url ?? post.media_url
                  : post.media_url;
              const captionPreview = post.caption
                ? post.caption.slice(0, 80) +
                  (post.caption.length > 80 ? "..." : "")
                : "Sem legenda";

              return (
                <motion.a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className="group bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-bg-elevated overflow-hidden">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={captionPreview}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon
                          size={32}
                          className="text-text-muted opacity-30"
                        />
                      </div>
                    )}

                    {/* Overlay on hover with full caption */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <p className="text-white text-xs leading-relaxed line-clamp-4">
                        {post.caption ?? "Sem legenda"}
                      </p>
                    </div>

                    {/* Media type badge */}
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                      {formatTypeIcon(post.media_type)}
                      {formatLabel(post.media_type)}
                    </span>

                    {/* Open link icon */}
                    <span className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ExternalLink size={14} className="text-white/80" />
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs text-text-secondary line-clamp-2 mb-2 min-h-[2rem]">
                      {captionPreview}
                    </p>
                    <div className="flex items-center gap-3 text-text-muted text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <Heart size={11} className="text-[#e1306c]" />
                        {formatNumber(post.like_count ?? 0)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={11} className="text-[#6c5ce7]" />
                        {formatNumber(post.comments_count ?? 0)}
                      </span>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Quick Stats Bar + DNA Status ───────────────────────── */}
      {!loading && connected && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Quick Stats Bar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-3 bg-bg-card border border-border rounded-xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#4ecdc4]/15 flex items-center justify-center">
                <BarChart3 size={14} className="text-[#4ecdc4]" />
              </div>
              <h2 className="section-title text-text-primary">
                Resumo de performance
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Avg Likes */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Heart size={13} className="text-[#e1306c]" />
                  <span className="text-[11px]">Media de curtidas</span>
                </div>
                <p className="text-lg font-bold text-text-primary tabular-nums">
                  {formatNumber(stats.avgLikes)}
                </p>
              </div>

              {/* Avg Comments */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <MessageCircle size={13} className="text-[#6c5ce7]" />
                  <span className="text-[11px]">Media de comentarios</span>
                </div>
                <p className="text-lg font-bold text-text-primary tabular-nums">
                  {formatNumber(stats.avgComments)}
                </p>
              </div>

              {/* Last Post */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Clock size={13} className="text-[#fbbf24]" />
                  <span className="text-[11px]">Post mais recente</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  {stats.lastPostAgo}
                </p>
              </div>

              {/* Most Used Format */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Calendar size={13} className="text-[#f093fb]" />
                  <span className="text-[11px]">Formato mais usado</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  {formatLabel(stats.mostUsedFormat)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* DNA Status Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#6c5ce7]/15 flex items-center justify-center">
                <Sparkles size={14} className="text-[#6c5ce7]" />
              </div>
              <h2 className="section-title text-text-primary">DNA da Marca</h2>
            </div>

            <DNACard dna={dna} empresaId={empresa.id} connected={connected} onDNAGenerated={refresh} />
          </motion.div>
        </div>
      )}

      {/* DNA card when NOT connected but dna exists */}
      {!loading && !connected && dna && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-bg-card border border-border rounded-xl p-4 sm:p-5 max-w-lg"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#6c5ce7]/15 flex items-center justify-center">
              <Sparkles size={14} className="text-[#6c5ce7]" />
            </div>
            <h2 className="section-title text-text-primary">DNA da Marca</h2>
          </div>
          <DNACard dna={dna} empresaId={empresa.id} connected={false} onDNAGenerated={refresh} />
        </motion.div>
      )}
    </div>
  );
}

// ─── DNA Card inner ─────────────────────────────────────────────────────────

function DNACard({
  dna,
  empresaId,
  connected,
  onDNAGenerated,
}: {
  dna: import("@/types").MarcaDNA | null;
  empresaId: string;
  connected?: boolean;
  onDNAGenerated?: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateDNA = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/ai/auto-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId }),
      });
      const result = await res.json();
      if (!res.ok || result.status === "erro") {
        throw new Error(result.error || "Erro ao gerar DNA");
      }
      onDNAGenerated?.();
    } catch (err: any) {
      setGenError(err.message || "Erro ao gerar DNA");
    } finally {
      setGenerating(false);
    }
  }, [empresaId, onDNAGenerated]);

  if (!dna || dna.status === "pendente") {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-muted mb-3">
          Gere o DNA da sua marca para desbloquear conteudo personalizado pela
          IA.
        </p>
        {connected ? (
          <button
            onClick={handleGenerateDNA}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-lg hover:shadow-[0_0_20px_rgba(108,92,231,0.3)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Gerando DNA com IA...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Gerar DNA da Marca
              </>
            )}
          </button>
        ) : (
          <Link
            href="/conexoes"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] rounded-lg hover:shadow-[0_0_20px_rgba(108,92,231,0.3)] transition-all duration-300"
          >
            <Sparkles size={14} />
            Conecte o Instagram primeiro
          </Link>
        )}
        {genError && (
          <p className="text-[11px] text-red-400 mt-2">{genError}</p>
        )}
        <p className="text-[11px] text-text-muted mt-2">DNA pendente</p>
      </div>
    );
  }

  const synth = dna.dna_sintetizado;

  return (
    <div className="space-y-3">
      {/* Tom de voz */}
      {synth?.tom_de_voz && (
        <div>
          <span className="text-[11px] text-text-muted uppercase tracking-wider">
            Tom de voz
          </span>
          <p className="text-sm text-text-primary mt-0.5 line-clamp-2">
            {synth.tom_de_voz}
          </p>
        </div>
      )}

      {/* 3 pilares */}
      {synth?.pilares_conteudo && synth.pilares_conteudo.length > 0 && (
        <div>
          <span className="text-[11px] text-text-muted uppercase tracking-wider">
            Pilares de conteudo
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {synth.pilares_conteudo.slice(0, 3).map((pilar) => (
              <span
                key={pilar}
                className="px-2 py-0.5 text-[11px] font-medium text-[#6c5ce7] bg-[#6c5ce7]/10 border border-[#6c5ce7]/20 rounded-md"
              >
                {pilar}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Paleta de cores */}
      {synth?.paleta_cores && synth.paleta_cores.length > 0 && (
        <div>
          <span className="text-[11px] text-text-muted uppercase tracking-wider">
            Paleta de cores
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {synth.paleta_cores.slice(0, 6).map((color) => (
              <span
                key={color}
                className="w-5 h-5 rounded-full border border-white/10"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-1.5 pt-1">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            dna.status === "completo" ? "bg-green-500" : "bg-yellow-500"
          )}
        />
        <span className="text-[11px] text-text-muted">
          {dna.status === "completo"
            ? "DNA atualizado"
            : dna.status === "analisando"
              ? "Analisando..."
              : "DNA pendente"}
        </span>
      </div>
    </div>
  );
}
