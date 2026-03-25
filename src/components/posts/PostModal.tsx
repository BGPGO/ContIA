"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { Post } from "@/types";
import { cn, getPlataformaCor, getPlataformaLabel } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const ALL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
] as const;

const STATUS_OPTIONS: { value: Post["status"]; label: string }[] = [
  { value: "rascunho", label: "Rascunho" },
  { value: "agendado", label: "Agendado" },
  { value: "publicado", label: "Publicado" },
];

// ─── types ────────────────────────────────────────────────────────────────────

type PostSaveData = Omit<Post, "id" | "created_at" | "metricas">;

interface PostModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: PostSaveData) => Promise<void>;
  post?: Post | null;
  empresaId: string;
}

// ─── form defaults ────────────────────────────────────────────────────────────

function buildDefaults(post: Post | null | undefined, empresaId: string): PostSaveData {
  return {
    empresa_id: empresaId,
    titulo: post?.titulo ?? "",
    conteudo: post?.conteudo ?? "",
    tematica: post?.tematica ?? "",
    plataformas: post?.plataformas ?? [],
    status: post?.status ?? "rascunho",
    agendado_para: post?.agendado_para ?? null,
    publicado_em: post?.publicado_em ?? null,
    midia_url: post?.midia_url ?? null,
  };
}

// ─── input shared styles ──────────────────────────────────────────────────────

const inputCls =
  "w-full bg-bg-input border border-border text-text-primary text-sm rounded-lg px-3 py-2 placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-150";

// ─── component ────────────────────────────────────────────────────────────────

export function PostModal({ open, onClose, onSave, post, empresaId }: PostModalProps) {
  const isEditing = !!post;

  const [form, setForm] = useState<PostSaveData>(() => buildDefaults(post, empresaId));
  const [saving, setSaving] = useState(false);

  // Reset form whenever the modal opens or `post` changes
  useEffect(() => {
    if (open) {
      setForm(buildDefaults(post, empresaId));
      setSaving(false);
    }
  }, [open, post, empresaId]);

  if (!open) return null;

  // ── handlers ──

  function setField<K extends keyof PostSaveData>(key: K, value: PostSaveData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePlatform(platform: string) {
    setForm((prev) => {
      const already = prev.plataformas.includes(platform);
      return {
        ...prev,
        plataformas: already
          ? prev.plataformas.filter((p) => p !== platform)
          : [...prev.plataformas, platform],
      };
    });
  }

  function handleStatusChange(status: Post["status"]) {
    setForm((prev) => ({
      ...prev,
      status,
      agendado_para: status !== "agendado" ? null : prev.agendado_para,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Convert ISO string to datetime-local value and back
  function toDatetimeLocal(iso: string | null): string {
    if (!iso) return "";
    // datetime-local expects "YYYY-MM-DDTHH:MM"
    return iso.slice(0, 16);
  }

  function fromDatetimeLocal(val: string): string | null {
    if (!val) return null;
    return new Date(val).toISOString();
  }

  return (
    <>
      {/* ── overlay ── */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── modal card ── */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Editar Post" : "Novo Post"}
      >
        <div
          className="bg-bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-bg-card z-10">
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              {isEditing ? "Editar Post" : "Novo Post"}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all duration-150"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── form ── */}
          <form onSubmit={handleSave} className="px-5 py-4 space-y-4">

            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Título <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setField("titulo", e.target.value)}
                placeholder="Título do post"
                required
                className={inputCls}
              />
            </div>

            {/* Conteúdo */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Conteúdo
              </label>
              <textarea
                value={form.conteudo}
                onChange={(e) => setField("conteudo", e.target.value)}
                placeholder="Escreva o conteúdo do post..."
                rows={4}
                className={cn(inputCls, "resize-none")}
              />
            </div>

            {/* Temática */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Temática
              </label>
              <input
                type="text"
                value={form.tematica}
                onChange={(e) => setField("tematica", e.target.value)}
                placeholder="Ex: Educacional, Case, Produto..."
                className={inputCls}
              />
            </div>

            {/* Plataformas */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Plataformas
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((platform) => {
                  const active = form.plataformas.includes(platform);
                  const color = getPlataformaCor(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 select-none",
                        active
                          ? "text-text-primary"
                          : "bg-bg-input border-border text-text-muted opacity-50 hover:opacity-75"
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: `${color}26`,
                              borderColor: `${color}50`,
                              color,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: active ? color : "var(--color-text-muted)" }}
                      />
                      {getPlataformaLabel(platform)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => handleStatusChange(e.target.value as Post["status"])}
                className={cn(inputCls, "cursor-pointer")}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Agendar para — only when status === "agendado" */}
            {form.status === "agendado" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Agendar para
                </label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(form.agendado_para)}
                  onChange={(e) =>
                    setField("agendado_para", fromDatetimeLocal(e.target.value))
                  }
                  className={cn(inputCls, "cursor-pointer")}
                />
              </div>
            )}

            {/* ── footer ── */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-input border border-border rounded-lg transition-all duration-150 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !form.titulo.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-all duration-150 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Salvando..." : isEditing ? "Salvar" : "Criar Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
