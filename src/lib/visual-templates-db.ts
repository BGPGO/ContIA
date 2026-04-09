import { SupabaseClient } from "@supabase/supabase-js";
import {
  VisualTemplate,
  VisualTemplateSummary,
} from "@/types/canvas";

// ── Mappers: DB row <-> VisualTemplate ──

interface VisualTemplateRow {
  id: string;
  empresa_id: string;
  user_id: string;
  name: string;
  description: string;
  canvas_json: unknown;
  thumbnail_url: string | null;
  format: string;
  aspect_ratio: string;
  source: string;
  source_image_url: string | null;
  ai_prompt: string | null;
  tags: string[] | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(row: VisualTemplateRow): VisualTemplate {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    user_id: row.user_id,
    name: row.name,
    description: row.description || "",
    canvas_json: (row.canvas_json as object) || {},
    thumbnail_url: row.thumbnail_url,
    format: (row.format as VisualTemplate["format"]) || "post",
    aspect_ratio: (row.aspect_ratio as VisualTemplate["aspect_ratio"]) || "1:1",
    source: (row.source as VisualTemplate["source"]) || "manual",
    source_image_url: row.source_image_url,
    ai_prompt: row.ai_prompt,
    tags: row.tags || [],
    is_public: row.is_public ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToSummary(row: VisualTemplateRow): VisualTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    thumbnail_url: row.thumbnail_url,
    format: row.format || "post",
    aspect_ratio: row.aspect_ratio || "1:1",
    source: row.source || "manual",
    tags: row.tags || [],
    updated_at: row.updated_at,
  };
}

// Summary columns — excludes heavy canvas_json
const SUMMARY_COLUMNS =
  "id, name, thumbnail_url, format, aspect_ratio, source, tags, updated_at";

// ── CRUD ──

export async function listVisualTemplates(
  supabase: SupabaseClient,
  empresaId: string
): Promise<VisualTemplateSummary[]> {
  const { data, error } = await supabase
    .from("visual_templates")
    .select(SUMMARY_COLUMNS)
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as VisualTemplateRow[]).map(rowToSummary);
}

export async function getVisualTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<VisualTemplate> {
  const { data, error } = await supabase
    .from("visual_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) throw error;
  return rowToTemplate(data as VisualTemplateRow);
}

export async function createVisualTemplate(
  supabase: SupabaseClient,
  template: Omit<VisualTemplate, "id" | "created_at" | "updated_at">
): Promise<VisualTemplate> {
  const { data, error } = await supabase
    .from("visual_templates")
    .insert({
      empresa_id: template.empresa_id,
      user_id: template.user_id,
      name: template.name,
      description: template.description || "",
      canvas_json: template.canvas_json || {},
      thumbnail_url: template.thumbnail_url || null,
      format: template.format || "post",
      aspect_ratio: template.aspect_ratio || "1:1",
      source: template.source || "manual",
      source_image_url: template.source_image_url || null,
      ai_prompt: template.ai_prompt || null,
      tags: template.tags || [],
      is_public: template.is_public ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToTemplate(data as VisualTemplateRow);
}

export async function updateVisualTemplate(
  supabase: SupabaseClient,
  templateId: string,
  updates: Partial<VisualTemplate>
): Promise<VisualTemplate> {
  // Only send fields that exist in the DB table
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.canvas_json !== undefined) payload.canvas_json = updates.canvas_json;
  if (updates.thumbnail_url !== undefined) payload.thumbnail_url = updates.thumbnail_url;
  if (updates.format !== undefined) payload.format = updates.format;
  if (updates.aspect_ratio !== undefined) payload.aspect_ratio = updates.aspect_ratio;
  if (updates.source !== undefined) payload.source = updates.source;
  if (updates.source_image_url !== undefined) payload.source_image_url = updates.source_image_url;
  if (updates.ai_prompt !== undefined) payload.ai_prompt = updates.ai_prompt;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.is_public !== undefined) payload.is_public = updates.is_public;

  const { data, error } = await supabase
    .from("visual_templates")
    .update(payload)
    .eq("id", templateId)
    .select()
    .single();

  if (error) throw error;
  return rowToTemplate(data as VisualTemplateRow);
}

export async function deleteVisualTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<void> {
  const { error } = await supabase
    .from("visual_templates")
    .delete()
    .eq("id", templateId);

  if (error) throw error;
}

export async function duplicateVisualTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<VisualTemplate> {
  // Fetch the original
  const original = await getVisualTemplate(supabase, templateId);

  // Create a copy with "(cópia)" suffix
  return createVisualTemplate(supabase, {
    empresa_id: original.empresa_id,
    user_id: original.user_id,
    name: `${original.name} (cópia)`,
    description: original.description,
    canvas_json: original.canvas_json,
    thumbnail_url: original.thumbnail_url,
    format: original.format,
    aspect_ratio: original.aspect_ratio,
    source: original.source,
    source_image_url: original.source_image_url,
    ai_prompt: original.ai_prompt,
    tags: original.tags,
    is_public: false, // Copies are private by default
  });
}
