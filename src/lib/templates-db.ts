import { SupabaseClient } from "@supabase/supabase-js";
import { CreationTemplate } from "@/types/ai";

// ── Mappers: DB row <-> CreationTemplate ──

interface TemplateRow {
  id: string;
  empresa_id: string;
  user_id: string;
  name: string;
  tone: string | null;
  platforms: string[] | null;
  site_analysis: unknown;
  ig_analysis: unknown;
  visual_style: unknown;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(row: TemplateRow): CreationTemplate {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    name: row.name,
    tone: (row.tone as CreationTemplate["tone"]) || "formal",
    platforms: row.platforms || [],
    site_analysis: row.site_analysis as CreationTemplate["site_analysis"],
    ig_analysis: row.ig_analysis as CreationTemplate["ig_analysis"],
    visual_style: row.visual_style as CreationTemplate["visual_style"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── CRUD ──

export async function listTemplates(
  supabase: SupabaseClient,
  empresaId: string
): Promise<CreationTemplate[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as TemplateRow[]).map(rowToTemplate);
}

export async function createTemplate(
  supabase: SupabaseClient,
  template: Omit<CreationTemplate, "id" | "created_at" | "updated_at"> & {
    user_id: string;
  }
): Promise<CreationTemplate> {
  const { data, error } = await supabase
    .from("templates")
    .insert({
      empresa_id: template.empresa_id,
      user_id: template.user_id,
      name: template.name,
      tone: template.tone || null,
      platforms: template.platforms || [],
      site_analysis: template.site_analysis || null,
      ig_analysis: template.ig_analysis || null,
      visual_style: template.visual_style || null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToTemplate(data as TemplateRow);
}

export async function updateTemplate(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<CreationTemplate>
): Promise<CreationTemplate> {
  // Only send fields that exist in the DB table
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.tone !== undefined) payload.tone = updates.tone;
  if (updates.platforms !== undefined) payload.platforms = updates.platforms;
  if (updates.site_analysis !== undefined)
    payload.site_analysis = updates.site_analysis;
  if (updates.ig_analysis !== undefined)
    payload.ig_analysis = updates.ig_analysis;
  if (updates.visual_style !== undefined)
    payload.visual_style = updates.visual_style;

  const { data, error } = await supabase
    .from("templates")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return rowToTemplate(data as TemplateRow);
}

export async function deleteTemplate(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) throw error;
}
