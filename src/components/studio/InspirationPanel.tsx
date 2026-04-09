"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Lightbulb,
  BarChart3,
  Heart,
  MessageCircle,
  Clock,
  TrendingUp,
  ArrowUpDown,
  ExternalLink,
  X,
  Sparkles,
  RefreshCw,
  Target,
  Newspaper,
  Calendar,
  Zap,
  ChevronRight,
  Layers,
  FileText,
  Video,
  Hash,
  Type,
  Smile,
  ImageIcon,
  Film,
  Database,
  Globe,
  Brain,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useSuggestions } from "@/hooks/useSuggestions";
import { usePatterns } from "@/hooks/usePatterns";
import { createClient } from "@/lib/supabase/client";
import type { EnrichedSuggestion } from "@/types/suggestions";
import type { StyleProfile } from "@/types/patterns";
import type { ContentFormat } from "@/types/ai";

/* ══════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════ */

interface MediaItem {
  id: string;
  ig_media_id: string;
  caption: string | null;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string;
  like_count: number;
  comments_count: number;
}

type InspirationTab = "posts" | "ideias" | "estilo";
type PostSort = "recentes" | "curtidos";

interface InspirationPanelProps {
  onStartFromSuggestion: (topic: string, format: ContentFormat, message: string) => void;
  onStartFromPost: (message: string) => void;
  className?: string;
}

/* ══════════════════════════════════════════════════════════════════
   Config
   ══════════════════════════════════════════════════════════════════ */

const TABS: { id: InspirationTab; label: string; icon: typeof Camera }[] = [
  { id: "posts", label: "Meus Posts", icon: Camera },
  { id: "ideias", label: "Ideias", icon: Lightbulb },
  { id: "estilo", label: "Estilo", icon: BarChart3 },
];

const SOURCE_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  trending: { icon: TrendingUp, color: "#a855f7", label: "Tendencia" },
  news: { icon: Newspaper, color: "#3b82f6", label: "Noticia" },
  gap: { icon: Target, color: "#22c55e", label: "Oportunidade" },
  seasonal: { icon: Calendar, color: "#f97316", label: "Sazonal" },
  engagement: { icon: BarChart3, color: "#ec4899", label: "Engajamento" },
};

const FORMAT_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  carrossel: { icon: Layers, color: "#a29bfe", label: "Carrossel" },
  post: { icon: FileText, color: "#60a5fa", label: "Post" },
  reels: { icon: Video, color: "#f87171", label: "Reels" },
};

const FORMAT_LABELS: Record<string, { icon: typeof ImageIcon; label: string }> = {
  IMAGE: { icon: ImageIcon, label: "Imagem" },
  VIDEO: { icon: Film, label: "Video" },
  CAROUSEL_ALBUM: { icon: Layers, label: "Carrossel" },
};

const ENGAGEMENT_CONFIG: Record<string, { color: string; label: string }> = {
  alto: { color: "#22c55e", label: "Alto" },
  "medio": { color: "#f59e0b", label: "Medio" },
  baixo: { color: "#6b7280", label: "Baixo" },
};

/* ══════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════ */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atras`;
  if (diffH < 24) return `${diffH}h atras`;
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `${diffD} dias atras`;
  if (diffD < 30) return `${Math.floor(diffD / 7)} sem atras`;
  return `${Math.floor(diffD / 30)} meses atras`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

/* ══════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════ */

/* ── Post card in grid ── */
function PostCard({
  post,
  onClick,
}: {
  post: MediaItem;
  onClick: () => void;
}) {
  const imgUrl = post.thumbnail_url || post.media_url;
  const typeConfig = FORMAT_LABELS[post.media_type] || FORMAT_LABELS.IMAGE;
  const TypeIcon = typeConfig.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group bg-[#141736] rounded-xl border border-white/5 overflow-hidden
        hover:border-[#4ecdc4]/30 transition-all text-left cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-[#0c0f24] overflow-hidden">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={post.caption?.slice(0, 40) || "Post"}
            className="w-full h-full object-cover rounded-t-xl group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon size={24} className="text-[#5e6388]" />
          </div>
        )}
        {/* Type badge */}
        <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white/80 font-medium">
          {typeConfig.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        {post.caption && (
          <p className="text-[11px] text-[#e8eaff]/80 leading-snug line-clamp-2">
            {truncate(post.caption, 80)}
          </p>
        )}
        <div className="flex items-center justify-between text-[10px] text-[#5e6388]">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <Heart size={10} className="text-pink-400/70" />
              {post.like_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={10} className="text-blue-400/70" />
              {post.comments_count}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {relativeTime(post.timestamp)}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Post detail modal ── */
function PostDetailModal({
  post,
  onClose,
  onUseAsReference,
}: {
  post: MediaItem;
  onClose: () => void;
  onUseAsReference: () => void;
}) {
  const imgUrl = post.thumbnail_url || post.media_url;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-[#141736] border border-white/10 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Camera size={14} className="text-[#4ecdc4]" />
            <span className="text-sm font-medium text-[#e8eaff]">Detalhes do post</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={16} className="text-[#5e6388]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {imgUrl && (
            <img
              src={imgUrl}
              alt="Post"
              className="w-full rounded-xl object-cover max-h-64"
            />
          )}

          {/* Engagement */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-pink-400">
              <Heart size={14} /> {post.like_count}
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <MessageCircle size={14} /> {post.comments_count}
            </span>
            <span className="text-[#5e6388] text-xs ml-auto">
              {relativeTime(post.timestamp)}
            </span>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="bg-[#0c0f24] rounded-xl p-3 border border-white/5">
              <p className="text-sm text-[#e8eaff]/90 leading-relaxed whitespace-pre-line">
                {post.caption}
              </p>
            </div>
          )}

          {/* Permalink */}
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#4ecdc4] hover:underline"
            >
              <ExternalLink size={12} />
              Ver no Instagram
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5">
          <button
            type="button"
            onClick={onUseAsReference}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer
              bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white
              hover:shadow-lg hover:shadow-[#4ecdc4]/20"
          >
            Usar como referencia
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Suggestion card ── */
function SuggestionCard({
  suggestion,
  onCriar,
}: {
  suggestion: EnrichedSuggestion;
  onCriar: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_CONFIG[suggestion.source?.type] || SOURCE_CONFIG.gap;
  const fmt = FORMAT_CONFIG[suggestion.format] || FORMAT_CONFIG.post;
  const eng = ENGAGEMENT_CONFIG[suggestion.estimated_engagement] || ENGAGEMENT_CONFIG.medio;
  const SrcIcon = src.icon;

  return (
    <div
      className="bg-[#141736] rounded-xl border border-white/5 overflow-hidden
        hover:border-white/10 transition-all"
      style={{ borderLeftWidth: 3, borderLeftColor: `${src.color}${Math.round((suggestion.confidence || 50) * 2.55).toString(16).padStart(2, "0")}` }}
    >
      <div className="p-3.5 space-y-2">
        {/* Topic + badges */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-[#e8eaff] leading-snug flex-1">
            {suggestion.topic}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${fmt.color}15`, color: fmt.color }}
            >
              {fmt.label}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${eng.color}15`, color: eng.color }}
            >
              {eng.label}
            </span>
          </div>
        </div>

        {/* Hook */}
        {suggestion.hook && (
          <p className="text-xs text-[#8b8fb0] italic leading-snug line-clamp-1">
            &ldquo;{suggestion.hook}&rdquo;
          </p>
        )}

        {/* Source + confidence */}
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium"
            style={{ color: src.color }}
          >
            <SrcIcon size={10} />
            {suggestion.source?.label || src.label}
          </span>

          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1.5 rounded-full bg-[#0c0f24] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${suggestion.confidence || 50}%`,
                  backgroundColor:
                    suggestion.confidence >= 75
                      ? "#22c55e"
                      : suggestion.confidence >= 50
                        ? "#f59e0b"
                        : "#6b7280",
                }}
              />
            </div>
            <span className="text-[10px] text-[#5e6388]">{suggestion.confidence}%</span>
          </div>

          {suggestion.category && (
            <span className="text-[10px] text-[#5e6388]">{suggestion.category}</span>
          )}
        </div>

        {/* Expand details */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-[#5e6388] hover:text-[#8b8fb0] transition-colors cursor-pointer"
          >
            <ChevronRight
              size={10}
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {expanded ? "Menos" : "Detalhes"}
          </button>

          <button
            type="button"
            onClick={onCriar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
              bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/20
              hover:bg-[#4ecdc4]/25 transition-all cursor-pointer"
          >
            <Zap size={11} />
            Criar
          </button>
        </div>

        {/* Expanded reasoning */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-2 border-t border-white/5">
                <p className="text-xs text-[#8b8fb0] leading-relaxed">
                  {suggestion.reasoning}
                </p>
                {suggestion.related_news && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-[#0c0f24]">
                    <Newspaper size={12} className="text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-[#e8eaff] leading-snug">
                        {suggestion.related_news.titulo}
                      </p>
                      <p className="text-[10px] text-[#5e6388]">
                        {suggestion.related_news.fonte}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Pattern insights (compact for panel) ── */
function PatternInsightsCompact({
  styleProfile,
  loading,
  onRefresh,
}: {
  styleProfile: StyleProfile | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#0c0f24] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!styleProfile) {
    return (
      <div className="bg-[#141736] border border-white/5 rounded-xl p-6 text-center">
        <BarChart3 size={28} className="mx-auto text-[#5e6388] mb-2" />
        <p className="text-sm text-[#8b8fb0] mb-1">Sem dados de estilo</p>
        <p className="text-xs text-[#5e6388]">
          Conecte o Instagram e sincronize seus posts para ver insights de estilo
        </p>
      </div>
    );
  }

  const sp = styleProfile;
  const fmtConfig = FORMAT_LABELS[sp.best_format] || FORMAT_LABELS.IMAGE;
  const FmtIcon = fmtConfig.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-[#4ecdc4]" />
          <span className="text-xs font-semibold text-[#e8eaff]">
            {sp.analyzed_posts_count} posts analisados
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Atualizar analise"
        >
          <RefreshCw size={12} className="text-[#5e6388]" />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Heart size={12} className="text-pink-400" />}
          label="Media likes"
          value={sp.avg_likes.toLocaleString()}
        />
        <MetricCard
          icon={<MessageCircle size={12} className="text-blue-400" />}
          label="Media comentarios"
          value={sp.avg_comments.toLocaleString()}
        />
        <MetricCard
          icon={<Clock size={12} className="text-amber-400" />}
          label="Melhor horario"
          value={sp.best_time_to_post}
        />
        <MetricCard
          icon={<FmtIcon size={12} className="text-green-400" />}
          label="Melhor formato"
          value={fmtConfig.label}
        />
      </div>

      {/* Quick insights */}
      <div className="bg-[#141736] rounded-xl border border-white/5 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Smile size={11} className="text-[#5e6388] shrink-0" />
          <span className="text-[11px] text-[#8b8fb0]">
            Emojis: <span className="text-[#e8eaff] font-medium">{sp.emoji_usage}</span>
            {sp.emoji_examples?.length > 0 && (
              <span className="ml-1 text-[#5e6388]">
                ({sp.emoji_examples.slice(0, 5).join(" ")})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Type size={11} className="text-[#5e6388] shrink-0" />
          <span className="text-[11px] text-[#8b8fb0]">
            Legenda media:{" "}
            <span className="text-[#e8eaff] font-medium">{sp.caption_avg_length} caracteres</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Hash size={11} className="text-[#5e6388] shrink-0" />
          <span className="text-[11px] text-[#8b8fb0]">
            Hashtags:{" "}
            <span className="text-[#e8eaff] font-medium">{sp.hashtag_avg_count} por post</span>
          </span>
        </div>
        {sp.caption_structure && (
          <div className="flex items-center gap-2">
            <FileText size={11} className="text-[#5e6388] shrink-0" />
            <span className="text-[11px] text-[#8b8fb0]">
              Estrutura:{" "}
              <span className="text-[#e8eaff] font-medium">{sp.caption_structure}</span>
            </span>
          </div>
        )}
      </div>

      {/* Top hashtags */}
      {sp.top_hashtags?.length > 0 && (
        <div>
          <span className="text-[10px] text-[#5e6388] font-medium uppercase tracking-wide mb-2 block">
            Top Hashtags
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sp.top_hashtags.slice(0, 10).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[#4ecdc4]/10 text-[#4ecdc4] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content pillars */}
      {sp.content_pillars?.length > 0 && (
        <div>
          <span className="text-[10px] text-[#5e6388] font-medium uppercase tracking-wide mb-2 block">
            Pilares de Conteudo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sp.content_pillars.map((pillar, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[#6c5ce7]/10 text-[#a29bfe] font-medium"
              >
                {pillar}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Note about auto-injection */}
      <div className="bg-[#4ecdc4]/5 border border-[#4ecdc4]/10 rounded-lg p-2.5">
        <p className="text-[10px] text-[#4ecdc4]/80 leading-relaxed">
          Esses insights sao automaticamente injetados no contexto da IA quando voce cria conteudo.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#0c0f24] rounded-lg p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-[#5e6388]">{label}</span>
      </div>
      <p className="text-sm font-semibold text-[#e8eaff]">{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main InspirationPanel
   ══════════════════════════════════════════════════════════════════ */

export function InspirationPanel({
  onStartFromSuggestion,
  onStartFromPost,
  className = "",
}: InspirationPanelProps) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  // Tab state
  const [activeTab, setActiveTab] = useState<InspirationTab>("posts");

  // Posts state
  const [posts, setPosts] = useState<MediaItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postSort, setPostSort] = useState<PostSort>("recentes");
  const [selectedPost, setSelectedPost] = useState<MediaItem | null>(null);

  // Suggestions
  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    context: suggestionsContext,
    fetchSuggestions,
    refetch: refetchSuggestions,
  } = useSuggestions(empresaId);

  // Patterns
  const {
    styleProfile,
    loading: patternsLoading,
    refetch: refetchPatterns,
  } = usePatterns(empresaId);

  // Fetch recent posts from Supabase
  useEffect(() => {
    async function loadPosts() {
      if (!empresaId) {
        setPostsLoading(false);
        return;
      }
      setPostsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("instagram_media_cache")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("timestamp", { ascending: false })
          .limit(12);

        if (error) {
          console.warn("[InspirationPanel] Posts fetch error:", error.message);
        }
        setPosts((data as MediaItem[]) || []);
      } catch (err) {
        console.warn("[InspirationPanel] Posts fetch failed:", err);
      } finally {
        setPostsLoading(false);
      }
    }
    loadPosts();
  }, [empresaId]);

  // Auto-fetch suggestions on mount
  useEffect(() => {
    if (empresaId && suggestions.length === 0) {
      fetchSuggestions();
    }
  }, [empresaId, suggestions.length, fetchSuggestions]);

  // Sort posts
  const sortedPosts = [...posts].sort((a, b) => {
    if (postSort === "curtidos") {
      return (b.like_count + b.comments_count) - (a.like_count + a.comments_count);
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Handlers
  const handleUseAsReference = useCallback(
    (post: MediaItem) => {
      const caption = post.caption || "(sem legenda)";
      const message = `Quero criar um post similar a este que performou bem: ${caption}. Mantenha o mesmo estilo e estrutura.`;
      onStartFromPost(message);
      setSelectedPost(null);
    },
    [onStartFromPost]
  );

  const handleCriarFromSuggestion = useCallback(
    (suggestion: EnrichedSuggestion) => {
      const format = (suggestion.format as ContentFormat) || "post";
      const message = `Quero criar um ${suggestion.format} sobre: ${suggestion.topic}. ${suggestion.reasoning}`;
      onStartFromSuggestion(suggestion.topic, format, message);
    },
    [onStartFromSuggestion]
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* ── Tab bar ── */}
      <div className="flex items-center bg-[#0c0f24] border-b border-white/5 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all cursor-pointer relative
                ${isActive ? "text-[#4ecdc4]" : "text-[#5e6388] hover:text-[#8b8fb0]"}`}
            >
              <Icon size={14} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="inspiration-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4ecdc4]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ── TAB: Meus Posts ── */}
          {activeTab === "posts" && (
            <motion.div
              key="posts"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-3"
            >
              {/* Sort control */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5e6388]">
                  {posts.length} posts recentes
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPostSort((s) => (s === "recentes" ? "curtidos" : "recentes"))
                  }
                  className="flex items-center gap-1 text-[10px] text-[#8b8fb0] hover:text-[#4ecdc4] transition-colors cursor-pointer"
                >
                  <ArrowUpDown size={10} />
                  {postSort === "recentes" ? "Recentes" : "Mais curtidos"}
                </button>
              </div>

              {/* Loading */}
              {postsLoading && (
                <div className="grid grid-cols-3 gap-2.5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="bg-[#141736] rounded-xl animate-pulse aspect-square"
                    />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!postsLoading && posts.length === 0 && (
                <div className="bg-[#141736] border border-white/5 rounded-xl p-6 text-center">
                  <Camera size={28} className="mx-auto text-[#5e6388] mb-2" />
                  <p className="text-sm text-[#8b8fb0] mb-1">Nenhum post encontrado</p>
                  <p className="text-xs text-[#5e6388]">
                    Conecte e sincronize seu Instagram para ver seus posts aqui
                  </p>
                </div>
              )}

              {/* Grid */}
              {!postsLoading && posts.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5">
                  {sortedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB: Ideias ── */}
          {activeTab === "ideias" && (
            <motion.div
              key="ideias"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-[#4ecdc4]" />
                  <span className="text-xs font-semibold text-[#e8eaff]">
                    Sugestoes Inteligentes
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => refetchSuggestions()}
                  disabled={suggestionsLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg
                    bg-[#0c0f24] border border-white/5 text-[#8b8fb0]
                    hover:text-[#e8eaff] hover:border-white/10 transition-all
                    disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    size={11}
                    className={suggestionsLoading ? "animate-spin" : ""}
                  />
                  {suggestionsLoading ? "Gerando..." : "Atualizar"}
                </button>
              </div>

              {/* Context badges */}
              {suggestionsContext && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestionsContext.dna_available && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/10 text-green-400">
                      <Database size={9} /> DNA ativo
                    </span>
                  )}
                  {suggestionsContext.news_count > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-400">
                      <Globe size={9} /> {suggestionsContext.news_count} noticias
                    </span>
                  )}
                  {suggestionsContext.recent_posts_analyzed > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/10 text-purple-400">
                      <BarChart3 size={9} /> {suggestionsContext.recent_posts_analyzed} posts
                    </span>
                  )}
                </div>
              )}

              {/* Error */}
              {suggestionsError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-400">{suggestionsError}</p>
                </div>
              )}

              {/* Loading skeleton */}
              {suggestionsLoading && suggestions.length === 0 && (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-[#141736] border border-white/5 rounded-xl p-4 animate-pulse"
                    >
                      <div className="space-y-2">
                        <div className="h-4 bg-[#0c0f24] rounded w-3/4" />
                        <div className="h-3 bg-[#0c0f24] rounded w-1/2" />
                        <div className="h-3 bg-[#0c0f24] rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No DNA CTA */}
              {!suggestionsLoading &&
                suggestions.length === 0 &&
                !suggestionsError &&
                suggestionsContext &&
                !suggestionsContext.dna_available && (
                  <div className="bg-[#141736] border border-white/5 rounded-xl p-6 text-center">
                    <Sparkles size={28} className="mx-auto text-[#5e6388] mb-2" />
                    <p className="text-sm text-[#8b8fb0] mb-1">
                      Configure o DNA da Marca
                    </p>
                    <p className="text-xs text-[#5e6388] mb-3">
                      Para receber sugestoes personalizadas, configure o DNA da marca em /marca
                    </p>
                    <a
                      href="/marca"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg
                        bg-[#4ecdc4] text-white hover:bg-[#4ecdc4]/90 transition-colors"
                    >
                      Configurar DNA
                    </a>
                  </div>
                )}

              {/* Empty state (has DNA but no suggestions yet) */}
              {!suggestionsLoading &&
                suggestions.length === 0 &&
                !suggestionsError &&
                (!suggestionsContext || suggestionsContext.dna_available) && (
                  <div className="bg-[#141736] border border-white/5 rounded-xl p-6 text-center">
                    <Sparkles size={28} className="mx-auto text-[#5e6388] mb-2" />
                    <p className="text-sm text-[#8b8fb0] mb-1">Nenhuma sugestao ainda</p>
                    <p className="text-xs text-[#5e6388] mb-3">
                      Clique em &quot;Atualizar&quot; para gerar sugestoes baseadas no seu perfil
                    </p>
                    <button
                      type="button"
                      onClick={() => refetchSuggestions()}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-[#4ecdc4] text-white
                        hover:bg-[#4ecdc4]/90 transition-colors cursor-pointer"
                    >
                      Gerar sugestoes
                    </button>
                  </div>
                )}

              {/* Suggestion cards */}
              {suggestions.length > 0 && (
                <div className="space-y-2.5">
                  {suggestions.map((suggestion, index) => (
                    <SuggestionCard
                      key={index}
                      suggestion={suggestion}
                      onCriar={() => handleCriarFromSuggestion(suggestion)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB: Estilo ── */}
          {activeTab === "estilo" && (
            <motion.div
              key="estilo"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <PatternInsightsCompact
                styleProfile={styleProfile}
                loading={patternsLoading}
                onRefresh={refetchPatterns}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Post detail modal ── */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onUseAsReference={() => handleUseAsReference(selectedPost)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
