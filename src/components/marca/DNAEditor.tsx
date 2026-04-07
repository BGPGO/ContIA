"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MessageSquare,
  Users,
  Target,
  Megaphone,
  Palette,
  Hash,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  FileText,
  Zap,
  Clock,
  PenTool,
  X,
  Plus,
  Save,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DNASintetizado } from "@/types";
import { cn } from "@/lib/utils";

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface DNAEditorProps {
  dna: DNASintetizado;
  editing: boolean;
  onSave: (dna: DNASintetizado) => void;
  onCancel?: () => void;
}

/* ================================================================== */
/*  Small primitives                                                    */
/* ================================================================== */

function SectionCard({
  icon,
  title,
  subtitle,
  children,
  accentColor = "#6c5ce7",
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accentColor?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.08 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${accentColor}18`,
            boxShadow: `0 0 20px ${accentColor}10`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/* ── Editable textarea ────────────────────────────────────────────── */

function EditableText({
  value,
  editing,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string | undefined;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  if (!editing) {
    return (
      <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {value || <span className="text-text-muted italic">Nao definido</span>}
      </p>
    );
  }
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 resize-y"
    />
  );
}

/* ── Tag editor (chips with add/remove) ───────────────────────────── */

function TagEditor({
  items,
  editing,
  onChange,
  placeholder,
  variant = "default",
  prefix,
}: {
  items: string[] | undefined;
  editing: boolean;
  onChange: (items: string[]) => void;
  placeholder?: string;
  variant?: "default" | "success" | "danger" | "accent" | "hash";
  prefix?: string;
}) {
  const [draft, setDraft] = useState("");
  const list = items || [];

  const chipStyles = {
    default: "bg-bg-elevated text-text-secondary border-border",
    success: "bg-success/10 text-success border-success/20",
    danger: "bg-danger/10 text-danger border-danger/20",
    accent: "bg-accent/15 text-accent-light border-accent/25",
    hash: "bg-accent/10 text-accent-light border-accent/20",
  };

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed || list.includes(trimmed)) return;
    onChange([...list, trimmed]);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {list.map((item, i) => (
            <motion.span
              key={`${item}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                chipStyles[variant]
              )}
            >
              {prefix && (
                <span className="opacity-60">{prefix}</span>
              )}
              {variant === "hash" && (
                <Hash size={10} className="opacity-60" />
              )}
              {item.replace(/^#/, "")}
              {editing && (
                <button
                  onClick={() => handleRemove(i)}
                  className="ml-1 text-text-muted hover:text-danger transition-colors"
                  aria-label={`Remover ${item}`}
                >
                  <X size={12} />
                </button>
              )}
            </motion.span>
          ))}
        </AnimatePresence>
        {!editing && list.length === 0 && (
          <span className="text-xs text-text-muted italic">
            Nenhum item definido.
          </span>
        )}
      </div>

      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Adicionar..."}
            className="flex-1 h-9 px-3 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 px-3 h-9 text-xs font-medium text-accent hover:bg-accent/10 border border-border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ── Color palette editor ─────────────────────────────────────────── */

function ColorPaletteEditor({
  colors,
  editing,
  onChange,
}: {
  colors: string[] | undefined;
  editing: boolean;
  onChange: (colors: string[]) => void;
}) {
  const list = colors || [];

  const handleChange = (idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    onChange(next);
  };

  const handleAdd = () => {
    if (list.length >= 8) return;
    onChange([...list, "#6c5ce7"]);
  };

  const handleRemove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  if (!editing) {
    return (
      <div className="space-y-3">
        {list.length > 0 ? (
          list.map((cor, i) => (
            <div key={i} className="flex items-center gap-2.5 group">
              <div
                className="w-8 h-8 rounded-lg border border-border-light shadow-md group-hover:scale-110 transition-transform duration-200"
                style={{
                  backgroundColor: cor,
                  boxShadow: `0 2px 12px ${cor}40`,
                }}
              />
              <span className="text-xs font-mono text-text-secondary">
                {cor}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-text-muted">
            Nenhuma cor identificada ainda.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {list.map((cor, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            layout
            className="flex items-center gap-2.5 group"
          >
            <input
              type="color"
              value={cor}
              onChange={(e) => handleChange(i, e.target.value)}
              className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={cor}
              onChange={(e) => handleChange(i, e.target.value)}
              className="w-24 h-8 px-2 text-xs font-mono bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
            />
            <button
              onClick={() => handleRemove(i)}
              className="text-text-muted hover:text-danger transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {list.length < 8 && (
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 border border-dashed border-accent/30 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Adicionar cor
        </button>
      )}
    </div>
  );
}

/* ── Editable legend list ─────────────────────────────────────────── */

function LegendaEditor({
  items,
  editing,
  onChange,
}: {
  items: string[] | undefined;
  editing: boolean;
  onChange: (items: string[]) => void;
}) {
  const list = items || [];

  const handleChange = (idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...list, ""]);
  };

  const handleRemove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  if (!editing) {
    if (list.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((ex, i) => (
          <div
            key={i}
            className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-all duration-200"
          >
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-[#e1306c] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">IG</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">
                  Sua Marca
                </p>
                <p className="text-[10px] text-text-muted">Post sugerido</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                {typeof ex === "string" ? ex : String(ex)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((ex, i) => (
        <div key={i} className="flex gap-2">
          <textarea
            value={ex}
            onChange={(e) => handleChange(i, e.target.value)}
            rows={3}
            placeholder={`Exemplo de legenda ${i + 1}...`}
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 resize-y"
          />
          <button
            onClick={() => handleRemove(i)}
            className="self-start mt-2 text-text-muted hover:text-danger transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {list.length < 6 && (
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 border border-dashed border-accent/30 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Adicionar exemplo
        </button>
      )}
    </div>
  );
}

/* ── InfoRow (view mode) ──────────────────────────────────────────── */

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0">
      <span className="text-accent-light mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-0.5">
          {label}
        </p>
        <div className="text-sm text-text-primary leading-relaxed">{value}</div>
      </div>
    </div>
  );
}

/* ── EditRow (edit mode) ──────────────────────────────────────────── */

function EditRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0">
      <span className="text-accent-light mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

/* ── hex points for radar SVG ─────────────────────────────────────── */

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

/* ================================================================== */
/*  DNAEditor                                                          */
/* ================================================================== */

export function DNAEditor({ dna, editing, onSave, onCancel }: DNAEditorProps) {
  const [draft, setDraft] = useState<DNASintetizado>({ ...dna });

  // Sync draft when dna prop changes (and not editing)
  useEffect(() => {
    if (!editing) {
      setDraft({ ...dna });
    }
  }, [dna, editing]);

  // Reset draft when entering edit mode
  const prevEditingRef = useRef(editing);
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setDraft({ ...dna });
    }
    prevEditingRef.current = editing;
  }, [editing, dna]);

  const update = useCallback(
    <K extends keyof DNASintetizado>(key: K, value: DNASintetizado[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = () => {
    onSave(draft);
  };

  const handleCancel = () => {
    setDraft({ ...dna });
    onCancel?.();
  };

  const d = editing ? draft : dna;

  return (
    <div className="space-y-10">
      {/* ── 1. Identidade da Marca ─────────────────────────────────────── */}
      <SectionCard
        icon={<PenTool size={20} />}
        title="Identidade da Marca"
        subtitle="Tom de voz, personalidade e proposta de valor"
        delay={1}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-6 space-y-1">
            {editing ? (
              <>
                <EditRow
                  icon={<MessageSquare size={16} />}
                  label="Tom de voz"
                >
                  <EditableText
                    value={d.tom_de_voz}
                    editing
                    onChange={(v) => update("tom_de_voz", v)}
                    placeholder="Descreva o tom de voz da marca..."
                    rows={2}
                  />
                </EditRow>
                <EditRow
                  icon={<Users size={16} />}
                  label="Personalidade"
                >
                  <EditableText
                    value={d.personalidade_marca}
                    editing
                    onChange={(v) => update("personalidade_marca", v)}
                    placeholder="Descreva a personalidade da marca..."
                    rows={2}
                  />
                </EditRow>
                <EditRow
                  icon={<Target size={16} />}
                  label="Proposta de valor"
                >
                  <EditableText
                    value={d.proposta_valor}
                    editing
                    onChange={(v) => update("proposta_valor", v)}
                    placeholder="Qual a proposta de valor?"
                    rows={2}
                  />
                </EditRow>
                <EditRow
                  icon={<Megaphone size={16} />}
                  label="Publico-alvo"
                >
                  <EditableText
                    value={d.publico_alvo}
                    editing
                    onChange={(v) => update("publico_alvo", v)}
                    placeholder="Quem e o publico-alvo?"
                    rows={2}
                  />
                </EditRow>
                <EditRow
                  icon={<Palette size={16} />}
                  label="Estilo visual"
                >
                  <EditableText
                    value={d.estilo_visual}
                    editing
                    onChange={(v) => update("estilo_visual", v)}
                    placeholder="Descreva o estilo visual..."
                    rows={2}
                  />
                </EditRow>
              </>
            ) : (
              <>
                {d.tom_de_voz && (
                  <InfoRow
                    icon={<MessageSquare size={16} />}
                    label="Tom de voz"
                    value={d.tom_de_voz}
                  />
                )}
                {d.personalidade_marca && (
                  <InfoRow
                    icon={<Users size={16} />}
                    label="Personalidade"
                    value={d.personalidade_marca}
                  />
                )}
                {d.proposta_valor && (
                  <InfoRow
                    icon={<Target size={16} />}
                    label="Proposta de valor"
                    value={d.proposta_valor}
                  />
                )}
                {d.publico_alvo && (
                  <InfoRow
                    icon={<Megaphone size={16} />}
                    label="Publico-alvo"
                    value={d.publico_alvo}
                  />
                )}
                {d.estilo_visual && (
                  <InfoRow
                    icon={<Palette size={16} />}
                    label="Estilo visual"
                    value={d.estilo_visual}
                  />
                )}
              </>
            )}
          </div>

          {/* Color palette column */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette size={16} className="text-accent-light" />
              <h3 className="text-sm font-semibold text-text-primary">
                Paleta de Cores
              </h3>
            </div>
            <ColorPaletteEditor
              colors={d.paleta_cores}
              editing={editing}
              onChange={(v) => update("paleta_cores", v)}
            />
            {!editing && d.personalidade_marca && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3 font-semibold">
                  Resumo visual
                </p>
                <div className="relative w-full aspect-square max-w-[140px] mx-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {[40, 30, 20].map((r) => (
                      <polygon
                        key={r}
                        points={hexPoints(50, 50, r)}
                        fill="none"
                        stroke="#1e2348"
                        strokeWidth="0.5"
                      />
                    ))}
                    <polygon
                      points={hexPoints(50, 50, 32)}
                      fill="rgba(108,92,231,0.12)"
                      stroke="#6c5ce7"
                      strokeWidth="1"
                    />
                    <circle cx="50" cy="50" r="2" fill="#6c5ce7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Radar de Conteudo ───────────────────────────────────────── */}
      <SectionCard
        icon={<Target size={20} />}
        title="Radar de Conteudo"
        subtitle="Pilares, temas, formatos e hashtags"
        accentColor="#a29bfe"
        delay={2}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pilares */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Target size={14} className="text-accent-light" /> Pilares de
              Conteudo
            </h3>
            <TagEditor
              items={d.pilares_conteudo}
              editing={editing}
              onChange={(v) => update("pilares_conteudo", v)}
              placeholder="Novo pilar de conteudo..."
              variant="accent"
            />
          </div>

          {/* Temas */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Lightbulb size={14} className="text-warning" /> Temas
              Recomendados
            </h3>
            <TagEditor
              items={d.temas_recomendados}
              editing={editing}
              onChange={(v) => update("temas_recomendados", v)}
              placeholder="Novo tema..."
              variant="default"
            />
          </div>

          {/* Formatos */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <FileText size={14} className="text-info" /> Formatos
              Recomendados
            </h3>
            <TagEditor
              items={d.formatos_recomendados}
              editing={editing}
              onChange={(v) => update("formatos_recomendados", v)}
              placeholder="Novo formato..."
              variant="default"
            />

            {/* Frequencia */}
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                <Clock size={11} /> Frequencia ideal
              </p>
              <EditableText
                value={d.frequencia_ideal}
                editing={editing}
                onChange={(v) => update("frequencia_ideal", v)}
                placeholder="Ex: 5x por semana"
                rows={1}
              />
            </div>
          </div>

          {/* Hashtags */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Hash size={14} className="text-accent-light" /> Hashtags
              Recomendadas
            </h3>
            <TagEditor
              items={d.hashtags_recomendadas}
              editing={editing}
              onChange={(v) => update("hashtags_recomendadas", v)}
              placeholder="#novahashtag"
              variant="hash"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Guia de Comunicacao ─────────────────────────────────────── */}
      <SectionCard
        icon={<PenTool size={20} />}
        title="Guia de Comunicacao"
        subtitle="Vocabulario, estilo e exemplos de legenda"
        accentColor="#34d399"
        delay={3}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Palavras para usar */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-success" /> Palavras para
              Usar
            </h3>
            <TagEditor
              items={d.palavras_usar}
              editing={editing}
              onChange={(v) => update("palavras_usar", v)}
              placeholder="Nova palavra..."
              variant="success"
            />
          </div>

          {/* Palavras para evitar */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <AlertCircle size={14} className="text-danger" /> Palavras para
              Evitar
            </h3>
            <TagEditor
              items={d.palavras_evitar}
              editing={editing}
              onChange={(v) => update("palavras_evitar", v)}
              placeholder="Palavra a evitar..."
              variant="danger"
            />
          </div>
        </div>

        {/* Exemplos de legenda */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <MessageSquare size={14} className="text-accent-light" /> Exemplos
            de Legenda
          </h3>
          <LegendaEditor
            items={d.exemplos_legenda}
            editing={editing}
            onChange={(v) => update("exemplos_legenda", v)}
          />
        </div>
      </SectionCard>

      {/* ── Save / Cancel bar (only in edit mode) ─────────────────────── */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-4 z-30 flex items-center justify-end gap-3 p-4 bg-bg-card/90 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/30"
          >
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary bg-bg-elevated border border-border hover:bg-bg-input transition-all duration-200"
            >
              <RotateCcw size={14} />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-accent to-purple-500 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.02] transition-all duration-200"
            >
              <Save size={14} />
              Salvar alteracoes
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
