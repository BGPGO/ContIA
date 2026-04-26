/**
 * clip-uploader.ts — Upload de clip MP4 renderizado pro Supabase Storage bucket `cuts`.
 *
 * Path no bucket: ${user_id}/${project_id}/${cut_id}.mp4
 * Signed URL válida por 7 dias (604800 segundos).
 *
 * Usa service client (bypass RLS) pois roda dentro do job pipeline.
 */

import fs from 'fs';
import { createServiceClient } from '@/lib/supabase/service';
import { STORAGE_BUCKETS } from './constants';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface UploadClipOptions {
  /** Path absoluto do MP4 local a ser enviado. */
  localPath: string;
  /** ID do video_project — usado no caminho do bucket. */
  projectId: string;
  /** ID do corte (VideoCutV2.id) — nome do arquivo no bucket. */
  cutId: string;
}

export interface UploadClipResult {
  /** Caminho relativo no bucket (ex: "user123/proj456/cut789.mp4"). */
  storage_path: string;
  /** Signed URL válida por 7 dias. */
  signed_url: string;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Faz upload do MP4 renderizado pro bucket `cuts`.
 *
 * 1. Descobre o user_id via query em video_projects
 * 2. Monta path: ${user_id}/${project_id}/${cut_id}.mp4
 * 3. Faz upload com upsert=true (idempotente — safe para rerender)
 * 4. Gera signed URL com validade de 7 dias
 *
 * @throws Error se upload ou geração de signed URL falhar
 */
export async function uploadClip(opts: UploadClipOptions): Promise<UploadClipResult> {
  const { localPath, projectId, cutId } = opts;

  const supabase = createServiceClient();

  // ─── 1. Buscar user_id do projeto ─────────────────────────────────────────
  const { data: project, error: projectError } = await supabase
    .from('video_projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (projectError || !project?.user_id) {
    throw new Error(
      `[clip-uploader] Falha ao buscar user_id do projeto '${projectId}': ` +
        (projectError?.message ?? 'projeto não encontrado ou user_id nulo')
    );
  }

  const userId = project.user_id as string;

  // ─── 2. Montar path no bucket ─────────────────────────────────────────────
  // Sanitizar IDs para evitar path traversal
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCutId = cutId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `${safeUserId}/${safeProjectId}/${safeCutId}.mp4`;

  // ─── 3. Ler arquivo do disco ───────────────────────────────────────────────
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.promises.readFile(localPath);
  } catch (err) {
    throw new Error(
      `[clip-uploader] Falha ao ler arquivo local '${localPath}': ` +
        (err instanceof Error ? err.message : String(err))
    );
  }

  // ─── 4. Upload pro Supabase Storage ───────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.CUTS)
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true, // idempotente — permite rerender sem erro de duplicata
    });

  if (uploadError) {
    throw new Error(
      `[clip-uploader] Falha no upload do clip '${safeCutId}' pro bucket '${STORAGE_BUCKETS.CUTS}': ` +
        uploadError.message
    );
  }

  // ─── 5. Gerar signed URL (7 dias = 604800 segundos) ───────────────────────
  const signedUrlExpiry = 60 * 60 * 24 * 7; // 7 dias

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKETS.CUTS)
    .createSignedUrl(storagePath, signedUrlExpiry);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `[clip-uploader] Falha ao gerar signed URL para '${storagePath}': ` +
        (signedError?.message ?? 'URL não retornada pelo Supabase')
    );
  }

  return {
    storage_path: storagePath,
    signed_url: signedData.signedUrl,
  };
}
