"use client";

import { useState, useEffect, useCallback } from "react";

export interface SetupStep {
  id: string;
  done: boolean;
  notes: string;
}

const PREFIX = "setup:";

function getKey(cardId: string, field: "done" | "notes") {
  return `${PREFIX}${cardId}:${field}`;
}

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // localStorage full or blocked
  }
}

export function useSetupProgress(
  cardIds: string[],
  defaultDone: Record<string, boolean> = {}
) {
  const [steps, setSteps] = useState<Record<string, SetupStep>>({});
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount; fall back to defaultDone when no stored value exists
  useEffect(() => {
    const initial: Record<string, SetupStep> = {};
    for (const id of cardIds) {
      const stored = safeGet(getKey(id, "done"));
      const done = stored !== null ? stored === "true" : (defaultDone[id] ?? false);
      const notes = safeGet(getKey(id, "notes")) ?? "";
      initial[id] = { id, done, notes };
    }
    setSteps(initial);
    setLoaded(true);
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const toggleDone = useCallback((cardId: string) => {
    setSteps((prev) => {
      const current = prev[cardId];
      if (!current) return prev;
      const next = { ...current, done: !current.done };
      safeSet(getKey(cardId, "done"), String(next.done));
      return { ...prev, [cardId]: next };
    });
  }, []);

  const setDone = useCallback((cardId: string, done: boolean) => {
    setSteps((prev) => {
      const current = prev[cardId];
      if (!current) return prev;
      const next = { ...current, done };
      safeSet(getKey(cardId, "done"), String(done));
      return { ...prev, [cardId]: next };
    });
  }, []);

  const setNotes = useCallback((cardId: string, notes: string) => {
    setSteps((prev) => {
      const current = prev[cardId];
      if (!current) return prev;
      const next = { ...current, notes };
      safeSet(getKey(cardId, "notes"), notes);
      return { ...prev, [cardId]: next };
    });
  }, []);

  const completedCount = Object.values(steps).filter((s) => s.done).length;
  const totalCount = cardIds.length;

  return {
    steps,
    loaded,
    toggleDone,
    setDone,
    setNotes,
    completedCount,
    totalCount,
  };
}
