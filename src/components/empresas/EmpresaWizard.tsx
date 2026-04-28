"use client";

import { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Globe,
  Building2,
  Palette,
  Share2,
  Users,
  Rss,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { getPlataformaCor, getPlataformaLabel } from "@/lib/utils";
import type { Empresa, RedesSociais, ConfigRSS } from "@/types";

/* ─────────────────────────────────────────────── types ─── */

interface WizardFormData {
  // Step 1
  nome: string;
  descricao: string;
  nicho: string;
  website: string;
  // Step 2
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  logo_preview: string | null;
  // Step 3
  redes: {
    [key: string]: { enabled: boolean; username: string };
  };
  // Step 4
  concorrentes: { nome: string; rede: string; username: string }[];
  // Step 5
  feeds: ConfigRSS[];
}

interface EmpresaWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (empresa: Empresa) => void;
}

/* ────────────────────────────────────────── constants ─── */

const PLATAFORMAS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
] as const;

const REDES_OPTIONS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
];

const SUGGESTED_FEEDS: ConfigRSS[] = [
  {
    nome: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    topico: "Tecnologia",
    ativo: false,
  },
  {
    nome: "Social Media Today",
    url: "https://www.socialmediatoday.com/rss",
    topico: "Marketing",
    ativo: false,
  },
];

const STEP_CONFIG = [
  { icon: Building2, label: "Básico" },
  { icon: Palette, label: "Visual" },
  { icon: Share2, label: "Redes" },
  { icon: Users, label: "Concorrentes" },
  { icon: Rss, label: "Notícias" },
];

const INITIAL_DATA: WizardFormData = {
  nome: "",
  descricao: "",
  nicho: "",
  website: "",
  cor_primaria: "#6c5ce7",
  cor_secundaria: "#a29bfe",
  logo_url: null,
  logo_preview: null,
  redes: Object.fromEntries(
    PLATAFORMAS.map((p) => [p, { enabled: false, username: "" }])
  ),
  concorrentes: [],
  feeds: [],
};

/* ─────────────────────────── small reusable pieces ─── */

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`transition-all duration-300 ${i <= current ? "bg-[#6c5ce7]" : "bg-border"}`}
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            borderRadius: 9999,
          }}
        />
      ))}
    </div>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200 resize-none"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-lg border border-border shrink-0 cursor-pointer relative overflow-hidden"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="flex-1 h-10 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200"
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────── step components ─── */

function Step1({
  data,
  onChange,
}: {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Vamos começar com as informações essenciais da empresa.
        </p>
      </div>
      <InputField
        label="Nome da empresa"
        value={data.nome}
        onChange={(v) => onChange({ nome: v })}
        placeholder="Ex: Agência Criativa"
        required
      />
      <TextareaField
        label="Descrição"
        value={data.descricao}
        onChange={(v) => onChange({ descricao: v })}
        placeholder="Descreva a empresa, seu mercado, público-alvo..."
        rows={3}
      />
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Nicho / Segmento"
          value={data.nicho}
          onChange={(v) => onChange({ nicho: v })}
          placeholder="Ex: Marketing Digital"
        />
        <InputField
          label="Website"
          type="url"
          value={data.website}
          onChange={(v) => onChange({ website: v })}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

function Step2({
  data,
  onChange,
}: {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onChange({ logo_preview: url, logo_url: null });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-text-secondary leading-relaxed">
        Defina as cores e identidade visual da empresa.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <ColorField
          label="Cor Primária"
          value={data.cor_primaria}
          onChange={(v) => onChange({ cor_primaria: v })}
        />
        <ColorField
          label="Cor Secundária"
          value={data.cor_secundaria}
          onChange={(v) => onChange({ cor_secundaria: v })}
        />
      </div>

      {/* Logo upload */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
          Logo
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="relative flex flex-col items-center justify-center gap-2 h-24 border border-dashed border-border rounded-lg bg-bg-input hover:border-accent hover:bg-[#6c5ce70a] transition-all duration-200 cursor-pointer group"
        >
          {data.logo_preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.logo_preview}
                alt="Logo preview"
                className="h-16 w-auto object-contain rounded"
              />
              <span className="text-[11px] text-text-muted">
                Clique para trocar
              </span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
              <span className="text-[12px] text-text-muted group-hover:text-text-secondary transition-colors">
                Arraste ou clique para fazer upload
              </span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
          Preview
        </label>
        <div
          className="rounded-xl p-4 border"
          style={{
            background: `linear-gradient(135deg, ${data.cor_primaria}22 0%, ${data.cor_secundaria}11 100%)`,
            borderColor: `${data.cor_primaria}44`,
          }}
        >
          <div className="flex items-center gap-3">
            {data.logo_preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo_preview}
                alt="Logo"
                className="w-10 h-10 rounded-lg object-contain bg-black/20"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: data.cor_primaria }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="text-[14px] font-semibold text-text-primary">
                {data.nome || "Nome da empresa"}
              </p>
              <p className="text-[12px]" style={{ color: data.cor_secundaria }}>
                {data.nicho || "Seu nicho"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] font-medium" style={{ color: data.cor_primaria }}>
            Bem-vindo, {data.nome || "empresa"}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Pronto para criar conteúdo incrível?
          </p>
        </div>
      </div>
    </div>
  );
}

function Step3({
  data,
  onChange,
}: {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
}) {
  const toggle = (p: string, enabled: boolean) => {
    onChange({
      redes: {
        ...data.redes,
        [p]: { ...data.redes[p], enabled },
      },
    });
  };

  const setUsername = (p: string, username: string) => {
    onChange({
      redes: {
        ...data.redes,
        [p]: { ...data.redes[p], username },
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary leading-relaxed">
        Quais plataformas esta empresa usa?
      </p>

      <div className="flex flex-col gap-2">
        {PLATAFORMAS.map((p) => {
          const cor = getPlataformaCor(p);
          const label = getPlataformaLabel(p);
          const state = data.redes[p];

          return (
            <div
              key={p}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-bg-input hover:border-border-light transition-colors duration-200"
            >
              {/* Platform dot */}
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cor }}
              />
              <span className="flex-1 text-[13px] font-medium text-text-primary">
                {label}
              </span>

              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggle(p, !state.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${state.enabled ? "bg-[#6c5ce7]" : "bg-border"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${state.enabled ? "bg-white" : "bg-bg-primary border border-border"}`}
                  style={{ transform: state.enabled ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>

              {/* Username input */}
              {state.enabled && (
                <input
                  type="text"
                  value={state.username}
                  onChange={(e) => setUsername(p, e.target.value)}
                  placeholder={`@username`}
                  className="w-36 h-7 px-2 text-[12px] bg-bg-card border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200"
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-muted mt-1">
        A conexão OAuth será configurada depois nas configurações.
      </p>
    </div>
  );
}

function Step4({
  data,
  onChange,
  onSkip,
}: {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
  onSkip: () => void;
}) {
  const addRow = () => {
    onChange({
      concorrentes: [
        ...data.concorrentes,
        { nome: "", rede: "instagram", username: "" },
      ],
    });
  };

  const updateRow = (
    i: number,
    field: "nome" | "rede" | "username",
    value: string
  ) => {
    const next = [...data.concorrentes];
    next[i] = { ...next[i], [field]: value };
    onChange({ concorrentes: next });
  };

  const removeRow = (i: number) => {
    onChange({ concorrentes: data.concorrentes.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary leading-relaxed">
        Adicione os concorrentes que deseja monitorar. Você pode fazer isso depois também.
      </p>

      {data.concorrentes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 border border-dashed border-border rounded-lg bg-bg-input">
          <Users className="w-8 h-8 text-text-muted" />
          <p className="text-[13px] text-text-muted">Nenhum concorrente adicionado</p>
        </div>
      )}

      {data.concorrentes.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={c.nome}
            onChange={(e) => updateRow(i, "nome", e.target.value)}
            placeholder="Nome"
            className="flex-1 h-9 px-3 text-[13px] bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200"
          />
          <select
            value={c.rede}
            onChange={(e) => updateRow(i, "rede", e.target.value)}
            className="h-9 px-2 text-[13px] bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-colors duration-200"
          >
            {REDES_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {getPlataformaLabel(r)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={c.username}
            onChange={(e) => updateRow(i, "username", e.target.value)}
            placeholder="@username"
            className="w-32 h-9 px-3 text-[13px] bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/10 transition-all duration-200 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 px-3 h-9 rounded-lg border border-dashed border-border text-[13px] text-text-secondary hover:text-text-primary hover:border-border-light hover:bg-bg-card-hover transition-all duration-200"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar concorrente
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="text-[12px] text-text-muted hover:text-text-secondary underline underline-offset-2 self-start transition-colors duration-200"
      >
        Pular este passo
      </button>
    </div>
  );
}

function Step5({
  data,
  onChange,
  onSkip,
}: {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
  onSkip: () => void;
}) {
  const addRow = () => {
    onChange({
      feeds: [...data.feeds, { nome: "", url: "", topico: "", ativo: true }],
    });
  };

  const updateRow = (
    i: number,
    field: keyof ConfigRSS,
    value: string | boolean
  ) => {
    const next = [...data.feeds];
    next[i] = { ...next[i], [field]: value };
    onChange({ feeds: next });
  };

  const removeRow = (i: number) => {
    onChange({ feeds: data.feeds.filter((_, idx) => idx !== i) });
  };

  const toggleSuggested = (feed: ConfigRSS) => {
    const exists = data.feeds.some((f) => f.url === feed.url);
    if (exists) {
      onChange({ feeds: data.feeds.filter((f) => f.url !== feed.url) });
    } else {
      onChange({ feeds: [...data.feeds, { ...feed, ativo: true }] });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary leading-relaxed">
        Configure fontes RSS para monitorar notícias relevantes ao negócio.
      </p>

      {/* Suggested feeds */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          Sugestões
        </p>
        <div className="flex flex-col gap-2">
          {SUGGESTED_FEEDS.map((feed) => {
            const active = data.feeds.some((f) => f.url === feed.url);
            return (
              <button
                key={feed.url}
                type="button"
                onClick={() => toggleSuggested(feed)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-200 text-left ${
                  active
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/[0.07]"
                    : "border-border bg-bg-input hover:border-border-light"
                }`}
              >
                <Rss
                  className={`w-4 h-4 shrink-0 ${active ? "text-[#6c5ce7]" : "text-text-muted"}`}
                />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-text-primary">
                    {feed.nome}
                  </p>
                  <p className="text-[11px] text-text-muted">{feed.topico}</p>
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    active
                      ? "text-[#6c5ce7] bg-[#6c5ce7]/[0.13] border border-[#6c5ce7]/30"
                      : "text-text-muted bg-bg-card border border-border"
                  }`}
                >
                  {active ? "Adicionado" : "Adicionar"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom feeds */}
      {data.feeds.filter((f) => !SUGGESTED_FEEDS.some((s) => s.url === f.url)).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            Personalizados
          </p>
          {data.feeds
            .filter((f) => !SUGGESTED_FEEDS.some((s) => s.url === f.url))
            .map((feed, i) => {
              const realIdx = data.feeds.indexOf(feed);
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feed.nome}
                    onChange={(e) => updateRow(realIdx, "nome", e.target.value)}
                    placeholder="Nome"
                    className="w-28 h-9 px-2 text-[12px] bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                  <input
                    type="url"
                    value={feed.url}
                    onChange={(e) => updateRow(realIdx, "url", e.target.value)}
                    placeholder="https://feed.xml"
                    className="flex-1 h-9 px-2 text-[12px] bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                  <input
                    type="text"
                    value={feed.topico}
                    onChange={(e) => updateRow(realIdx, "topico", e.target.value)}
                    placeholder="Tópico"
                    className="w-24 h-9 px-2 text-[12px] bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(realIdx)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/10 transition-all duration-200 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 px-3 h-9 rounded-lg border border-dashed border-border text-[13px] text-text-secondary hover:text-text-primary hover:border-border-light hover:bg-bg-card-hover transition-all duration-200"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar fonte
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="text-[12px] text-text-muted hover:text-text-secondary underline underline-offset-2 self-start transition-colors duration-200"
      >
        Pular este passo
      </button>
    </div>
  );
}

/* ────────────────────────────────── main wizard ─── */

export function EmpresaWizard({ open, onClose, onCreated }: EmpresaWizardProps) {
  const { createEmpresa } = useEmpresa();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardFormData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  const patch = useCallback((p: Partial<WizardFormData>) => {
    setData((prev) => ({ ...prev, ...p }));
  }, []);

  const animateStep = (newStep: number, dir: "forward" | "back") => {
    setAnimating(true);
    setAnimDir(dir);
    setTimeout(() => {
      setStep(newStep);
      setAnimating(false);
    }, 150);
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!data.nome.trim()) {
        setError("O nome da empresa é obrigatório.");
        return false;
      }
    }
    setError(null);
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < 4) animateStep(step + 1, "forward");
  };

  const back = () => {
    if (step > 0) animateStep(step - 1, "back");
  };

  const skip = () => {
    if (step < 4) animateStep(step + 1, "forward");
  };

  const handleCreate = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError(null);

    try {
      // Build redes_sociais
      const redes_sociais: RedesSociais = {};
      for (const p of PLATAFORMAS) {
        const r = data.redes[p];
        if (r.enabled) {
          (redes_sociais as Record<string, unknown>)[p] = {
            conectado: false,
            username: r.username,
          };
        }
      }

      const payload: Partial<Empresa> = {
        nome: data.nome.trim(),
        descricao: data.descricao.trim(),
        nicho: data.nicho.trim(),
        website: data.website.trim() || null,
        cor_primaria: data.cor_primaria,
        cor_secundaria: data.cor_secundaria,
        logo_url: data.logo_url,
        redes_sociais,
        config_rss: data.feeds,
      };

      const empresa = await createEmpresa(payload);

      if (!empresa) {
        setError("Falha ao criar empresa. Verifique a conexão e tente novamente.");
        return;
      }

      onCreated(empresa);
      onClose();

      // Reset state after a short delay so animation is clean
      setTimeout(() => {
        setStep(0);
        setData(INITIAL_DATA);
        setError(null);
      }, 300);
    } catch (err) {
      console.error(err);
      setError("Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(0);
      setData(INITIAL_DATA);
      setError(null);
    }, 300);
  };

  if (!open) return null;

  const stepTitles = [
    "Informações Básicas",
    "Identidade Visual",
    "Redes Sociais",
    "Concorrentes",
    "Fontes de Notícias",
  ];

  const stepIcons = [Building2, Palette, Share2, Users, Rss];
  const StepIcon = stepIcons[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative bg-bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(108,92,231,0.08)" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0 border-b border-border">
          {/* Top row: branding + close */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-semibold text-text-primary tracking-tight">
                GO Studio
              </span>
              <span className="text-[11px] text-text-muted px-1.5 py-0.5 rounded bg-bg-input border border-border">
                Nova empresa
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover border border-transparent hover:border-border transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step title row */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#6c5ce722", border: "1px solid #6c5ce744" }}
            >
              <StepIcon className="w-4.5 h-4.5 text-accent" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                Passo {step + 1} de 5
              </p>
              <h2 className="text-[16px] font-semibold text-text-primary leading-tight">
                {stepTitles[step]}
              </h2>
            </div>
            <StepDots current={step} total={5} />
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? animDir === "forward"
                ? "translateX(16px)"
                : "translateX(-16px)"
              : "translateX(0)",
            transition: "opacity 150ms ease, transform 150ms ease",
          }}
        >
          {step === 0 && <Step1 data={data} onChange={patch} />}
          {step === 1 && <Step2 data={data} onChange={patch} />}
          {step === 2 && <Step3 data={data} onChange={patch} />}
          {step === 3 && <Step4 data={data} onChange={patch} onSkip={skip} />}
          {step === 4 && <Step5 data={data} onChange={patch} onSkip={skip} />}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 pb-2 shrink-0">
            <p className="text-[12px] text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-light hover:bg-bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          {/* Step indicator pills */}
          <div className="flex items-center gap-1">
            {STEP_CONFIG.map(({ label }, i) => (
              <span
                key={i}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all duration-200 ${
                  i < step
                    ? "bg-[#6c5ce7]/[0.13] text-[#a29bfe]"
                    : i === step
                    ? "bg-[#6c5ce7]/20 text-[#a29bfe]"
                    : "bg-bg-input text-text-muted border border-border"
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1.5 h-10 px-5 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-[#7d6ef0] active:scale-[0.98] transition-all duration-200"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="flex items-center gap-2 h-10 px-5 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-[#7d6ef0] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Criar Empresa
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
