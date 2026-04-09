"use client";

import { useState, useEffect, useCallback } from "react";
import type { VisualTemplate, VisualTemplateSummary } from "@/types/canvas";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import * as visualTemplatesDb from "@/lib/visual-templates-db";

/* ═══════════════════════════════════════════════════════════════════════════
   localStorage fallback
   ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "contia_visual_templates";

function getLocalTemplates(empresaId: string): VisualTemplateSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${empresaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalTemplates(empresaId: string, items: VisualTemplateSummary[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}_${empresaId}`, JSON.stringify(items));
}

function getLocalTemplate(empresaId: string, id: string): VisualTemplate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_full_${empresaId}_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalTemplate(empresaId: string, template: VisualTemplate) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `${STORAGE_KEY}_full_${empresaId}_${template.id}`,
    JSON.stringify(template)
  );
  // Also update summary list
  const summaries = getLocalTemplates(empresaId);
  const summary: VisualTemplateSummary = {
    id: template.id,
    name: template.name,
    thumbnail_url: template.thumbnail_url,
    format: template.format,
    aspect_ratio: template.aspect_ratio,
    source: template.source,
    tags: template.tags,
    updated_at: template.updated_at,
  };
  const idx = summaries.findIndex((s) => s.id === template.id);
  if (idx >= 0) {
    summaries[idx] = summary;
  } else {
    summaries.unshift(summary);
  }
  setLocalTemplates(empresaId, summaries);
}

function removeLocalTemplate(empresaId: string, id: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_KEY}_full_${empresaId}_${id}`);
  const summaries = getLocalTemplates(empresaId).filter((s) => s.id !== id);
  setLocalTemplates(empresaId, summaries);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UseVisualTemplatesReturn {
  templates: VisualTemplateSummary[];
  isLoading: boolean;
  error: string | null;
  fetchTemplates: () => Promise<void>;
  saveTemplate: (
    template: Omit<VisualTemplate, "id" | "created_at" | "updated_at" | "user_id">
  ) => Promise<string>;
  updateTemplate: (id: string, updates: Partial<VisualTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<string>;
}

export function useVisualTemplates(
  empresaId: string | undefined
): UseVisualTemplatesReturn {
  const [templates, setTemplates] = useState<VisualTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const useSupabase = isSupabaseConfigured();

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    if (!empresaId) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    if (!useSupabase) {
      setTemplates(getLocalTemplates(empresaId));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const data = await visualTemplatesDb.listVisualTemplates(supabase, empresaId);
      setTemplates(data);
    } catch (err) {
      console.error("[useVisualTemplates] Falha ao carregar:", err);
      setError((err as Error).message);
      // Fallback to localStorage
      setTemplates(getLocalTemplates(empresaId));
    } finally {
      setIsLoading(false);
    }
  }, [empresaId, useSupabase]);

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    fetchTemplates().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchTemplates]);

  // ── Save (create) ──
  const saveTemplate = useCallback(
    async (
      template: Omit<VisualTemplate, "id" | "created_at" | "updated_at" | "user_id">
    ): Promise<string> => {
      if (!empresaId) throw new Error("empresaId obrigatorio");

      const now = new Date().toISOString();
      const optimisticId = crypto.randomUUID();

      // Optimistic summary
      const optimisticSummary: VisualTemplateSummary = {
        id: optimisticId,
        name: template.name,
        thumbnail_url: template.thumbnail_url,
        format: template.format,
        aspect_ratio: template.aspect_ratio,
        source: template.source,
        tags: template.tags,
        updated_at: now,
      };

      setTemplates((prev) => [optimisticSummary, ...prev]);

      if (!useSupabase) {
        const fullTemplate: VisualTemplate = {
          ...template,
          id: optimisticId,
          user_id: "local",
          created_at: now,
          updated_at: now,
        };
        setLocalTemplate(empresaId, fullTemplate);
        return optimisticId;
      }

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuario nao autenticado");

        const created = await visualTemplatesDb.createVisualTemplate(supabase, {
          ...template,
          empresa_id: empresaId,
          user_id: user.id,
        });

        // Replace optimistic entry with real one
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === optimisticId
              ? {
                  id: created.id,
                  name: created.name,
                  thumbnail_url: created.thumbnail_url,
                  format: created.format,
                  aspect_ratio: created.aspect_ratio,
                  source: created.source,
                  tags: created.tags,
                  updated_at: created.updated_at,
                }
              : t
          )
        );

        return created.id;
      } catch (err) {
        console.error("[useVisualTemplates] Falha ao criar:", err);
        setError((err as Error).message);
        // Rollback
        setTemplates((prev) => prev.filter((t) => t.id !== optimisticId));
        throw err;
      }
    },
    [empresaId, useSupabase]
  );

  // ── Update ──
  const updateTemplate = useCallback(
    async (id: string, updates: Partial<VisualTemplate>): Promise<void> => {
      if (!empresaId) return;

      // Optimistic update
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.thumbnail_url !== undefined && {
                  thumbnail_url: updates.thumbnail_url,
                }),
                ...(updates.format !== undefined && { format: updates.format }),
                ...(updates.aspect_ratio !== undefined && {
                  aspect_ratio: updates.aspect_ratio,
                }),
                ...(updates.tags !== undefined && { tags: updates.tags }),
                updated_at: new Date().toISOString(),
              }
            : t
        )
      );

      if (!useSupabase) {
        const existing = getLocalTemplate(empresaId, id);
        if (existing) {
          setLocalTemplate(empresaId, {
            ...existing,
            ...updates,
            updated_at: new Date().toISOString(),
          });
        }
        return;
      }

      try {
        const supabase = createClient();
        await visualTemplatesDb.updateVisualTemplate(supabase, id, updates);
      } catch (err) {
        console.error("[useVisualTemplates] Falha ao atualizar:", err);
        setError((err as Error).message);
        // Refresh to get correct state
        fetchTemplates();
      }
    },
    [empresaId, useSupabase, fetchTemplates]
  );

  // ── Delete ──
  const deleteTemplate = useCallback(
    async (id: string): Promise<void> => {
      if (!empresaId) return;

      // Optimistic delete
      const removed = templates.find((t) => t.id === id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));

      if (!useSupabase) {
        removeLocalTemplate(empresaId, id);
        return;
      }

      try {
        const supabase = createClient();
        await visualTemplatesDb.deleteVisualTemplate(supabase, id);
      } catch (err) {
        console.error("[useVisualTemplates] Falha ao deletar:", err);
        setError((err as Error).message);
        // Rollback
        if (removed) {
          setTemplates((prev) => [...prev, removed]);
        }
      }
    },
    [empresaId, useSupabase, templates]
  );

  // ── Duplicate ──
  const duplicateTemplate = useCallback(
    async (id: string): Promise<string> => {
      if (!empresaId) throw new Error("empresaId obrigatorio");

      if (!useSupabase) {
        const original = getLocalTemplate(empresaId, id);
        if (!original) throw new Error("Template nao encontrado");
        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        const copy: VisualTemplate = {
          ...original,
          id: newId,
          name: `${original.name} (copia)`,
          is_public: false,
          created_at: now,
          updated_at: now,
        };
        setLocalTemplate(empresaId, copy);
        setTemplates((prev) => [
          {
            id: copy.id,
            name: copy.name,
            thumbnail_url: copy.thumbnail_url,
            format: copy.format,
            aspect_ratio: copy.aspect_ratio,
            source: copy.source,
            tags: copy.tags,
            updated_at: copy.updated_at,
          },
          ...prev,
        ]);
        return newId;
      }

      try {
        const supabase = createClient();
        const created = await visualTemplatesDb.duplicateVisualTemplate(
          supabase,
          id
        );

        // Add to list
        setTemplates((prev) => [
          {
            id: created.id,
            name: created.name,
            thumbnail_url: created.thumbnail_url,
            format: created.format,
            aspect_ratio: created.aspect_ratio,
            source: created.source,
            tags: created.tags,
            updated_at: created.updated_at,
          },
          ...prev,
        ]);

        return created.id;
      } catch (err) {
        console.error("[useVisualTemplates] Falha ao duplicar:", err);
        setError((err as Error).message);
        throw err;
      }
    },
    [empresaId, useSupabase]
  );

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  };
}
