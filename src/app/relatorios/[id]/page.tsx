"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  ArrowLeft,
  Download,
  Send,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  AlertTriangle,
  Star,
  BarChart2,
  ExternalLink,
  Users,
  Heart,
  Eye,
  Image,
  Film,
  MessageCircle,
  Bookmark,
  Share2,
  Database,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Report, ReportAnalysis, Insight, Recommendation, Warning, Comparison, Highlight } from "@/types/reports";

/* ── Sub-components ─────────────────────────────────────────── */

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.FC<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-accent" />
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InsightBadge({ insight }: { insight: Insight }) {
  const colors: Record<Insight["type"], string> = {
    positive: "border-emerald-400/20 bg-emerald-400/5",
    negative: "border-red-400/20 bg-red-400/5",
    neutral: "border-blue-400/20 bg-blue-400/5",
    warning: "border-amber-400/20 bg-amber-400/5",
  };
  const iconColors: Record<Insight["type"], string> = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-blue-400",
    warning: "text-amber-400",
  };

  return (
    <div className={`border rounded-xl p-4 ${colors[insight.type]}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${iconColors[insight.type]}`}>
          {insight.type === "positive" && <CheckCircle2 size={15} />}
          {insight.type === "negative" && <AlertCircle size={15} />}
          {insight.type === "warning" && <AlertTriangle size={15} />}
          {insight.type === "neutral" && <Lightbulb size={15} />}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-text-primary">{insight.title}</p>
          <p className="text-[12px] text-text-secondary mt-0.5">{insight.description}</p>
          {insight.providers.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {insight.providers.map((p) => (
                <span key={p} className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">{p}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const priorityColors: Record<Recommendation["priority"], string> = {
    high: "text-red-400 bg-red-400/10",
    medium: "text-amber-400 bg-amber-400/10",
    low: "text-emerald-400 bg-emerald-400/10",
  };
  const priorityLabels: Record<Recommendation["priority"], string> = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };

  return (
    <div className="border border-border rounded-xl p-4 bg-bg-elevated/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-text-primary">{rec.action}</p>
          <p className="text-[12px] text-text-secondary mt-1">{rec.rationale}</p>
          {rec.estimatedImpact && (
            <p className="text-[11px] text-accent mt-1.5">Impacto estimado: {rec.estimatedImpact}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${priorityColors[rec.priority]}`}>
          {priorityLabels[rec.priority]}
        </span>
      </div>
    </div>
  );
}

function WarningCard({ warning }: { warning: Warning }) {
  const colors: Record<Warning["severity"], string> = {
    info: "border-blue-400/20 bg-blue-400/5 text-blue-400",
    warning: "border-amber-400/20 bg-amber-400/5 text-amber-400",
    critical: "border-red-400/20 bg-red-400/5 text-red-400",
  };

  return (
    <div className={`border rounded-xl p-4 ${colors[warning.severity]}`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold">{warning.title}</p>
          <p className="text-[12px] opacity-80 mt-0.5">{warning.description}</p>
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({ comparison }: { comparison: Comparison }) {
  const TrendIcon = comparison.trend === "up" ? TrendingUp : comparison.trend === "down" ? TrendingDown : Minus;
  const trendColor = comparison.trend === "up" ? "text-emerald-400" : comparison.trend === "down" ? "text-red-400" : "text-text-muted";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1">
        <p className="text-[13px] text-text-primary">{comparison.metric}</p>
        {comparison.context && <p className="text-[11px] text-text-muted mt-0.5">{comparison.context}</p>}
      </div>
      <div className="flex items-center gap-4 text-[13px]">
        <div className="text-right">
          <p className="font-semibold text-text-primary">{comparison.current.toLocaleString("pt-BR")}</p>
          <p className="text-[11px] text-text-muted">{comparison.previous.toLocaleString("pt-BR")} anterior</p>
        </div>
        <div className={`flex items-center gap-1 font-semibold ${trendColor}`}>
          <TrendIcon size={14} />
          <span>{Math.abs(comparison.deltaPercent).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: Highlight }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Star size={14} className="text-accent mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-text-primary">{highlight.title}</p>
          <p className="text-[12px] text-text-secondary mt-0.5">{highlight.description}</p>
          {highlight.metric && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-text-muted">{highlight.metric.label}:</span>
              <span className="text-[13px] font-bold text-accent">{highlight.metric.value}</span>
              {highlight.metric.delta && (
                <span className="text-[11px] text-emerald-400">{highlight.metric.delta}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Report Data types ─────────────────────────────────────── */

interface ReportKPIs {
  followers: number | null;
  engagementRate: number;
  totalPosts: number;
  totalReach: number | null;
}

interface ReportEngagementBreakdown {
  avgLikes: number;
  avgComments: number;
  avgSaves: number;
  avgShares: number;
  engagementRate: number;
  likesToCommentsRatio: number;
}

interface ContentPerformanceByType {
  type: string;
  count: number;
  avgEngagement: number;
  bestPost: string | null;
}

interface ReportCaptionAnalysis {
  avgLength: number;
  withCTA: number;
  withoutCTA: number;
  ctaEngagementAvg: number;
  noCtaEngagementAvg: number;
  withHashtags: number;
  avgHashtagCount: number;
}

interface ReportTopPost {
  id: string;
  provider: string;
  contentType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  url: string | null;
  publishedAt: string | null;
  metrics: Record<string, number>;
  engagement: number;
}

interface ReportData {
  contentCount?: number;
  kpis?: ReportKPIs;
  engagementBreakdown?: ReportEngagementBreakdown;
  contentPerformance?: { byType?: ContentPerformanceByType[] };
  captionAnalysis?: ReportCaptionAnalysis;
  topPosts?: ReportTopPost[];
  postingFrequency?: { postsPerWeek?: number; mostActiveDay?: string };
}

/* ── KPI Mini Card ─────────────────────────────────────────── */

function KPIMiniCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.FC<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon size={16} className="text-accent" />
        </div>
        <span className="text-[11px] text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-text-primary tracking-tight">{value}</p>
    </div>
  );
}

/* ── Report Data Section ───────────────────────────────────── */

function ReportDataSection({ data }: { data: ReportData }) {
  const kpis = data.kpis;
  const engagement = data.engagementBreakdown;
  const byType = data.contentPerformance?.byType;
  const captionAnalysis = data.captionAnalysis;
  const topPosts = data.topPosts;
  const frequency = data.postingFrequency;

  const hasAnyData = kpis || engagement || topPosts?.length;
  if (!hasAnyData) return null;

  const TYPE_LABELS: Record<string, string> = {
    post: "Post",
    reel: "Reel",
    carousel: "Carrossel",
    carousel_album: "Carrossel",
    video: "Video",
    story: "Story",
    image: "Imagem",
  };

  const TYPE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
    post: Image,
    reel: Film,
    carousel: Image,
    carousel_album: Image,
    video: Film,
    story: Image,
    image: Image,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.12 }}
      className="space-y-4"
    >
      <SectionCard title="Dados do Periodo" icon={Database}>
        <div className="space-y-5">
          {/* KPIs Grid */}
          {kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.followers != null && (
                <KPIMiniCard label="Seguidores" value={formatNumber(kpis.followers)} icon={Users} />
              )}
              <KPIMiniCard label="Eng. Rate" value={`${kpis.engagementRate.toFixed(1)}%`} icon={Heart} />
              <KPIMiniCard label="Posts" value={String(kpis.totalPosts)} icon={FileText} />
              {kpis.totalReach != null && (
                <KPIMiniCard label="Alcance" value={formatNumber(kpis.totalReach)} icon={Eye} />
              )}
            </div>
          )}

          {/* Engagement por post (media) */}
          {engagement && (engagement.avgLikes > 0 || engagement.avgComments > 0) && (
            <div className="bg-bg-elevated border border-border rounded-xl p-4">
              <p className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-3">Engajamento por Post (media)</p>
              <div className="flex flex-wrap gap-4">
                {engagement.avgLikes > 0 && (
                  <div className="flex items-center gap-2">
                    <Heart size={14} className="text-red-400" />
                    <span className="text-[14px] font-semibold text-text-primary">{formatNumber(Math.round(engagement.avgLikes))}</span>
                    <span className="text-[11px] text-text-muted">curtidas</span>
                  </div>
                )}
                {engagement.avgComments > 0 && (
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-blue-400" />
                    <span className="text-[14px] font-semibold text-text-primary">{formatNumber(Math.round(engagement.avgComments))}</span>
                    <span className="text-[11px] text-text-muted">comentarios</span>
                  </div>
                )}
                {engagement.avgSaves > 0 && (
                  <div className="flex items-center gap-2">
                    <Bookmark size={14} className="text-amber-400" />
                    <span className="text-[14px] font-semibold text-text-primary">{formatNumber(Math.round(engagement.avgSaves))}</span>
                    <span className="text-[11px] text-text-muted">salvos</span>
                  </div>
                )}
                {engagement.avgShares > 0 && (
                  <div className="flex items-center gap-2">
                    <Share2 size={14} className="text-emerald-400" />
                    <span className="text-[14px] font-semibold text-text-primary">{formatNumber(Math.round(engagement.avgShares))}</span>
                    <span className="text-[11px] text-text-muted">compartilhamentos</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top 5 Posts */}
          {topPosts && topPosts.length > 0 && (
            <div className="bg-bg-elevated border border-border rounded-xl p-4">
              <p className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-3">Top {topPosts.length} Posts</p>
              <div className="space-y-2">
                {topPosts.map((post, i) => {
                  const displayCaption = post.caption ?? "Sem legenda";
                  const postDate = post.publishedAt
                    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(post.publishedAt))
                    : "";
                  const likes = post.metrics.likes ?? post.metrics.like_count ?? 0;
                  const comments = post.metrics.comments ?? post.metrics.comments_count ?? 0;

                  return (
                    <div key={post.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-card border border-border/50 hover:border-border-light transition-all">
                      <span className="shrink-0 w-6 text-center text-[12px] font-bold text-text-muted">{i + 1}</span>
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-elevated overflow-hidden flex items-center justify-center">
                        {post.thumbnailUrl ? (
                          <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          (() => {
                            const TypeIcon = TYPE_ICONS[post.contentType] ?? FileText;
                            return <TypeIcon size={16} className="text-text-muted" />;
                          })()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] text-accent font-medium">{TYPE_LABELS[post.contentType] ?? post.contentType}</span>
                          {postDate && <span className="text-[10px] text-text-muted">· {postDate}</span>}
                        </div>
                        <p className="text-[12px] text-text-secondary truncate">{displayCaption}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-bold text-accent">{formatNumber(post.engagement)}</p>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                          {likes > 0 && <span>{formatNumber(likes)} likes</span>}
                          {comments > 0 && <span>{formatNumber(comments)} comm</span>}
                        </div>
                      </div>
                      {post.url && (
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-bg-elevated transition-colors">
                          <ExternalLink size={12} className="text-text-muted" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Performance por Formato */}
          {byType && byType.length > 0 && (
            <div className="bg-bg-elevated border border-border rounded-xl p-4">
              <p className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-3">Performance por Formato</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {byType.map((t) => {
                  const TypeIcon = TYPE_ICONS[t.type] ?? FileText;
                  return (
                    <div key={t.type} className="flex items-center gap-3 p-3 rounded-lg bg-bg-card border border-border/50">
                      <TypeIcon size={16} className="text-accent shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-text-primary">{TYPE_LABELS[t.type] ?? t.type}</p>
                        <p className="text-[11px] text-text-muted">{t.count} posts · {t.avgEngagement.toFixed(1)} eng medio</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analise de CTAs */}
          {captionAnalysis && (captionAnalysis.withCTA > 0 || captionAnalysis.withoutCTA > 0) && (
            <div className="bg-bg-elevated border border-border rounded-xl p-4">
              <p className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-3">Analise de CTAs</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-secondary">Com CTA</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-text-primary">
                      {captionAnalysis.withCTA + captionAnalysis.withoutCTA > 0
                        ? Math.round((captionAnalysis.withCTA / (captionAnalysis.withCTA + captionAnalysis.withoutCTA)) * 100)
                        : 0}% dos posts
                    </span>
                    <span className="text-[11px] text-text-muted">eng medio {captionAnalysis.ctaEngagementAvg.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-secondary">Sem CTA</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-text-primary">
                      {captionAnalysis.withCTA + captionAnalysis.withoutCTA > 0
                        ? Math.round((captionAnalysis.withoutCTA / (captionAnalysis.withCTA + captionAnalysis.withoutCTA)) * 100)
                        : 0}% dos posts
                    </span>
                    <span className="text-[11px] text-text-muted">eng medio {captionAnalysis.noCtaEngagementAvg.toFixed(1)}</span>
                  </div>
                </div>
                {captionAnalysis.ctaEngagementAvg > 0 && captionAnalysis.noCtaEngagementAvg > 0 && (
                  <div className="mt-2 p-2.5 rounded-lg bg-accent/5 border border-accent/15">
                    <p className="text-[12px] text-accent font-medium">
                      Impacto: {captionAnalysis.noCtaEngagementAvg > 0
                        ? `${captionAnalysis.ctaEngagementAvg > captionAnalysis.noCtaEngagementAvg ? "+" : ""}${(((captionAnalysis.ctaEngagementAvg - captionAnalysis.noCtaEngagementAvg) / captionAnalysis.noCtaEngagementAvg) * 100).toFixed(0)}% de engajamento com CTA`
                        : "Sem dados suficientes"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Frequencia */}
          {frequency && frequency.postsPerWeek != null && (
            <div className="flex items-center gap-4 text-[12px] text-text-muted">
              <span>Frequencia: <strong className="text-text-primary">{frequency.postsPerWeek.toFixed(1)} posts/semana</strong></span>
              {frequency.mostActiveDay && <span>Dia mais ativo: <strong className="text-text-primary">{frequency.mostActiveDay}</strong></span>}
            </div>
          )}
        </div>
      </SectionCard>
    </motion.div>
  );
}

/* ── Send modal ─────────────────────────────────────────────── */

function SendEmailModal({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: string[] } | null>(null);

  function addEmail() {
    const t = email.trim();
    if (t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && !emails.includes(t)) {
      setEmails((prev) => [...prev, t]);
      setEmail("");
    }
  }

  async function handleSend() {
    if (emails.length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: emails }),
      });
      const data = await res.json() as { sent?: number; failed?: string[]; error?: string };
      if (!res.ok) {
        setSendError(data.error ?? `Erro HTTP ${res.status}`);
        setSending(false);
        return;
      }
      setSendResult({ sent: data.sent ?? 0, failed: data.failed ?? [] });
      setDone(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erro de conexao ao enviar email");
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#141736] border border-[#1e2348] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {done ? (
          <div className="text-center space-y-3">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
            <p className="text-[16px] font-semibold text-text-primary">
              {sendResult && sendResult.sent > 0 ? `Email enviado para ${sendResult.sent} destinatario${sendResult.sent > 1 ? "s" : ""}!` : "Email enviado!"}
            </p>
            {sendResult && sendResult.failed.length > 0 && (
              <p className="text-[12px] text-amber-400">
                Falha ao enviar para: {sendResult.failed.join(", ")}
              </p>
            )}
            <button onClick={onClose} className="px-4 py-2 bg-accent text-bg-primary text-[13px] font-semibold rounded-lg">Fechar</button>
          </div>
        ) : (
          <>
            <h3 className="text-[16px] font-semibold text-text-primary mb-4">Enviar relatorio por email</h3>

            {sendError && (
              <div className="flex items-center gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[12px]">
                <AlertCircle size={14} className="shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()} placeholder="email@exemplo.com"
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-accent/50" />
              <button onClick={addEmail} className="px-3 py-2 bg-accent/20 text-accent rounded-lg text-[13px] hover:bg-accent/30 transition-colors">+</button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {emails.map((e) => (
                  <span key={e} className="flex items-center gap-1 text-[11px] bg-bg-elevated border border-border rounded-full px-2 py-0.5 text-text-secondary">
                    {e}<button onClick={() => setEmails((p) => p.filter((x) => x !== e))} className="text-text-muted hover:text-red-400 ml-0.5">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-[13px] text-text-secondary">Cancelar</button>
              <button onClick={handleSend} disabled={sending || emails.length === 0} className="flex items-center gap-2 px-4 py-2 bg-accent text-bg-primary text-[13px] font-semibold rounded-lg disabled:opacity-50">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Enviar
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function ReportViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/${id}`);
        if (!res.ok) throw new Error("Relatório não encontrado");
        const data = await res.json() as { report: Report };
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar relatório");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-secondary">
        <Loader2 size={20} className="animate-spin text-accent" />
        Carregando relatório...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px]">
          <AlertCircle size={18} />
          {error ?? "Relatório não encontrado"}
        </div>
      </div>
    );
  }

  const analysis = report.ai_analysis as ReportAnalysis;
  const hasAnalysis = analysis && typeof analysis.summary === "string";

  const fmt = (d: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 md:p-6 space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
            <FileText size={16} className="text-accent" />
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text-primary tracking-tight truncate">{report.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[12px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {fmt(report.period_start)} – {fmt(report.period_end)}
                </span>
                <span>·</span>
                <span>{report.providers.join(", ")}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  {report.status === "ready" && <CheckCircle2 size={12} className="text-emerald-400" />}
                  {report.status === "generating" && <Loader2 size={12} className="animate-spin text-amber-400" />}
                  {report.status === "failed" && <AlertCircle size={12} className="text-red-400" />}
                  {report.status === "ready" ? "Pronto" : report.status === "generating" ? "Gerando..." : "Falhou"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {report.pdf_url && (
                <a
                  href={report.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:border-accent/30 transition-all"
                >
                  <Download size={14} />
                  PDF
                </a>
              )}
              {report.status === "ready" && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-accent text-bg-primary rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Send size={14} />
                  Enviar por email
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* PDF iframe */}
      {report.pdf_url && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-[13px] font-medium text-text-secondary">Visualização do PDF</span>
            <a href={report.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] text-accent hover:underline">
              Abrir em nova aba
              <ExternalLink size={12} />
            </a>
          </div>
          <iframe src={report.pdf_url} className="w-full h-[500px] bg-white" title="PDF do relatório" />
        </motion.div>
      )}

      {/* Analysis */}
      {report.status === "generating" && (
        <div className="flex items-center gap-3 p-5 bg-accent/5 border border-accent/20 rounded-xl text-accent text-[13px]">
          <Loader2 size={20} className="animate-spin shrink-0" />
          <div>
            <p className="font-semibold">Gerando análise com IA...</p>
            <p className="text-[11px] text-accent/70 mt-0.5">Isso pode levar entre 5 e 15 segundos</p>
          </div>
        </div>
      )}

      {/* Report Data (visual metrics) */}
      {report.status === "ready" && report.data && Object.keys(report.data).length > 0 && (
        <ReportDataSection data={report.data as ReportData} />
      )}

      {hasAnalysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-4">
          {/* Summary */}
          <SectionCard title="Resumo Executivo" icon={FileText}>
            <p className="text-[14px] text-text-secondary leading-relaxed">{analysis.summary}</p>
          </SectionCard>

          {/* Highlights */}
          {analysis.highlights?.length > 0 && (
            <SectionCard title="Destaques" icon={Star}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.highlights.map((h: Highlight, i: number) => (
                  <HighlightCard key={i} highlight={h} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Comparisons */}
          {analysis.comparisons?.length > 0 && (
            <SectionCard title="Comparações com período anterior" icon={BarChart2}>
              <div className="divide-y divide-border/0">
                {analysis.comparisons.map((c: Comparison, i: number) => (
                  <ComparisonRow key={i} comparison={c} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Insights */}
          {analysis.insights?.length > 0 && (
            <SectionCard title="Insights" icon={Lightbulb}>
              <div className="space-y-3">
                {analysis.insights.map((ins: Insight, i: number) => (
                  <InsightBadge key={i} insight={ins} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <SectionCard title="Recomendações" icon={CheckCircle2}>
              <div className="space-y-3">
                {analysis.recommendations.map((rec: Recommendation, i: number) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Warnings */}
          {analysis.warnings?.length > 0 && (
            <SectionCard title="Alertas" icon={AlertTriangle}>
              <div className="space-y-3">
                {analysis.warnings.map((w: Warning, i: number) => (
                  <WarningCard key={i} warning={w} />
                ))}
              </div>
            </SectionCard>
          )}
        </motion.div>
      )}

      {/* Send modal */}
      <AnimatePresence>
        {showSendModal && (
          <SendEmailModal reportId={report.id} onClose={() => setShowSendModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
