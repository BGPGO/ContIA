/**
 * Helpers Supabase Storage para PDFs de relatórios.
 * Bucket: reports (private, com signed URLs)
 */

import { createClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'reports'
const SIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hora

/* ── ensureReportsBucket ─────────────────────────────────────────────────── */

/**
 * Garante que o bucket `reports` exista no Supabase Storage.
 * É idempotente — seguro chamar múltiplas vezes.
 */
export async function ensureReportsBucket(): Promise<void> {
  const supabase = await createClient()

  // Verifica se já existe
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    console.error('[storage] Erro ao listar buckets:', listError)
    return
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME)
  if (exists) return

  // Cria bucket privado
  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: false,
    allowedMimeTypes: ['application/pdf'],
    fileSizeLimit: 52428800, // 50MB
  })

  if (createError && !createError.message.includes('already exists')) {
    console.error('[storage] Erro ao criar bucket reports:', createError)
    throw new Error(`Erro ao criar bucket de relatórios: ${createError.message}`)
  }
}

/* ── uploadReportPdf ─────────────────────────────────────────────────────── */

/**
 * Faz upload de um PDF para Supabase Storage.
 * Retorna signed URL válida por 1 hora.
 *
 * @param buffer  Buffer do PDF gerado pelo Puppeteer
 * @param path    Caminho no bucket, ex: "empresa-uuid/report-uuid.pdf"
 */
export async function uploadReportPdf(
  buffer: Buffer,
  path: string
): Promise<string> {
  const supabase = await createClient()

  // Garante bucket existe
  await ensureReportsBucket()

  // Upload com upsert (sobrescreve se existir)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadError) {
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`)
  }

  // Gera signed URL
  const { data: signedData, error: signError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Erro ao gerar URL do PDF: ${signError?.message ?? 'URL vazia'}`)
  }

  return signedData.signedUrl
}

/* ── getReportPdfUrl ─────────────────────────────────────────────────────── */

/**
 * Recupera signed URL para um PDF já armazenado.
 * Retorna null se o arquivo não existir.
 */
export async function getReportPdfUrl(
  empresaId: string,
  reportId: string
): Promise<string | null> {
  const supabase = await createClient()

  const path = buildPdfPath(empresaId, reportId)

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/* ── buildPdfPath ────────────────────────────────────────────────────────── */

export function buildPdfPath(empresaId: string, reportId: string): string {
  return `${empresaId}/${reportId}.pdf`
}
