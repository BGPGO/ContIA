// @deprecated — substituído por CreativesLibrary (modal fullscreen com grid visual).
// Este arquivo está morto e será removido após validação final.
// NÃO importar em novos componentes.
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ConversationSummary } from "@/hooks/useCreativeChat";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface ConversationsSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function relativeDate(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 2) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return new Date(isoString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

// ═══════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════

function SkeletonItem({ delay }: { delay: number }) {
  return (
    <div
      className="px-3 py-3 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="h-3.5 bg-white/10 rounded-md mb-2 w-3/4" />
      <div className="h-2.5 bg-white/6 rounded-md w-1/3" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CONVERSATION ITEM
// ═══════════════════════════════════════════════════════════════════════

interface ConversationItemProps {
  conv: ConversationSummary;
  isActive: boolean;
  index: number;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

function ConversationItem({
  conv,
  isActive,
  index,
  onSelect,
  onDelete,
  onRename,
}: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input when edit mode activates
  useEffect(() => {
    if (editMode) {
      setEditValue(conv.title);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editMode, conv.title]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  function saveEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conv.title) {
      onRename(trimmed);
    }
    setEditMode(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      setEditMode(false);
      setEditValue(conv.title);
    }
  }

  function handleDeleteClick() {
    setMenuOpen(false);
    if (window.confirm("Excluir esta conversa?")) {
      onDelete();
    }
  }

  function handleRenameClick() {
    setMenuOpen(false);
    setEditMode(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={`group relative flex items-start gap-2 px-3 py-2.5 cursor-pointer rounded-lg mx-2 my-0.5 transition-all duration-150 border-l-2 ${
        isActive
          ? "bg-white/10 border-[#4ecdc4]"
          : "border-transparent hover:bg-white/5 hover:border-white/10"
      }`}
      onClick={() => {
        if (!editMode) onSelect();
      }}
    >
      <div className="flex-1 min-w-0">
        {editMode ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white/10 border border-[#4ecdc4]/40 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:border-[#4ecdc4]"
          />
        ) : (
          <p className="text-sm font-medium text-white/90 leading-snug line-clamp-2 pr-6">
            {conv.title}
          </p>
        )}
        <p className="text-[11px] text-white/40 mt-0.5">
          {relativeDate(conv.updatedAt)}
        </p>
      </div>

      {/* Menu button */}
      {!editMode && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={`w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all ${
              menuOpen ? "opacity-100 bg-white/10" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-7 z-50 w-36 bg-[#0d1025] border border-white/10 rounded-xl shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleRenameClick}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Renomear
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function ConversationsSidebar({
  conversations,
  activeConversationId,
  loading,
  onSelect,
  onNewConversation,
  onDelete,
  onRename,
}: ConversationsSidebarProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[#080b1e]">
      {/* Header fixo */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white/80 tracking-wide">
          Conversas
        </span>
        <button
          type="button"
          onClick={onNewConversation}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#4ecdc4]/15 hover:bg-[#4ecdc4]/25 text-[#4ecdc4] text-xs font-medium transition-all border border-[#4ecdc4]/20 hover:border-[#4ecdc4]/40"
          title="Nova conversa"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova
        </button>
      </div>

      {/* Lista scrollável */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          // Skeleton
          <>
            {[0, 60, 120, 180, 240].map((delay) => (
              <SkeletonItem key={delay} delay={delay} />
            ))}
          </>
        ) : conversations.length === 0 ? (
          // Estado vazio
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <p className="text-sm text-white/30 leading-relaxed">
              Sem conversas ainda. Crie uma nova pra começar.
            </p>
          </div>
        ) : (
          // Lista
          conversations.map((conv, index) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConversationId}
              index={index}
              onSelect={() => onSelect(conv.id)}
              onDelete={() => onDelete(conv.id)}
              onRename={(title) => onRename(conv.id, title)}
            />
          ))
        )}
      </div>
    </div>
  );
}
