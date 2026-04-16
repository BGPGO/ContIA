/**
 * PDF Generator Engine — ContIA 2.0
 *
 * Gera PDFs de relatórios usando Puppeteer + templates HTML server-side.
 * Roda SOMENTE em Node.js (não em Edge Runtime).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * REQUISITOS DOCKERFILE (Coolify / qualquer container Linux):
 * Para o Chromium do Puppeteer funcionar em container, adicionar ao Dockerfile:
 *
 *   RUN apt-get update && apt-get install -y \
 *     libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
 *     libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
 *     libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0 \
 *     libcairo2 libgdk-pixbuf2.0-0 libgtk-3-0 libx11-xcb1 \
 *     --no-install-recommends && rm -rf /var/lib/apt/lists/*
 *
 * O Puppeteer já baixa o Chromium bundled (~170MB no cache do npm).
 * O flag --no-sandbox é obrigatório em containers (sem user namespace).
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { Report } from '@/types/reports'
import { renderExecutiveTemplate } from './templates/executive'
import { renderTechnicalTemplate } from './templates/technical'
import { renderClientTemplate } from './templates/client'
import type { BrandDna } from './templates/executive'

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface PdfGenerationOptions {
  /** ID do relatório na tabela `reports` — busca automaticamente do Supabase */
  reportId: string
  /** Template a ser usado. Default: 'client' */
  template?: 'executive' | 'technical' | 'client'
  /** Override das cores do DNA da marca */
  brandColors?: {
    primary: string
    secondary: string
    accent: string
  }
  /** URL ou base64 do logo da empresa */
  brandLogo?: string
  /** Nome da empresa (override do DNA) */
  brandName?: string
}

export interface PdfGenerationResult {
  pdfBuffer: Buffer
  pageCount: number
  generatedAt: Date
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function resolveDna(
  dnaRow: Record<string, unknown> | null | undefined,
  options: PdfGenerationOptions
): BrandDna {
  const dna = dnaRow ?? {}
  const sintetizado = dna.dna_sintetizado as Record<string, unknown> | undefined
  const cores = (sintetizado?.cores ?? dna.cores ?? {}) as Record<string, unknown>

  return {
    primary:
      options.brandColors?.primary ??
      (typeof cores.primaria === 'string' ? cores.primaria : undefined) ??
      '#4ecdc4',
    secondary:
      options.brandColors?.secondary ??
      (typeof cores.secundaria === 'string' ? cores.secundaria : undefined) ??
      '#6c5ce7',
    accent:
      options.brandColors?.accent ??
      (typeof cores.acento === 'string' ? cores.acento : undefined) ??
      '#fbbf24',
    logo:
      options.brandLogo ??
      (typeof dna.logo_url === 'string' ? dna.logo_url : undefined),
    name:
      options.brandName ??
      (typeof sintetizado?.nome === 'string' ? sintetizado.nome : undefined),
  }
}

function renderHtml(
  report: Report,
  dna: BrandDna,
  template: 'executive' | 'technical' | 'client'
): string {
  switch (template) {
    case 'executive':
      return renderExecutiveTemplate(report, dna)
    case 'technical':
      return renderTechnicalTemplate(report, dna)
    case 'client':
    default:
      return renderClientTemplate(report, dna)
  }
}

/* ── generateReportPDF ────────────────────────────────────────────────────── */

export async function generateReportPDF(
  options: PdfGenerationOptions
): Promise<PdfGenerationResult> {
  const { reportId, template = 'client' } = options

  // Lazy imports — evita problemas em Edge/build
  const { createClient } = await import('@/lib/supabase/server')
  const puppeteer = await import('puppeteer')

  const supabase = await createClient()

  /* 1. Busca o relatório ── */
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (reportError || !report) {
    throw new Error(
      `Relatório não encontrado: ${reportError?.message ?? 'ID inválido'}`
    )
  }

  /* 2. Busca DNA da marca ── */
  const { data: dnaRow } = await supabase
    .from('marca_dna')
    .select('*')
    .eq('empresa_id', report.empresa_id)
    .limit(1)
    .single()

  /* 3. Busca nome da empresa se não fornecido ── */
  let brandName = options.brandName
  if (!brandName) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome')
      .eq('id', report.empresa_id)
      .single()
    brandName = empresa?.nome ?? undefined
  }

  /* 4. Monta BrandDna ── */
  const dna = resolveDna(dnaRow as Record<string, unknown> | null, {
    ...options,
    brandName,
  })

  /* 5. Renderiza HTML ── */
  const html = renderHtml(report as Report, dna, template)

  /* 6. Lança Puppeteer ── */
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  })

  let pdfBuffer: Buffer
  let pageCount = 0

  try {
    const page = await browser.newPage()

    // Define viewport A4 em 96 DPI
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 })

    // Carrega HTML inline — sem dependências externas além do Google Fonts
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })

    // Aguarda fontes e imagens
    await page.evaluateHandle('document.fonts.ready')

    // Gera PDF A4
    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    })

    pdfBuffer = Buffer.from(pdfData)

    // Estima página count pelo tamanho (≈ 50KB por página típica)
    pageCount = Math.max(1, Math.round(pdfBuffer.length / 51200))
  } finally {
    await browser.close()
  }

  return {
    pdfBuffer,
    pageCount,
    generatedAt: new Date(),
  }
}
