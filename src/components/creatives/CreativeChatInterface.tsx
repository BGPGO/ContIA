"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  CheckCircle2,
  Paperclip,
  X,
  Sparkles,
  MessageSquare,
  Palette,
  Image as ImageIcon,
  CreditCard,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import type { CreativeMessage, StreamingPhase } from "@/hooks/useCreativeChat";
import type { MessageAttachment } from "@/lib/creatives/history";
import type { QuickAction, QuickActionConfig } from "@/types/copy-studio";
import { QuickActions } from "@/components/studio/QuickActions";

// StreamingPhase é re-exportado do hook para consumidores que importem deste módulo
export type { StreamingPhase };

// ═══════════════════════════════════════════════════════════════════════
// PHASE INDICATOR
// ═══════════════════════════════════════════════════════════════════════

const PHASE_LABELS: Record<
  StreamingPhase,
  { label: string; icon: React.ReactNode }
> = {
  idle: { label: "", icon: null },
  thinking: {
    label: "Pensando…",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  writing: {
    label: "Escrevendo…",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  designing: {
    label: "Desenhando criativo…",
    icon: <Palette className="w-3.5 h-3.5" />,
  },
  rendering: {
    label: "Montando imagem…",
    icon: <ImageIcon className="w-3.5 h-3.5" />,
  },
};

function PhaseIndicator({ phase }: { phase: StreamingPhase }) {
  const { label, icon } = PHASE_LABELS[phase];
  if (!label) return null;
  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-2 px-4 py-3 text-xs text-white/60"
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4]"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      {icon}
      <span>{label}</span>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// EXTRAIR PROSA (sem HTML)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Divide o content do assistant em prosa + indicador de código.
 * A prosa é a frase explicativa ("Fiz com fundo preto..."), o HTML fica escondido.
 */
function extractProse(content: string): {
  prose: string;
  hasCode: boolean;
  code: string;
} {
  // Caso 1: bloco ```html ... ``` (padrão do output do Claude)
  const fenced = content.match(/```html\s*\n([\s\S]*?)(\n```|$)/i);
  if (fenced && typeof fenced.index === "number") {
    return {
      prose: content.slice(0, fenced.index).trim(),
      hasCode: true,
      code: (fenced[1] ?? "").trim(),
    };
  }
  // Caso 2: HTML inline sem fence (<!DOCTYPE ou <html)
  const bareStart = content.search(/<!DOCTYPE html>|<html/i);
  if (bareStart >= 0) {
    return {
      prose: content.slice(0, bareStart).trim(),
      hasCode: true,
      code: content.slice(bareStart).trim(),
    };
  }
  return { prose: content, hasCode: false, code: "" };
}

// ═══════════════════════════════════════════════════════════════════════
// ERROS ESPECIAIS (créditos, rate limit)
// ═══════════════════════════════════════════════════════════════════════

type SpecialErrorType = "credit_exhausted" | "rate_limited" | "overloaded";

/**
 * Detecta erros conhecidos da Anthropic API no content da mensagem assistant
 * pra renderizar card amigável em vez de stacktrace cru.
 */
function detectSpecialError(content: string): SpecialErrorType | null {
  const c = content.toLowerCase();
  if (
    c.includes("credit balance is too low") ||
    c.includes("créditos") ||
    c.includes("plans & billing") ||
    c.includes("insufficient credit")
  ) {
    return "credit_exhausted";
  }
  if (
    c.includes("rate_limit") ||
    c.includes("rate limit") ||
    c.includes("too many requests") ||
    c.includes("429")
  ) {
    return "rate_limited";
  }
  if (
    c.includes("overloaded") ||
    c.includes("api is temporarily") ||
    c.includes("529")
  ) {
    return "overloaded";
  }
  return null;
}

const ERROR_CONFIG: Record<
  SpecialErrorType,
  {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: { label: string; href: string };
    palette: { border: string; bg: string; iconColor: string; accent: string };
  }
> = {
  credit_exhausted: {
    icon: <CreditCard className="w-8 h-8" />,
    title: "Créditos esgotados",
    description:
      "O saldo de créditos da Anthropic chegou a zero. Pra continuar gerando criativos, adicione créditos no painel da Anthropic — leva menos de 1 minuto.",
    action: {
      label: "Adicionar créditos na Anthropic",
      href: "https://console.anthropic.com/settings/billing",
    },
    palette: {
      border: "border-amber-500/30",
      bg: "from-amber-500/10 via-amber-500/5 to-transparent",
      iconColor: "text-amber-400",
      accent: "bg-amber-500 hover:bg-amber-600 text-black",
    },
  },
  rate_limited: {
    icon: <AlertTriangle className="w-8 h-8" />,
    title: "Muitos pedidos ao mesmo tempo",
    description:
      "A API da Anthropic limitou temporariamente os pedidos. Espera uns segundos e manda de novo.",
    palette: {
      border: "border-sky-500/30",
      bg: "from-sky-500/10 via-sky-500/5 to-transparent",
      iconColor: "text-sky-400",
      accent: "bg-sky-500 hover:bg-sky-600 text-black",
    },
  },
  overloaded: {
    icon: <AlertTriangle className="w-8 h-8" />,
    title: "API sobrecarregada",
    description:
      "A Anthropic está com pico de demanda agora. Tenta de novo em um minuto — costuma passar rápido.",
    palette: {
      border: "border-violet-500/30",
      bg: "from-violet-500/10 via-violet-500/5 to-transparent",
      iconColor: "text-violet-400",
      accent: "bg-violet-500 hover:bg-violet-600 text-white",
    },
  },
};

function SpecialErrorCard({ type }: { type: SpecialErrorType }) {
  const config = ERROR_CONFIG[type];
  return (
    <div className="max-w-[90%] w-full">
      <div
        className={`relative overflow-hidden rounded-2xl border ${config.palette.border} bg-gradient-to-br ${config.palette.bg} px-5 py-4`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`shrink-0 ${config.palette.iconColor} mt-0.5`}
            aria-hidden
          >
            {config.icon}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="text-[15px] font-semibold text-white leading-tight">
              {config.title}
            </h3>
            <p className="text-[13px] text-white/70 leading-relaxed">
              {config.description}
            </p>
            {config.action && (
              <a
                href={config.action.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 mt-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${config.palette.accent}`}
              >
                {config.action.label}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════

interface MessageBubbleProps {
  message: CreativeMessage;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex justify-end"
      >
        <div className="max-w-[85%]">
          {/* Thumbnails de anexos acima do conteúdo */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2 justify-end">
              {message.attachments.map((a, i) => (
                <img
                  key={i}
                  src={a.url}
                  alt={a.name || "anexo"}
                  className="w-20 h-20 rounded-md object-cover border border-white/10"
                />
              ))}
            </div>
          )}
          <div
            className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line
            bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/20"
          >
            {message.content}
          </div>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  const { prose, hasCode, code } = extractProse(message.content);
  const cost = typeof message.cost === "number" ? message.cost : 0;

  // Detecta erros especiais (créditos, rate limit, etc) pra renderizar card bonito
  const specialError = detectSpecialError(message.content);
  if (specialError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex justify-start"
      >
        <SpecialErrorCard type={specialError} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] space-y-1.5">
        <div className="bg-[#141736] text-[#e8eaff] border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
          {prose || (hasCode ? "Desenhando criativo…" : "")}
          {isStreaming && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-0.5 h-4 bg-[#4ecdc4] ml-0.5 align-middle"
            />
          )}

          {/* Barra de progresso animada enquanto o Claude desenha o HTML */}
          {isStreaming && hasCode && (
            <div className="mt-3 h-1 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#4ecdc4] to-[#6c5ce7]"
                initial={{ width: "15%" }}
                animate={{ width: ["15%", "85%", "15%"] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          )}

          {/* HTML colapsável — só depois do streaming terminar */}
          {!isStreaming && hasCode && code.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] text-white/40 hover:text-white/70 select-none list-none flex items-center gap-1 transition-colors">
                <svg
                  className="w-3 h-3 transition-transform group-open:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Ver HTML gerado ({code.length.toLocaleString("pt-BR")} caracteres)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto text-[10px] font-mono text-white/50 bg-black/30 rounded-md p-2 whitespace-pre-wrap break-all">
                {code}
              </pre>
            </details>
          )}
        </div>

        {/* Badge de custo — aparece apenas quando cost está disponível */}
        {cost > 0 && (
          <div className="mt-1 text-[10px] text-white/30 font-mono">
            ~${cost.toFixed(3)}
          </div>
        )}

        {/* Badge "copy atualizada" opcional para compatibilidade futura */}
        {Boolean((message as { copy_snapshot?: unknown }).copy_snapshot) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium w-fit"
          >
            <CheckCircle2 size={12} />
            Criativo atualizado
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════════

interface CreativeChatInterfaceProps {
  messages: CreativeMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingPhase: StreamingPhase;
  onSendMessage: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  quickActions?: QuickActionConfig[];
  onQuickAction?: (action: QuickAction) => void;
  // Anexos integrados no input
  pendingAttachments: MessageAttachment[];
  onAddAttachment: (file: File) => void;
  onRemoveAttachment: (url: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function CreativeChatInterface({
  messages,
  isStreaming,
  streamingText,
  streamingPhase,
  onSendMessage,
  placeholder = "Descreva o criativo que você quer…",
  disabled = false,
  quickActions = [],
  onQuickAction,
  pendingAttachments,
  onAddAttachment,
  onRemoveAttachment,
}: CreativeChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll ao atualizar mensagens ou streaming
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, streamingText]);

  // Send handler
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming || disabled) return;
    onSendMessage(text);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, isStreaming, disabled, onSendMessage]);

  // Keyboard: Enter envia, Shift+Enter quebra linha
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // File picker
  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remainingSlots = 3 - pendingAttachments.length;
    const toUpload = Array.from(files).slice(0, remainingSlots);
    for (const f of toUpload) onAddAttachment(f);
    e.target.value = "";
  };

  // Streaming partial message renderizado como bubble
  const streamingMessage: CreativeMessage | null =
    isStreaming && streamingText
      ? {
          id: "__streaming__",
          role: "assistant",
          content: streamingText,
          createdAt: new Date().toISOString(),
        }
      : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Lista de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {/* Mensagem parcial durante streaming */}
        {streamingMessage && (
          <MessageBubble message={streamingMessage} isStreaming />
        )}

        {/* Phase indicator — aparece quando está streamando sem texto ainda,
            ou junto com o texto dependendo da fase */}
        <AnimatePresence mode="wait">
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex justify-start"
            >
              <div className="bg-[#141736] border border-white/5 rounded-2xl rounded-bl-md">
                <PhaseIndicator phase={streamingPhase} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Quick actions */}
      {quickActions.length > 0 && onQuickAction && (
        <div className="shrink-0 px-4 pt-2">
          <QuickActions
            actions={quickActions}
            onAction={onQuickAction}
            disabled={isStreaming || disabled}
          />
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 px-3 py-3 border-t border-border">
        {/* Linha de anexos pendentes */}
        {pendingAttachments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-2 pb-2 border-b border-white/5">
            {pendingAttachments.map((a) => (
              <div key={a.url} className="relative group shrink-0">
                <img
                  src={a.url}
                  alt={a.name || "anexo"}
                  className="w-14 h-14 rounded-md object-cover border border-white/10"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.url)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/90 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black cursor-pointer transition-all"
                  title="Remover"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Paperclip à esquerda */}
          <button
            type="button"
            onClick={handleOpenFilePicker}
            disabled={
              pendingAttachments.length >= 3 || isStreaming || disabled
            }
            title={
              pendingAttachments.length >= 3
                ? "Máximo de 3 imagens"
                : "Anexar imagem (PNG, JPG, WEBP, máx 5MB)"
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0 mb-0.5"
          >
            <Paperclip size={16} />
          </button>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || disabled}
              placeholder={placeholder}
              rows={1}
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary
                placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50
                transition-colors resize-none disabled:opacity-50"
              style={{ maxHeight: 120 }}
            />
          </div>

          {/* Botão Send à direita */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isStreaming || disabled || !inputValue.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer
              disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mb-0.5 text-white"
            style={{
              background:
                !isStreaming && !disabled && inputValue.trim()
                  ? "linear-gradient(135deg, #6c5ce7 0%, #4ecdc4 100%)"
                  : "rgba(255,255,255,0.06)",
            }}
          >
            <Send size={16} />
          </button>

          {/* Input oculto para seleção de arquivos */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}
