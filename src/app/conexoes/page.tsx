"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cable,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unplug,
  Shield,
  Image,
  BarChart3,
  Send,
  MessageCircle,
  ArrowLeft,
  Info,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useInstagram } from "@/hooks/useInstagram";
import { useConnections } from "@/hooks/useConnections";
import { triggerAutoDNA } from "@/lib/ai/dna-trigger";
import { METADATA_BY_PROVIDER, PROVIDER_DISPLAY_ORDER } from "@/lib/drivers/metadata";
import type { ProviderCategory, ProviderKey } from "@/types/providers";
import { ProviderCard } from "@/components/conexoes/ProviderCard";
import { ProviderDetailsModal } from "@/components/conexoes/ProviderDetailsModal";
import { ProviderIcon } from "@/components/conexoes/ProviderIcon";

/* ── Types ────────────────────────────────────────────────────────── */

type CategoryFilter = "all" | ProviderCategory;

interface CategoryTab {
  id: CategoryFilter;
  label: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: "all", label: "Todas" },
  { id: "social", label: "Redes Sociais" },
  { id: "ads", label: "Publicidade" },
  { id: "analytics", label: "Analytics" },
  { id: "landing", label: "Landing" },
  { id: "crm", label: "CRM" },
];

/* ── Permissions for Instagram detail view ───────────────────────── */

const igPermissions = [
  { icon: Image, label: "Publicar posts, carrosseis e reels" },
  { icon: BarChart3, label: "Acessar metricas e insights" },
  { icon: MessageCircle, label: "Gerenciar comentarios" },
  { icon: Send, label: "Agendar publicacoes" },
];

/* ── Page ─────────────────────────────────────────────────────────── */

export default function ConexoesPage() {
  const { empresa } = useEmpresa();
  const instagram = useInstagram();
  const { connections, loading: connectionsLoading, isConnected, getConnections, refresh } =
    useConnections();

  const [selectedRede, setSelectedRede] = useState<ProviderKey | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [detailsProvider, setDetailsProvider] = useState<ProviderKey | null>(null);
  const [oauthMessage, setOauthMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dnaGenerating, setDnaGenerating] = useState(false);
  const dnaTriggeredRef = useRef(false);

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    const username = params.get("username");

    if (success === "instagram" && username) {
      setOauthMessage({
        type: "success",
        text: `Instagram @${username} conectado com sucesso! Gerando DNA da marca automaticamente...`,
      });
      window.history.replaceState({}, "", "/conexoes");
      refresh();
    } else if (error) {
      const msgs: Record<string, string> = {
        access_denied: "Voce cancelou a autorizacao. Tente novamente quando quiser.",
        no_ig_account:
          "Nenhuma conta Instagram Business/Creator encontrada. Verifique se sua conta e profissional e esta vinculada a uma pagina do Facebook.",
        auth_failed: `Falha na autenticacao com o Instagram. ${params.get("detail") ?? "Tente novamente."}`,
        db_error: "Erro ao salvar a conexao. Tente novamente.",
        missing_params: "Algo deu errado no retorno. Tente conectar novamente.",
        invalid_state: "Sessao expirada. Tente conectar novamente.",
      };
      setOauthMessage({
        type: "error",
        text: msgs[error] ?? "Erro desconhecido. Tente novamente.",
      });
      window.history.replaceState({}, "", "/conexoes");
    }
  }, [refresh]);

  // Auto-trigger DNA after successful Instagram connection
  useEffect(() => {
    if (!empresa?.id || dnaTriggeredRef.current) return;
    if (!oauthMessage || oauthMessage.type !== "success") return;

    dnaTriggeredRef.current = true;
    setDnaGenerating(true);

    triggerAutoDNA(empresa.id, {
      onComplete: () => {
        setDnaGenerating(false);
        setOauthMessage({
          type: "success",
          text: "Instagram conectado e DNA da marca gerado com sucesso!",
        });
      },
      onError: () => {
        setDnaGenerating(false);
        setOauthMessage({
          type: "success",
          text: "Instagram conectado! DNA sera gerado na proxima visita ao dashboard.",
        });
      },
    });
  }, [empresa?.id, oauthMessage]);

  if (!empresa) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Nenhuma empresa selecionada.
      </div>
    );
  }

  const igConnected = empresa.redes_sociais?.instagram?.conectado ?? false;

  /* ── Instagram detail view (existing UX preserved) ────────────── */
  if (selectedRede === "instagram") {
    return (
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => setSelectedRede(null)}
            className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Voltar para conexoes
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-4"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(228, 64, 95, 0.12)" }}
          >
            <ProviderIcon name="Instagram" color="#E4405F" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Instagram</h1>
            <p className="text-[13px] text-text-secondary">
              {igConnected
                ? "Conta conectada e pronta para publicar"
                : "Conecte sua conta para publicar direto da plataforma"}
            </p>
          </div>
        </motion.div>

        <AnimatePresence>
          {oauthMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                oauthMessage.type === "success"
                  ? "bg-success/10 border-success/20 text-success"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {oauthMessage.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span className="text-[13px] font-medium flex-1">{oauthMessage.text}</span>
              <button
                onClick={() => setOauthMessage(null)}
                className="text-current opacity-60 hover:opacity-100 text-sm"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {igConnected || instagram.profile ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-4">
                {instagram.profile?.profile_picture_url ? (
                  <img
                    src={instagram.profile.profile_picture_url}
                    alt={instagram.profile.username}
                    className="w-16 h-16 rounded-full border-2 border-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
                    <ProviderIcon name="Instagram" color="#E4405F" size={28} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-semibold text-text-primary">
                      @{instagram.profile?.username ??
                        empresa.redes_sociais?.instagram?.username ??
                        "—"}
                    </p>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Conectado
                    </span>
                  </div>
                  {instagram.profile && (
                    <p className="text-[13px] text-text-muted mt-0.5">
                      {instagram.profile.followers_count.toLocaleString()} seguidores ·{" "}
                      {instagram.profile.media_count} publicacoes
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => instagram.verify()}
                  disabled={instagram.loading}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg hover:bg-bg-elevated transition-all disabled:opacity-50"
                >
                  <RefreshCw size={13} className={instagram.loading ? "animate-spin" : ""} />
                  Verificar conexao
                </button>
                <button
                  onClick={async () => {
                    await instagram.disconnect();
                    setSelectedRede(null);
                  }}
                  disabled={instagram.loading}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  <Unplug size={13} />
                  Desconectar
                </button>
              </div>

              {instagram.error && (
                <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                  <AlertCircle size={14} className="shrink-0" />
                  {instagram.error}
                </div>
              )}
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-5">
              <p className="text-[13px] font-semibold text-text-primary mb-3">
                O que voce pode fazer
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {igPermissions.map((p) => (
                  <div
                    key={p.label}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-elevated/50"
                  >
                    <p.icon size={15} className="text-accent shrink-0" />
                    <span className="text-[12px] text-text-secondary">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
              <div className="max-w-sm mx-auto space-y-5">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br from-[#405DE6]/20 via-[#C13584]/20 to-[#FD1D1D]/20">
                  <ProviderIcon name="Instagram" color="#E4405F" size={32} />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    Conecte seu Instagram
                  </h2>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">
                    Clique no botao abaixo para autorizar via Facebook. Voce escolhe quais
                    paginas e contas dar acesso.
                  </p>
                </div>
                <button
                  onClick={() => instagram.connect()}
                  disabled={instagram.loading}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pink-500/20 disabled:opacity-50 disabled:hover:translate-y-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #405DE6, #5851DB, #833AB4, #C13584, #E1306C, #FD1D1D)",
                  }}
                >
                  <ProviderIcon name="Instagram" color="white" size={20} />
                  Continuar com Instagram
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                  <Shield size={12} />
                  Login direto no Instagram · Nao armazenamos sua senha
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-5">
              <p className="text-[13px] font-semibold text-text-primary mb-3">
                Permissoes solicitadas
              </p>
              <div className="space-y-2">
                {igPermissions.map((p) => (
                  <div key={p.label} className="flex items-center gap-2.5 p-2.5 rounded-lg">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <p.icon size={14} className="text-accent" />
                    </div>
                    <span className="text-[12px] text-text-secondary">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-text-muted" />
                <p className="text-[13px] font-semibold text-text-primary">Pre-requisitos</p>
              </div>
              <ul className="space-y-2 text-[12px] text-text-secondary">
                {[
                  "Conta do Instagram precisa ser Profissional (Business ou Creator)",
                  "Voce vai fazer login direto no Instagram — sem precisar de Facebook",
                  "Autorize as permissoes solicitadas na tela de autorizacao",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
                Se sua conta ainda for pessoal, o Instagram vai pedir para converter para
                Profissional durante o processo.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  /* ── Main grid view ─────────────────────────────────────────────── */

  const filteredProviders = PROVIDER_DISPLAY_ORDER.filter((key) => {
    const meta = METADATA_BY_PROVIDER[key];
    if (activeCategory === "all") return true;
    return meta.category === activeCategory;
  });

  const detailsMeta = detailsProvider ? METADATA_BY_PROVIDER[detailsProvider] : null;
  const detailsConnected = detailsProvider ? isConnected(detailsProvider) : false;
  const detailsConnection = detailsProvider
    ? getConnections(detailsProvider)[0]
    : undefined;

  function handleConnect(key: ProviderKey) {
    if (key === "instagram") {
      setDetailsProvider(null);
      setSelectedRede("instagram");
      return;
    }
    const meta = METADATA_BY_PROVIDER[key];
    if (meta.status === "coming_soon") return;
    // For OAuth providers redirect; for others show details drawer
    if (meta.status === "available") {
      // Provider keys usam underscore (ex: meta_ads) mas as rotas usam hífen (ex: /api/meta-ads)
      const slug = key.replace(/_/g, "-");
      window.location.href = `/api/${slug}/auth?empresa_id=${empresa?.id}`;
    }
  }

  function handleManage(key: ProviderKey) {
    if (key === "instagram") {
      setSelectedRede("instagram");
      setDetailsProvider(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
            <Cable size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              Conexoes
            </h1>
            <p className="text-[13px] text-text-secondary">
              Conecte suas redes sociais, ferramentas de analytics e canais de marketing.
              Quanto mais conectado, mais rico fica seu relatorio.
            </p>
          </div>
        </div>
      </motion.div>

      {/* OAuth banner */}
      <AnimatePresence>
        {oauthMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 p-4 rounded-xl border ${
              oauthMessage.type === "success"
                ? "bg-success/10 border-success/20 text-success"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {dnaGenerating ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : oauthMessage.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="text-[13px] font-medium flex-1">{oauthMessage.text}</span>
            <button
              onClick={() => setOauthMessage(null)}
              className="text-current opacity-60 hover:opacity-100 text-sm"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide"
        role="tablist"
        aria-label="Filtrar por categoria"
      >
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeCategory === tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
              activeCategory === tab.id
                ? "bg-accent text-bg-primary shadow-sm shadow-accent/30"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Stats summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center gap-4 text-[12px] text-text-muted"
      >
        {connectionsLoading ? (
          <span className="flex items-center gap-1.5">
            <RefreshCw size={12} className="animate-spin" />
            Verificando conexoes...
          </span>
        ) : (
          <>
            <span>
              <span className="text-success font-semibold">
                {PROVIDER_DISPLAY_ORDER.filter((k) => isConnected(k)).length}
              </span>{" "}
              conectadas
            </span>
            <span className="text-border">·</span>
            <span>
              <span className="text-text-secondary font-medium">
                {PROVIDER_DISPLAY_ORDER.length}
              </span>{" "}
              providers disponíveis
            </span>
          </>
        )}
      </motion.div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <AnimatePresence mode="popLayout">
          {filteredProviders.map((key, i) => {
            const meta = METADATA_BY_PROVIDER[key];
            const connected =
              key === "instagram"
                ? igConnected || isConnected("instagram")
                : isConnected(key);
            const connection = getConnections(key)[0];

            return (
              <ProviderCard
                key={key}
                metadata={meta}
                isConnected={connected}
                connection={connection}
                animationDelay={i * 0.05}
                onConnect={() => handleConnect(key)}
                onManage={() => handleManage(key)}
                onDetails={() => setDetailsProvider(key)}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {filteredProviders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Cable size={36} className="mb-3 opacity-30" />
          <p className="text-[14px]">Nenhum provider nesta categoria ainda.</p>
        </div>
      )}

      {/* Provider details modal/drawer */}
      <ProviderDetailsModal
        metadata={detailsMeta}
        connection={detailsConnection}
        isConnected={detailsConnected}
        onClose={() => setDetailsProvider(null)}
        onConnect={() => {
          if (detailsProvider) handleConnect(detailsProvider);
          setDetailsProvider(null);
        }}
        onManage={() => {
          if (detailsProvider) handleManage(detailsProvider);
          setDetailsProvider(null);
        }}
      />
    </div>
  );
}
