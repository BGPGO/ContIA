"use client";

import { useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  Megaphone,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useConcorrenteAds, AdLibraryAd } from "@/hooks/useConcorrenteAds";
import { cn } from "@/lib/utils";

// ── Platform badge helpers ───────────────────────────────────────────────────

const PLATFORM_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  FACEBOOK: { label: "FB", bg: "bg-[#1877f2]/15", text: "text-[#1877f2]" },
  INSTAGRAM: { label: "IG", bg: "bg-[#e1306c]/15", text: "text-[#e1306c]" },
  MESSENGER: {
    label: "Msg",
    bg: "bg-[#6c5ce7]/15",
    text: "text-[#6c5ce7]",
  },
  AUDIENCE_NETWORK: {
    label: "AN",
    bg: "bg-[#4ecdc4]/15",
    text: "text-[#4ecdc4]",
  },
};

function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_STYLES[platform.toUpperCase()] ?? {
    label: platform.slice(0, 3).toUpperCase(),
    bg: "bg-bg-card-hover",
    text: "text-text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
        style.bg,
        style.text
      )}
    >
      {style.label}
    </span>
  );
}

// ── Date period helper ───────────────────────────────────────────────────────

function formatPeriod(start?: string, stop?: string): string {
  const fmt = (iso: string) =>
    format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });

  if (!start) return "";
  if (!stop) return `Ativo desde ${fmt(start)}`;
  return `Ativo de ${fmt(start)} a ${fmt(stop)}`;
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function AdSkeleton() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-5 w-8 rounded bg-bg-card-hover" />
        <div className="h-5 w-8 rounded bg-bg-card-hover" />
        <div className="h-5 w-32 rounded bg-bg-card-hover ml-auto" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-bg-card-hover" />
        <div className="h-3 w-4/5 rounded bg-bg-card-hover" />
        <div className="h-3 w-2/3 rounded bg-bg-card-hover" />
      </div>
      <div className="h-3 w-1/3 rounded bg-bg-card-hover" />
    </div>
  );
}

// ── Ad Card ──────────────────────────────────────────────────────────────────

function AdCard({ ad }: { ad: AdLibraryAd }) {
  const [expanded, setExpanded] = useState(false);

  const bodies = ad.ad_creative_bodies ?? [];
  const title = ad.ad_creative_link_titles?.[0];
  const primaryBody = bodies[0] ?? "";
  const truncatedBody =
    primaryBody.length > 200
      ? primaryBody.slice(0, 200) + "..."
      : primaryBody;
  const extraVariations = bodies.length - 1;
  const period = formatPeriod(
    ad.ad_delivery_start_time,
    ad.ad_delivery_stop_time ?? undefined
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-bg-card border border-border rounded-xl p-4 space-y-3 hover:border-[#4ecdc4]/30 transition-colors"
    >
      {/* Top row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(ad.publisher_platforms ?? []).map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
        </div>
        {period && (
          <span className="text-[10px] text-text-muted shrink-0">{period}</span>
        )}
      </div>

      {/* Body */}
      {primaryBody && (
        <div className="space-y-1.5">
          <p className="text-xs text-text-secondary leading-relaxed">
            {expanded ? primaryBody : truncatedBody}
          </p>

          {/* Extra variations */}
          {extraVariations > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-[#4ecdc4] hover:text-[#4ecdc4]/80 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={11} />
                    Menos variações
                  </>
                ) : (
                  <>
                    <ChevronDown size={11} />+{extraVariations} variações
                  </>
                )}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-2 border-l-2 border-[#4ecdc4]/30 pl-3">
                      {bodies.slice(1).map((b, i) => (
                        <p
                          key={i}
                          className="text-[11px] text-text-muted leading-relaxed"
                        >
                          {b}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Link title */}
      {title && (
        <p className="text-xs font-semibold text-text-primary border-l-2 border-[#4ecdc4] pl-2">
          {title}
        </p>
      )}

      {/* Footer */}
      {ad.ad_snapshot_url && (
        <div className="pt-1">
          <a
            href={ad.ad_snapshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4ecdc4] hover:text-[#4ecdc4]/80 transition-colors"
          >
            <ExternalLink size={11} />
            Ver anúncio na Biblioteca
          </a>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface ConcorrenteAdsTabProps {
  concorrenteId: string;
}

export function ConcorrenteAdsTab({ concorrenteId }: ConcorrenteAdsTabProps) {
  const { ads, loading, error, total, cached, notAuthorized, fallbackUrl, refresh } =
    useConcorrenteAds(concorrenteId);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-text-primary">
            Anúncios ativos no Meta
          </h4>
          {!loading && ads.length > 0 && (
            <span className="text-[11px] text-text-muted bg-bg-card-hover px-1.5 py-0.5 rounded-full">
              {total > 0 ? total : ads.length}
            </span>
          )}
          {cached && !loading && (
            <span className="text-[10px] text-text-muted italic">(cache)</span>
          )}
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary border border-border hover:text-text-primary hover:border-border-hover transition-colors disabled:opacity-40"
        >
          <RefreshCw
            size={11}
            className={cn(loading && "animate-spin")}
          />
          Atualizar
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AdSkeleton />
          <AdSkeleton />
          <AdSkeleton />
        </div>
      )}

      {/* Not authorized — Meta App sem permissão Ad Library API */}
      {!loading && notAuthorized && (
        <div className="bg-bg-card border border-[#fbbf24]/30 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-[#fbbf24] mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-text-primary">
                Acesso à Ad Library API ainda não aprovado
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                O app Meta deste workspace ainda não tem a feature{" "}
                <span className="font-medium text-text-secondary">Ad Library API</span>{" "}
                aprovada. Enquanto isso, você pode ver os anúncios deste concorrente
                diretamente na Biblioteca de Anúncios pública do Meta.
              </p>
            </div>
          </div>
          {fallbackUrl && (
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#1877f2] to-[#4ecdc4] text-white hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={13} />
              Abrir na Biblioteca de Anúncios do Meta
            </a>
          )}
        </div>
      )}

      {/* Error state */}
      {!loading && !notAuthorized && error && (
        <div className="bg-bg-card border border-[#f87171]/30 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-[#f87171] mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#f87171]">
                Erro ao carregar anúncios
              </p>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/10 transition-colors"
            >
              <RefreshCw size={11} />
              Tentar novamente
            </button>
            {fallbackUrl && (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
              >
                <ExternalLink size={11} />
                Abrir na Ad Library pública
              </a>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !notAuthorized && ads.length === 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center space-y-3">
          <Megaphone size={28} className="text-text-muted mx-auto" />
          <div className="space-y-1">
            <p className="text-sm text-text-secondary font-medium">
              Nenhum anúncio ativo encontrado
            </p>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              Este concorrente não tem anúncios ativos na Biblioteca de Anúncios
              do Meta no momento. Apenas anúncios pagos públicos são visíveis
              nessa pesquisa.
            </p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-card-hover hover:bg-bg-card text-text-secondary border border-border hover:border-border-hover transition-colors"
          >
            <RefreshCw size={11} />
            Buscar novamente
          </button>
        </div>
      )}

      {/* Ads grid */}
      {!loading && !error && ads.length > 0 && (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
