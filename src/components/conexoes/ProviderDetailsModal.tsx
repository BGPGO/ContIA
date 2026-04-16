"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Clock,
  ExternalLink,
  CheckCircle,
  Construction,
  Send,
  BarChart3,
  Users,
  Megaphone,
  MessageCircle,
  Calendar,
} from "lucide-react";
import type { ProviderMetadata, Connection } from "@/types/providers";
import { ProviderIcon } from "./ProviderIcon";

interface ProviderDetailsModalProps {
  metadata: ProviderMetadata | null;
  connection?: Connection;
  onClose: () => void;
  onConnect: () => void;
  onManage: () => void;
  isConnected: boolean;
}

const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  account: "Conta",
  permission: "Permissão",
  setup: "Configuração",
  external: "Externo",
};

interface CapabilityEntry {
  key: keyof ProviderMetadata["capabilities"];
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CAPABILITY_ENTRIES: CapabilityEntry[] = [
  {
    key: "canPublish",
    label: "Publicação direta",
    description: "Publique conteúdo diretamente nesta plataforma.",
    icon: Send,
  },
  {
    key: "canSchedule",
    label: "Agendamento",
    description: "Agende publicações para datas futuras.",
    icon: Calendar,
  },
  {
    key: "canReadEngagement",
    label: "Métricas detalhadas",
    description: "Acesse dados de alcance, impressões e engajamento.",
    icon: BarChart3,
  },
  {
    key: "canReadDemographics",
    label: "Dados demográficos",
    description: "Veja informações de audiência: idade, gênero, localização.",
    icon: Users,
  },
  {
    key: "canReadAds",
    label: "Dados de campanhas",
    description: "Acompanhe performance de anúncios, CPC e ROAS.",
    icon: Megaphone,
  },
  {
    key: "canReadComments",
    label: "Comentários e engajamento",
    description: "Monitore e responda comentários e interações.",
    icon: MessageCircle,
  },
];

export function ProviderDetailsModal({
  metadata,
  connection,
  onClose,
  onConnect,
  onManage,
  isConnected,
}: ProviderDetailsModalProps) {
  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (metadata) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [metadata]);

  const isComingSoon = metadata?.status === "coming_soon";
  const bgColor = metadata ? `${metadata.color}1a` : "transparent";

  const activeCapabilities = metadata
    ? CAPABILITY_ENTRIES.filter((c) => metadata.capabilities[c.key])
    : [];

  return (
    <AnimatePresence>
      {metadata && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Drawer — slides in from right */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-bg-secondary border-l border-border flex flex-col overflow-hidden"
            role="dialog"
            aria-modal
            aria-label={`Detalhes: ${metadata.displayName}`}
          >
            {/* Header */}
            <div className="flex items-start gap-4 p-6 border-b border-border shrink-0">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: bgColor }}
              >
                <ProviderIcon
                  name={metadata.iconName}
                  color={metadata.color}
                  size={28}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-bold text-text-primary">
                    {metadata.displayName}
                  </h2>
                  {isComingSoon && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                      <Construction size={10} />
                      Em breve
                    </span>
                  )}
                  {metadata.status === "beta" && (
                    <span className="text-[11px] font-medium text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                      Beta
                    </span>
                  )}
                  {isConnected && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Conectado
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                  {metadata.description}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Pre-requisites */}
              {metadata.requirements.length > 0 && (
                <section>
                  <h3 className="text-[13px] font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-warning/20 flex items-center justify-center text-warning text-[10px] font-bold">
                      !
                    </span>
                    Pré-requisitos
                  </h3>
                  <ul className="space-y-3">
                    {metadata.requirements.map((req, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-bg-elevated/50 border border-border/50"
                      >
                        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-bg-elevated text-text-muted">
                          {REQUIREMENT_TYPE_LABELS[req.type] ?? req.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-text-primary">
                            {req.label}
                          </p>
                          <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                            {req.description}
                          </p>
                          {req.link && (
                            <a
                              href={req.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent-light mt-1 transition-colors"
                            >
                              Saiba mais
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Section 2: How to connect */}
              {metadata.instructions.length > 0 && (
                <section>
                  <h3 className="text-[13px] font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center">
                      <CheckCircle size={12} className="text-accent" />
                    </span>
                    Como conectar
                  </h3>
                  <ol className="space-y-3">
                    {metadata.instructions.map((step) => (
                      <li key={step.step} className="flex items-start gap-3">
                        <span
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                          style={{ backgroundColor: metadata.color }}
                        >
                          {step.step}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-text-primary">
                            {step.title}
                          </p>
                          <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Section 3: What you'll see */}
              {activeCapabilities.length > 0 && (
                <section>
                  <h3 className="text-[13px] font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-secondary/20 flex items-center justify-center">
                      <BarChart3 size={12} className="text-secondary-light" />
                    </span>
                    O que você vai ver
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {activeCapabilities.map((cap) => {
                      const Icon = cap.icon;
                      return (
                        <div
                          key={cap.key}
                          className="flex items-start gap-3 p-3 rounded-xl bg-bg-elevated/40"
                        >
                          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <Icon size={14} className="text-accent" />
                          </div>
                          <div>
                            <p className="text-[12px] font-medium text-text-primary">
                              {cap.label}
                            </p>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {cap.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Section 4: Estimated time */}
              <section className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated/40 border border-border/50">
                <Clock size={16} className="text-text-muted shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-text-primary">
                    Tempo estimado de configuração
                  </p>
                  <p className="text-[12px] text-accent font-semibold">
                    {metadata.estimatedTime}
                  </p>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border shrink-0">
              {isConnected ? (
                <div className="flex gap-3">
                  <button
                    onClick={onManage}
                    className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-text-secondary bg-bg-elevated hover:bg-border transition-colors"
                  >
                    Gerenciar conexão
                  </button>
                  <button
                    onClick={onClose}
                    className="py-3 px-4 rounded-xl text-[14px] font-semibold text-text-muted hover:text-text-primary transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : isComingSoon ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl text-[14px] font-semibold bg-bg-elevated text-text-muted cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Construction size={16} />
                  Em breve
                </button>
              ) : (
                <button
                  onClick={onConnect}
                  className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all hover:brightness-110 hover:shadow-lg"
                  style={{
                    backgroundColor: metadata.color,
                    boxShadow: `0 4px 14px ${metadata.color}33`,
                  }}
                >
                  Conectar agora
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
