"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";
import { usePatterns } from "@/hooks/usePatterns";
import type { ContentFormat, ContentTone } from "@/types/ai";
import type {
  CopyContent,
  CopyChatMessage,
  CopySession,
  CopySessionStatus,
  QuickAction,
} from "@/types/copy-studio";
import { QUICK_ACTIONS } from "@/types/copy-studio";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

export interface CopyStudioState {
  // Session config
  sessionId: string | null;
  format: ContentFormat;
  tone: ContentTone;
  platforms: string[];
  topic: string;

  // Chat
  messages: CopyChatMessage[];
  isStreaming: boolean;
  streamingText: string;

  // Copy
  currentCopy: CopyContent | null;
  copyHistory: CopyContent[];

  // Status
  status: CopySessionStatus;
  isSaving: boolean;
  error: string | null;

  // Context loaded
  hasDNA: boolean;
  hasPatterns: boolean;
}

const initialState: CopyStudioState = {
  sessionId: null,
  format: "post",
  tone: "casual",
  platforms: ["instagram"],
  topic: "",
  messages: [],
  isStreaming: false,
  streamingText: "",
  currentCopy: null,
  copyHistory: [],
  status: "draft",
  isSaving: false,
  error: null,
  hasDNA: false,
  hasPatterns: false,
};

// ═══════════════════════════════════════════════════════════════════════
// SSE PARSER
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

export function useCopyStudio() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const { dna } = useMarcaDNA(empresaId);
  const { styleProfile } = usePatterns(empresaId);

  // ── State ──
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [format, setFormat] = useState<ContentFormat>("post");
  const [tone, setTone] = useState<ContentTone>("casual");
  const [platforms, setPlatforms] = useState<string[]>(["instagram"]);
  const [topic, setTopic] = useState("");

  const [messages, setMessages] = useState<CopyChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const [currentCopy, setCurrentCopy] = useState<CopyContent | null>(null);
  const [copyHistory, setCopyHistory] = useState<CopyContent[]>([]);

  const [status, setStatus] = useState<CopySessionStatus>("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──
  const sendingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const configured = isSupabaseConfigured();

  // ── Derived ──
  const hasDNA = !!dna;
  const hasPatterns = !!styleProfile;

  // ── Auto-save (debounced) ──
  const debouncedSave = useCallback(() => {
    if (!sessionId || !empresaId || !configured) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const supabase = createClient();
        const { error: err } = await supabase
          .from("copy_sessions")
          .update({
            format,
            tone,
            platforms,
            topic,
            current_copy: currentCopy,
            messages,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (err) {
          console.warn("[CopyStudio] Auto-save error:", err.message);
        }
      } catch (e) {
        console.warn("[CopyStudio] Auto-save failed:", e);
      } finally {
        setIsSaving(false);
      }
    }, 2000);
  }, [sessionId, empresaId, configured, format, tone, platforms, topic, currentCopy, messages, status]);

  // ── Cleanup debounce on unmount ──
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sendingRef.current || !empresaId) return;

      sendingRef.current = true;
      setIsStreaming(true);
      setStreamingText("");
      setError(null);

      const userMessage: CopyChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Build history for API (include new user message)
      const historyForApi = [...messages, userMessage];

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/ai/copy-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            message: text.trim(),
            format,
            tone,
            platforms,
            topic,
            current_copy: currentCopy,
            history: historyForApi,
            empresa_id: empresaId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Erro ${response.status}: falha na comunicacao com o assistente`
          );
        }

        // Check if streaming response (SSE) or JSON
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
          // SSE streaming
          const reader = response.body?.getReader();
          if (!reader) throw new Error("ReadableStream not supported");

          const decoder = new TextDecoder();
          let accumulatedText = "";
          let receivedCopy: CopyContent | null = null;
          let receivedSessionId: string | null = null;
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = parseSSEChunk(buffer);

            // Keep unparsed remainder in buffer
            const lastNewline = buffer.lastIndexOf("\n\n");
            if (lastNewline >= 0) {
              buffer = buffer.slice(lastNewline + 2);
            }

            for (const sse of events) {
              switch (sse.event) {
                case "text":
                  try {
                    const textPayload = JSON.parse(sse.data);
                    accumulatedText += textPayload.content ?? "";
                  } catch {
                    // Fallback: treat as raw text
                    accumulatedText += sse.data;
                  }
                  setStreamingText(accumulatedText);
                  break;

                case "copy":
                  try {
                    const copyPayload = JSON.parse(sse.data);
                    receivedCopy = (copyPayload.copy ?? copyPayload) as CopyContent;
                    // Push current copy to history before replacing
                    if (currentCopy) {
                      setCopyHistory((prev) => [...prev, currentCopy]);
                    }
                    setCurrentCopy(receivedCopy);
                  } catch (parseErr) {
                    console.warn("[CopyStudio] Failed to parse copy event:", parseErr);
                  }
                  break;

                case "session_id":
                  try {
                    const sidPayload = JSON.parse(sse.data);
                    receivedSessionId = (sidPayload.session_id ?? sse.data).toString().trim();
                  } catch {
                    receivedSessionId = sse.data.trim();
                  }
                  setSessionId(receivedSessionId);
                  break;

                case "done":
                  // Finalize
                  break;

                case "error":
                  try {
                    const errPayload = JSON.parse(sse.data);
                    throw new Error(errPayload.error ?? sse.data);
                  } catch (e) {
                    if (e instanceof Error && e.message !== sse.data) throw e;
                    throw new Error(sse.data);
                  }
              }
            }
          }

          // Create assistant message from accumulated text
          const assistantMessage: CopyChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: accumulatedText || "Copy atualizada.",
            copy_snapshot: receivedCopy || undefined,
            timestamp: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingText("");
        } else {
          // Non-streaming JSON response (fallback)
          const data = await response.json();

          if (data.session_id && !sessionId) {
            setSessionId(data.session_id);
          }

          if (data.copy) {
            if (currentCopy) {
              setCopyHistory((prev) => [...prev, currentCopy]);
            }
            setCurrentCopy(data.copy);
          }

          const assistantMessage: CopyChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message || "Copy atualizada.",
            copy_snapshot: data.copy || undefined,
            timestamp: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
        }

        // Trigger auto-save
        debouncedSave();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled, not an error
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Erro desconhecido ao enviar mensagem";
        setError(errorMessage);

        // Add error as assistant message so user sees it inline
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Desculpe, ocorreu um erro: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsStreaming(false);
        setStreamingText("");
        sendingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [empresaId, sessionId, format, tone, platforms, topic, currentCopy, messages, debouncedSave]
  );

  // ── Send quick action ──
  const sendQuickAction = useCallback(
    (action: QuickAction) => {
      const config = QUICK_ACTIONS.find((qa) => qa.id === action);
      if (!config) return;
      sendMessage(config.prompt);
    },
    [sendMessage]
  );

  // ── Undo copy ──
  const undoCopy = useCallback(() => {
    if (copyHistory.length === 0) return;

    const previous = copyHistory[copyHistory.length - 1];
    setCopyHistory((prev) => prev.slice(0, -1));
    setCurrentCopy(previous);
    debouncedSave();
  }, [copyHistory, debouncedSave]);

  // ── Approve copy ──
  const approveCopy = useCallback(() => {
    setStatus("approved");
    debouncedSave();
  }, [debouncedSave]);

  // ── Edit copy field ──
  const editCopyField = useCallback(
    (field: keyof CopyContent, value: any) => {
      if (!currentCopy) return;

      // Push current to history before editing
      setCopyHistory((prev) => [...prev, currentCopy]);
      setCurrentCopy((prev) => (prev ? { ...prev, [field]: value } : null));
      debouncedSave();
    },
    [currentCopy, debouncedSave]
  );

  // ── Update config ──
  const updateConfig = useCallback(
    (config: Partial<{ format: ContentFormat; tone: ContentTone; platforms: string[]; topic: string }>) => {
      if (config.format !== undefined) setFormat(config.format);
      if (config.tone !== undefined) setTone(config.tone);
      if (config.platforms !== undefined) setPlatforms(config.platforms);
      if (config.topic !== undefined) setTopic(config.topic);
      debouncedSave();
    },
    [debouncedSave]
  );

  // ── New session ──
  const newSession = useCallback(
    async (config: {
      format?: ContentFormat;
      tone?: ContentTone;
      platforms?: string[];
      topic?: string;
    }) => {
      // Reset state
      setSessionId(null);
      setMessages([]);
      setCurrentCopy(null);
      setCopyHistory([]);
      setStatus("draft");
      setError(null);
      setStreamingText("");

      // Apply config
      if (config.format) setFormat(config.format);
      if (config.tone) setTone(config.tone);
      if (config.platforms) setPlatforms(config.platforms);
      if (config.topic) setTopic(config.topic ?? "");

      // Create session in Supabase
      if (configured && empresaId) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Nao autenticado");

          const { data, error: err } = await supabase
            .from("copy_sessions")
            .insert({
              empresa_id: empresaId,
              user_id: user.id,
              title: config.topic || "Nova sessao",
              format: config.format || "post",
              tone: config.tone || "casual",
              platforms: config.platforms || ["instagram"],
              topic: config.topic || "",
              current_copy: null,
              messages: [],
              dna_context: dna ? (dna as any) : null,
              style_profile: styleProfile ? (styleProfile as any) : null,
              status: "draft",
            })
            .select("id")
            .single();

          if (err) {
            console.warn("[CopyStudio] Failed to create session:", err.message);
          } else if (data) {
            setSessionId(data.id);
          }
        } catch (e) {
          console.warn("[CopyStudio] Session creation failed:", e);
        }
      }
    },
    [configured, empresaId, dna, styleProfile]
  );

  // ── Load session ──
  const loadSession = useCallback(
    async (id: string) => {
      if (!configured) return;

      setError(null);

      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from("copy_sessions")
          .select("*")
          .eq("id", id)
          .single();

        if (err) throw new Error(err.message);
        if (!data) throw new Error("Sessao nao encontrada");

        const session = data as CopySession;
        setSessionId(session.id);
        setFormat(session.format);
        setTone(session.tone);
        setPlatforms(session.platforms);
        setTopic(session.topic);
        setMessages(session.messages || []);
        setCurrentCopy(session.current_copy);
        setCopyHistory([]);
        setStatus(session.status);
      } catch (e: any) {
        const msg = e.message || "Erro ao carregar sessao";
        setError(msg);
        console.error("[CopyStudio] Load session failed:", msg);
      }
    },
    [configured]
  );

  // ── Save session (manual) ──
  const saveSession = useCallback(async () => {
    if (!sessionId || !configured) return;

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("copy_sessions")
        .update({
          format,
          tone,
          platforms,
          topic,
          current_copy: currentCopy,
          messages,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (err) {
        throw new Error(err.message);
      }
    } catch (e: any) {
      console.error("[CopyStudio] Manual save failed:", e.message);
      setError("Erro ao salvar sessao");
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, configured, format, tone, platforms, topic, currentCopy, messages, status]);

  // ── Reset ──
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSessionId(null);
    setFormat("post");
    setTone("casual");
    setPlatforms(["instagram"]);
    setTopic("");
    setMessages([]);
    setIsStreaming(false);
    setStreamingText("");
    setCurrentCopy(null);
    setCopyHistory([]);
    setStatus("draft");
    setIsSaving(false);
    setError(null);
  }, []);

  // ── Computed state object ──
  const state: CopyStudioState = {
    sessionId,
    format,
    tone,
    platforms,
    topic,
    messages,
    isStreaming,
    streamingText,
    currentCopy,
    copyHistory,
    status,
    isSaving,
    error,
    hasDNA,
    hasPatterns,
  };

  return {
    state,
    sendMessage,
    sendQuickAction,
    undoCopy,
    approveCopy,
    editCopyField,
    updateConfig,
    newSession,
    loadSession,
    saveSession,
    reset,
  };
}
