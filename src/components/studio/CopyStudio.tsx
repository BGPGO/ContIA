"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquareText,
  ChevronDown,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { ContentFormat, ContentTone } from "@/types/ai";
import type {
  CopyContent,
  CopyChatMessage,
  CopySessionStatus,
  QuickAction,
} from "@/types/copy-studio";
import { QUICK_ACTIONS } from "@/types/copy-studio";
import { useCopyStudio } from "@/hooks/useCopyStudio";
import { useCopySessions } from "@/hooks/useCopySessions";
import { ChatInterface } from "./ChatInterface";
import { CopyPreview } from "./CopyPreview";
import { SessionHistory } from "./SessionHistory";

/* ══════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════ */

/* ── Format dropdown ── */
const FORMAT_OPTIONS: { value: ContentFormat; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "carrossel", label: "Carrossel" },
  { value: "reels", label: "Reels" },
  { value: "email", label: "Email" },
  { value: "copy", label: "Copy" },
];

const TONE_OPTIONS: { value: ContentTone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "tecnico", label: "Tecnico" },
  { value: "divertido", label: "Divertido" },
  { value: "inspirador", label: "Inspirador" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "IG", color: "var(--color-instagram)" },
  { value: "facebook", label: "FB", color: "var(--color-facebook)" },
  { value: "linkedin", label: "LI", color: "var(--color-linkedin)" },
];

function MiniSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
          bg-bg-input border border-border text-text-secondary
          hover:border-border-light hover:text-text-primary transition-all cursor-pointer"
      >
        <span className="text-text-muted">{label}:</span>
        {current?.label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl py-1 min-w-[120px]"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                    opt.value === value
                      ? "text-accent bg-accent/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
                  }`}
                >
                  {opt.label}
                  {opt.value === value && <Check size={10} className="inline ml-2" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Editable title ── */
function EditableTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange(draft.trim() || value);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={() => {
            onChange(draft.trim() || value);
            setEditing(false);
          }}
          className="bg-transparent text-sm font-semibold text-text-primary border-b border-accent/50 focus:outline-none px-0 py-0 w-[200px]"
        />
        <button
          type="button"
          onClick={() => {
            onChange(draft.trim() || value);
            setEditing(false);
          }}
          className="p-0.5 text-accent cursor-pointer"
        >
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 group cursor-pointer"
    >
      <span className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
        {value}
      </span>
      <Pencil
        size={12}
        className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );
}

/* ── Status badge ── */
const STATUS_CONFIG: Record<CopySessionStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "#5e6388" },
  approved: { label: "Aprovado", color: "#34d399" },
  designed: { label: "Desenhado", color: "#6c5ce7" },
  exported: { label: "Exportado", color: "#4ecdc4" },
};

/* ── Mobile bottom sheet ── */
function MobilePreviewSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden
              bg-bg-secondary border-t border-border rounded-t-2xl
              max-h-[85vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 p-1 rounded-lg text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main CopyStudio Component
   ══════════════════════════════════════════════════════════════════ */

export function CopyStudio() {
  const router = useRouter();
  const {
    state,
    sendMessage,
    sendQuickAction,
    approveCopy,
    editCopyField,
    updateConfig,
    newSession,
    loadSession,
    reset,
  } = useCopyStudio();

  const {
    sessions,
    isLoading: sessionsLoading,
    deleteSession,
    fetchSessions,
  } = useCopySessions();

  // Adapter: expose flat state for sub-components
  const studio = {
    sessionId: state.sessionId,
    title: state.topic || "Nova sessao",
    format: state.format,
    tone: state.tone,
    platforms: state.platforms,
    status: state.status,
    messages: state.messages,
    currentCopy: state.currentCopy,
    isStreaming: state.isStreaming,
    streamingText: state.streamingText,
    // Actions
    setTitle: (v: string) => updateConfig({ topic: v }),
    setFormat: (v: ContentFormat) => updateConfig({ format: v }),
    setTone: (v: ContentTone) => updateConfig({ tone: v }),
    setPlatforms: (v: string[]) => updateConfig({ platforms: v }),
    sendMessage,
    handleQuickAction: sendQuickAction,
    approve: approveCopy,
    editCopy: editCopyField,
    newSession: () => newSession({}),
    selectSession: (id: string) => loadSession(id),
    deleteSession: (id: string) => deleteSession(id),
    sessions,
    sessionsLoading,
  };

  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // Auto-open mobile preview when copy is generated
  useEffect(() => {
    if (studio.currentCopy && window.innerWidth < 768) {
      setMobilePreviewOpen(true);
    }
  }, [studio.currentCopy]);

  const statusCfg = STATUS_CONFIG[studio.status];

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)] bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        {/* Icon + Title */}
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10">
            <MessageSquareText size={16} className="text-accent" />
          </div>
          <EditableTitle value={studio.title} onChange={studio.setTitle} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <MiniSelect
            value={studio.format}
            options={FORMAT_OPTIONS}
            onChange={studio.setFormat}
            label="Formato"
          />
          <MiniSelect
            value={studio.tone}
            options={TONE_OPTIONS}
            onChange={studio.setTone}
            label="Tom"
          />

          {/* Platform toggles */}
          <div className="flex items-center gap-0.5 ml-1">
            {PLATFORM_OPTIONS.map((plat) => {
              const active = studio.platforms.includes(plat.value);
              return (
                <button
                  key={plat.value}
                  type="button"
                  onClick={() => {
                    if (active && studio.platforms.length > 1) {
                      studio.setPlatforms(studio.platforms.filter((p) => p !== plat.value));
                    } else if (!active) {
                      studio.setPlatforms([...studio.platforms, plat.value]);
                    }
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-accent/15 border border-accent/20"
                      : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-bg-card"
                  }`}
                  style={active ? { color: plat.color } : undefined}
                  title={plat.label}
                >
                  {plat.label}
                </button>
              );
            })}
          </div>

          {/* Status badge */}
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium ml-1"
            style={{ backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* Mobile preview toggle */}
        {studio.currentCopy && (
          <button
            type="button"
            onClick={() => setMobilePreviewOpen(true)}
            className="md:hidden ml-auto px-3 py-1.5 rounded-lg text-[11px] font-medium
              bg-accent/15 text-accent border border-accent/20 cursor-pointer"
          >
            Ver preview
          </button>
        )}
      </div>

      {/* ── Body: Two columns ── */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* LEFT: Chat (60%) */}
        <div className="flex-[3] flex flex-col min-w-0 border-r border-border min-h-0">
          <ChatInterface
            messages={studio.messages}
            isStreaming={studio.isStreaming}
            streamingText={studio.streamingText}
            onSendMessage={studio.sendMessage}
            onQuickAction={studio.handleQuickAction}
            quickActions={QUICK_ACTIONS}
            placeholder="Descreva o conteudo que voce quer criar..."
            disabled={false}
          />
        </div>

        {/* RIGHT: Preview (40%) — desktop only */}
        <div className="hidden md:flex flex-[2] flex-col min-w-0 bg-bg-primary/30">
          <CopyPreview
            copy={studio.currentCopy}
            format={studio.format}
            platforms={studio.platforms}
            isApproved={studio.status === "approved" || studio.status === "designed" || studio.status === "exported"}
            onApprove={studio.approve}
            onEdit={studio.editCopy}
            onCreateVisual={() => {
              const url = studio.sessionId
                ? `/studio/editor?session=${studio.sessionId}`
                : "/studio/editor";
              router.push(url);
            }}
          />
        </div>
      </div>

      {/* ── Session history bar ── */}
      <SessionHistory
        sessions={studio.sessions}
        currentSessionId={studio.sessionId}
        onSelect={studio.selectSession}
        onDelete={studio.deleteSession}
        onNew={studio.newSession}
        isLoading={studio.sessionsLoading}
      />

      {/* ── Mobile preview sheet ── */}
      <MobilePreviewSheet
        open={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
      >
        <CopyPreview
          copy={studio.currentCopy}
          format={studio.format}
          platforms={studio.platforms}
          isApproved={studio.status === "approved" || studio.status === "designed" || studio.status === "exported"}
          onApprove={studio.approve}
          onEdit={studio.editCopy}
          onCreateVisual={() => {
            setMobilePreviewOpen(false);
            const url = studio.sessionId
              ? `/studio/editor?session=${studio.sessionId}`
              : "/studio/editor";
            router.push(url);
          }}
        />
      </MobilePreviewSheet>
    </div>
  );
}
