"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { MessageAttachment } from "@/lib/creatives/history";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type StreamingPhase =
  | "idle"
  | "thinking"
  | "writing"
  | "designing"
  | "rendering";

export interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface TokenTotals {
  input: number;    // fresh input (sem cache)
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface CreativeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string | null;
  pngUrl?: string | null;
  pngUrls?: string[] | null;
  attachments?: MessageAttachment[] | null;
  usage?: MessageUsage | null;   // uso de tokens da mensagem
  cost?: number;                 // custo em USD
  model?: "sonnet" | "opus";    // modelo que gerou a mensagem
  createdAt?: string;
}

export type ModelKey = "sonnet" | "opus";

// ── Conversation library types ──────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  // thumb omitida: GET /api/creatives retorna apenas summary (sem messages),
  // buscar thumb exigiria N+1 requests — skip intencional.
  thumbUrl?: string | null;
}

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
// PRICING & COST CALCULATION
// ═══════════════════════════════════════════════════════════════════════

// Preços por 1M de tokens em USD
const PRICING = {
  sonnet: {
    input: 3,
    output: 15,
    cacheWrite: 3.75,  // 25% a mais que input (padrão Anthropic)
    cacheRead: 0.30,   // 10% do input
  },
  opus: {
    input: 15,
    output: 75,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
} as const;

function calculateCost(
  usage: MessageUsage,
  modelKey: "sonnet" | "opus"
): number {
  const rates = PRICING[modelKey];
  const cost =
    (usage.input_tokens * rates.input +
      usage.cache_creation_input_tokens * rates.cacheWrite +
      usage.cache_read_input_tokens * rates.cacheRead +
      usage.output_tokens * rates.output) /
    1_000_000;
  return cost;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE DETECTION
// ═══════════════════════════════════════════════════════════════════════

function detectPhase(text: string): StreamingPhase {
  if (!text || text.trim().length === 0) return "thinking";
  const hasHtmlStart = /```html/i.test(text);
  if (!hasHtmlStart) return "writing";
  // Checa se o bloco html já fechou
  const afterHtmlStart = text.split(/```html/i)[1] ?? "";
  if (!afterHtmlStart.includes("```")) return "designing";
  // HTML terminou mas stream ainda rolando — continua como designing
  return "designing";
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
  streamingPhase: StreamingPhase;
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
  totalCostUsd: number;
  totalTokens: TokenTotals;
  // ── Biblioteca de conversas ──
  conversations: ConversationSummary[];
  loadingConversations: boolean;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
} {
  const [messages, setMessages] = useState<CreativeMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>("idle");
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [currentPngUrl, setCurrentPngUrl] = useState<string | null>(null);
  const [currentPngUrls, setCurrentPngUrls] = useState<string[] | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [model, setModelState] = useState<ModelKey>(getInitialModel);
  const [useBrandKit, setUseBrandKitState] = useState<boolean>(getInitialUseBrandKit);
  const [error, setError] = useState<string | null>(null);
  const [totalCostUsd, setTotalCostUsd] = useState(0);
  const [totalTokens, setTotalTokens] = useState<TokenTotals>({
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
  });

  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  // ── Biblioteca de conversas ──
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

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

  // ── Biblioteca de conversas ──────────────────────────────────────────────

  /** Carrega lista de conversas da empresa (sort por updatedAt desc) */
  const loadConversations = useCallback(async () => {
    if (!empresaId) return;
    setLoadingConversations(true);
    try {
      const res = await fetch(`/api/creatives?empresaId=${empresaId}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Erro ${res.status} ao carregar conversas`);
      }
      const data = (await res.json()) as {
        conversations: Array<{
          id: string;
          title: string;
          created_at: string;
          updated_at: string;
          thumb_url?: string | null;
        }>;
      };
      const mapped: ConversationSummary[] = (data.conversations ?? [])
        .map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          thumbUrl: c.thumb_url ?? null,
        }))
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      setConversations(mapped);
    } catch (err) {
      console.error("[CreativeChat] loadConversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, [empresaId]);

  /** Carrega uma conversa existente pelo id, populando messages e html/png */
  const loadConversation = useCallback(
    async (id: string) => {
      if (!empresaId) return;
      try {
        const res = await fetch(`/api/creatives/${id}?empresaId=${empresaId}`);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Erro ${res.status} ao carregar conversa`);
        }
        const data = (await res.json()) as {
          conversation: { id: string; title: string; created_at: string; updated_at: string };
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            html?: string | null;
            png_url?: string | null;
            png_urls?: string[] | null;
            attachments?: MessageAttachment[] | null;
            created_at?: string;
          }>;
        };

        const mapped: CreativeMessage[] = (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          html: m.html ?? null,
          pngUrl: m.png_url ?? null,
          pngUrls: m.png_urls ?? null,
          attachments: m.attachments ?? null,
          createdAt: m.created_at,
        }));

        messagesRef.current = mapped;
        setMessages(mapped);
        setConversationId(id);

        // Restaura último html/png do último assistant com conteúdo visual
        const lastAssistant = [...mapped].reverse().find((m) => m.role === "assistant");
        if (lastAssistant) {
          setCurrentHtml(lastAssistant.html ?? null);
          setCurrentPngUrl(lastAssistant.pngUrl ?? null);
          setCurrentPngUrls(lastAssistant.pngUrls ?? null);
        } else {
          setCurrentHtml(null);
          setCurrentPngUrl(null);
          setCurrentPngUrls(null);
        }

        // Reseta estado de streaming
        setStreamingText("");
        setIsStreaming(false);
        setError(null);
        setStreamingPhase("idle");
        setPendingAttachments([]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha ao carregar conversa";
        console.error("[CreativeChat] loadConversation:", msg);
        setError(msg);
      }
    },
    [empresaId]
  );

  /** Reseta para uma nova conversa vazia, sem salvar no backend */
  const createNewConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    messagesRef.current = [];
    setMessages([]);
    setConversationId(null);
    setCurrentHtml(null);
    setCurrentPngUrl(null);
    setCurrentPngUrls(null);
    setStreamingText("");
    setIsStreaming(false);
    setError(null);
    setStreamingPhase("idle");
    setPendingAttachments([]);
    setTotalCostUsd(0);
    setTotalTokens({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
    sendingRef.current = false;
  }, []);

  /** Deleta uma conversa por id. Se for a ativa, cria nova conversa vazia. */
  const deleteConversation = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/creatives/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Erro ${res.status} ao deletar conversa`);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // Se deletou a conversa ativa, abre nova
      setConversationId((current) => {
        if (current === id) {
          // side-effect seguro: reseta tudo via createNewConversation
          // mas não podemos chamar um callback dentro de setState — fazemos inline
          messagesRef.current = [];
          setMessages([]);
          setCurrentHtml(null);
          setCurrentPngUrl(null);
          setCurrentPngUrls(null);
          setStreamingText("");
          setIsStreaming(false);
          setError(null);
          setStreamingPhase("idle");
          setPendingAttachments([]);
          setTotalCostUsd(0);
          setTotalTokens({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
          sendingRef.current = false;
          return null;
        }
        return current;
      });
    },
    []
  );

  /** Renomeia uma conversa. Atualiza state local sem refetch. */
  const renameConversation = useCallback(async (id: string, title: string) => {
    const res = await fetch(`/api/creatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Erro ${res.status} ao renomear conversa`);
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  // ── Efeito: carrega lista ao montar / trocar empresa ──
  useEffect(() => {
    if (empresaId) {
      loadConversations().catch((err) =>
        console.error("[CreativeChat] loadConversations (effect):", err)
      );
    }
  }, [empresaId, loadConversations]);

  // ── Render HTML to PNG ──
  const renderHtml = useCallback(
    async (messageId: string, html: string) => {
      setStreamingPhase("rendering");
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
      } finally {
        setStreamingPhase("idle");
      }
    },
    [empresaId]
  );

  // ── Send message ──
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sendingRef.current || !empresaId) return;

      // Guarda se é nova conversa pra inserir localmente na lista ao final
      const wasNewConversation = !conversationId;

      sendingRef.current = true;
      setIsStreaming(true);
      setStreamingText("");
      setStreamingPhase("thinking");
      setError(null);

      // Em nova conversa zera o preview; em iterações preserva até nova resposta com HTML chegar
      if (wasNewConversation) {
        setCurrentHtml(null);
        setCurrentPngUrl(null);
        setCurrentPngUrls(null);
      }

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
        let receivedConversationId: string | null = null;
        let receivedUsage: MessageUsage | null = null;
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
                setStreamingPhase(detectPhase(accumulatedText));
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
                    usage?: MessageUsage;
                  };
                  receivedMessageId = payload.messageId ?? null;
                  receivedUsage = payload.usage ?? null;
                  if (payload.conversationId) {
                    receivedConversationId = payload.conversationId;
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

        // Calcula custo e monta mensagem do assistente
        const modelKey: "sonnet" | "opus" = model;
        const cost = receivedUsage ? calculateCost(receivedUsage, modelKey) : 0;

        const assistantId = receivedMessageId ?? "assistant-" + Date.now();
        const assistantMessage: CreativeMessage = {
          id: assistantId,
          role: "assistant",
          content: accumulatedText || "Criativo gerado.",
          html: receivedHtml,
          pngUrl: null,
          pngUrls: null,
          usage: receivedUsage,
          cost,
          model: modelKey,
          createdAt: new Date().toISOString(),
        };
        messagesRef.current = [...messagesRef.current, assistantMessage];
        setMessages(messagesRef.current);
        setStreamingText("");

        // Acumula totais de tokens e custo
        if (receivedUsage) {
          setTotalCostUsd((prev) => prev + cost);
          setTotalTokens((prev) => ({
            input: prev.input + (receivedUsage?.input_tokens ?? 0),
            output: prev.output + (receivedUsage?.output_tokens ?? 0),
            cacheWrite: prev.cacheWrite + (receivedUsage?.cache_creation_input_tokens ?? 0),
            cacheRead: prev.cacheRead + (receivedUsage?.cache_read_input_tokens ?? 0),
          }));
        }

        // Se criou nova conversa: inserir localmente no topo da lista (sem refetch)
        if (wasNewConversation && receivedConversationId) {
          const now = new Date().toISOString();
          const newEntry: ConversationSummary = {
            id: receivedConversationId,
            title: text.trim().slice(0, 60),
            createdAt: now,
            updatedAt: now,
            thumbUrl: null,
          };
          setConversations((prev) => [newEntry, ...prev]);
        }

        // Renderiza PNG se recebeu HTML
        if (receivedHtml && assistantId) {
          await renderHtml(assistantId, receivedHtml);
        } else {
          setStreamingPhase("idle");
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
        setStreamingPhase("idle");

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
    setStreamingPhase("idle");
    setCurrentHtml(null);
    setCurrentPngUrl(null);
    setCurrentPngUrls(null);
    setConversationId(null);
    setError(null);
    setTotalCostUsd(0);
    setTotalTokens({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
    sendingRef.current = false;
  }, []);

  return {
    messages,
    isStreaming,
    streamingText,
    streamingPhase,
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
    totalCostUsd,
    totalTokens,
    // ── Biblioteca de conversas ──
    conversations,
    loadingConversations,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
    renameConversation,
  };
}
