"use client";

import { useState, useEffect, useCallback } from "react";
import { CreationTemplate } from "@/types/ai";
import * as templatesLib from "@/lib/templates";

export function useTemplates(empresaId: string | undefined) {
  const [templates, setTemplates] = useState<CreationTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    setTemplates(templatesLib.getTemplates(empresaId));
    setLoading(false);
  }, [empresaId]);

  const saveTemplate = useCallback(
    (template: CreationTemplate) => {
      const saved = templatesLib.saveTemplate(template);
      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      return saved;
    },
    []
  );

  const removeTemplate = useCallback(
    (templateId: string) => {
      if (!empresaId) return;
      templatesLib.deleteTemplate(empresaId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    },
    [empresaId]
  );

  return { templates, loading, saveTemplate, removeTemplate };
}
