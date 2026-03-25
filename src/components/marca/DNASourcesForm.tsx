"use client";

import { useState } from "react";
import {
  Plus,
  X,
  Globe,
  Users,
  Link2,
  Loader2,
  Brain,
  Sparkles,
} from "lucide-react";

// Lucide v1 removed brand icons — inline SVG for Instagram
const InstagramIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────── types ─── */

interface DNASourcesFormProps {
  instagramHandle: string;
  website: string;
  concorrentesIg: string[];
  referenciasIg: string[];
  referenciasSites: string[];
  onUpdate: (field: string, value: any) => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
  compact?: boolean;
}

/* ────────────────────────────── small helpers ─── */

const MAX_ITEMS = 5;

const inputBase =
  "h-10 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 w-full";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon size={16} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        <p className="text-xs text-text-muted leading-relaxed mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function TagList({
  items,
  onRemove,
  onAdd,
  placeholder,
  max,
  prefix,
}: {
  items: string[];
  onRemove: (idx: number) => void;
  onAdd: (value: string) => void;
  placeholder: string;
  max: number;
  prefix?: string;
}) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const trimmed = draft.trim().replace(/^@/, "");
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      {/* existing items */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-bg-input border border-border rounded-lg text-text-secondary transition-colors"
            >
              {prefix && (
                <span className="text-text-muted">{prefix}</span>
              )}
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-0.5 text-text-muted hover:text-danger transition-colors"
                aria-label={`Remover ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* add input */}
      {items.length < max && (
        <div className="flex items-center gap-2">
          {prefix && (
            <span className="text-xs text-text-muted select-none">
              {prefix}
            </span>
          )}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(inputBase, "flex-1")}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 px-3 h-10 text-xs font-medium text-accent hover:bg-accent/10 border border-border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>
      )}

      {items.length >= max && (
        <p className="text-xs text-text-muted italic">
          Limite de {max} atingido
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── main component ─── */

export function DNASourcesForm({
  instagramHandle,
  website,
  concorrentesIg,
  referenciasIg,
  referenciasSites,
  onUpdate,
  onAnalyze,
  analyzing = false,
  compact = false,
}: DNASourcesFormProps) {
  const cardClass = cn(
    "bg-bg-card border border-border rounded-xl transition-all duration-200",
    compact ? "p-3" : "p-4"
  );

  const sectionGap = compact ? "space-y-3" : "space-y-5";

  return (
    <div className={sectionGap}>
      {/* ── a) Seu Instagram ── */}
      <div className={cardClass}>
        <SectionHeader
          icon={InstagramIcon}
          title="Seu Instagram"
          subtitle="Perfil publico da empresa — analisaremos estilo visual, tom e engajamento"
        />
        <div className="flex items-center gap-2">
          <span className="flex h-10 items-center px-3 text-sm font-medium text-text-muted bg-bg-input border border-border rounded-l-lg select-none border-r-0">
            @
          </span>
          <input
            type="text"
            value={instagramHandle}
            onChange={(e) =>
              onUpdate("instagramHandle", e.target.value.replace(/^@/, ""))
            }
            placeholder="suaempresa"
            className={cn(
              inputBase,
              "rounded-l-none border-l-0 -ml-2"
            )}
          />
        </div>
      </div>

      {/* ── b) Seu Site ── */}
      <div className={cardClass}>
        <SectionHeader
          icon={Globe}
          title="Seu Site"
          subtitle="Analisaremos proposta de valor, tom de voz e publico-alvo"
        />
        <input
          type="url"
          value={website}
          onChange={(e) => onUpdate("website", e.target.value)}
          placeholder="https://suaempresa.com.br"
          className={inputBase}
        />
      </div>

      {/* ── c) Concorrentes ── */}
      <div className={cardClass}>
        <SectionHeader
          icon={Users}
          title="Concorrentes"
          subtitle="Perfis que competem no seu nicho — analisaremos estrategia e pontos fortes"
        />
        <TagList
          items={concorrentesIg}
          onRemove={(idx) => {
            const next = concorrentesIg.filter((_, i) => i !== idx);
            onUpdate("concorrentesIg", next);
          }}
          onAdd={(val) => onUpdate("concorrentesIg", [...concorrentesIg, val])}
          placeholder="handle do concorrente"
          max={MAX_ITEMS}
          prefix="@"
        />
      </div>

      {/* ── d) Referencias de Copy ── */}
      <div className={cardClass}>
        <SectionHeader
          icon={Link2}
          title="Referencias de Copy"
          subtitle="Perfis e sites que inspiram seu conteudo — analisaremos tom e estilo"
        />

        {/* Instagram references */}
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Instagram
          </p>
          <TagList
            items={referenciasIg}
            onRemove={(idx) => {
              const next = referenciasIg.filter((_, i) => i !== idx);
              onUpdate("referenciasIg", next);
            }}
            onAdd={(val) => onUpdate("referenciasIg", [...referenciasIg, val])}
            placeholder="handle de referencia"
            max={MAX_ITEMS}
            prefix="@"
          />
        </div>

        {/* Site references */}
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Sites
          </p>
          <TagList
            items={referenciasSites}
            onRemove={(idx) => {
              const next = referenciasSites.filter((_, i) => i !== idx);
              onUpdate("referenciasSites", next);
            }}
            onAdd={(val) =>
              onUpdate("referenciasSites", [...referenciasSites, val])
            }
            placeholder="https://referencia.com.br"
            max={MAX_ITEMS}
          />
        </div>
      </div>

      {/* ── e) Analyze Button ── */}
      {onAnalyze && (
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300",
            "bg-gradient-to-r from-accent to-purple-500 text-white shadow-lg shadow-accent/20",
            "hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.01]",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
          )}
        >
          {analyzing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Analisando DNA da Marca...
            </>
          ) : (
            <>
              <Brain size={18} />
              Analisar DNA da Marca
              <Sparkles size={14} className="opacity-70" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
