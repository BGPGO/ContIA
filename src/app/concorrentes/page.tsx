"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  X,
  Users,
  ExternalLink,
  Trash2,
  Loader2,
  ImageIcon,
  RefreshCw,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  useConcorrentes,
  ConcorrenteDB,
  ConcorrentePostsResult,
} from "@/hooks/useConcorrentes";
import { cn, formatNumber } from "@/lib/utils";
import { ConcorrenteAdsTab } from "@/components/concorrentes/ConcorrenteAdsTab";

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── Instagram Embed Iframe ─────────────────────────────────────────────────

interface InstagramEmbedProps {
  username: string;
}

function InstagramEmbed({ username }: InstagramEmbedProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border-subtle bg-bg-card/30">
      {/* Skeleton enquanto o iframe carrega */}
      {!iframeLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-card/60 z-10 animate-pulse">
          <ImageIcon size={24} className="text-instagram/60" />
          <span className="text-xs text-text-muted">Carregando posts...</span>
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-24 h-24 rounded-lg bg-bg-card-hover"
              />
            ))}
          </div>
        </div>
      )}

      <iframe
        src={`https://www.instagram.com/${username}/embed/`}
        width="100%"
        height="600"
        frameBorder="0"
        scrolling="yes"
        allowTransparency={true}
        onLoad={() => setIframeLoaded(true)}
        className={cn(
          "w-full transition-opacity duration-500 rounded-xl",
          iframeLoaded ? "opacity-100" : "opacity-0"
        )}
        title={`Posts do Instagram de @${username}`}
      />
    </div>
  );
}

// ─── Concorrente Section ────────────────────────────────────────────────────

type ConcorrenteTab = "perfil" | "anuncios";

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
  const [profileData, setProfileData] =
    useState<ConcorrentePostsResult | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState<ConcorrenteTab>("perfil");

  const igUsername = getInstagramUsername(concorrente);

  const loadProfile = useCallback(
    async (force = false) => {
      if (!igUsername) return;
      setLoadingProfile(true);
      const result = await onFetchPosts(concorrente.id, igUsername, force);
      setProfileData(result);
      setLoadingProfile(false);
      setProfileLoaded(true);
    },
    [concorrente.id, igUsername, onFetchPosts]
  );

  // Auto-load profile on mount
  useEffect(() => {
    if (igUsername && !profileLoaded && !loadingProfile) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igUsername]);

  const handleRemove = async () => {
    if (!confirm(`Remover ${concorrente.nome}?`)) return;
    setRemoving(true);
    await onRemove(concorrente.id);
  };

  const profile = profileData?.profile;

  return (
    <div className="bg-bg-card backdrop-blur-xl border border-border rounded-xl overflow-hidden fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-border">
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

          {/* Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-text-primary text-sm leading-tight truncate">
                {profile?.fullName || concorrente.nome}
              </h3>
              {igUsername && (
                <span className="text-[11px] text-text-muted shrink-0">
                  @{igUsername}
                </span>
              )}
            </div>

            {/* Stats row */}
            {profile && (
              <div className="flex items-center gap-3 text-[11px] text-text-muted mt-0.5 flex-wrap">
                {profile.followers > 0 && (
                  <span>
                    <span className="text-text-secondary font-medium">
                      {formatNumber(profile.followers)}
                    </span>{" "}
                    seguidores
                  </span>
                )}
                {profile.postCount > 0 && (
                  <span>
                    <span className="text-text-secondary font-medium">
                      {formatNumber(profile.postCount)}
                    </span>{" "}
                    posts
                  </span>
                )}
                {profile.following > 0 && (
                  <span>
                    <span className="text-text-secondary font-medium">
                      {formatNumber(profile.following)}
                    </span>{" "}
                    seguindo
                  </span>
                )}
              </div>
            )}

            {/* Bio */}
            {profile?.biography && (
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed line-clamp-2 max-w-lg">
                {profile.biography}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {igUsername && (
            <a
              href={`https://www.instagram.com/${igUsername}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-accent border border-accent/25 hover:bg-accent/10 hover:border-accent/40 transition-colors"
            >
              <ExternalLink size={11} />
              Ver no Instagram
            </a>
          )}
          {activeTab === "perfil" && (
            <button
              onClick={() => loadProfile(true)}
              disabled={loadingProfile}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors disabled:opacity-40"
              title="Atualizar perfil"
            >
              <RefreshCw
                size={13}
                className={cn(loadingProfile && "animate-spin")}
              />
            </button>
          )}
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

      {/* ── Tabs ── */}
      <div className="border-b border-border-subtle px-4">
        <div className="flex items-center gap-0">
          {(
            [
              { key: "perfil", label: "Perfil" },
              { key: "anuncios", label: "Anúncios" },
            ] as { key: ConcorrenteTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.key
                  ? "border-[#4ecdc4] text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="p-4">
        {activeTab === "perfil" && (
          <>
            {!igUsername ? (
              <p className="text-text-muted text-xs text-center py-6">
                Sem username Instagram configurado.
              </p>
            ) : (
              <InstagramEmbed username={igUsername} />
            )}
          </>
        )}

        {activeTab === "anuncios" && (
          <ConcorrenteAdsTab concorrenteId={concorrente.id} />
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
    <div className="fade-in space-y-4 p-4 max-w-5xl mx-auto">
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
            Visualize os posts recentes dos concorrentes via Instagram Embeds
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/90 hover:bg-accent text-white transition-colors text-xs font-medium shrink-0"
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
        <div className="space-y-4">
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
