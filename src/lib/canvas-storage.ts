import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Converte uma data URL base64 (PNG/JPEG/WebP) em Blob.
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = dataUrl.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const binary = atob(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext };
}

/**
 * Percorre um canvas_json do Fabric e substitui qualquer `src` data-URL
 * por um URL público do Supabase Storage. Retorna um NOVO objeto (não muta).
 *
 * Uso: chamar antes de persistir um template pra evitar estouro do limite de payload.
 *
 * Se o upload falhar ou supabase não estiver configurado, mantém a data URL original
 * (fallback gracioso — o save vai quebrar, mas não por causa desta função).
 */
export async function externalizeCanvasImages(
  canvasJson: unknown,
  supabase: SupabaseClient,
  empresaId: string
): Promise<unknown> {
  if (!canvasJson || typeof canvasJson !== "object") return canvasJson;
  const json = JSON.parse(JSON.stringify(canvasJson)) as Record<string, unknown>;

  // Collect all nodes that might have a data-URL src, recursive
  const queue: Record<string, unknown>[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (typeof obj.src === "string" && obj.src.startsWith("data:image/")) {
      queue.push(obj);
    }
    // Fabric objects[] array (template) + slides (carousel)
    if (Array.isArray((obj as Record<string, unknown>).objects)) {
      for (const child of (obj as Record<string, unknown[]>).objects as unknown[]) walk(child);
    }
    if (Array.isArray((obj as Record<string, unknown>).slides)) {
      for (const slide of (obj as Record<string, unknown[]>).slides as unknown[]) walk(slide);
    }
  }
  walk(json);

  if (queue.length === 0) return json;

  // Upload in parallel with a small concurrency cap
  const CONCURRENCY = 4;
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= queue.length) break;
      const node = queue[i];
      const src = node.src as string;
      const converted = dataUrlToBlob(src);
      if (!converted) continue;
      const path = `${empresaId}/canvas/${crypto.randomUUID()}.${converted.ext}`;
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(path, converted.blob, {
          contentType: converted.blob.type,
          upsert: false,
        });
      if (error) {
        console.warn("[canvas-storage] upload failed, keeping data URL:", error.message);
        continue;
      }
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      if (pub?.publicUrl) node.src = pub.publicUrl;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return json;
}
