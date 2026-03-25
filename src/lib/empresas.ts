import { SupabaseClient } from "@supabase/supabase-js";
import { Empresa } from "@/types";

type EmpresaInsert = Omit<Empresa, "id" | "created_at" | "updated_at"> & { user_id: string };
type EmpresaUpdate = Partial<Omit<Empresa, "id" | "created_at" | "updated_at">>;

export async function listEmpresas(supabase: SupabaseClient): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Empresa[];
}

export async function getEmpresa(supabase: SupabaseClient, id: string): Promise<Empresa | null> {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Empresa;
}

export async function createEmpresa(
  supabase: SupabaseClient,
  data: Omit<EmpresaInsert, "user_id">
): Promise<Empresa> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: empresa, error } = await supabase
    .from("empresas")
    .insert({ ...data, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return empresa as Empresa;
}

export async function updateEmpresa(
  supabase: SupabaseClient,
  id: string,
  data: EmpresaUpdate
): Promise<Empresa> {
  const { data: empresa, error } = await supabase
    .from("empresas")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return empresa as Empresa;
}

export async function deleteEmpresa(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("empresas")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
