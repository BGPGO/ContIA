"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cable,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Construction,
  Unplug,
  RefreshCw,
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
import { triggerAutoDNA } from "@/lib/ai/dna-trigger";

/* ── Social Icons (SVG) ────────────────────────── */

function IconInstagram({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconFacebook({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IconLinkedin({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconTwitter({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconYoutube({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconTiktok({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.3z" />
    </svg>
  );
}

/* ── Types ─────────────────────────────────────── */

type SocialIcon = React.ComponentType<{ className?: string; size?: number }>;

interface RedeConfig {
  id: string;
  nome: string;
  icon: SocialIcon;
  cor: string;
  corBg: string;
  disponivel: boolean;
  descricao: string;
}

/* ── Redes Sociais ─────────────────────────────── */

const redes: RedeConfig[] = [
  {
    id: "instagram",
    nome: "Instagram",
    icon: IconInstagram,
    cor: "#e1306c",
    corBg: "rgba(225, 48, 108, 0.12)",
    disponivel: true,
    descricao: "Publique posts, carrosseis e reels automaticamente",
  },
  {
    id: "facebook",
    nome: "Facebook",
    icon: IconFacebook,
    cor: "#1877f2",
    corBg: "rgba(24, 119, 242, 0.12)",
    disponivel: false,
    descricao: "Gerencie paginas e publique conteudo",
  },
  {
    id: "linkedin",
    nome: "LinkedIn",
    icon: IconLinkedin,
    cor: "#0a66c2",
    corBg: "rgba(10, 102, 194, 0.12)",
    disponivel: false,
    descricao: "Publique artigos e posts na sua pagina",
  },
  {
    id: "twitter",
    nome: "X (Twitter)",
    icon: IconTwitter,
    cor: "#1da1f2",
    corBg: "rgba(29, 161, 242, 0.12)",
    disponivel: false,
    descricao: "Tweets, threads e agendamentos",
  },
  {
    id: "youtube",
    nome: "YouTube",
    icon: IconYoutube,
    cor: "#ff0000",
    corBg: "rgba(255, 0, 0, 0.12)",
    disponivel: false,
    descricao: "Upload de videos e Shorts",
  },
  {
    id: "tiktok",
    nome: "TikTok",
    icon: IconTiktok,
    cor: "#00f2ea",
    corBg: "rgba(0, 242, 234, 0.12)",
    disponivel: false,
    descricao: "Publique videos e acompanhe metricas",
  },
];

/* ── Permissões que serão solicitadas ──────────── */

const igPermissions = [
  { icon: Image, label: "Publicar posts, carrosseis e reels" },
  { icon: BarChart3, label: "Acessar metricas e insights" },
  { icon: MessageCircle, label: "Gerenciar comentarios" },
  { icon: Send, label: "Agendar publicacoes" },
];

/* ── Page ───────────────────────────────────────── */

export default function ConexoesPage() {
  const { empresa } = useEmpresa();
  const instagram = useInstagram();
  const [selectedRede, setSelectedRede] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dnaGenerating, setDnaGenerating] = useState(false);
  const dnaTriggeredRef = useRef(false);

  // Tratar retorno do OAuth callback
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
    } else if (error) {
      const msgs: Record<string, string> = {
        access_denied: "Voce cancelou a autorizacao. Tente novamente quando quiser.",
        no_ig_account:
          "Nenhuma conta Instagram Business/Creator encontrada. Verifique se sua conta e profissional e esta vinculada a uma pagina do Facebook.",
        auth_failed: `Falha na autenticacao com o Instagram. ${params.get("detail") || "Tente novamente."}`,
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
  }, []);

  // Auto-trigger DNA generation after successful Instagram connection
  useEffect(() => {
    if (!empresa?.id || dnaTriggeredRef.current) return;
    // Only trigger when we have a success message (fresh connection)
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
      onError: (errMsg) => {
        setDnaGenerating(false);
        // Keep the success message for the connection, just note the DNA issue
        setOauthMessage({
          type: "success",
          text: `Instagram conectado! DNA sera gerado na proxima visita ao dashboard.`,
        });
        console.warn("[Conexoes] DNA auto-generation failed:", errMsg);
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

  const igConnected =
    empresa.redes_sociais?.instagram?.conectado ?? false;

  /* ── Tela de detalhes do Instagram ─────────── */
  if (selectedRede === "instagram") {
    return (
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 max-w-3xl mx-auto">
        {/* Voltar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setSelectedRede(null)}
            className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Voltar para conexoes
          </button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-4"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(225, 48, 108, 0.12)" }}
          >
            <span style={{ color: "#e1306c" }}>
              <IconInstagram size={28} />
            </span>
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

        {/* Banner de mensagem */}
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
              <span className="text-[13px] font-medium flex-1">
                {oauthMessage.text}
              </span>
              <button
                onClick={() => setOauthMessage(null)}
                className="text-current opacity-60 hover:opacity-100 text-sm"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CONECTADO ── */}
        {igConnected || instagram.profile ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Card do perfil */}
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
                    <IconInstagram size={28} className="text-text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-semibold text-text-primary">
                      @{instagram.profile?.username ?? empresa.redes_sociais?.instagram?.username ?? "—"}
                    </p>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Conectado
                    </span>
                  </div>
                  {instagram.profile && (
                    <p className="text-[13px] text-text-muted mt-0.5">
                      {instagram.profile.followers_count.toLocaleString()} seguidores · {instagram.profile.media_count} publicacoes
                    </p>
                  )}
                </div>
              </div>

              {/* Ações */}
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

            {/* O que você pode fazer */}
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
                    <span className="text-[12px] text-text-secondary">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── NÃO CONECTADO ── */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Card principal — Botão de conectar */}
            <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
              <div className="max-w-sm mx-auto space-y-5">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br from-[#405DE6]/20 via-[#C13584]/20 to-[#FD1D1D]/20">
                  <IconInstagram size={32} className="text-[#e1306c]" />
                </div>

                <div>
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    Conecte seu Instagram
                  </h2>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">
                    Clique no botao abaixo para autorizar via Facebook.
                    Voce escolhe quais paginas e contas dar acesso.
                  </p>
                </div>

                {/* Botão OAuth — Business Login for Instagram */}
                <button
                  onClick={() => instagram.connect()}
                  disabled={instagram.loading}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pink-500/20 disabled:opacity-50 disabled:hover:translate-y-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #405DE6, #5851DB, #833AB4, #C13584, #E1306C, #FD1D1D)",
                  }}
                >
                  <IconInstagram size={20} />
                  Continuar com Instagram
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                  <Shield size={12} />
                  Login direto no Instagram · Nao armazenamos sua senha
                </div>
              </div>
            </div>

            {/* Permissões que serão solicitadas */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <p className="text-[13px] font-semibold text-text-primary mb-3">
                Permissoes solicitadas
              </p>
              <div className="space-y-2">
                {igPermissions.map((p) => (
                  <div
                    key={p.label}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg"
                  >
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <p.icon size={14} className="text-accent" />
                    </div>
                    <span className="text-[12px] text-text-secondary">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pré-requisitos */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-text-muted" />
                <p className="text-[13px] font-semibold text-text-primary">
                  Pre-requisitos
                </p>
              </div>
              <ul className="space-y-2 text-[12px] text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
                    1
                  </span>
                  <span>
                    Conta do Instagram precisa ser{" "}
                    <strong className="text-text-primary">Profissional</strong>{" "}
                    (Business ou Creator)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
                    2
                  </span>
                  <span>
                    Voce vai fazer login direto no{" "}
                    <strong className="text-text-primary">Instagram</strong>{" "}
                    — sem precisar de Facebook
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
                    3
                  </span>
                  <span>
                    Autorize as{" "}
                    <strong className="text-text-primary">
                      permissoes solicitadas
                    </strong>{" "}
                    na tela de autorizacao
                  </span>
                </li>
              </ul>
              <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
                Se sua conta ainda for pessoal, o Instagram vai pedir
                para converter para Profissional durante o processo.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  /* ── Grid de redes (tela principal) ─────────── */
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
              Conecte suas redes sociais para publicar direto da plataforma
            </p>
          </div>
        </div>
      </motion.div>

      {/* Banner OAuth (retorno do callback) */}
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
            <span className="text-[13px] font-medium flex-1">
              {oauthMessage.text}
            </span>
            <button
              onClick={() => setOauthMessage(null)}
              className="text-current opacity-60 hover:opacity-100 text-sm"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid de redes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {redes.map((rede, i) => {
          const Icon = rede.icon;
          const connected =
            rede.id === "instagram"
              ? igConnected
              : (empresa.redes_sociais?.[
                  rede.id as keyof typeof empresa.redes_sociais
                ]?.conectado ?? false);

          return (
            <motion.button
              key={rede.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              onClick={() => {
                if (rede.disponivel) setSelectedRede(rede.id);
              }}
              disabled={!rede.disponivel}
              className={`group relative text-left bg-bg-card border rounded-xl p-5 transition-all duration-200 ${
                rede.disponivel
                  ? "border-border hover:border-border-light hover:bg-bg-card-hover hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 cursor-pointer"
                  : "border-border/50 opacity-60 cursor-not-allowed"
              }`}
            >
              {/* Badge de status */}
              <div className="absolute top-4 right-4">
                {connected ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Conectado
                  </span>
                ) : rede.disponivel ? (
                  <span className="text-[11px] font-medium text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
                    Desconectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                    <Construction size={10} />
                    Em breve
                  </span>
                )}
              </div>

              {/* Ícone */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: rede.corBg }}
              >
                <span style={{ color: rede.cor }}>
                  <Icon size={24} />
                </span>
              </div>

              {/* Info */}
              <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                {rede.nome}
              </h3>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {rede.descricao}
              </p>

              {/* CTA */}
              {rede.disponivel && (
                <div className="flex items-center gap-1 mt-3 text-[12px] font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {connected ? "Gerenciar" : "Conectar"}
                  <ChevronRight size={14} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
