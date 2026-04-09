import { SupabaseClient } from "@supabase/supabase-js";
import {
  CopySession,
  CopyContent,
  CopyChatMessage,
  CopySessionStatus,
} from "@/types/copy-studio";
import { ContentFormat, ContentTone } from "@/types/ai";

// ── Mappers: DB row <-> CopySession ──

interface CopySessionRow {
  id: string;
  empresa_id: string;
  user_id: string;
  title: string;
  format: string;
  tone: string;
  platforms: string[] | null;
  topic: string | null;
  current_copy: unknown;
  messages: unknown;
  dna_context: unknown;
  style_profile: unknown;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: CopySessionRow): CopySession {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    user_id: row.user_id,
    title: row.title,
    format: (row.format as ContentFormat) || "post",
    tone: (row.tone as ContentTone) || "casual",
    platforms: row.platforms || [],
    topic: row.topic || "",
    current_copy: (row.current_copy as CopyContent) || null,
    messages: (row.messages as CopyChatMessage[]) || [],
    dna_context: (row.dna_context as Record<string, unknown>) || null,
    style_profile: (row.style_profile as Record<string, unknown>) || null,
    status: (row.status as CopySessionStatus) || "draft",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── CRUD ──

export async function listCopySessions(
  supabase: SupabaseClient,
  empresaId: string
): Promise<CopySession[]> {
  const { data, error } = await supabase
    .from("copy_sessions")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as CopySessionRow[]).map(rowToSession);
}

export async function getCopySession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<CopySession> {
  const { data, error } = await supabase
    .from("copy_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return rowToSession(data as CopySessionRow);
}

export async function createCopySession(
  supabase: SupabaseClient,
  session: Omit<CopySession, "id" | "created_at" | "updated_at">
): Promise<CopySession> {
  const { data, error } = await supabase
    .from("copy_sessions")
    .insert({
      empresa_id: session.empresa_id,
      user_id: session.user_id,
      title: session.title,
      format: session.format || "post",
      tone: session.tone || "casual",
      platforms: session.platforms || [],
      topic: session.topic || "",
      current_copy: session.current_copy || null,
      messages: session.messages || [],
      dna_context: session.dna_context || null,
      style_profile: session.style_profile || null,
      status: session.status || "draft",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToSession(data as CopySessionRow);
}

export async function updateCopySession(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Partial<CopySession>
): Promise<CopySession> {
  // Only send fields that exist in the DB table
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.format !== undefined) payload.format = updates.format;
  if (updates.tone !== undefined) payload.tone = updates.tone;
  if (updates.platforms !== undefined) payload.platforms = updates.platforms;
  if (updates.topic !== undefined) payload.topic = updates.topic;
  if (updates.current_copy !== undefined) payload.current_copy = updates.current_copy;
  if (updates.messages !== undefined) payload.messages = updates.messages;
  if (updates.dna_context !== undefined) payload.dna_context = updates.dna_context;
  if (updates.style_profile !== undefined) payload.style_profile = updates.style_profile;
  if (updates.status !== undefined) payload.status = updates.status;

  const { data, error } = await supabase
    .from("copy_sessions")
    .update(payload)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return rowToSession(data as CopySessionRow);
}

export async function deleteCopySession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from("copy_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}
