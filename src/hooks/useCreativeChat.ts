"use client";

import { useState, useCallback, useRef } from "react";
import type { MessageAttachment } from "@/lib/creatives/history";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface CreativeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string | null;
  pngUrl?: string | null;
  pngUrls?: string[] | null;
  attachments?: MessageAttachment[] | null;
  createdAt?: string;
}

export type ModelKey = "sonnet" | "opus";

export interface UseCreativeChatOpts {
  empresaId: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SSE PARSER (clonado de useCopyStudio.ts)
// ═══════════════════════════════════════════════════════════════════════

interface SSEEvent {
  event: string;
  data: string;
}

function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split("\n");
  let currentEvent = "message";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
    } else if (line === "" && currentData) {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = "message";
      currentData = "";
    }
  }

  // Handle case where chunk doesn't end with blank line
  if (currentData) {
    events.push({ event: currentEvent, data: currentData });
  }

  return events;
}

// ═══════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════

function getInitialModel(): ModelKey {
  if (typeof window === "undefined") return "sonnet";
  const stored = localStorage.getItem("creative_model");
  if (stored === "sonnet" || stored === "opus") return stored;
  return "sonnet";
}

function getInitialUseBrandKit(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("creative_use_brand_kit") === "true";
}

export function useCreativeChat({ empresaId }: UseCreativeChatOpts): {
  messages: CreativeMessage[];
  isStreaming: boolean;
  streamingText: string;
  currentHtml: string | null;
  currentPngUrl: string | null;
  currentPngUrls: string[] | null;
  conversationId: string | null;
  model: ModelKey;
  setModel: (m: ModelKey) => void;
  useBrandKit: boolean;
  setUseBrandKit: (v: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  error: string | null;
  reset: () => void;
  pendingAttachments: MessageAttachment[];
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (url: string) => void;
} {
  const [messages, setMessages] = useState<CreativeMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [currentPngUrl, setCurrentPngUrl] = useState<string | null>(null);
  const [currentPngUrls, setCurrentPngUrls] = useState<string[] | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [model, setModelState] = useState<ModelKey>(getInitialModel);
  const [useBrandKit, setUseBrandKitState] = useState<boolean>(getInitialUseBrandKit);
  const [error, setError] = useState<string | null>(null);

  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  const sendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref para acessar o array de mensagens sem stale closure
  const messagesRef = useRef<CreativeMessage[]>([]);

  const setModel = useCallback((m: ModelKey) => {
    setModelState(m);
    if (typeof window !== "undefined") {
      localStorage.setItem("creative_model", m);
    }
  }, []);

  const setUseBrandKit = useCallback((v: boolean) => {
    setUseBrandKitState(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("creative_use_brand_kit", v ? "true" : "false");
    }
  }, []);

  // ── Add attachment ──
  const addAttachment = useCallback(
    async (file: File) => {
      if (!empresaId) return;
      if (pendingAttachments.length >= 3) {
        setError("Máximo de 3 imagens por mensagem.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Imagem muito grande (máx 5MB).");
        return;
      }
      const mt = (file.type || "").toLowerCase();
      if (!["image/png", "image/jpeg", "image/webp"].includes(mt)) {
        setError("Formato inválido. Use PNG, JPG ou WEBP.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresaId", empresaId);

      try {
        const res = await fetch("/api/creatives/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Erro ${res.status} no upload`);
        }
        const data = (await res.json()) as { url: string; mediaType: string; name?: string };
        const attachment: MessageAttachment = {
          url: data.url,
          mediaType: data.mediaType as MessageAttachment["mediaType"],
          name: data.name || file.name,
        };
        setPendingAttachments((prev) => [...prev, attachment]);
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha no upload da imagem";
        console.error("[CreativeChat] addAttachment:", msg);
        setError(msg);
      }
    },
    [empresaId, pendingAttachments.length]
  );

  // ── Remove attachment ──
  const removeAttachment = useCallback((url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url));
  }, []);

  // ── Render HTML to PNG ──
  const renderHtml = useCallback(
    async (messageId: string, html: string) => {
      try {
        const response = await fetch("/api/creatives/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, messageId, empresaId }),
        });

        if (!response.ok) {
          throw new Error(`Erro ${response.status} ao renderizar PNG`);
        }

        const data = (await response.json()) as { url: string; urls?: string[] };
        const url = data.url;
        const urls = data.urls ?? [url];

        setCurrentPngUrl(url);
        setCurrentPngUrls(urls);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, pngUrl: url, pngUrls: urls } : msg
          )
        );
        messagesRef.current = messagesRef.current.map((msg) =>
          msg.id === messageId ? { ...msg, pngUrl: url, pngUrls: urls } : msg
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Falha ao renderizar PNG";
        console.error("[CreativeChat] Falha ao renderizar PNG:", msg);
        setError("Falha ao renderizar PNG");
      }
    },
    [empresaId]
  );

  // ── Send message ──
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sendingRef.current || !empresaId) return;

      sendingRef.current = true;
      setIsStreaming(true);
      setStreamingText("");
      setCurrentHtml(null);
      setCurrentPngUrl(null);
      setCurrentPngUrls(null);
      setError(null);

      // Adiciona mensagem do usuário ao state imediatamente
      const userMessage: CreativeMessage = {
        id: "temp-" + Date.now(),
        role: "user",
        content: text.trim(),
        attachments: pendingAttachments.length > 0 ? pendingAttachments : null,
        createdAt: new Date().toISOString(),
      };
      const allMessages = [...messagesRef.current, userMessage];
      messagesRef.current = allMessages;
      setMessages(allMessages);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/creatives/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            empresaId,
            conversationId,
            model,
            useBrandKit,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error(
            (errorData.error as string) ||
              `Erro ${response.status}: falha na comunicação com o assistente`
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("ReadableStream não suportado");

        const decoder = new TextDecoder();
        let accumulatedText = "";
        let receivedHtml: string | null = null;
        let receivedMessageId: string | null = null;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = parseSSEChunk(buffer);

          // Mantém o restante não parseado no buffer
          const lastNewline = buffer.lastIndexOf("\n\n");
          if (lastNewline >= 0) {
            buffer = buffer.slice(lastNewline + 2);
          }

          for (const sse of events) {
            switch (sse.event) {
              case "text": {
                try {
                  const payload = JSON.parse(sse.data) as { content?: string };
                  accumulatedText += payload.content ?? "";
                } catch {
                  accumulatedText += sse.data;
                }
                setStreamingText(accumulatedText);
                break;
              }

              case "html": {
                try {
                  const payload = JSON.parse(sse.data) as { html?: string };
                  receivedHtml = payload.html ?? sse.data;
                } catch {
                  receivedHtml = sse.data;
                }
                setCurrentHtml(receivedHtml);
                break;
              }

              case "done": {
                try {
                  const payload = JSON.parse(sse.data) as {
                    messageId?: string;
                    conversationId?: string;
                  };
                  receivedMessageId = payload.messageId ?? null;
                  if (payload.conversationId) {
                    setConversationId(payload.conversationId);
                  }
                } catch {
                  // ignorar erros de parse no done
                }
                break;
              }

              case "error": {
                try {
                  const payload = JSON.parse(sse.data) as { message?: string };
                  throw new Error(payload.message ?? sse.data);
                } catch (e) {
                  if (e instanceof Error && e.message !== sse.data) throw e;
                  throw new Error(sse.data);
                }
              }
            }
          }
        }

        // Adiciona mensagem do assistente ao state
        const assistantId = receivedMessageId ?? "assistant-" + Date.now();
        const assistantMessage: CreativeMessage = {
          id: assistantId,
          role: "assistant",
          content: accumulatedText || "Criativo gerado.",
          html: receivedHtml,
          pngUrl: null,
          createdAt: new Date().toISOString(),
        };
        messagesRef.current = [...messagesRef.current, assistantMessage];
        setMessages(messagesRef.current);
        setStreamingText("");

        // Renderiza PNG se recebeu HTML
        if (receivedHtml && assistantId) {
          await renderHtml(assistantId, receivedHtml);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao enviar mensagem";

        console.error("[CreativeChat] Erro ao enviar mensagem:", errorMessage);
        setError(errorMessage);

        const errorMsg: CreativeMessage = {
          id: "error-" + Date.now(),
          role: "assistant",
          content: `Desculpe, ocorreu um erro: ${errorMessage}`,
          createdAt: new Date().toISOString(),
        };
        messagesRef.current = [...messagesRef.current, errorMsg];
        setMessages(messagesRef.current);
      } finally {
        setIsStreaming(false);
        sendingRef.current = false;
        abortControllerRef.current = null;
        setPendingAttachments([]);
      }
    },
    [empresaId, conversationId, model, useBrandKit, renderHtml, pendingAttachments]
  );

  // ── Reset ──
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    messagesRef.current = [];
    setMessages([]);
    setIsStreaming(false);
    setStreamingText("");
    setCurrentHtml(null);
    setCurrentPngUrl(null);
    setCurrentPngUrls(null);
    setConversationId(null);
    setError(null);
    sendingRef.current = false;
  }, []);

  return {
    messages,
    isStreaming,
    streamingText,
    currentHtml,
    currentPngUrl,
    currentPngUrls,
    conversationId,
    model,
    setModel,
    useBrandKit,
    setUseBrandKit,
    sendMessage,
    error,
    reset,
    pendingAttachments,
    addAttachment,
    removeAttachment,
  };
}
