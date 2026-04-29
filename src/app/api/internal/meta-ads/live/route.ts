/**
 * GET /api/internal/meta-ads/live
 *
 * Faz fetch DIRETO da Meta Insights API pra obter spend/leads em tempo real,
 * SEM passar pelo cache de provider_snapshots. Use quando precisar de dados
 * recém-consolidados (ex: relatório das 7h precisa de "ontem" mas o cron
 * das 4h pode ter pegado o dia ainda incompleto na API do Meta).
 *
 * Auth:    x-internal-secret header
 * Query:   date=YYYY-MM-DD, empresa_id=<uuid>
 *
 * Resposta no MESMO formato do /api/internal/meta-ads/insights pra ser
 * drop-in replacement no driver do CRM.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/drivers/base'

export const runtime = 'nodejs'

const FB_GRAPH = 'https://graph.facebook.com/v23.0'

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
  source: 'live'
}

interface ActionStat {
  action_type: string
  value: string
}

interface InsightRow {
  spend?: string
  impressions?: string
  clicks?: string
  inline_link_clicks?: string
  ctr?: string
  cpc?: string
  cpm?: string
  reach?: string
  frequency?: string
  actions?: ActionStat[]
  action_values?: ActionStat[]
}

interface CampaignRow extends InsightRow {
  campaign_id?: string
  campaign_name?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sumActions(actions: ActionStat[] | undefined, matchKeys: string[]): number {
  if (!actions || actions.length === 0) return 0
  return actions
    .filter((a) => matchKeys.some((k) => a.action_type.includes(k)))
    .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0)
}

function sumActionValues(actions: ActionStat[] | undefined, matchKeys: string[]): number {
  if (!actions || actions.length === 0) return 0
  return actions
    .filter((a) => matchKeys.some((k) => a.action_type.includes(k)))
    .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0)
}

async function fbFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${FB_GRAPH}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  const data = (await res.json()) as { error?: { message: string; code: number; type: string } } & T
  if (data.error) {
    throw new Error(`Meta API [${data.error.code}] ${data.error.type}: ${data.error.message}`)
  }
  return data
}

function parseLeads(row: InsightRow): number {
  return sumActions(row.actions, [
    'lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
  ])
}

function parseConversionValue(row: InsightRow): number {
  return sumActionValues(row.action_values, ['purchase', 'lead', 'complete_registration'])
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret')
  const expected = process.env.META_ADS_INTERNAL_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Secret inválido' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const date = searchParams.get('date')
  const empresaId = searchParams.get('empresa_id')

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date é obrigatório no formato YYYY-MM-DD' },
      { status: 400 }
    )
  }
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
  }

  let supabase: ReturnType<typeof getAdminSupabase>
  try {
    supabase = getAdminSupabase()
  } catch (err) {
    console.error('[meta-ads/live] Supabase não configurado:', err)
    return NextResponse.json({ error: 'Banco indisponível' }, { status: 503 })
  }

  const { data: connection, error: connError } = await supabase
    .from('social_connections')
    .select('id, access_token, provider_user_id, metadata')
    .eq('empresa_id', empresaId)
    .eq('provider', 'meta_ads')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Conexão Meta Ads não encontrada' }, { status: 404 })
  }

  let token: string
  try {
    token = decryptToken(connection.access_token as string)
  } catch (err) {
    console.error('[meta-ads/live] decrypt falhou:', err)
    return NextResponse.json({ error: 'Token inválido' }, { status: 500 })
  }

  const accountId = connection.provider_user_id as string
  if (!accountId) {
    return NextResponse.json({ error: 'provider_user_id (ad_account_id) ausente' }, { status: 500 })
  }

  const currency =
    (connection.metadata as Record<string, unknown> | null)?.currency as string ?? 'BRL'

  // 1. Fetch account-level totals + campaign breakdown — ambos em paralelo
  // Usa time_range pra forçar o dia exato (mais confiável que date_preset)
  const timeRange = JSON.stringify({ since: date, until: date })
  const insightFields =
    'spend,impressions,clicks,inline_link_clicks,ctr,cpc,cpm,reach,frequency,actions,action_values'

  let accountData: { data: InsightRow[] } = { data: [] }
  let campaignData: { data: CampaignRow[] } = { data: [] }
  try {
    ;[accountData, campaignData] = await Promise.all([
      fbFetch<{ data: InsightRow[] }>(`/${accountId}/insights`, {
        access_token: token,
        fields: insightFields,
        level: 'account',
        time_range: timeRange,
      }),
      fbFetch<{ data: CampaignRow[] }>(`/${accountId}/insights`, {
        access_token: token,
        fields: `campaign_id,campaign_name,${insightFields}`,
        level: 'campaign',
        time_range: timeRange,
      }),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[meta-ads/live] Falha ao chamar Meta:', msg)
    return NextResponse.json({ error: 'Falha na Meta API', details: msg }, { status: 502 })
  }

  // 2. Aggregate totals
  const accountRow = accountData.data[0] ?? {}
  const totalSpend = parseFloat(accountRow.spend ?? '0') || 0
  const totalLeads = parseLeads(accountRow)

  // 3. Per-campaign breakdown (filtra campanhas com 0 spend e 0 leads)
  const campaigns: CampaignInsight[] = (campaignData.data ?? [])
    .map((row) => ({
      id: row.campaign_id ?? '',
      name: row.campaign_name ?? '',
      spend: parseFloat(row.spend ?? '0') || 0,
      impressions: parseInt(row.impressions ?? '0', 10) || 0,
      clicks: parseInt(row.clicks ?? '0', 10) || 0,
      leads: parseLeads(row),
      conversionValue: parseConversionValue(row),
    }))
    .filter((c) => c.spend > 0 || c.leads > 0)

  // 4. MTD: 1ª do mês até a data
  const firstOfMonth = date.slice(0, 7) + '-01'
  const mtdRange = JSON.stringify({ since: firstOfMonth, until: date })
  let mtdSpend = 0
  let mtdLeads = 0
  try {
    const mtdData = await fbFetch<{ data: InsightRow[] }>(`/${accountId}/insights`, {
      access_token: token,
      fields: 'spend,actions',
      level: 'account',
      time_range: mtdRange,
    })
    const row = mtdData.data[0] ?? {}
    mtdSpend = parseFloat(row.spend ?? '0') || 0
    mtdLeads = parseLeads(row)
  } catch (err) {
    console.warn('[meta-ads/live] MTD fetch falhou (non-fatal):', err instanceof Error ? err.message : err)
  }

  const response: InsightsResponse = {
    date,
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalLeads,
    currency,
    campaigns,
    monthToDate: { spend: Math.round(mtdSpend * 100) / 100, leads: mtdLeads },
    source: 'live',
  }

  return NextResponse.json(response)
}
