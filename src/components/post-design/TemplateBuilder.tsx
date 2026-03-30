"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Save,
  Send,
  Camera,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Eye,
  Trash2,
  RectangleHorizontal,
  Square,
  Smartphone,
  SlidersHorizontal,
} from "lucide-react";
import type {
  TemplateStyleConfig,
  CustomTemplate,
} from "@/types/custom-template";
import { DEFAULT_STYLE_CONFIG } from "@/types/custom-template";
import { CustomCanvas } from "./CustomCanvas";
import type { PostDesignData } from "./PostCanvas";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface TemplateBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: CustomTemplate) => void;
  editTemplate?: CustomTemplate | null;
  empresaId: string;
  empresaNome: string;
  brandColor?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
  timestamp: Date;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const SAMPLE_DATA: PostDesignData = {
  headline: "Seu negocio fatura bem e ainda assim falta dinheiro?",
  subheadline: "O problema quase nunca e o lucro.",
  accentText: "GESTAO FINANCEIRA",
  brandName: "",
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Ola! Descreva como voce quer o template do seu post. Voce pode:\n\n\u2022 Explicar o estilo (\"dark, editorial, minimalista\")\n\u2022 Subir uma imagem de referencia\n\u2022 Pedir ajustes (\"mais escuro\", \"adiciona chevron\")\n\nVou criando e voce vai refinando!",
  timestamp: new Date(),
};

const BG_PRESETS: {
  label: string;
  value: Partial<TemplateStyleConfig["background"]>;
}[] = [
  { label: "Dark Navy", value: { type: "solid", color: "#0c0f24" } },
  {
    label: "Dark Warm",
    value: {
      type: "gradient",
      gradientFrom: "#151826",
      gradientTo: "#1a1e2e",
      gradientAngle: 160,
    },
  },
  { label: "White Clean", value: { type: "solid", color: "#ffffff" } },
  {
    label: "Gradient Accent",
    value: {
      type: "gradient",
      gradientFrom: "#6c5ce7",
      gradientTo: "#4ecdc4",
      gradientAngle: 135,
    },
  },
];

const ASPECT_RATIOS = [
  { label: "1:1", value: "1:1" as const, icon: Square },
  { label: "4:5", value: "4:5" as const, icon: RectangleHorizontal },
  { label: "9:16", value: "9:16" as const, icon: Smartphone },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Small reusable sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function MiniColorPicker({
  value,
  onChange,
  presets,
}: {
  value: string;
  onChange: (c: string) => void;
  presets?: string[];
}) {
  const defaultPresets = [
    "#f0f0f5",
    "#1a1a2e",
    "#4ecdc4",
    "#6c5ce7",
    "#e11d48",
    "#f59e0b",
  ];
  const colors = presets || defaultPresets;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 cursor-pointer ${
            value === c
              ? "border-white/60 scale-110 shadow-lg"
              : "border-transparent hover:border-white/20"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-border"
        />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-accent/60"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-xs text-text-muted ml-2">Gerando template...</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function TemplateBuilder({
  open,
  onClose,
  onSave,
  editTemplate,
  empresaId,
  empresaNome,
  brandColor = "#4ecdc4",
}: TemplateBuilderProps) {
  /* ── Core State ── */
  const [name, setName] = useState("");
  const [style, setStyle] = useState<TemplateStyleConfig>(
    structuredClone(DEFAULT_STYLE_CONFIG)
  );
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16">(
    "1:1"
  );

  /* ── Chat State ── */
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);

  /* ── Refs ── */
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Initialize on open / editTemplate change ── */
  useEffect(() => {
    if (!open) return;
    if (editTemplate) {
      setName(editTemplate.name);
      setStyle(structuredClone(editTemplate.style));
      setMessages([
        INITIAL_MESSAGE,
        {
          id: "edit-context",
          role: "system",
          content: `Editando template "${editTemplate.name}". Configuracao carregada.`,
          timestamp: new Date(),
        },
      ]);
    } else {
      setName("");
      setStyle(structuredClone(DEFAULT_STYLE_CONFIG));
      setMessages([INITIAL_MESSAGE]);
    }
    setInputValue("");
    setPendingImages([]);
    setIsGenerating(false);
    setManualOpen(false);
  }, [open, editTemplate]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  /* ── Deep updaters ── */
  const updateBg = useCallback(
    (patch: Partial<TemplateStyleConfig["background"]>) =>
      setStyle((s) => ({ ...s, background: { ...s.background, ...patch } })),
    []
  );
  const updateDeco = useCallback(
    (patch: Partial<TemplateStyleConfig["decorations"]>) =>
      setStyle((s) => ({
        ...s,
        decorations: { ...s.decorations, ...patch },
      })),
    []
  );

  /* ── Image upload ── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 3 - pendingImages.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImages((prev) =>
          [...prev, reader.result as string].slice(0, 3)
        );
      };
      reader.readAsDataURL(file);
    });
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Send message ── */
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text && pendingImages.length === 0) return;
    if (isGenerating) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setPendingImages([]);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentConfig: style,
          referenceImages: userMessage.images || [],
          context: {
            brandName: empresaNome,
            brandColor,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}`);
      }

      const data = await res.json();

      if (data.config) {
        setStyle(data.config);
      }

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          data.explanation ||
          "Pronto! Ajustei o template conforme pedido. Veja o preview ao lado.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Desculpe, houve um erro ao gerar o template. Tente novamente ou use os controles manuais abaixo.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Keyboard handler ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Auto-resize textarea ── */
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  /* ── Save handler ── */
  const handleSave = () => {
    const now = new Date().toISOString();
    const chatLog = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");

    const template: CustomTemplate = {
      id: editTemplate?.id ?? crypto.randomUUID(),
      empresa_id: empresaId,
      name: name.trim() || "Template sem nome",
      description: chatLog,
      style,
      aiPrompt: chatLog,
      created_at: editTemplate?.created_at ?? now,
      updated_at: now,
    };
    onSave(template);
  };

  /* ── Sample preview data ── */
  const previewData: PostDesignData = {
    ...SAMPLE_DATA,
    brandName: empresaNome,
    brandColor,
  };

  /* ── Render ── */
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-[1100px] h-[92vh] md:h-[88vh] bg-bg-secondary border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            initial={{ scale: 0.93, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10">
                  <Sparkles size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">
                    {editTemplate ? "Editar Template" : "Criar Template"}
                  </h2>
                  <p className="text-[11px] text-text-muted">
                    Converse com a IA para criar seu design
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Body: 2-column layout ── */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* ═══ LEFT: Chat Interface (60%) ═══ */}
              <div className="flex-[3] flex flex-col min-w-0 border-r border-border">
                {/* Template name input */}
                <div className="px-4 py-3 border-b border-border/50 shrink-0">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do template (ex: Editorial Dark Premium)"
                    className="w-full bg-transparent text-sm font-semibold text-text-primary placeholder:text-text-muted/40 focus:outline-none"
                  />
                </div>

                {/* Chat messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`flex ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role === "system" ? (
                          /* System message */
                          <div className="w-full flex justify-center">
                            <span className="text-[11px] text-text-muted/60 bg-bg-card/30 px-3 py-1 rounded-full">
                              {msg.content}
                            </span>
                          </div>
                        ) : msg.role === "user" ? (
                          /* User message */
                          <div className="max-w-[85%] space-y-2">
                            {msg.images && msg.images.length > 0 && (
                              <div className="flex gap-2 justify-end">
                                {msg.images.map((img, i) => (
                                  <div
                                    key={i}
                                    className="w-16 h-16 rounded-lg overflow-hidden border border-border/50"
                                  >
                                    <img
                                      src={img}
                                      alt={`Referencia ${i + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            {msg.content && (
                              <div
                                className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white leading-relaxed"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
                                }}
                              >
                                {msg.content}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Assistant message */
                          <div className="max-w-[85%]">
                            <div className="bg-bg-card border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-text-primary leading-relaxed whitespace-pre-line">
                              {msg.content}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="bg-bg-card border border-border/50 rounded-2xl rounded-bl-md">
                        <TypingIndicator />
                      </div>
                    </motion.div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Pending images preview */}
                <AnimatePresence>
                  {pendingImages.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border/30 px-4"
                    >
                      <div className="flex gap-2 py-2">
                        {pendingImages.map((img, i) => (
                          <div key={i} className="relative group">
                            <div className="w-14 h-14 rounded-lg overflow-hidden border border-border/50">
                              <img
                                src={img}
                                alt={`Upload ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingImage(i)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <X size={10} className="text-white" />
                            </button>
                          </div>
                        ))}
                        {pendingImages.length < 3 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-14 h-14 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center text-text-muted hover:border-accent/30 hover:text-accent transition-colors cursor-pointer"
                          >
                            <Camera size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message input bar */}
                <div className="shrink-0 border-t border-border px-3 py-3">
                  <div className="flex items-end gap-2">
                    {/* Image upload button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating || pendingImages.length >= 3}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mb-0.5"
                      title="Subir imagem de referencia"
                    >
                      <Camera size={18} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {/* Text input */}
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleTextareaInput}
                        onKeyDown={handleKeyDown}
                        disabled={isGenerating}
                        placeholder="Descreva o que voce quer..."
                        rows={1}
                        className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none disabled:opacity-50 pr-2"
                        style={{ maxHeight: 120 }}
                      />
                    </div>

                    {/* Send button */}
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={
                        isGenerating ||
                        (!inputValue.trim() && pendingImages.length === 0)
                      }
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mb-0.5 text-white"
                      style={{
                        background:
                          !isGenerating &&
                          (inputValue.trim() || pendingImages.length > 0)
                            ? "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)"
                            : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>

                {/* ── Ajuste manual (collapsed) ── */}
                <div className="shrink-0 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setManualOpen(!manualOpen)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-bg-card-hover/30 transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal
                      size={14}
                      className="text-text-muted"
                    />
                    <span className="text-xs font-medium text-text-muted flex-1">
                      Ajuste manual
                    </span>
                    {manualOpen ? (
                      <ChevronDown size={14} className="text-text-muted" />
                    ) : (
                      <ChevronRight size={14} className="text-text-muted" />
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {manualOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-5 max-h-[260px] overflow-y-auto">
                          {/* Background presets */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                              Background
                            </span>
                            <div className="grid grid-cols-4 gap-2">
                              {BG_PRESETS.map((preset) => {
                                const bg =
                                  preset.value.type === "gradient"
                                    ? `linear-gradient(135deg, ${preset.value.gradientFrom}, ${preset.value.gradientTo})`
                                    : preset.value.color ?? "#0c0f24";

                                return (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => updateBg(preset.value)}
                                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border hover:border-accent/30 transition-all cursor-pointer group"
                                  >
                                    <div
                                      className="w-full aspect-square rounded-md border border-border-subtle"
                                      style={{ background: bg }}
                                    />
                                    <span className="text-[10px] text-text-muted group-hover:text-text-secondary truncate w-full text-center">
                                      {preset.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Quick toggles */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                              Elementos
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                              <Toggle
                                label="Chevron >>"
                                checked={style.decorations.chevronBefore}
                                onChange={(v) =>
                                  updateDeco({ chevronBefore: v })
                                }
                              />
                              <Toggle
                                label="Textura noise"
                                checked={style.decorations.noiseTexture}
                                onChange={(v) =>
                                  updateDeco({ noiseTexture: v })
                                }
                              />
                              <Toggle
                                label="Faixa diagonal"
                                checked={style.decorations.diagonalStripe}
                                onChange={(v) =>
                                  updateDeco({ diagonalStripe: v })
                                }
                              />
                              <Toggle
                                label="Linhas nos cantos"
                                checked={style.decorations.cornerAccents}
                                onChange={(v) =>
                                  updateDeco({ cornerAccents: v })
                                }
                              />
                            </div>
                          </div>

                          {/* Accent color */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                              Cor de destaque
                            </span>
                            <MiniColorPicker
                              value={style.decorations.accentBarColor}
                              onChange={(c) =>
                                updateDeco({ accentBarColor: c })
                              }
                              presets={[
                                "#4ecdc4",
                                "#6c5ce7",
                                "#e11d48",
                                "#f59e0b",
                                "#22c55e",
                                brandColor,
                              ]}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ═══ RIGHT: Live Preview (40%) ═══ */}
              <div className="flex-[2] flex flex-col bg-bg-primary/30 min-w-0">
                {/* Preview header */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50 shrink-0">
                  <Eye size={14} className="text-accent/70" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex-1">
                    Preview
                  </span>
                </div>

                {/* Canvas area */}
                <div className="flex-1 flex items-center justify-center p-5 overflow-hidden">
                  <motion.div
                    layout
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex items-center justify-center"
                  >
                    <div
                      className="rounded-xl overflow-hidden border border-border shadow-lg"
                      style={{
                        transform: `scale(${aspectRatio === "9:16" ? 0.42 : aspectRatio === "4:5" ? 0.6 : 0.65})`,
                        transformOrigin: "center center",
                      }}
                    >
                      <CustomCanvas
                        style={style}
                        data={previewData}
                        aspectRatio={aspectRatio}
                      />
                    </div>
                  </motion.div>
                </div>

                {/* Aspect ratio picker */}
                <div className="flex items-center justify-center gap-2 px-5 py-2 shrink-0">
                  {ASPECT_RATIOS.map((ar) => {
                    const Icon = ar.icon;
                    return (
                      <button
                        key={ar.value}
                        type="button"
                        onClick={() => setAspectRatio(ar.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          aspectRatio === ar.value
                            ? "bg-accent/15 text-accent-light border border-accent/30"
                            : "bg-bg-input text-text-muted border border-border hover:border-border-light hover:text-text-secondary"
                        }`}
                      >
                        <Icon size={12} />
                        {ar.label}
                      </button>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-text-secondary border border-border hover:bg-bg-card hover:text-text-primary transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
                    style={{
                      background:
                        "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Save size={14} />
                      {editTemplate ? "Salvar alteracoes" : "Criar template"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
