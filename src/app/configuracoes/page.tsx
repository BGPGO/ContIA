"use client";

import { useState, useRef, KeyboardEvent } from "react";
import {
  Share2,
  Sparkles,
  BarChart3,
  CalendarDays,
  Users,
  Newspaper,
  Upload,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Save,
  Link2,
  Link2Off,
  Rss,
  Loader2,
  Building2,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { empresasMock } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { Empresa, ConfigRSS } from "@/types";
import { EmpresaSettingsPanel } from "@/components/empresas/EmpresaSettingsPanel";

// ─── types ────────────────────────────────────────────────────────────────────

type TabId =
  | "empresa"
  | "equipe"
  | "redes"
  | "ia"
  | "analytics"
  | "calendario"
  | "concorrentes"
  | "noticias";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// ─── constants ────────────────────────────────────────────────────────────────

const TABS: TabItem[] = [
  { id: "empresa", label: "Empresa", icon: <Building2 size={14} /> },
  { id: "equipe", label: "Equipe", icon: <Users size={14} /> },
  { id: "redes", label: "Redes Sociais", icon: <Share2 size={14} /> },
  { id: "ia", label: "Criacao IA", icon: <Sparkles size={14} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
  { id: "calendario", label: "Calendario", icon: <CalendarDays size={14} /> },
  { id: "concorrentes", label: "Concorrentes", icon: <Users size={14} /> },
  { id: "noticias", label: "Noticias / RSS", icon: <Newspaper size={14} /> },
];

const DIAS_SEMANA = [
  "Segunda-feira",
  "Terca-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sabado",
  "Domingo",
];

// Inline SVG brand icons (lucide v1 removed brand icons)
const IgIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const FbIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const LiIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const TwIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const YtIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const TtIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.01-.05z" />
  </svg>
);

const PLATAFORMAS_SOCIAIS = [
  {
    id: "instagram",
    label: "Instagram",
    icon: <IgIcon />,
    color: "var(--color-instagram)",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: <FbIcon />,
    color: "var(--color-facebook)",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: <LiIcon />,
    color: "var(--color-linkedin)",
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    icon: <TwIcon />,
    color: "var(--color-twitter)",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: <YtIcon />,
    color: "var(--color-youtube)",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: <TtIcon />,
    color: "var(--color-tiktok)",
  },
];

// ─── shared input styles ──────────────────────────────────────────────────────

const inputClass =
  "w-full h-9 bg-bg-card border border-border text-text-primary placeholder:text-text-muted rounded-lg px-3 text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200";

const labelClass =
  "block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5";

const sectionTitleClass =
  "text-xs font-medium text-text-secondary uppercase tracking-wide mb-3 pb-2 border-b border-border-subtle";

const glassCard =
  "bg-bg-card backdrop-blur-xl border border-border rounded-xl p-4";

// ─── tag input ────────────────────────────────────────────────────────────────

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagInput({ tags, onChange, placeholder = "Digite e pressione Enter" }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/,$/, "");
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="min-h-[36px] bg-bg-card border border-border rounded-lg px-2.5 py-1.5 flex flex-wrap gap-1 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all duration-200">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 bg-accent/15 text-accent-light border border-accent/20 rounded-md px-1.5 h-5 text-[11px] font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-accent-light/50 hover:text-accent-light transition-colors"
          >
            <X size={8} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
      />
    </div>
  );
}

// ─── toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      {label && <span className="text-xs text-text-secondary">{label}</span>}
    </label>
  );
}

// ─── checkbox ────────────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-200 shrink-0",
          checked
            ? "bg-accent border-accent"
            : "bg-bg-card border-border group-hover:border-border-light"
        )}
      >
        {checked && <Check size={9} className="text-white" />}
      </button>
      <span className="text-xs text-text-secondary">{label}</span>
    </label>
  );
}

// ─── save button ─────────────────────────────────────────────────────────────

interface SaveButtonProps {
  onClick: () => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
}

function SaveButton({ onClick, loading, error }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  async function handleClick() {
    await onClick();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-[11px] text-danger">{error}</span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 h-8 rounded-lg font-medium text-xs transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed",
          saved
            ? "bg-success/15 text-success border border-success/20"
            : "bg-accent hover:bg-accent/90 text-white"
        )}
      >
        {loading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Salvando...
          </>
        ) : saved ? (
          <>
            <Check size={12} />
            Salvo
          </>
        ) : (
          <>
            <Save size={12} />
            Salvar
          </>
        )}
      </button>
    </div>
  );
}

// NOTE: EmpresaTab removed — company info now lives at /marca
// The function below is kept as dead code to avoid breaking the file structure.
// It can be fully removed in a future cleanup.

interface EmpresaFormState {
  nome: string;
  descricao: string;
  nicho: string;
  website: string;
  cor_primaria: string;
  cor_secundaria: string;
  info_adicional: string;
}

function _REMOVED_EmpresaTab() {
  const { empresa, empresas, setEmpresaId, createEmpresa, updateEmpresa, deleteEmpresa } = useEmpresa();
  const configured = isSupabaseConfigured();

  const initialState: EmpresaFormState = {
    nome: empresa?.nome ?? "",
    descricao: empresa?.descricao ?? "",
    nicho: empresa?.nicho ?? "",
    website: empresa?.website ?? "",
    cor_primaria: empresa?.cor_primaria ?? "#6c5ce7",
    cor_secundaria: empresa?.cor_secundaria ?? "#a29bfe",
    info_adicional: "",
  };

  const [form, setForm] = useState<EmpresaFormState>(initialState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateField(field: keyof EmpresaFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSelectEmpresa(id: string) {
    const e = empresas.find((x) => x.id === id);
    if (!e) return;
    setEmpresaId(id);
    setForm({
      nome: e.nome,
      descricao: e.descricao,
      nicho: e.nicho,
      website: e.website ?? "",
      cor_primaria: e.cor_primaria,
      cor_secundaria: e.cor_secundaria,
      info_adicional: "",
    });
    setEditingId(id);
    setShowNewForm(false);
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      if (showNewForm) {
        // Create new empresa
        const result = await createEmpresa({
          nome: form.nome,
          descricao: form.descricao,
          nicho: form.nicho,
          website: form.website || null,
          cor_primaria: form.cor_primaria,
          cor_secundaria: form.cor_secundaria,
        });
        if (!result) {
          setSaveError("Erro ao criar empresa.");
        } else {
          setShowNewForm(false);
          setEditingId(result.id);
        }
      } else {
        // Update existing empresa
        const targetId = editingId ?? empresa?.id;
        if (!targetId) return;
        const result = await updateEmpresa(targetId, {
          nome: form.nome,
          descricao: form.descricao,
          nicho: form.nicho,
          website: form.website || null,
          cor_primaria: form.cor_primaria,
          cor_secundaria: form.cor_secundaria,
        });
        if (!result) {
          setSaveError("Erro ao salvar empresa.");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.")) return;
    const ok = await deleteEmpresa(id);
    if (!ok) {
      setSaveError("Erro ao excluir empresa.");
    } else {
      setEditingId(null);
      setForm({
        nome: empresas.find((e) => e.id !== id)?.nome ?? "",
        descricao: empresas.find((e) => e.id !== id)?.descricao ?? "",
        nicho: empresas.find((e) => e.id !== id)?.nicho ?? "",
        website: empresas.find((e) => e.id !== id)?.website ?? "",
        cor_primaria: empresas.find((e) => e.id !== id)?.cor_primaria ?? "#6c5ce7",
        cor_secundaria: empresas.find((e) => e.id !== id)?.cor_secundaria ?? "#a29bfe",
        info_adicional: "",
      });
    }
  }

  function handleClickNova() {
    setShowNewForm(!showNewForm);
    if (!showNewForm) {
      // Reset form for creating a new empresa
      setEditingId(null);
      setForm({
        nome: "",
        descricao: "",
        nicho: "",
        website: "",
        cor_primaria: "#6c5ce7",
        cor_secundaria: "#a29bfe",
        info_adicional: "",
      });
    } else {
      // Restore current empresa into form
      if (empresa) {
        setForm({
          nome: empresa.nome,
          descricao: empresa.descricao,
          nicho: empresa.nicho,
          website: empresa.website ?? "",
          cor_primaria: empresa.cor_primaria,
          cor_secundaria: empresa.cor_secundaria,
          info_adicional: "",
        });
        setEditingId(empresa.id);
      }
    }
  }

  return (
    <div className="space-y-4 fade-in">
      {/* mock mode notice */}
      {!configured && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-[11px] text-warning">
          <span className="shrink-0">⚠</span>
          Modo demonstracao — dados nao sao persistidos
        </div>
      )}

      {/* current empresa form */}
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>
          {showNewForm ? "Nova Empresa" : editingId ? "Editar Empresa" : "Informacoes da Empresa"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* nome */}
          <div className="md:col-span-2">
            <label className={labelClass}>Nome da empresa</label>
            <input
              type="text"
              className={inputClass}
              value={form.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              placeholder="Ex: TechFlow Solutions"
            />
          </div>

          {/* descricao */}
          <div className="md:col-span-2">
            <label className={labelClass}>Descricao</label>
            <textarea
              className={cn(inputClass, "h-auto py-2 resize-none")}
              rows={3}
              value={form.descricao}
              onChange={(e) => updateField("descricao", e.target.value)}
              placeholder="Descreva sua empresa, proposta de valor, publico-alvo..."
            />
          </div>

          {/* nicho */}
          <div>
            <label className={labelClass}>Nicho / Segmento</label>
            <input
              type="text"
              className={inputClass}
              value={form.nicho}
              onChange={(e) => updateField("nicho", e.target.value)}
              placeholder="Ex: Tecnologia / SaaS"
            />
          </div>

          {/* website */}
          <div>
            <label className={labelClass}>Website</label>
            <input
              type="url"
              className={inputClass}
              value={form.website}
              onChange={(e) => updateField("website", e.target.value)}
              placeholder="https://suaempresa.com.br"
            />
          </div>

          {/* cor primaria */}
          <div>
            <label className={labelClass}>Cor primaria</label>
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <input
                  type="color"
                  value={form.cor_primaria}
                  onChange={(e) => updateField("cor_primaria", e.target.value)}
                  className="w-6 h-6 rounded-md border border-border bg-transparent cursor-pointer p-0"
                />
              </div>
              <input
                type="text"
                className={cn(inputClass, "font-mono uppercase text-xs")}
                value={form.cor_primaria}
                onChange={(e) => updateField("cor_primaria", e.target.value)}
                placeholder="#6c5ce7"
                maxLength={7}
              />
            </div>
          </div>

          {/* cor secundaria */}
          <div>
            <label className={labelClass}>Cor secundaria</label>
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <input
                  type="color"
                  value={form.cor_secundaria}
                  onChange={(e) => updateField("cor_secundaria", e.target.value)}
                  className="w-6 h-6 rounded-md border border-border bg-transparent cursor-pointer p-0"
                />
              </div>
              <input
                type="text"
                className={cn(inputClass, "font-mono uppercase text-xs")}
                value={form.cor_secundaria}
                onChange={(e) => updateField("cor_secundaria", e.target.value)}
                placeholder="#a29bfe"
                maxLength={7}
              />
            </div>
          </div>

          {/* logo upload */}
          <div className="md:col-span-2">
            <label className={labelClass}>Logo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed border-border hover:border-accent/30 rounded-lg p-4 flex items-center gap-3 text-text-muted hover:text-text-secondary transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-lg bg-bg-card flex items-center justify-center group-hover:bg-accent/10 transition-colors duration-200">
                <Upload size={14} className="group-hover:text-accent transition-colors duration-200" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium">Upload ou arraste aqui</p>
                <p className="text-[11px] text-text-muted mt-0.5">PNG, JPG, SVG — max 2MB</p>
              </div>
            </button>
          </div>

          {/* informacoes adicionais */}
          <div className="md:col-span-2">
            <label className={labelClass}>
              Info adicional
              <span className="ml-1.5 normal-case tracking-normal font-normal text-text-muted">
                (alimenta a IA)
              </span>
            </label>
            <textarea
              className={cn(inputClass, "h-auto py-2 resize-none")}
              rows={3}
              value={form.info_adicional}
              onChange={(e) => updateField("info_adicional", e.target.value)}
              placeholder="Diferenciais, tom de comunicacao, valores da marca, produtos/servicos..."
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <SaveButton onClick={handleSave} loading={saving} error={saveError} />
        </div>
      </div>

      {/* empresas cadastradas */}
      <div className={glassCard}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Empresas cadastradas</h3>
          <button
            type="button"
            onClick={handleClickNova}
            className="inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light rounded-lg bg-transparent transition-all duration-200"
          >
            <Plus size={11} />
            {showNewForm ? "Cancelar" : "Nova Empresa"}
          </button>
        </div>

        {showNewForm && (
          <div className="mb-3 p-3 bg-accent/5 rounded-lg border border-accent/15">
            <p className="text-xs text-text-muted">
              Preencha o formulario acima e clique em <strong className="text-text-secondary">Salvar</strong> para criar a empresa.
            </p>
          </div>
        )}

        <div className="space-y-0.5">
          {empresas.map((e) => (
            <div
              key={e.id}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer",
                empresa?.id === e.id
                  ? "bg-accent/[0.06] border border-accent/15"
                  : "border border-transparent hover:bg-bg-card/50"
              )}
              onClick={() => handleSelectEmpresa(e.id)}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex gap-0.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: e.cor_primaria }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: e.cor_secundaria }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-primary">{e.nome}</p>
                  <p className="text-[11px] text-text-muted">{e.nicho}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                {empresa?.id === e.id && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-accent/10 text-accent rounded-md">
                    Ativa
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectEmpresa(e.id)}
                  className="p-1 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors duration-200"
                  title="Editar"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors duration-200"
                  title="Excluir"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── redes sociais tab ────────────────────────────────────────────────────────

function RedesSociaisTab() {
  const { empresa } = useEmpresa();

  const [connections, setConnections] = useState<
    Record<string, { conectado: boolean; username: string }>
  >(() => {
    const base: Record<string, { conectado: boolean; username: string }> = {};
    PLATAFORMAS_SOCIAIS.forEach(({ id }) => {
      const config = (empresa?.redes_sociais as Record<string, { conectado: boolean; username: string }>)?.[id];
      base[id] = config ?? { conectado: false, username: "" };
    });
    return base;
  });

  function toggleConnection(id: string) {
    setConnections((prev) => ({
      ...prev,
      [id]: { ...prev[id], conectado: !prev[id].conectado },
    }));
  }

  return (
    <div className="space-y-4 fade-in">
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Contas conectadas</h3>

        <div className="space-y-0.5">
          {PLATAFORMAS_SOCIAIS.map(({ id, label, icon, color }) => {
            const conn = connections[id];
            return (
              <div
                key={id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bg-card/50 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <span style={{ color }}>{icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">{label}</p>
                    <p className="text-[11px] text-text-muted">
                      {conn?.conectado && conn.username ? conn.username : "Nao conectado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        conn?.conectado ? "bg-success" : "bg-border-light"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[11px]",
                        conn?.conectado ? "text-success" : "text-text-muted"
                      )}
                    >
                      {conn?.conectado ? "On" : "Off"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleConnection(id)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-medium transition-all duration-200",
                      conn?.conectado
                        ? "text-danger/80 hover:text-danger hover:bg-danger/10"
                        : "text-accent/80 hover:text-accent hover:bg-accent/10"
                    )}
                  >
                    {conn?.conectado ? (
                      <>
                        <Link2Off size={10} />
                        Desconectar
                      </>
                    ) : (
                      <>
                        <Link2 size={10} />
                        Conectar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 px-3 py-2 rounded-lg bg-info/[0.04] border border-info/10">
          <p className="text-[11px] text-info/70">
            <span className="font-medium text-info/90">Nota:</span> A integracao OAuth real estara disponivel
            em breve. As conexoes acima sao uma previa da interface.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={() => {}} />
      </div>
    </div>
  );
}

// ─── criacao ia tab ───────────────────────────────────────────────────────────

interface IAConfig {
  tom_voz: string;
  idioma: string;
  palavras_chave: string[];
  comprimento_posts: string;
  hashtags_padrao: string[];
}

function CriacaoIATab() {
  const [config, setConfig] = useState<IAConfig>({
    tom_voz: "Profissional",
    idioma: "Portugues (Brasil)",
    palavras_chave: ["inovacao", "tecnologia", "IA", "automacao"],
    comprimento_posts: "Medio",
    hashtags_padrao: ["#tech", "#inovacao", "#IA"],
  });

  function updateField<K extends keyof IAConfig>(field: K, value: IAConfig[K]) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4 fade-in">
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Parametros de geracao</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* tom de voz */}
          <div>
            <label className={labelClass}>Tom de voz</label>
            <select
              className={inputClass}
              value={config.tom_voz}
              onChange={(e) => updateField("tom_voz", e.target.value)}
            >
              {["Formal", "Casual", "Profissional", "Tecnico", "Divertido", "Inspiracional"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                )
              )}
            </select>
          </div>

          {/* idioma */}
          <div>
            <label className={labelClass}>Idioma preferido</label>
            <select
              className={inputClass}
              value={config.idioma}
              onChange={(e) => updateField("idioma", e.target.value)}
            >
              {[
                "Portugues (Brasil)",
                "Portugues (Portugal)",
                "Ingles",
                "Espanhol",
                "Frances",
              ].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* comprimento */}
          <div className="md:col-span-2">
            <label className={labelClass}>Comprimento padrao dos posts</label>
            <select
              className={inputClass}
              value={config.comprimento_posts}
              onChange={(e) => updateField("comprimento_posts", e.target.value)}
            >
              {["Curto (ate 100 palavras)", "Medio (100-250 palavras)", "Longo (250+ palavras)"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                )
              )}
            </select>
          </div>

          {/* palavras-chave */}
          <div className="md:col-span-2">
            <label className={labelClass}>
              Palavras-chave do nicho
              <span className="ml-1.5 normal-case tracking-normal font-normal text-text-muted">
                (Enter ou virgula)
              </span>
            </label>
            <TagInput
              tags={config.palavras_chave}
              onChange={(tags) => updateField("palavras_chave", tags)}
              placeholder="Digite palavras-chave e pressione Enter..."
            />
          </div>

          {/* hashtags */}
          <div className="md:col-span-2">
            <label className={labelClass}>
              Hashtags padrao
              <span className="ml-1.5 normal-case tracking-normal font-normal text-text-muted">
                (Enter ou virgula)
              </span>
            </label>
            <TagInput
              tags={config.hashtags_padrao}
              onChange={(tags) => updateField("hashtags_padrao", tags)}
              placeholder="#hashtag..."
            />
          </div>
        </div>
      </div>

      {/* em breve */}
      <div className="px-3 py-2.5 rounded-lg border border-dashed border-accent/20 bg-accent/[0.03] flex items-start gap-2.5">
        <Sparkles size={12} className="text-accent mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-accent/90">Configuracoes avancadas em breve</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Temperatura criativa, exemplos de posts, prompts personalizados e mais.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={() => {}} />
      </div>
    </div>
  );
}

// ─── analytics tab ────────────────────────────────────────────────────────────

interface AnalyticsConfig {
  periodo_padrao: string;
  metricas: Record<string, boolean>;
  meta_engajamento: string;
  meta_crescimento: string;
}

function AnalyticsTab() {
  const [config, setConfig] = useState<AnalyticsConfig>({
    periodo_padrao: "30",
    metricas: {
      Impressoes: true,
      Engajamento: true,
      Seguidores: true,
      Cliques: false,
      Alcance: true,
    },
    meta_engajamento: "5",
    meta_crescimento: "10",
  });

  function toggleMetrica(key: string) {
    setConfig((prev) => ({
      ...prev,
      metricas: { ...prev.metricas, [key]: !prev.metricas[key] },
    }));
  }

  return (
    <div className="space-y-4 fade-in">
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Configuracoes de analise</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* periodo */}
          <div>
            <label className={labelClass}>Periodo padrao</label>
            <select
              className={inputClass}
              value={config.periodo_padrao}
              onChange={(e) => setConfig((p) => ({ ...p, periodo_padrao: e.target.value }))}
            >
              <option value="7">Ultimos 7 dias</option>
              <option value="14">Ultimos 14 dias</option>
              <option value="30">Ultimos 30 dias</option>
              <option value="90">Ultimos 90 dias</option>
            </select>
          </div>

          {/* spacer for alignment */}
          <div />

          {/* metas */}
          <div>
            <label className={labelClass}>Meta de engajamento</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className={cn(inputClass, "pr-8")}
                value={config.meta_engajamento}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, meta_engajamento: e.target.value }))
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                %
              </span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Meta de crescimento mensal</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className={cn(inputClass, "pr-8")}
                value={config.meta_crescimento}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, meta_crescimento: e.target.value }))
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                %
              </span>
            </div>
          </div>

          {/* metricas prioritarias */}
          <div className="md:col-span-2">
            <label className={labelClass}>Metricas prioritarias</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-bg-card/50 rounded-lg border border-border-subtle">
              {Object.entries(config.metricas).map(([key, val]) => (
                <Checkbox
                  key={key}
                  label={key}
                  checked={val}
                  onChange={() => toggleMetrica(key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={() => {}} />
      </div>
    </div>
  );
}

// ─── calendario tab ───────────────────────────────────────────────────────────

interface CalendarioConfig {
  horarios: Record<string, string>;
  frequencia_semanal: number;
  fuso_horario: string;
}

function CalendarioTab() {
  const [config, setConfig] = useState<CalendarioConfig>({
    horarios: {
      "Segunda-feira": "09:00",
      "Terca-feira": "18:00",
      "Quarta-feira": "12:00",
      "Quinta-feira": "18:00",
      "Sexta-feira": "09:00",
      Sabado: "",
      Domingo: "",
    },
    frequencia_semanal: 5,
    fuso_horario: "America/Sao_Paulo",
  });

  function updateHorario(dia: string, valor: string) {
    setConfig((prev) => ({
      ...prev,
      horarios: { ...prev.horarios, [dia]: valor },
    }));
  }

  const FUSOS = [
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Belem",
    "America/Fortaleza",
    "America/Recife",
    "America/New_York",
    "Europe/Lisbon",
    "UTC",
  ];

  return (
    <div className="space-y-4 fade-in">
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Preferencias de publicacao</h3>

        <div className="space-y-3">
          {/* frequencia + fuso */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Frequencia semanal</label>
              <input
                type="number"
                min="1"
                max="21"
                className={inputClass}
                value={config.frequencia_semanal}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    frequencia_semanal: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className={labelClass}>Fuso horario</label>
              <select
                className={inputClass}
                value={config.fuso_horario}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, fuso_horario: e.target.value }))
                }
              >
                {FUSOS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* horarios por dia */}
          <div>
            <label className={labelClass}>
              Horarios de postagem
              <span className="ml-1.5 normal-case tracking-normal font-normal text-text-muted">
                (vazio = nao postar)
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-bg-card/50 rounded-lg border border-border-subtle">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-muted font-medium">{dia}</span>
                  <input
                    type="time"
                    className={cn(inputClass, "h-8 text-xs")}
                    value={config.horarios[dia] ?? ""}
                    onChange={(e) => updateHorario(dia, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={() => {}} />
      </div>
    </div>
  );
}

// ─── concorrentes tab ─────────────────────────────────────────────────────────

interface ConcorrentesConfig {
  frequencia_atualizacao: string;
  alertas_atividade: boolean;
  metricas: Record<string, boolean>;
}

function ConcorrentesTab() {
  const [config, setConfig] = useState<ConcorrentesConfig>({
    frequencia_atualizacao: "Semanal",
    alertas_atividade: true,
    metricas: {
      "Frequencia de postagem": true,
      "Taxa de engajamento": true,
      "Crescimento de seguidores": false,
      "Melhores horarios": false,
      "Tipos de conteudo": true,
      Hashtags: false,
    },
  });

  function toggleMetrica(key: string) {
    setConfig((prev) => ({
      ...prev,
      metricas: { ...prev.metricas, [key]: !prev.metricas[key] },
    }));
  }

  return (
    <div className="space-y-4 fade-in">
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Monitoramento de concorrentes</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* frequencia */}
          <div>
            <label className={labelClass}>Frequencia de atualizacao</label>
            <select
              className={inputClass}
              value={config.frequencia_atualizacao}
              onChange={(e) =>
                setConfig((p) => ({ ...p, frequencia_atualizacao: e.target.value }))
              }
            >
              <option>Diaria</option>
              <option>Semanal</option>
              <option>Quinzenal</option>
            </select>
          </div>

          {/* alertas */}
          <div className="flex items-end">
            <div className="w-full px-3 py-2.5 bg-bg-card/50 rounded-lg border border-border-subtle flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-primary">Alertas de atividade</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Notificacoes quando concorrentes postarem
                </p>
              </div>
              <Toggle
                checked={config.alertas_atividade}
                onChange={(v) => setConfig((p) => ({ ...p, alertas_atividade: v }))}
              />
            </div>
          </div>

          {/* metricas monitoradas */}
          <div className="md:col-span-2">
            <label className={labelClass}>Metricas monitoradas</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-bg-card/50 rounded-lg border border-border-subtle">
              {Object.entries(config.metricas).map(([key, val]) => (
                <Checkbox
                  key={key}
                  label={key}
                  checked={val}
                  onChange={() => toggleMetrica(key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={() => {}} />
      </div>
    </div>
  );
}

// ─── noticias / rss tab ───────────────────────────────────────────────────────

interface RSSConfig {
  frequencia_atualizacao: string;
  max_noticias: number;
  filtro_idioma: string;
  feeds: ConfigRSS[];
}

function NoticasRSSTab() {
  const { empresa } = useEmpresa();

  const [config, setConfig] = useState<RSSConfig>({
    frequencia_atualizacao: "6h",
    max_noticias: 20,
    filtro_idioma: "Todos",
    feeds: empresa?.config_rss ?? [],
  });

  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newFeed, setNewFeed] = useState<ConfigRSS>({
    nome: "",
    url: "",
    topico: "",
    ativo: true,
  });

  function addFeed() {
    if (!newFeed.nome.trim() || !newFeed.url.trim()) return;
    setConfig((prev) => ({
      ...prev,
      feeds: [...prev.feeds, { ...newFeed }],
    }));
    setNewFeed({ nome: "", url: "", topico: "", ativo: true });
    setShowAddFeed(false);
  }

  function removeFeed(idx: number) {
    setConfig((prev) => ({
      ...prev,
      feeds: prev.feeds.filter((_, i) => i !== idx),
    }));
  }

  function toggleFeed(idx: number) {
    setConfig((prev) => ({
      ...prev,
      feeds: prev.feeds.map((f, i) => (i === idx ? { ...f, ativo: !f.ativo } : f)),
    }));
  }

  return (
    <div className="space-y-4 fade-in">
      {/* config geral */}
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Configuracoes gerais de RSS</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Frequencia</label>
            <select
              className={inputClass}
              value={config.frequencia_atualizacao}
              onChange={(e) => setConfig((p) => ({ ...p, frequencia_atualizacao: e.target.value }))}
            >
              <option value="1h">A cada 1 hora</option>
              <option value="3h">A cada 3 horas</option>
              <option value="6h">A cada 6 horas</option>
              <option value="12h">A cada 12 horas</option>
              <option value="24h">Diariamente</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Max noticias / feed</label>
            <input
              type="number"
              min="5"
              max="100"
              step="5"
              className={inputClass}
              value={config.max_noticias}
              onChange={(e) => setConfig((p) => ({ ...p, max_noticias: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className={labelClass}>Idioma</label>
            <select
              className={inputClass}
              value={config.filtro_idioma}
              onChange={(e) => setConfig((p) => ({ ...p, filtro_idioma: e.target.value }))}
            >
              <option>Todos</option>
              <option>Portugues</option>
              <option>Ingles</option>
              <option>Espanhol</option>
            </select>
          </div>
        </div>
      </div>

      {/* feeds */}
      <div className={glassCard}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Feeds cadastrados</h3>
          <button
            type="button"
            onClick={() => setShowAddFeed(!showAddFeed)}
            className="inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-light rounded-lg bg-transparent transition-all duration-200"
          >
            <Plus size={11} />
            Adicionar Feed
          </button>
        </div>

        {/* add feed form */}
        {showAddFeed && (
          <div className="mb-3 p-3 bg-bg-card/50 rounded-lg border border-border-subtle space-y-2.5">
            <p className="text-xs font-medium text-text-primary">Novo feed RSS</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  type="text"
                  className={inputClass}
                  value={newFeed.nome}
                  onChange={(e) => setNewFeed((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: TechCrunch"
                />
              </div>
              <div>
                <label className={labelClass}>Topico</label>
                <input
                  type="text"
                  className={inputClass}
                  value={newFeed.topico}
                  onChange={(e) => setNewFeed((p) => ({ ...p, topico: e.target.value }))}
                  placeholder="Ex: Tecnologia"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>URL do feed</label>
                <input
                  type="url"
                  className={inputClass}
                  value={newFeed.url}
                  onChange={(e) => setNewFeed((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://site.com/feed/"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddFeed(false)}
                className="px-3 h-7 text-[11px] text-text-muted hover:text-text-secondary bg-bg-card border border-border rounded-lg transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addFeed}
                className="px-3 h-7 text-[11px] text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors duration-200"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}

        {config.feeds.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <Rss size={20} className="mx-auto mb-1.5 opacity-20" />
            <p className="text-xs">Nenhum feed cadastrado</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {config.feeds.map((feed, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-card/50 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                    <Rss size={11} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">{feed.nome}</p>
                    <p className="text-[11px] text-text-muted truncate max-w-[240px]">{feed.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {feed.topico && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-bg-card border border-border rounded-md text-text-muted">
                      {feed.topico}
                    </span>
                  )}
                  <Toggle
                    checked={feed.ativo}
                    onChange={() => toggleFeed(idx)}
                  />
                  <button
                    type="button"
                    onClick={() => removeFeed(idx)}
                    className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors duration-200"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={() => {}} />
      </div>
    </div>
  );
}

// ─── equipe tab ───────────────────────────────────────────────────────────────

function EquipeTab() {
  const { empresa } = useEmpresa();

  if (!empresa) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-text-muted text-sm">
        Selecione uma empresa para gerenciar a equipe.
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      <div className={glassCard}>
        <h3 className={sectionTitleClass}>Membros da empresa</h3>
        <p className="text-xs text-text-muted mb-4">
          Gerencie quem tem acesso a esta empresa e seus papéis.
        </p>
        <a
          href={`/empresas/${empresa.id}/membros`}
          className="inline-flex items-center gap-1.5 px-4 h-8 rounded-lg text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors duration-200"
        >
          <Users size={12} />
          Gerenciar membros
        </a>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("empresa");
  const { empresa, myRole } = useEmpresa();

  function renderContent() {
    switch (activeTab) {
      case "empresa":
        return empresa ? (
          <EmpresaSettingsPanel empresa={empresa} myRole={myRole} />
        ) : (
          <div className={glassCard}>
            <p className="text-xs text-text-muted">Selecione uma empresa para editar.</p>
          </div>
        );
      case "equipe":
        return <EquipeTab />;
      case "redes":
        return <RedesSociaisTab />;
      case "ia":
        return <CriacaoIATab />;
      case "analytics":
        return <AnalyticsTab />;
      case "calendario":
        return <CalendarioTab />;
      case "concorrentes":
        return <ConcorrentesTab />;
      case "noticias":
        return <NoticasRSSTab />;
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4 lg:p-6">
      {/* page header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-text-primary">Configuracoes</h1>
      </div>

      {/* content layout: vertical tabs + panel */}
      <div className="flex gap-4 items-start">
        {/* ── vertical tab nav ── */}
        <aside className="w-[200px] shrink-0 sticky top-4">
          <nav className="bg-bg-card backdrop-blur-xl border border-border rounded-xl p-1.5">
            <div className="space-y-0.5">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-xs font-medium transition-all duration-150 text-left relative",
                      isActive
                        ? "bg-bg-card-hover text-text-primary"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-card/50"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3 bg-accent rounded-r-full" />
                    )}
                    <span
                      className={cn(
                        "transition-colors duration-150 shrink-0",
                        isActive ? "text-text-primary" : "text-text-muted"
                      )}
                    >
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* ── tab content panel ── */}
        <div className="flex-1 min-w-0">
          <div key={activeTab}>{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
