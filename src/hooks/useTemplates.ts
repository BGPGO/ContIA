"use client";

import { useState, useEffect, useCallback } from "react";
import { CreationTemplate } from "@/types/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import * as templatesDb from "@/lib/templates-db";
import * as templatesLocal from "@/lib/templates";

export function useTemplates(empresaId: string | undefined) {
  const [templates, setTemplates] = useState<CreationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const useSupabase = isSupabaseConfigured();

  // ── Load templates ──
  useEffect(() => {
    if (!empresaId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    if (!useSupabase) {
      setTemplates(templatesLocal.getTemplates(empresaId));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    templatesDb
      .listTemplates(supabase, empresaId)
      .then((data) => {
        if (!cancelled) {
          setTemplates(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[useTemplates] Falha ao carregar do Supabase, usando localStorage como fallback:", err);
          setError(err);
          // Fallback to localStorage on error
          setTemplates(templatesLocal.getTemplates(empresaId));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [empresaId, useSupabase]);

  // ── Save (create or update) ──
  const saveTemplate = useCallback(
    (template: CreationTemplate): CreationTemplate => {
      if (!useSupabase) {
        const saved = templatesLocal.saveTemplate(template);
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
      }

      // Supabase path — fire async, update state optimistically
      const supabase = createClient();
      const isExisting = templates.some((t) => t.id === template.id);

      if (isExisting) {
        // Optimistic update
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === template.id
              ? { ...template, updated_at: new Date().toISOString() }
              : t
          )
        );

        templatesDb
          .updateTemplate(supabase, template.id, {
            name: template.name,
            tone: template.tone,
            platforms: template.platforms,
            site_analysis: template.site_analysis,
            ig_analysis: template.ig_analysis,
            visual_style: template.visual_style,
          })
          .then((updated) => {
            setTemplates((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          })
          .catch((err) => {
            console.error("[useTemplates] Falha ao atualizar no Supabase:", err);
            setError(err);
          });
      } else {
        // New template — optimistic add
        setTemplates((prev) => [template, ...prev]);

        supabase.auth
          .getUser()
          .then(({ data: { user } }) => {
            if (!user) throw new Error("Usuário não autenticado");
            return templatesDb.createTemplate(supabase, {
              empresa_id: template.empresa_id,
              name: template.name,
              tone: template.tone,
              platforms: template.platforms,
              site_analysis: template.site_analysis,
              ig_analysis: template.ig_analysis,
              visual_style: template.visual_style,
              user_id: user.id,
            });
          })
          .then((created) => {
            // Replace the optimistic entry with the real one (new id from DB)
            setTemplates((prev) =>
              prev.map((t) => (t.id === template.id ? created : t))
            );
          })
          .catch((err) => {
            console.error("[useTemplates] Falha ao criar no Supabase:", err);
            setError(err);
            // Rollback optimistic add
            setTemplates((prev) => prev.filter((t) => t.id !== template.id));
          });
      }

      return template;
    },
    [useSupabase, templates]
  );

  // ── Delete ──
  const removeTemplate = useCallback(
    (templateId: string) => {
      if (!empresaId) return;

      if (!useSupabase) {
        templatesLocal.deleteTemplate(empresaId, templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        return;
      }

      // Optimistic delete
      const removed = templates.find((t) => t.id === templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));

      const supabase = createClient();
      templatesDb.deleteTemplate(supabase, templateId).catch((err) => {
        console.error("[useTemplates] Falha ao deletar no Supabase:", err);
        setError(err);
        // Rollback
        if (removed) {
          setTemplates((prev) => [...prev, removed]);
        }
      });
    },
    [empresaId, useSupabase, templates]
  );

  return { templates, loading, error, saveTemplate, removeTemplate };
}
