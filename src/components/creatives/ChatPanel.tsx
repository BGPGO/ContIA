"use client";

import { Library, Palette } from "lucide-react";
import { CreativeChatInterface } from "./CreativeChatInterface";
import type { QuickAction, QuickActionConfig } from "@/types/copy-studio";
import type { CreativeMessage, ModelKey, StreamingPhase, TokenTotals } from "@/hooks/useCreativeChat";
import type { MessageAttachment } from "@/lib/creatives/history";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface ChatPanelProps {
  messages: CreativeMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingPhase: StreamingPhase;
  totalCostUsd: number;
  totalTokens: TokenTotals;
  onSendMessage: (text: string) => void;
  model: ModelKey;
  onModelChange: (m: ModelKey) => void;
  useBrandKit: boolean;
  onUseBrandKitChange: (v: boolean) => void;
  pendingAttachments: MessageAttachment[];
  onAddAttachment: (file: File) => void;
  onRemoveAttachment: (url: string) => void;
  onOpenLibrary?: () => void;
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
  streamingPhase,
  totalCostUsd,
  totalTokens,
  onSendMessage,
  model,
  onModelChange,
  useBrandKit,
  onUseBrandKitChange,
  pendingAttachments,
  onAddAttachment,
  onRemoveAttachment,
  onOpenLibrary,
}: ChatPanelProps) {
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
        <div className="flex items-center gap-3">
          {onOpenLibrary && (
            <button
              type="button"
              onClick={onOpenLibrary}
              title="Abrir biblioteca de criativos"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              <Library className="w-3.5 h-3.5" />
              <span>Biblioteca</span>
            </button>
          )}
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

          {/* Cost tracker — mostra acumulado real após primeira resposta, preços esperados antes */}
          <div className="flex items-center gap-3 text-[10px]">
            {totalCostUsd > 0 ? (
              <>
                <span className="text-[#4ecdc4] font-mono">
                  ${totalCostUsd.toFixed(3)}
                </span>
                <span className="text-white/30">
                  {(totalTokens.input + totalTokens.output + totalTokens.cacheWrite + totalTokens.cacheRead).toLocaleString("pt-BR")} tokens
                </span>
              </>
            ) : (
              <span className="text-white/30 whitespace-nowrap">
                {useBrandKit ? "Identidade ativa · " : ""}Sonnet ~$0.06 · Opus ~$0.30 por criativo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chat interface (com paperclip e thumbnails integrados) */}
      <div className="flex-1 min-h-0">
        <CreativeChatInterface
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          streamingPhase={streamingPhase}
          onSendMessage={onSendMessage}
          onQuickAction={handleQuickAction}
          quickActions={CREATIVE_QUICK_ACTIONS}
          placeholder="Descreva o criativo que você quer…"
          pendingAttachments={pendingAttachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
        />
      </div>
    </div>
  );
}
