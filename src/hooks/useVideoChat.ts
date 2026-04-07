"use client";

import { useState, useCallback, useRef } from "react";
import { AgentAction, VideoEdits } from "@/lib/video/video-agent";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface VideoChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: AgentAction;
  timestamp: string;
}

interface ChatApiResponse {
  message: string;
  action: AgentAction | null;
  suggestions: string[];
  edits: VideoEdits;
}

interface UseVideoChatReturn {
  messages: VideoChatMessage[];
  send: (message: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  suggestions: string[];
  edits: VideoEdits | null;
  clearError: () => void;
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════

export function useVideoChat(projectId: string): UseVideoChatReturn {
  const [messages, setMessages] = useState<VideoChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Sugere cortes virais",
    "Adiciona legendas",
    "Qual o melhor trecho?",
  ]);
  const [edits, setEdits] = useState<VideoEdits | null>(null);

  // Prevent concurrent sends
  const sendingRef = useRef(false);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim() || sendingRef.current) return;

      sendingRef.current = true;
      setLoading(true);
      setError(null);

      const userMessage: VideoChatMessage = {
        role: "user",
        content: message.trim(),
        timestamp: new Date().toISOString(),
      };

      // Optimistic update: add user message immediately
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await fetch("/api/video/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            message: message.trim(),
            history: messages,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Erro ${response.status}: falha na comunicacao com o agente`
          );
        }

        const data: ChatApiResponse = await response.json();

        const assistantMessage: VideoChatMessage = {
          role: "assistant",
          content: data.message,
          action: data.action || undefined,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (data.suggestions?.length) {
          setSuggestions(data.suggestions);
        }

        if (data.edits) {
          setEdits(data.edits);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Erro desconhecido ao enviar mensagem";
        setError(errorMessage);

        // Add error as assistant message so user sees it inline
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Desculpe, ocorreu um erro: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        sendingRef.current = false;
      }
    },
    [projectId, messages]
  );

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setSuggestions([
      "Sugere cortes virais",
      "Adiciona legendas",
      "Qual o melhor trecho?",
    ]);
    setEdits(null);
  }, []);

  return {
    messages,
    send,
    loading,
    error,
    suggestions,
    edits,
    clearError,
    reset,
  };
}
