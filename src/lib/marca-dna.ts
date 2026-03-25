import { SupabaseClient } from "@supabase/supabase-js";
import { MarcaDNA } from "@/types";

export async function getMarcaDNA(supabase: SupabaseClient, empresaId: string): Promise<MarcaDNA | null> {
  const { data, error } = await supabase
    .from("marca_dna")
    .select("*")
    .eq("empresa_id", empresaId)
    .single();
  if (error) return null;
  return data as MarcaDNA;
}

export async function upsertMarcaDNA(supabase: SupabaseClient, empresaId: string, updates: Partial<MarcaDNA>): Promise<MarcaDNA> {
  const { data, error } = await supabase
    .from("marca_dna")
    .upsert({ empresa_id: empresaId, ...updates }, { onConflict: "empresa_id" })
    .select()
    .single();
  if (error) throw error;
  return data as MarcaDNA;
}

export async function deleteMarcaDNA(supabase: SupabaseClient, empresaId: string): Promise<void> {
  const { error } = await supabase.from("marca_dna").delete().eq("empresa_id", empresaId);
  if (error) throw error;
}
