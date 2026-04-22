"use client";

import { Palette } from "lucide-react";
import { ChatInterface } from "@/components/studio/ChatInterface";
import type { CopyChatMessage, QuickAction, QuickActionConfig } from "@/types/copy-studio";
import type { CreativeMessage, ModelKey } from "@/hooks/useCreativeChat";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface ChatPanelProps {
  messages: CreativeMessage[];
  isStreaming: boolean;
  streamingText: string;
  onSendMessage: (text: string) => void;
  model: ModelKey;
  onModelChange: (m: ModelKey) => void;
  useBrandKit: boolean;
  onUseBrandKitChange: (v: boolean) => void;
}

// ═══════════════════════════════════════════════════════════════════════
// Quick actions para criativos
// ═══════════════════════════════════════════════════════════════════════

const CREATIVE_QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: "gancho_forte" as QuickAction,
    label: "Post financeiro sobre clareza",
    icon: "Zap",
    prompt: "Post financeiro sobre clareza",
  },
  {
    id: "encurtar" as QuickAction,
    label: "Reflexão editorial com frase de pensador",
    icon: "Palette",
    prompt: "Reflexão editorial com frase de pensador",
  },
  {
    id: "reformular" as QuickAction,
    label: "Anúncio viral brutalista",
    icon: "RefreshCw",
    prompt: "Anúncio viral brutalista",
  },
  {
    id: "trocar_tom" as QuickAction,
    label: "Minimalista tech com whitespace",
    icon: "Minimize2",
    prompt: "Minimalista tech com whitespace",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function ChatPanel({
  messages,
  isStreaming,
  streamingText,
  onSendMessage,
  model,
  onModelChange,
  useBrandKit,
  onUseBrandKitChange,
}: ChatPanelProps) {
  // Adapta CreativeMessage[] para CopyChatMessage[]
  const adaptedMessages: CopyChatMessage[] = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.createdAt ?? new Date().toISOString(),
  }));

  // Handler de quick action: recebe o QuickAction id, mas usa o prompt mapeado
  const handleQuickAction = (actionId: QuickAction) => {
    const action = CREATIVE_QUICK_ACTIONS.find((a) => a.id === actionId);
    if (action) {
      onSendMessage(action.prompt);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-serif text-white leading-tight">Criativos IA</h1>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Brand kit toggle */}
            <button
              type="button"
              onClick={() => onUseBrandKitChange(!useBrandKit)}
              title={
                useBrandKit
                  ? "Usando cores, fonte e logo da marca"
                  : "Ativar cores, fonte e logo da marca"
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                useBrandKit
                  ? "bg-[#ec4899] text-black border-[#ec4899]"
                  : "bg-transparent text-white/60 border-white/10 hover:text-white/80 hover:border-white/20"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Identidade</span>
            </button>

            {/* Model toggle */}
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => onModelChange("sonnet")}
                className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  model === "sonnet"
                    ? "bg-[#4ecdc4] text-black"
                    : "bg-transparent text-white/60 hover:text-white/80"
                }`}
              >
                Sonnet
              </button>
              <button
                type="button"
                onClick={() => onModelChange("opus")}
                className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  model === "opus"
                    ? "bg-[#4ecdc4] text-black"
                    : "bg-transparent text-white/60 hover:text-white/80"
                }`}
              >
                Opus
              </button>
            </div>
          </div>
          {/* Cost label */}
          <span className="text-[10px] text-white/30 whitespace-nowrap">
            {useBrandKit ? "Identidade ativa · " : ""}Sonnet ~$0.06 · Opus ~$0.30 por criativo
          </span>
        </div>
      </div>

      {/* Chat interface */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          messages={adaptedMessages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          onSendMessage={onSendMessage}
          onQuickAction={handleQuickAction}
          quickActions={CREATIVE_QUICK_ACTIONS}
          placeholder="Descreva o criativo que você quer…"
        />
      </div>
    </div>
  );
}
