"use client";

import { useState, useEffect, useCallback } from "react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";
import { DNASourcesForm } from "./DNASourcesForm";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  Dna,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────── helpers ─── */

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type DNAStatus = "none" | "analyzing" | "ready" | "error";

function StatusBadge({ status }: { status: DNAStatus }) {
  const config: Record<
    DNAStatus,
    { label: string; color: string; icon: React.ElementType }
  > = {
    none: {
      label: "Nao analisado",
      color: "text-text-muted bg-bg-input border-border",
      icon: Clock,
    },
    analyzing: {
      label: "Analisando...",
      color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
      icon: Loader2,
    },
    ready: {
      label: "DNA pronto",
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
      icon: CheckCircle2,
    },
    error: {
      label: "Erro na analise",
      color: "text-danger bg-danger/10 border-danger/30",
      icon: AlertCircle,
    },
  };

  const c = config[status];
  const Icon = c.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full",
        c.color
      )}
    >
      <Icon
        size={12}
        className={status === "analyzing" ? "animate-spin" : ""}
      />
      {c.label}
    </span>
  );
}

/* ────────────────────────── main component ─── */

export function DNASetup() {
  const { empresa, updateEmpresa } = useEmpresa();
  const { dna, loading: dnaLoading } = useMarcaDNA(empresa?.id);

  /* local form state */
  const [instagramHandle, setInstagramHandle] = useState("");
  const [website, setWebsite] = useState("");
  const [concorrentesIg, setConcorrentesIg] = useState<string[]>([]);
  const [referenciasIg, setReferenciasIg] = useState<string[]>([]);
  const [referenciasSites, setReferenciasSites] = useState<string[]>([]);

  /* analysis state */
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* sync from empresa when it loads / changes */
  useEffect(() => {
    if (!empresa) return;
    setInstagramHandle(
      (empresa.redes_sociais?.instagram?.username as string) || ""
    );
    setWebsite(empresa.website || "");
    // DNA source fields are stored as JSON on empresa (may not exist yet)
    const raw = empresa as any;
    setConcorrentesIg(raw.concorrentes_ig || []);
    setReferenciasIg(raw.referencias_ig || []);
    setReferenciasSites(raw.referencias_sites || []);
  }, [empresa]);

  /* generic field updater from the form */
  const handleUpdate = useCallback(
    (field: string, value: any) => {
      switch (field) {
        case "instagramHandle":
          setInstagramHandle(value);
          break;
        case "website":
          setWebsite(value);
          break;
        case "concorrentesIg":
          setConcorrentesIg(value);
          break;
        case "referenciasIg":
          setReferenciasIg(value);
          break;
        case "referenciasSites":
          setReferenciasSites(value);
          break;
      }
    },
    []
  );

  /* save sources to empresa and trigger analysis */
  const handleAnalyze = useCallback(async () => {
    if (!empresa) return;
    setAnalyzing(true);
    setError(null);

    try {
      // 1. Persist sources on empresa
      const updates: Partial<any> = {
        website,
        concorrentes_ig: concorrentesIg,
        referencias_ig: referenciasIg,
        referencias_sites: referenciasSites,
        redes_sociais: {
          ...empresa.redes_sociais,
          instagram: {
            ...(empresa.redes_sociais?.instagram || {}),
            username: instagramHandle,
            conectado: !!instagramHandle,
          },
        },
      };
      await updateEmpresa(empresa.id, updates);

      // 2. Trigger DNA analysis via API
      const res = await fetch("/api/ai/analyze-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresa.id,
          instagram_handle: instagramHandle,
          website,
          concorrentes_ig: concorrentesIg,
          referencias_ig: referenciasIg,
          referencias_sites: referenciasSites,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }

      // Success — DNA will be picked up by useMarcaDNA on next fetch
      // Force a page-level refresh of DNA data
      window.dispatchEvent(new CustomEvent("dna-updated"));
    } catch (err: any) {
      console.error("DNA analysis failed:", err);
      setError(err.message || "Falha ao analisar DNA da marca");
    } finally {
      setAnalyzing(false);
    }
  }, [
    empresa,
    instagramHandle,
    website,
    concorrentesIg,
    referenciasIg,
    referenciasSites,
    updateEmpresa,
  ]);

  /* derive status */
  const status: DNAStatus = analyzing
    ? "analyzing"
    : error
    ? "error"
    : dna?.dna_sintetizado
    ? "ready"
    : "none";

  /* ─── render ─── */
  if (!empresa) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm">
        <Loader2 size={18} className="animate-spin mr-2" />
        Carregando empresa...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Status card ── */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 text-accent">
              <Dna size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                DNA da Marca
              </h3>
              <p className="text-xs text-text-muted">
                Inteligencia de marca para {empresa.nome}
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* last analysis date */}
        {dna?.updated_at && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted mt-2">
            <Clock size={12} />
            Ultima analise: {formatDate(dna.updated_at)}
          </div>
        )}

        {/* DNA summary pills when ready */}
        {dna?.dna_sintetizado && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SummaryPill
              label="Tom de voz"
              value={dna.dna_sintetizado.tom_de_voz}
            />
            <SummaryPill
              label="Publico-alvo"
              value={dna.dna_sintetizado.publico_alvo}
            />
            <SummaryPill
              label="Proposta de valor"
              value={dna.dna_sintetizado.proposta_valor}
              span2
            />
          </div>
        )}

        {/* error message */}
        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Erro na analise</p>
              <p className="opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Sources form ── */}
      <DNASourcesForm
        instagramHandle={instagramHandle}
        website={website}
        concorrentesIg={concorrentesIg}
        referenciasIg={referenciasIg}
        referenciasSites={referenciasSites}
        onUpdate={handleUpdate}
        onAnalyze={handleAnalyze}
        analyzing={analyzing}
      />
    </div>
  );
}

/* ─────────────────────── small pill component ─── */

function SummaryPill({
  label,
  value,
  span2 = false,
}: {
  label: string;
  value?: string;
  span2?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-bg-input border border-border rounded-lg px-3 py-2",
        span2 && "col-span-2"
      )}
    >
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-xs text-text-primary leading-relaxed line-clamp-2">
        {value}
      </p>
    </div>
  );
}
