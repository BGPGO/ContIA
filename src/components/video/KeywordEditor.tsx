'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Loader2, X, Plus, Tag } from 'lucide-react';
import type { Keyword, WordTimestamp } from '@/types/captions';

interface KeywordEditorProps {
  keywords: Keyword[];
  wordsHint?: WordTimestamp[];
  loading?: boolean;
  onChange: (keywords: Keyword[]) => void;
  onRegenerate: () => void;
}

const IMPORTANCE_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Leve',
  2: 'Médio',
  3: 'Máximo',
};

const IMPORTANCE_BG: Record<1 | 2 | 3, string> = {
  1: 'rgba(113, 113, 122, 0.25)',   // cinza suave
  2: 'rgba(247, 194, 4, 0.20)',      // amarelo suave
  3: 'rgba(247, 194, 4, 0.53)',      // amarelo forte
};

const IMPORTANCE_BORDER: Record<1 | 2 | 3, string> = {
  1: 'rgba(113, 113, 122, 0.4)',
  2: 'rgba(247, 194, 4, 0.35)',
  3: 'rgba(247, 194, 4, 0.6)',
};

export const KeywordEditor: React.FC<KeywordEditorProps> = ({
  keywords,
  wordsHint,
  loading = false,
  onChange,
  onRegenerate,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete suggestions from wordsHint
  const suggestions = React.useMemo(() => {
    if (!wordsHint || !inputValue.trim()) return [];
    const lower = inputValue.toLowerCase();
    const alreadyAdded = new Set(keywords.map((k) => k.word.toLowerCase()));
    return wordsHint
      .filter(
        (wt) =>
          wt.word.toLowerCase().includes(lower) &&
          !alreadyAdded.has(wt.word.toLowerCase())
      )
      .map((wt) => wt.word)
      .filter((w, i, arr) => arr.indexOf(w) === i) // deduplicate
      .slice(0, 8);
  }, [wordsHint, inputValue, keywords]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.closest('[data-keyword-input]')?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addKeyword = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    const alreadyExists = keywords.some(
      (k) => k.word.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) return;
    onChange([...keywords, { word: trimmed, importance: 2 }]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeKeyword = (index: number) => {
    onChange(keywords.filter((_, i) => i !== index));
  };

  const updateImportance = (index: number, importance: 1 | 2 | 3) => {
    const updated = keywords.map((k, i) =>
      i === index ? { ...k, importance } : k
    );
    onChange(updated);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && showSuggestions) {
        addKeyword(suggestions[0]);
      } else {
        addKeyword(inputValue);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white">
            Palavras em destaque
          </span>
          {!loading && (
            <span className="text-xs text-zinc-500 font-normal">
              ({keywords.length})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Regenerar
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-zinc-800/50 border border-white/8">
          <Loader2 className="w-4 h-4 text-yellow-400 animate-spin shrink-0" />
          <span className="text-xs text-zinc-400">Detectando palavras-chave...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && keywords.length === 0 && (
        <div className="py-4 text-center space-y-1">
          <p className="text-xs text-zinc-500">
            Nenhuma palavra em destaque ainda.
          </p>
          <p className="text-xs text-zinc-600">
            Clique em <span className="text-zinc-400 font-medium">Regenerar</span> para detectar automaticamente.
          </p>
        </div>
      )}

      {/* Keyword chips list */}
      {!loading && keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw, index) => (
            <div
              key={`${kw.word}-${index}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                backgroundColor: IMPORTANCE_BG[kw.importance],
                borderColor: IMPORTANCE_BORDER[kw.importance],
              }}
            >
              {kw.emoji && (
                <span className="text-sm leading-none">{kw.emoji}</span>
              )}
              <span className="text-white">{kw.word}</span>

              {/* Importance selector */}
              <select
                value={kw.importance}
                onChange={(e) =>
                  updateImportance(index, Number(e.target.value) as 1 | 2 | 3)
                }
                className="bg-transparent text-[10px] text-zinc-400 border-none outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-1 pl-0.5"
                title="Importância"
                aria-label={`Importância de ${kw.word}`}
              >
                <option value={1} className="bg-zinc-900 text-white">
                  {IMPORTANCE_LABELS[1]}
                </option>
                <option value={2} className="bg-zinc-900 text-white">
                  {IMPORTANCE_LABELS[2]}
                </option>
                <option value={3} className="bg-zinc-900 text-white">
                  {IMPORTANCE_LABELS[3]}
                </option>
              </select>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeKeyword(index)}
                className="ml-0.5 text-zinc-500 hover:text-white transition-colors"
                aria-label={`Remover ${kw.word}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add word input */}
      <div className="relative" data-keyword-input="">
        <div className="flex items-center gap-2 bg-zinc-800/60 border border-white/10 rounded-xl px-3 py-2 focus-within:border-yellow-400/40 transition-colors">
          <Plus className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(e.target.value.trim().length > 0);
            }}
            onKeyDown={handleInputKeyDown}
            onFocus={() => {
              if (inputValue.trim()) setShowSuggestions(true);
            }}
            placeholder="Adicionar palavra..."
            className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => addKeyword(inputValue)}
              className="text-[10px] text-yellow-400 hover:text-yellow-300 font-medium transition-colors"
            >
              Adicionar
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/15 rounded-xl overflow-hidden shadow-xl z-50">
            {suggestions.map((word) => (
              <button
                key={word}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur
                  addKeyword(word);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
