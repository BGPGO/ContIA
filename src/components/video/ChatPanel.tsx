"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Bot,
  User,
  Scissors,
  Type,
  Image,
  Gauge,
  Check,
  Palette,
  Loader2,
} from "lucide-react";
import type { ChatMessage, ChatAction, VideoCut, SubtitleStyle, TranscriptionSegment } from "@/types/video";

interface ChatPanelProps {
  videoSummary: string;
  transcription?: TranscriptionSegment[];
  cuts: VideoCut[];
  subtitleStyle?: SubtitleStyle;
  onAcceptCut: (cut: VideoCut) => void;
  onAdjustCut: (index: number, changes: Partial<VideoCut>) => void;
  onToggleSubtitles: (enabled: boolean) => void;
  onUpdateSubtitleStyle?: (style: Partial<SubtitleStyle>) => void;
  subtitlesEnabled: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

const quickSuggestions = [
  { label: "Sugerir cortes virais", icon: Scissors },
  { label: "Adicionar legendas", icon: Type },
  { label: "Adicionar logo", icon: Image },
  { label: "Estilo viral na legenda", icon: Palette },
  { label: "Alterar velocidade", icon: Gauge },
];

export function ChatPanel({
  videoSummary,
  transcription = [],
  cuts,
  subtitleStyle,
  onAcceptCut,
  onAdjustCut,
  onToggleSubtitles,
  onUpdateSubtitleStyle,
  subtitlesEnabled,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build transcription text for context
  const transcriptionText = transcription
    .map((s) => {
      const m = Math.floor(s.start / 60);
      const sec = Math.floor(s.start % 60);
      return `[${m}:${sec.toString().padStart(2, "0")}] ${s.text}`;
    })
    .join("\n");

  // Initial AI message
  useEffect(() => {
    if (messages.length === 0 && videoSummary) {
      setMessages([
        {
          id: generateId(),
          role: "assistant",
          content: `${videoSummary}\n\nO que deseja fazer? Posso sugerir cortes virais, adicionar legendas, mudar o estilo ou ajudar com a edicao.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [videoSummary, messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      try {
        // Build history for API (just role + content)
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/video/chat-simple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            transcription: transcriptionText,
            videoSummary,
            subtitleConfig: subtitleStyle,
            history,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ${res.status}`);
        }

        const data = await res.json();

        // Convert API action to ChatAction format for display
        const actions: ChatAction[] = [];
        if (data.action) {
          const actionType = data.action.type;
          if (actionType === "SUGGEST_CUTS" && data.action.payload?.suggestions) {
            for (const sug of data.action.payload.suggestions) {
              actions.push({
                type: "cut_suggestion",
                label: sug.label || `Corte ${sug.start}s - ${sug.end}s`,
                data: {
                  startTime: sug.start,
                  endTime: sug.end,
                  description: sug.reason || sug.label || "",
                },
                status: "pending",
              });
            }
          } else if (actionType === "ADD_CUT" && data.action.payload) {
            actions.push({
              type: "cut_suggestion",
              label: data.action.payload.label || "Novo corte",
              data: {
                startTime: data.action.payload.start,
                endTime: data.action.payload.end,
                description: data.action.payload.label || "",
              },
              status: "pending",
            });
          } else if (actionType === "ADD_SUBTITLES") {
            actions.push({
              type: "subtitle_toggle",
              label: "Legendas",
              data: {},
              status: "pending",
            });
            onToggleSubtitles(true);
          } else if (actionType === "REMOVE_SUBTITLES") {
            onToggleSubtitles(false);
          } else if (actionType === "UPDATE_SUBTITLE_STYLE" && data.action.payload) {
            // Apply subtitle style update
            if (onUpdateSubtitleStyle) {
              onUpdateSubtitleStyle(data.action.payload);
            }
            actions.push({
              type: "subtitle_toggle",
              label: "Estilo da legenda atualizado",
              data: { styleUpdate: data.action.payload },
              status: "accepted",
            });
          } else if (actionType === "ADD_LOGO") {
            actions.push({
              type: "logo_position",
              label: "Posicao do logo",
              data: { position: data.action.payload?.position || "bottom-right" },
              status: "pending",
            });
          }
        }

        const aiMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
          actions: actions.length > 0 ? actions : undefined,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Erro desconhecido";
        const aiMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `Desculpe, ocorreu um erro: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [messages, isTyping, transcriptionText, videoSummary, subtitleStyle, onToggleSubtitles, onUpdateSubtitleStyle]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (label: string) => {
    sendMessage(label);
  };

  return (
    <div className="flex flex-col h-full max-h-[500px] lg:max-h-none bg-bg-secondary rounded-b-xl border border-t-0 border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Editor IA</p>
          <p className="text-[10px] text-text-muted">Assistente de video</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Online
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-2.5 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "assistant"
                    ? "bg-secondary/20"
                    : "bg-accent/20"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="w-3.5 h-3.5 text-secondary-light" />
                ) : (
                  <User className="w-3.5 h-3.5 text-accent-light" />
                )}
              </div>
              <div
                className={`max-w-[85%] space-y-2 ${
                  msg.role === "user" ? "text-right" : ""
                }`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                    msg.role === "assistant"
                      ? "bg-bg-card text-text-primary rounded-tl-sm"
                      : "bg-accent/15 text-text-primary rounded-tr-sm"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Action cards */}
                {msg.actions?.map((action, i) => (
                  <ActionCard
                    key={i}
                    action={action}
                    onAcceptCut={() => {
                      const startTime = action.data.startTime as number;
                      const endTime = action.data.endTime as number;
                      const desc = action.data.description as string;
                      if (startTime !== undefined && endTime !== undefined) {
                        onAcceptCut({
                          id: generateId(),
                          title: action.label,
                          startTime,
                          endTime,
                          description: desc || action.label,
                          accepted: true,
                        });
                      }
                    }}
                    onToggleSubtitles={onToggleSubtitles}
                    subtitlesEnabled={subtitlesEnabled}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-secondary-light" />
            </div>
            <div className="flex gap-1 px-3 py-2.5 bg-bg-card rounded-xl rounded-tl-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick suggestions */}
      <div className="px-3 py-2 flex gap-2 overflow-x-auto border-t border-border/50">
        {quickSuggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => handleQuickAction(s.label)}
            disabled={isTyping}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card hover:bg-bg-card-hover border border-border text-[11px] text-text-secondary hover:text-text-primary whitespace-nowrap transition-all duration-200 shrink-0 disabled:opacity-40"
          >
            <s.icon className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 bg-bg-input border border-border rounded-xl px-3 py-2 focus-within:border-accent/40 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Diga ao editor o que deseja..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Action Card ── */

function ActionCard({
  action,
  onAcceptCut,
  onToggleSubtitles,
  subtitlesEnabled,
}: {
  action: ChatAction;
  onAcceptCut: () => void;
  onToggleSubtitles: (v: boolean) => void;
  subtitlesEnabled: boolean;
}) {
  if (action.type === "cut_suggestion") {
    const startTime = action.data.startTime as number;
    const endTime = action.data.endTime as number;
    const desc = action.data.description as string;
    const formatT = (s: number) =>
      `${Math.floor(s / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(s % 60)
        .toString()
        .padStart(2, "0")}`;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-card border border-border rounded-lg p-3 text-left"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-secondary-light" />
            <span className="text-[12px] font-medium text-text-primary">
              {action.label}
            </span>
          </div>
          {startTime !== undefined && endTime !== undefined && (
            <span className="text-[10px] text-text-muted font-mono">
              {formatT(startTime)} - {formatT(endTime)}
            </span>
          )}
        </div>
        {desc && <p className="text-[11px] text-text-secondary mb-2">{desc}</p>}
        <div className="flex gap-2">
          <button
            onClick={onAcceptCut}
            disabled={action.status === "accepted"}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              action.status === "accepted"
                ? "bg-success/20 text-success cursor-default"
                : "bg-accent/15 text-accent hover:bg-accent/25"
            }`}
          >
            <Check className="w-3 h-3" />
            {action.status === "accepted" ? "Aceito" : "Aceitar"}
          </button>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-bg-card-hover text-[11px] text-text-secondary hover:text-text-primary transition-all">
            Ajustar
          </button>
        </div>
      </motion.div>
    );
  }

  if (action.type === "subtitle_toggle") {
    // If it's a style update action, show as confirmed
    if (action.data.styleUpdate) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-bg-card border border-border rounded-lg p-3 text-left"
        >
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-accent" />
            <span className="text-[12px] font-medium text-text-primary">
              {action.label}
            </span>
            <Check className="w-3 h-3 text-success ml-auto" />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-card border border-border rounded-lg p-3 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-accent" />
            <span className="text-[12px] font-medium text-text-primary">
              Legendas automaticas
            </span>
          </div>
          <button
            onClick={() => onToggleSubtitles(!subtitlesEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              subtitlesEnabled ? "bg-accent" : "bg-bg-card-hover"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                subtitlesEnabled ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </motion.div>
    );
  }

  if (action.type === "logo_position") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-card border border-border rounded-lg p-3 text-left"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Image className="w-3.5 h-3.5 text-secondary-light" />
          <span className="text-[12px] font-medium text-text-primary">
            Posicao do logo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {["top-left", "top-right", "bottom-left", "bottom-right"].map(
            (pos) => (
              <button
                key={pos}
                className="px-2 py-1.5 rounded-md bg-bg-card-hover text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all capitalize"
              >
                {pos.replace("-", " ")}
              </button>
            )
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}
