import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadPng(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  buffer: Buffer
): Promise<string> {
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Falha ao gerar URL pública");
  }
  return data.publicUrl;
}

/**
 * Converte signed URL do Supabase pra public URL.
 * Se a URL já é pública, retorna como está.
 * Retorna null para entradas nulas/undefined.
 *
 * Formato signed: https://{ref}.supabase.co/storage/v1/object/sign/{bucket}/{path}?token=...
 * Formato public: https://{ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
export function toPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("/object/public/")) return url;
  if (url.includes("/object/sign/")) {
    // Remove query string e troca /sign/ por /public/
    const [base] = url.split("?");
    return base.replace("/object/sign/", "/object/public/");
  }
  return url;
}
