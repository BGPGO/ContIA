"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Search,
  Plus,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Library,
  Layers,
} from "lucide-react";
import type { ConversationSummary } from "@/hooks/useCreativeChat";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface CreativesLibraryProps {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onNewConversation: () => void;
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
  if (diffDays < 30) return `${diffDays} dias atrás`;
  return new Date(isoString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════════════
// SKELETON CARD
// ═══════════════════════════════════════════════════════════════════════

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="aspect-[1/1.25] rounded-xl bg-white/5 animate-pulse overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-full h-full bg-gradient-to-b from-white/5 to-white/10" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CREATIVE CARD
// ═══════════════════════════════════════════════════════════════════════

interface CreativeCardProps {
  conv: ConversationSummary;
  isActive: boolean;
  index: number;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

function CreativeCard({
  conv,
  isActive,
  index,
  onSelect,
  onDelete,
  onRename,
}: CreativeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input quando entra em modo de edição
  useEffect(() => {
    if (editMode) {
      setEditValue(conv.title);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editMode, conv.title]);

  // Fecha menu ao clicar fora
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

  function handleCardClick() {
    if (!editMode) {
      onSelect();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className={`group relative aspect-[1/1.25] rounded-xl overflow-hidden cursor-pointer border transition-all duration-150 ${
        isActive
          ? "ring-2 ring-[#4ecdc4] border-[#4ecdc4]/50"
          : "border-white/10 hover:border-[#4ecdc4]/40"
      }`}
      onClick={handleCardClick}
    >
      {/* Thumb ou placeholder */}
      {conv.thumbUrl ? (
        <img
          src={conv.thumbUrl}
          alt={conv.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#0d1025] via-[#111530] to-[#0a0d1f] flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-white/15" />
        </div>
      )}

      {/* Badge de slides para carrosséis */}
      {conv.slidesCount && conv.slidesCount > 1 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-semibold z-10">
          <Layers className="w-3 h-3" />
          <span>{conv.slidesCount} slides</span>
        </div>
      )}

      {/* Overlay gradiente no bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

      {/* Conteúdo do overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {editMode ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-black/40 border border-[#4ecdc4]/60 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-[#4ecdc4] placeholder-white/40"
          />
        ) : (
          <p className="text-xs font-medium text-white/90 leading-snug line-clamp-2 pr-6">
            {conv.title}
          </p>
        )}
        {!editMode && (
          <p className="text-[10px] text-white/40 mt-0.5">
            {relativeDate(conv.updatedAt)}
          </p>
        )}
      </div>

      {/* Botão de menu "..." */}
      {!editMode && (
        <div
          className="absolute top-2 right-2"
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={`w-6 h-6 rounded-md flex items-center justify-center text-white/60 hover:text-white bg-black/50 hover:bg-black/70 transition-all ${
              menuOpen
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
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

      {/* Badge "ativo" */}
      {isActive && (
        <div className="absolute top-2 left-2">
          <div className="w-2 h-2 rounded-full bg-[#4ecdc4] shadow-[0_0_6px_rgba(78,205,196,0.8)]" />
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function CreativesLibrary({
  open,
  onClose,
  conversations,
  activeConversationId,
  loading,
  onSelect,
  onDelete,
  onRename,
  onNewConversation,
}: CreativesLibraryProps) {
  const [query, setQuery] = useState("");

  // Reset busca ao abrir
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Fechar com Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Filtra conversas pela busca
  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      )
    : conversations;

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleNewConversation = useCallback(() => {
    onNewConversation();
    onClose();
  }, [onNewConversation, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-6xl max-h-[90vh] rounded-2xl bg-[#0d1025] border border-white/10 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#4ecdc4]/15 flex items-center justify-center">
                    <Library className="w-4.5 h-4.5 text-[#4ecdc4]" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Biblioteca de Criativos
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      Todos os criativos que você gerou
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Linha de ações */}
              <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-white/6">
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4ecdc4] hover:bg-[#4ecdc4]/90 text-bg-primary text-sm font-semibold transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Nova conversa
                </button>

                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar criativos..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#4ecdc4]/40 focus:bg-white/8 transition-all"
                  />
                </div>

                {!loading && (
                  <span className="text-xs text-white/30 shrink-0">
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "criativo" : "criativos"}
                  </span>
                )}
              </div>

              {/* Conteúdo scrollável */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {loading ? (
                  // Skeleton grid
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonCard key={i} delay={i * 60} />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  // Estado vazio (sem conversas ainda)
                  <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-white/20" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/60">
                        Nenhum criativo ainda
                      </p>
                      <p className="text-xs text-white/30 mt-1">
                        Crie seu primeiro criativo para começar
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleNewConversation}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4ecdc4] hover:bg-[#4ecdc4]/90 text-bg-primary text-sm font-semibold transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Nova conversa
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  // Empty de busca
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                    <Search className="w-8 h-8 text-white/15" />
                    <div>
                      <p className="text-sm text-white/50">
                        Nenhum resultado para &ldquo;{query}&rdquo;
                      </p>
                      <p className="text-xs text-white/30 mt-1">
                        Tente outro termo de busca
                      </p>
                    </div>
                  </div>
                ) : (
                  // Grid de cards
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map((conv, index) => (
                      <CreativeCard
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === activeConversationId}
                        index={index}
                        onSelect={() => handleSelect(conv.id)}
                        onDelete={() => onDelete(conv.id)}
                        onRename={(title) => onRename(conv.id, title)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
