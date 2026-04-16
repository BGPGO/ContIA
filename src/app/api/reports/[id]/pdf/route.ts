/**
 * GET /api/reports/[id]/pdf
 *
 * Gera ou recupera o PDF de um relatório.
 * Auth Supabase obrigatório. O relatório deve pertencer à empresa do usuário.
 *
 * Query params:
 *   template?  — 'executive' | 'technical' | 'client' (default: 'client')
 *   download?  — 'true' retorna buffer com Content-Disposition: attachment
 *                (default: redireciona para Supabase Storage signed URL)
 *   regenerate? — 'true' força regeneração mesmo se pdf_url já existe
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReportPDF } from '@/lib/reports/pdf-generator'
import { uploadReportPdf, buildPdfPath } from '@/lib/reports/storage'
import type { ReportType } from '@/types/reports'

type TemplateType = 'executive' | 'technical' | 'client'

const VALID_TEMPLATES: TemplateType[] = ['executive', 'technical', 'client']

function isValidTemplate(t: string): t is TemplateType {
  return VALID_TEMPLATES.includes(t as TemplateType)
}

/* ── GET handler ─────────────────────────────────────────────────────────── */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params

  if (!reportId) {
    return NextResponse.json({ error: 'ID do relatório não informado' }, { status: 400 })
  }

  /* 1. Auth ── */
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  /* 2. Query params ── */
  const searchParams = req.nextUrl.searchParams
  const rawTemplate = searchParams.get('template') ?? 'client'
  const template: TemplateType = isValidTemplate(rawTemplate) ? rawTemplate : 'client'
  const download = searchParams.get('download') === 'true'
  const regenerate = searchParams.get('regenerate') === 'true'

  /* 3. Valida ownership — relatório pertence à empresa do usuário ── */
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, empresa_id, name, type, pdf_url, status')
    .eq('id', reportId)
    .single()

  if (reportError || !report) {
    return NextResponse.json(
      { error: 'Relatório não encontrado' },
      { status: 404 }
    )
  }

  // Verifica que empresa_id pertence ao usuário via RLS (query retornaria vazio se não)
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('id', report.empresa_id)
    .eq('user_id', user.id)
    .single()

  if (!empresa) {
    return NextResponse.json(
      { error: 'Acesso negado a este relatório' },
      { status: 403 }
    )
  }

  // Verifica status — relatório deve estar pronto
  if (report.status !== 'ready') {
    return NextResponse.json(
      { error: `Relatório ainda não está pronto. Status atual: ${report.status as ReportType}` },
      { status: 409 }
    )
  }

  /* 4. Se já tem pdf_url e não quer regenerar, redireciona/retorna direto ── */
  if (report.pdf_url && !regenerate && !download) {
    return NextResponse.redirect(report.pdf_url)
  }

  /* 5. Gera PDF ── */
  let pdfBuffer: Buffer

  try {
    const result = await generateReportPDF({
      reportId,
      template,
      brandName: empresa.nome as string,
    })
    pdfBuffer = result.pdfBuffer
  } catch (err) {
    console.error('[reports/pdf] Erro ao gerar PDF:', err)
    const message = err instanceof Error ? err.message : 'Erro interno ao gerar PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  /* 6. Upload para Supabase Storage ── */
  let pdfUrl: string

  try {
    const storagePath = buildPdfPath(report.empresa_id as string, reportId)
    pdfUrl = await uploadReportPdf(pdfBuffer, storagePath)
  } catch (err) {
    console.error('[reports/pdf] Erro ao fazer upload:', err)
    const message = err instanceof Error ? err.message : 'Erro ao armazenar PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  /* 7. Atualiza pdf_url na tabela reports ── */
  await supabase
    .from('reports')
    .update({ pdf_url: pdfUrl })
    .eq('id', reportId)

  /* 8. Resposta ── */
  if (download) {
    // Retorna buffer direto com header de download
    const fileName = `relatorio-${report.name?.toLowerCase().replace(/\s+/g, '-') ?? reportId}.pdf`
    return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    })
  }

  // Redireciona para signed URL do Supabase Storage
  return NextResponse.redirect(pdfUrl)
}
