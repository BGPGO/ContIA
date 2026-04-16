"use client";

import { motion } from "motion/react";
import { Construction, ChevronRight, Zap } from "lucide-react";
import type { ProviderMetadata, Connection } from "@/types/providers";
import { ProviderIcon } from "./ProviderIcon";

interface ProviderCardProps {
  metadata: ProviderMetadata;
  isConnected: boolean;
  connection?: Connection;
  onConnect: () => void;
  onManage: () => void;
  onDetails: () => void;
  animationDelay?: number;
}

const CAPABILITY_LABELS: Array<{
  key: keyof ProviderMetadata["capabilities"];
  label: string;
}> = [
  { key: "canPublish", label: "Publicar" },
  { key: "canSchedule", label: "Agendar" },
  { key: "canReadEngagement", label: "Analytics" },
  { key: "canReadAds", label: "Ads" },
  { key: "canReadDemographics", label: "Audiência" },
  { key: "canReadComments", label: "Comentários" },
];

export function ProviderCard({
  metadata,
  isConnected,
  connection,
  onConnect,
  onManage,
  onDetails,
  animationDelay = 0,
}: ProviderCardProps) {
  const isComingSoon = metadata.status === "coming_soon";
  const isBeta = metadata.status === "beta";

  const bgColor = `${metadata.color}1a`; // ~10% opacity hex

  const activeCapabilities = CAPABILITY_LABELS.filter(
    (c) => metadata.capabilities[c.key]
  );

  function handleButtonClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isComingSoon) return;
    if (isConnected) {
      onManage();
    } else {
      onConnect();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.35 }}
      onClick={isComingSoon ? undefined : onDetails}
      className={`group relative flex flex-col bg-bg-card border border-border rounded-2xl p-5 transition-all duration-200 ${
        isComingSoon
          ? "opacity-60 cursor-default"
          : "cursor-pointer hover:border-border-light hover:bg-bg-card-hover hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
      }`}
    >
      {/* Top-right status badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        {isConnected && !isComingSoon && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Conectado
          </span>
        )}
        {isComingSoon && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
            <Construction size={10} />
            Em breve
          </span>
        )}
        {isBeta && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
            Beta
          </span>
        )}
      </div>

      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110 shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <ProviderIcon name={metadata.iconName} color={metadata.color} size={24} />
      </div>

      {/* Name + description */}
      <h3 className="text-[15px] font-semibold text-text-primary mb-1 pr-16">
        {metadata.displayName}
      </h3>
      <p className="text-[12px] text-text-muted leading-relaxed flex-1 mb-3">
        {metadata.description}
      </p>

      {/* Connected account label */}
      {isConnected && connection?.display_label && (
        <p className="text-[11px] text-accent mb-2 truncate">
          {connection.display_label}
        </p>
      )}
      {isConnected && connection?.username && !connection?.display_label && (
        <p className="text-[11px] text-accent mb-2 truncate">
          @{connection.username}
        </p>
      )}

      {/* Capability badges */}
      {activeCapabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {activeCapabilities.slice(0, 3).map((c) => (
            <span
              key={c.key}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-bg-elevated text-text-muted"
            >
              {c.label}
            </span>
          ))}
          {activeCapabilities.length > 3 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-bg-elevated text-text-muted">
              +{activeCapabilities.length - 3}
            </span>
          )}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={handleButtonClick}
        disabled={isComingSoon}
        aria-label={
          isComingSoon
            ? `${metadata.displayName} em breve`
            : isConnected
            ? `Gerenciar ${metadata.displayName}`
            : `Conectar ${metadata.displayName}`
        }
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
          isComingSoon
            ? "bg-bg-elevated text-text-muted cursor-not-allowed"
            : isConnected
            ? "bg-bg-elevated text-text-secondary hover:bg-border hover:text-text-primary"
            : "text-white hover:brightness-110 hover:shadow-lg"
        }`}
        style={
          !isComingSoon && !isConnected
            ? {
                backgroundColor: metadata.color,
                boxShadow: `0 4px 14px ${metadata.color}33`,
              }
            : undefined
        }
      >
        {isComingSoon ? (
          <>
            <Construction size={14} />
            Em breve
          </>
        ) : isConnected ? (
          <>
            <Zap size={14} />
            Gerenciar
          </>
        ) : (
          <>
            Conectar
            <ChevronRight size={14} />
          </>
        )}
      </button>
    </motion.div>
  );
}
