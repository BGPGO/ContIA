import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1h

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

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (signErr || !data?.signedUrl) {
    throw new Error(
      `Falha ao gerar signed URL: ${signErr?.message || "sem URL"}`
    );
  }
  return data.signedUrl;
}
