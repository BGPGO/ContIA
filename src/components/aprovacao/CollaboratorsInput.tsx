"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface CollaboratorsInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  disabled?: boolean;
}

const HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

export function CollaboratorsInput({
  value,
  onChange,
  max = 3,
  disabled = false,
}: CollaboratorsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function sanitize(raw: string): string {
    return raw.trim().replace(/^@+/, "").toLowerCase();
  }

  function addHandle(raw: string) {
    const handle = sanitize(raw);
    if (!handle) return;

    if (value.length >= max) {
      setError(`Máximo de ${max} colaboradores atingido.`);
      return;
    }

    if (!HANDLE_REGEX.test(handle)) {
      setError(
        "Handle inválido. Use apenas letras, números, ponto ou underscore (máx. 30 caracteres)."
      );
      return;
    }

    if (value.includes(handle)) {
      setError("Esse colaborador já foi adicionado.");
      return;
    }

    setError(null);
    onChange([...value, handle]);
    setInputValue("");
  }

  function removeHandle(handle: string) {
    onChange(value.filter((h) => h !== handle));
    setError(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addHandle(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeHandle(value[value.length - 1]);
    }
  }

  const atMax = value.length >= max;

  return (
    <div className="space-y-2">
      {/* Chips container + inline input */}
      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        className={`flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2 rounded-xl bg-bg-card/80 border transition-all duration-200 cursor-text ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } border-border/60 focus-within:border-[#4ecdc4]/40 focus-within:ring-1 focus-within:ring-[#4ecdc4]/20`}
      >
        <AnimatePresence initial={false}>
          {value.map((handle) => (
            <motion.span
              key={handle}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[12px] font-medium bg-bg-card-hover/60 text-text-primary border border-border/40 hover:bg-bg-card-hover transition-colors"
            >
              @{handle}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeHandle(handle);
                  }}
                  className="ml-0.5 text-text-muted hover:text-[#f87171] transition-colors leading-none"
                  aria-label={`Remover @${handle}`}
                >
                  <X size={11} />
                </button>
              )}
            </motion.span>
          ))}
        </AnimatePresence>

        {!atMax && !disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addHandle(inputValue);
            }}
            placeholder={value.length === 0 ? "@usuario" : ""}
            className="flex-1 min-w-[80px] bg-transparent text-[13px] text-text-primary placeholder-text-muted/60 outline-none"
            disabled={disabled}
          />
        )}
      </div>

      {/* Inline error */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="collab-error"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="text-[11px] text-[#f87171]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Helper text */}
      <p className="text-[11px] text-text-muted leading-snug">
        Máximo {max} colaboradores. Eles precisam aceitar o convite no Instagram
        após a publicação.
      </p>
    </div>
  );
}
