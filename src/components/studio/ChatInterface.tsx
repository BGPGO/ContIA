"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, CheckCircle2 } from "lucide-react";
import type { CopyChatMessage, QuickAction, QuickActionConfig } from "@/types/copy-studio";
import { QuickActions } from "./QuickActions";

/* ── Typing indicator ── */
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
      <span className="text-xs text-text-muted ml-2">Gerando copy...</span>
    </div>
  );
}

/* ── Message bubble ── */
function MessageBubble({ message, isStreaming }: { message: CopyChatMessage; isStreaming?: boolean }) {
  if (message.role === "system") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full flex justify-center"
      >
        <span className="text-[11px] text-text-muted bg-bg-card/30 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </motion.div>
    );
  }

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex justify-end"
      >
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line
            bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/20">
            {message.content}
          </div>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] space-y-1.5">
        <div className="bg-bg-card text-text-primary border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
          {message.content}
          {isStreaming && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-middle"
            />
          )}
        </div>
        {message.copy_snapshot && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-[11px] font-medium w-fit"
          >
            <CheckCircle2 size={12} />
            Copy atualizada
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Props ── */
interface ChatInterfaceProps {
  messages: CopyChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  onSendMessage: (text: string) => void;
  onQuickAction?: (action: QuickAction) => void;
  quickActions?: QuickActionConfig[];
  placeholder?: string;
  disabled?: boolean;
}

/* ── Main Component ── */
export function ChatInterface({
  messages,
  isStreaming,
  streamingText,
  onSendMessage,
  onQuickAction,
  quickActions = [],
  placeholder = "Descreva o que voce quer...",
  disabled = false,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, streamingText]);

  // Send handler
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming || disabled) return;
    onSendMessage(text);
    setInputValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, isStreaming, disabled, onSendMessage]);

  // Keyboard
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

  // Streaming message (rendered as a partial assistant message)
  const streamingMessage: CopyChatMessage | null = isStreaming && streamingText
    ? {
        id: "__streaming__",
        role: "assistant",
        content: streamingText,
        timestamp: new Date().toISOString(),
      }
    : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {/* Streaming partial message */}
        {streamingMessage && (
          <MessageBubble message={streamingMessage} isStreaming />
        )}

        {/* Typing indicator (when streaming but no text yet) */}
        {isStreaming && !streamingText && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-bg-card border border-white/5 rounded-2xl rounded-bl-md">
              <TypingIndicator />
            </div>
          </motion.div>
        )}

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
        <div className="flex items-end gap-2">
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
                transition-colors resize-none disabled:opacity-50 pr-2"
              style={{ maxHeight: 120 }}
            />
          </div>
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
        </div>
      </div>
    </div>
  );
}
