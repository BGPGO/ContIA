/**
 * GET /api/internal/meta-ads/insights
 *
 * Rota interna consumida pelo CRM BGPGO para obter dados de Meta Ads
 * de uma empresa específica. Protegida por secret compartilhado.
 *
 * Auth:    x-internal-secret header
 * Query:   date=YYYY-MM-DD, empresa_id=<uuid>
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CampaignInsight {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  conversionValue: number
}

interface InsightsResponse {
  date: string
  totalSpend: number
  totalLeads: number
  currency: string
  campaigns: CampaignInsight[]
  monthToDate: { spend: number; leads: number }
}

// ── Helper: métricas de snapshot ─────────────────────────────────────────────

function extractSpendLeads(metrics: Record<string, number> | null | undefined): {
  spend: number
  leads: number
} {
  if (!metrics) return { spend: 0, leads: 0 }
  return {
    spend: typeof metrics.spend === 'number' ? metrics.spend : 0,
    leads: typeof metrics.conversions === 'number'
      ? metrics.conversions
      : typeof metrics.leads === 'number'
        ? metrics.leads
        : 0,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Validar secret
  const secret = req.headers.get('x-internal-secret')
  const expected = process.env.META_ADS_INTERNAL_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Secret inválido' }, { status: 401 })
  }

  // 2. Validar query params
  const { searchParams } = req.nextUrl
  const date = searchParams.get('date')
  const empresaId = searchParams.get('empresa_id')

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Parâmetro date é obrigatório e deve estar no formato YYYY-MM-DD' },
      { status: 400 }
    )
  }

  if (!empresaId) {
    return NextResponse.json(
      { error: 'Parâmetro empresa_id é obrigatório' },
      { status: 400 }
    )
  }

  let supabase: ReturnType<typeof getAdminSupabase>
  try {
    supabase = getAdminSupabase()
  } catch (err) {
    console.error('[internal/meta-ads/insights] Supabase não configurado:', err)
    return NextResponse.json(
      { error: 'Serviço de banco de dados indisponível' },
      { status: 503 }
    )
  }

  // 3. Buscar connection ativa
  const { data: connection, error: connError } = await supabase
    .from('social_connections')
    .select('id, metadata, provider_user_id')
    .eq('empresa_id', empresaId)
    .eq('provider', 'meta_ads')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (connError || !connection) {
    return NextResponse.json(
      { error: 'Conexão Meta Ads não encontrada' },
      { status: 404 }
    )
  }

  // 4. Buscar snapshot do dia
  const { data: snapshot, error: snapError } = await supabase
    .from('provider_snapshots')
    .select('metrics')
    .eq('connection_id', connection.id)
    .eq('snapshot_date', date)
    .limit(1)
    .maybeSingle()

  if (snapError) {
    console.error('[internal/meta-ads/insights] Erro ao buscar snapshot:', snapError.message)
    return NextResponse.json(
      { error: 'Erro ao consultar dados do banco', details: snapError.message },
      { status: 503 }
    )
  }

  // Se não há snapshot do dia, retornar zerado (200 — dado pode não ter chegado ainda)
  if (!snapshot) {
    const emptyResponse: InsightsResponse = {
      date,
      totalSpend: 0,
      totalLeads: 0,
      currency: (connection.metadata as Record<string, unknown> | null)?.currency as string ?? 'BRL',
      campaigns: [],
      monthToDate: { spend: 0, leads: 0 },
    }
    return NextResponse.json(emptyResponse)
  }

  const { spend: totalSpend, leads: totalLeads } = extractSpendLeads(
    snapshot.metrics as Record<string, number> | null
  )

  // 5. Buscar campanhas com insights (content_items com metrics)
  const { data: contentItems, error: contentError } = await supabase
    .from('content_items')
    .select('provider_content_id, title, metrics')
    .eq('connection_id', connection.id)
    .eq('content_type', 'ad_campaign')

  if (contentError) {
    console.error('[internal/meta-ads/insights] Erro ao buscar campanhas:', contentError.message)
    return NextResponse.json(
      { error: 'Erro ao consultar campanhas', details: contentError.message },
      { status: 503 }
    )
  }

  // Mapear campaigns para o formato de response
  // metrics em content_items é agregado (não tem daily_breakdown por campanha)
  // — usamos o que está persistido (syncInsights sobrescreve metrics com dados do range solicitado)
  const campaigns: CampaignInsight[] = (contentItems ?? [])
    .map((item) => {
      const m = (item.metrics ?? {}) as Record<string, number>
      const spend = typeof m.spend === 'number' ? m.spend : 0
      const impressions = typeof m.impressions === 'number' ? m.impressions : 0
      const clicks = typeof m.clicks === 'number' ? m.clicks : 0
      const conversions =
        typeof m.conversions === 'number'
          ? m.conversions
          : typeof m.leads === 'number'
            ? m.leads
            : 0
      const conversionValue = typeof m.conversion_value === 'number' ? m.conversion_value : 0

      return {
        id: item.provider_content_id as string,
        name: item.title as string,
        spend,
        impressions,
        clicks,
        leads: conversions,
        conversionValue,
      }
    })
    // Filtrar campanhas sem dados relevantes (spend=0 e leads=0 provavelmente não tiveram atividade no dia)
    .filter((c) => c.spend > 0 || c.leads > 0)

  // 6. Calcular MTD: SUM de spend e leads de provider_snapshots do mês até a data
  const firstDayOfMonth = date.slice(0, 7) + '-01' // YYYY-MM-01

  const { data: mtdRows, error: mtdError } = await supabase
    .from('provider_snapshots')
    .select('metrics')
    .eq('connection_id', connection.id)
    .gte('snapshot_date', firstDayOfMonth)
    .lte('snapshot_date', date)

  if (mtdError) {
    console.error('[internal/meta-ads/insights] Erro ao calcular MTD:', mtdError.message)
    // Não abortar — retornar MTD zerado como fallback
  }

  const mtd = (mtdRows ?? []).reduce(
    (acc, row) => {
      const { spend, leads } = extractSpendLeads(row.metrics as Record<string, number> | null)
      return { spend: acc.spend + spend, leads: acc.leads + leads }
    },
    { spend: 0, leads: 0 }
  )

  // 7. Montar resposta
  const currency =
    (connection.metadata as Record<string, unknown> | null)?.currency as string ?? 'BRL'

  const response: InsightsResponse = {
    date,
    totalSpend,
    totalLeads,
    currency,
    campaigns,
    monthToDate: {
      spend: Math.round(mtd.spend * 100) / 100,
      leads: mtd.leads,
    },
  }

  return NextResponse.json(response)
}
