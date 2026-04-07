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
  X,
} from "lucide-react";
import type { ChatMessage, ChatAction, VideoCut } from "@/types/video";

interface ChatPanelProps {
  videoSummary: string;
  cuts: VideoCut[];
  onAcceptCut: (cut: VideoCut) => void;
  onAdjustCut: (index: number, changes: Partial<VideoCut>) => void;
  onToggleSubtitles: (enabled: boolean) => void;
  subtitlesEnabled: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

const quickSuggestions = [
  { label: "Sugerir cortes virais", icon: Scissors },
  { label: "Adicionar legendas", icon: Type },
  { label: "Adicionar logo", icon: Image },
  { label: "Alterar velocidade", icon: Gauge },
];

// Simulated AI responses
function getAIResponse(
  input: string,
  cuts: VideoCut[]
): { content: string; actions?: ChatAction[] } {
  const lower = input.toLowerCase();

  if (lower.includes("corte") || lower.includes("viral") || lower.includes("sugerir")) {
    return {
      content:
        "Analisei o video e identifiquei os melhores momentos para cortes virais. Cada corte foi selecionado com base no engajamento potencial, ritmo e gancho do conteudo.",
      actions: cuts.map((c, i) => ({
        type: "cut_suggestion" as const,
        label: c.title,
        data: {
          index: i,
          startTime: c.startTime,
          endTime: c.endTime,
          description: c.description,
        },
        status: c.accepted ? ("accepted" as const) : ("pending" as const),
      })),
    };
  }

  if (lower.includes("legenda") || lower.includes("subtitle")) {
    return {
      content:
        "As legendas foram geradas automaticamente a partir da transcricao do audio. Voce pode ativar/desativar abaixo.",
      actions: [
        {
          type: "subtitle_toggle",
          label: "Legendas",
          data: {},
          status: "pending",
        },
      ],
    };
  }

  if (lower.includes("logo")) {
    return {
      content:
        "Posso adicionar o logo da sua empresa no video. Escolha a posicao preferida no player. Por enquanto, use a configuracao na pagina de marca para definir seu logo.",
      actions: [
        {
          type: "logo_position",
          label: "Posicao do logo",
          data: { position: "bottom-right" },
          status: "pending",
        },
      ],
    };
  }

  if (lower.includes("velocidade") || lower.includes("speed")) {
    return {
      content:
        "Voce pode ajustar a velocidade diretamente no player (0.5x, 1x, 1.5x, 2x). Para cortes especificos, recomendo 1x para conteudo falado e 1.5x para transicoes.",
    };
  }

  if (lower.includes("exportar") || lower.includes("download")) {
    return {
      content:
        "A funcao de exportacao estara disponivel em breve! Por enquanto, voce pode pre-visualizar os cortes e definir os pontos exatos. Quando a exportacao estiver pronta, basta clicar em 'Exportar' em cada corte.",
    };
  }

  return {
    content:
      "Entendi! Posso ajudar com varias coisas: sugerir cortes virais, adicionar legendas, posicionar o logo, ou ajustar a velocidade. O que deseja fazer?",
  };
}

export function ChatPanel({
  videoSummary,
  cuts,
  onAcceptCut,
  onAdjustCut,
  onToggleSubtitles,
  subtitlesEnabled,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial AI message
  useEffect(() => {
    if (messages.length === 0 && videoSummary) {
      setMessages([
        {
          id: generateId(),
          role: "assistant",
          content: `${videoSummary}\n\nO que deseja fazer? Posso sugerir cortes virais, adicionar legendas ou ajudar com a edicao.`,
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
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      // Simulate AI thinking
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

      const response = getAIResponse(text, cuts);
      const aiMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: response.content,
        timestamp: new Date().toISOString(),
        actions: response.actions,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    },
    [cuts]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (label: string) => {
    sendMessage(label);
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-border overflow-hidden">
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
                      const idx = action.data.index as number;
                      if (cuts[idx]) onAcceptCut(cuts[idx]);
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card hover:bg-bg-card-hover border border-border text-[11px] text-text-secondary hover:text-text-primary whitespace-nowrap transition-all duration-200 shrink-0"
          >
            <s.icon className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 pb-3 pt-1"
      >
        <div className="flex items-center gap-2 bg-bg-input border border-border rounded-xl px-3 py-2 focus-within:border-accent/40 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Diga ao editor o que deseja..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
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
          <span className="text-[10px] text-text-muted font-mono">
            {formatT(startTime)} - {formatT(endTime)}
          </span>
        </div>
        <p className="text-[11px] text-text-secondary mb-2">{desc}</p>
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
