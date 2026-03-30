"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomTemplate } from "@/types/custom-template";

const STORAGE_KEY = "contia_custom_templates";

export function useCustomTemplates(empresaId: string | undefined) {
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    if (!empresaId) { setLoading(false); return; }
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${empresaId}`);
      if (stored) setTemplates(JSON.parse(stored));
    } catch { /* ignore */ }
    setLoading(false);
  }, [empresaId]);

  // Persist to localStorage
  const persist = useCallback((items: CustomTemplate[]) => {
    if (!empresaId) return;
    localStorage.setItem(`${STORAGE_KEY}_${empresaId}`, JSON.stringify(items));
  }, [empresaId]);

  const saveTemplate = useCallback((template: CustomTemplate) => {
    setTemplates((prev) => {
      const exists = prev.findIndex((t) => t.id === template.id);
      const next = exists >= 0
        ? prev.map((t) => (t.id === template.id ? template : t))
        : [...prev, template];
      persist(next);
      return next;
    });
  }, [persist]);

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const duplicateTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const original = prev.find((t) => t.id === id);
      if (!original) return prev;
      const copy: CustomTemplate = {
        ...original,
        id: crypto.randomUUID(),
        name: `${original.name} (copia)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const next = [...prev, copy];
      persist(next);
      return next;
    });
  }, [persist]);

  return { templates, loading, saveTemplate, removeTemplate, duplicateTemplate };
}
