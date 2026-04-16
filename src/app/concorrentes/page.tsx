"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  X,
  Users,
  RefreshCw,
  Trash2,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  useConcorrentes,
  ConcorrenteDB,
  ConcorrentePostsResult,
} from "@/hooks/useConcorrentes";
import { cn, formatNumber } from "@/lib/utils";
import type { IGScrapedPost } from "@/lib/instagram-scraper";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

function getInstagramUsername(c: ConcorrenteDB): string | null {
  const ig = c.plataformas?.find((p) => p.rede === "instagram");
  return ig?.username || null;
}

// ─── Add Concorrente Modal ──────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onAdd: (nome: string, username: string) => Promise<boolean>;
}

function AddConcorrenteModal({ onClose, onAdd }: AddModalProps) {
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !username.trim()) {
      setError("Preencha nome e username.");
      return;
    }
    setSaving(true);
    const ok = await onAdd(nome.trim(), username.trim().replace(/^@/, ""));
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError("Erro ao salvar. Tente novamente.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-bg-card backdrop-blur-xl border border-border rounded-xl p-5 fade-in shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Adicionar Concorrente
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Concorrente X"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">
              Instagram Username
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors text-xs"
              />
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-3 py-1.5 rounded-lg bg-accent/90 hover:bg-accent text-white transition-colors text-xs font-medium disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Post Card ──────────────────────────────────────────────────────────────

interface PostCardProps {
  post: IGScrapedPost;
}

function PostCard({ post }: PostCardProps) {
  return (
    <a
      href={post.permalink || `https://www.instagram.com/p/${post.shortcode}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0 w-[140px] rounded-lg border border-border-subtle bg-bg-card/50 overflow-hidden hover:border-accent/30 transition-all"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-square bg-bg-card overflow-hidden">
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={truncate(post.caption, 40)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <Eye size={20} />
          </div>
        )}
        {post.isVideo && (
          <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded">
            VIDEO
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink
            size={14}
            className="absolute top-1.5 right-1.5 text-white/80"
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="p-2 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="inline-flex items-center gap-0.5 text-danger/80">
            <Heart size={9} />
            {formatNumber(post.likes)}
          </span>
          <span className="inline-flex items-center gap-0.5 text-info/80">
            <MessageCircle size={9} />
            {formatNumber(post.comments)}
          </span>
        </div>
        <p className="text-[10px] text-text-muted">
          {formatShortDate(post.timestamp)}
        </p>
        {post.caption && (
          <p className="text-[10px] text-text-secondary leading-tight line-clamp-2">
            {truncate(post.caption, 80)}
          </p>
        )}
      </div>
    </a>
  );
}

// ─── Post Grid Skeleton ─────────────────────────────────────────────────────

function PostsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-[140px] rounded-lg border border-border-subtle bg-bg-card/30 overflow-hidden animate-pulse"
        >
          <div className="w-full aspect-square bg-bg-card-hover" />
          <div className="p-2 space-y-1.5">
            <div className="flex justify-between">
              <div className="h-2.5 w-10 bg-bg-card-hover rounded" />
              <div className="h-2.5 w-8 bg-bg-card-hover rounded" />
            </div>
            <div className="h-2 w-12 bg-bg-card-hover rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Concorrente Section ────────────────────────────────────────────────────

interface ConcorrenteSectionProps {
  concorrente: ConcorrenteDB;
  onRemove: (id: string) => void;
  onFetchPosts: (
    id: string,
    username?: string,
    force?: boolean
  ) => Promise<ConcorrentePostsResult>;
}

function ConcorrenteSection({
  concorrente,
  onRemove,
  onFetchPosts,
}: ConcorrenteSectionProps) {
  const [postsData, setPostsData] = useState<ConcorrentePostsResult | null>(
    null
  );
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState(false);

  const igUsername = getInstagramUsername(concorrente);

  const loadPosts = useCallback(
    async (force = false) => {
      if (!igUsername) return;
      setLoadingPosts(true);
      const result = await onFetchPosts(concorrente.id, igUsername, force);
      setPostsData(result);
      setLoadingPosts(false);
      setLoaded(true);
    },
    [concorrente.id, igUsername, onFetchPosts]
  );

  // Auto-load on mount
  useEffect(() => {
    if (igUsername && !loaded && !loadingPosts) {
      loadPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igUsername]);

  const handleRemove = async () => {
    if (!confirm(`Remover ${concorrente.nome}?`)) return;
    setRemoving(true);
    await onRemove(concorrente.id);
  };

  const profile = postsData?.profile;
  const posts = postsData?.posts || [];
  const scrapeError = postsData?.error;

  return (
    <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl overflow-hidden fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border-subtle">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0 overflow-hidden">
            {profile?.profilePicUrl ? (
              <img
                src={profile.profilePicUrl}
                alt={concorrente.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-accent font-semibold text-sm">
                {concorrente.nome.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-primary text-sm leading-tight truncate">
                {concorrente.nome}
              </h3>
              {igUsername && (
                <a
                  href={`https://www.instagram.com/${igUsername}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-accent hover:underline shrink-0"
                >
                  @{igUsername}
                </a>
              )}
            </div>
            {profile && !profile.partial && (
              <div className="flex items-center gap-3 text-[10px] text-text-muted mt-0.5">
                <span>{formatNumber(profile.followers)} seguidores</span>
                <span>{formatNumber(profile.postCount)} posts</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => loadPosts(true)}
            disabled={loadingPosts}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors disabled:opacity-40"
            title="Atualizar posts"
          >
            <RefreshCw
              size={13}
              className={cn(loadingPosts && "animate-spin")}
            />
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
            title="Remover concorrente"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Loading state */}
        {loadingPosts && !loaded && <PostsSkeleton />}

        {/* Error state */}
        {scrapeError && !loadingPosts && (
          <div className="flex items-center gap-2 text-warning text-xs py-2">
            <AlertTriangle size={13} />
            <span>{scrapeError}</span>
          </div>
        )}

        {/* Posts grid */}
        {loaded && posts.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {posts.map((post) => (
              <PostCard key={post.id || post.shortcode} post={post} />
            ))}
          </div>
        )}

        {/* Empty posts (profile loaded but no posts) */}
        {loaded && !loadingPosts && posts.length === 0 && !scrapeError && (
          <p className="text-text-muted text-xs text-center py-4">
            {profile?.partial
              ? "Dados parciais obtidos. O Instagram pode estar limitando o acesso. Tente novamente mais tarde."
              : "Nenhum post encontrado."}
          </p>
        )}

        {/* No username configured */}
        {!igUsername && (
          <p className="text-text-muted text-xs text-center py-4">
            Sem username Instagram configurado.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConcorrentesPage() {
  const { empresa } = useEmpresa();
  const {
    concorrentes,
    loading,
    addConcorrente,
    removeConcorrente,
    fetchPosts,
  } = useConcorrentes(empresa?.id);
  const [showModal, setShowModal] = useState(false);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4 p-4 max-w-6xl mx-auto">
      {/* Modal */}
      {showModal && (
        <AddConcorrenteModal
          onClose={() => setShowModal(false)}
          onAdd={addConcorrente}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            Monitoramento de Concorrentes
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Acompanhe os posts recentes dos concorrentes no Instagram
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/90 hover:bg-accent text-white transition-colors text-xs font-medium"
        >
          <Plus size={13} />
          Adicionar Concorrente
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-accent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && concorrentes.length === 0 && (
        <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl text-center py-12 space-y-3">
          <Users size={32} className="text-text-muted mx-auto" />
          <p className="text-text-secondary text-sm">
            Nenhum concorrente cadastrado.
          </p>
          <p className="text-text-muted text-xs">
            Clique em &quot;Adicionar Concorrente&quot; para monitorar perfis do
            Instagram.
          </p>
        </div>
      )}

      {/* Concorrentes list */}
      {!loading && concorrentes.length > 0 && (
        <div className="space-y-3">
          {concorrentes.map((c) => (
            <ConcorrenteSection
              key={c.id}
              concorrente={c}
              onRemove={removeConcorrente}
              onFetchPosts={fetchPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
