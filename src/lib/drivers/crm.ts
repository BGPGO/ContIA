/**
 * CRMDriver — implementa ConnectionDriver para o CRM BGPGO
 *
 * O CRM não usa OAuth. A conexão é feita via API key (X-API-Key header).
 * Os dados vêm do endpoint GET /api/analytics/export do CRM.
 *
 * Fluxo de conexão:
 *   1. Frontend chama GET /api/crm/auth?empresa=<id>
 *   2. Route chama connectCrmAuto() que cria/atualiza a linha em social_connections
 *   3. Driver usa access_token vazio — autenticação real é via CRM_ANALYTICS_API_KEY do env
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type {
  ConnectionDriver,
  Connection,
  ProfileData,
  ContentItem,
  MetricSet,
  SyncOptions,
} from '@/types/providers'
import { METADATA_BY_PROVIDER } from './metadata'
import { upsertConnection, deactivateConnection } from './base'

/* ── Config ──────────────────────────────────────────────────────────────── */

const CRM_API_URL =
  process.env.CRM_API_URL || 'https://crm-api.bgpgo.com.br'

function getCrmApiKey(): string {
  return process.env.CRM_ANALYTICS_API_KEY || ''
}

/* ── Supabase admin client ───────────────────────────────────────────────── */

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createServiceClient(url, key)
}

/* ── Helper: fetch do endpoint de analytics ─────────────────────────────── */

interface CrmExportParams {
  empresa_id: string
  date_from: string
  date_to: string
  metrics?: string
}

interface CrmExportResponse {
  period: { from: string; to: string }
  leads?: {
    totalNewLeads: number
    byOrigin: Record<string, number>
    byDay: { date: string; count: number }[]
    leadScoreDistribution: { hot: number; warm: number; cold: number }
  }
  funnel?: {
    totalEntered: number
    atStage: Record<string, number>
    conversionRate: number
    wonDeals: number
    wonRevenue: number
  }
  email?: {
    campaigns: number
    totalSent: number
    avgOpenRate: number
    avgClickRate: number
    avgBounceRate: number
  }
  whatsapp?: {
    messagesSent: number
    messagesDelivered: number
    replies: number
    conversions: number
  }
  greatpages?: {
    activeLandingPages: number
    leadsGenerated: number
    topLP: { name: string; leads: number }[]
    utmBreakdown: Record<string, number>
  }
}

async function fetchCrmExport(params: CrmExportParams): Promise<CrmExportResponse> {
  const apiKey = getCrmApiKey()
  if (!apiKey) {
    throw new Error(
      'CRM_ANALYTICS_API_KEY não configurada — defina a variável de ambiente no servidor'
    )
  }

  const qs = new URLSearchParams({
    empresa_id: params.empresa_id,
    date_from: params.date_from,
    date_to: params.date_to,
    ...(params.metrics ? { metrics: params.metrics } : {}),
  })

  const url = `${CRM_API_URL}/api/analytics/export?${qs.toString()}`

  const response = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `CRM analytics export falhou [${response.status}]: ${body || response.statusText}`
    )
  }

  return response.json() as Promise<CrmExportResponse>
}

/* ── Utilitários de data ─────────────────────────────────────────────────── */

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getDefaultPeriod(options?: SyncOptions): { date_from: string; date_to: string } {
  const until = options?.until ?? new Date()
  const since = options?.since ?? new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    date_from: formatDate(since),
    date_to: formatDate(until),
  }
}

/* ── Driver ──────────────────────────────────────────────────────────────── */

export const crmDriver: ConnectionDriver = {
  metadata: METADATA_BY_PROVIDER.crm,

  /* ── buildAuthUrl ─────────────────────────────────────────────────────── */

  async buildAuthUrl(empresaId: string, _userId: string): Promise<string> {
    // CRM não tem OAuth — redireciona para rota de auto-conexão
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    return `${appUrl}/api/crm/auth?empresa=${empresaId}`
  },

  /* ── handleCallback ───────────────────────────────────────────────────── */

  async handleCallback(_code: string, _state: string): Promise<Connection> {
    throw new Error(
      'CRM não usa OAuth. Use o endpoint /api/crm/auth para auto-conexão.'
    )
  },

  /* ── verify ───────────────────────────────────────────────────────────── */

  async verify(connection: Connection): Promise<boolean> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const today = new Date()

      await fetchCrmExport({
        empresa_id: connection.empresa_id,
        date_from: formatDate(yesterday),
        date_to: formatDate(today),
        metrics: 'leads',
      })

      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({ last_verified_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id)

      return true
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Erro desconhecido na verificação CRM'

      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({ last_error: msg })
        .eq('id', connection.id)

      return false
    }
  },

  /* ── refreshToken ─────────────────────────────────────────────────────── */

  async refreshToken(connection: Connection): Promise<Connection> {
    // Sem token para renovar — retorna a conexão como está
    return connection
  },

  /* ── disconnect ───────────────────────────────────────────────────────── */

  async disconnect(connection: Connection): Promise<void> {
    const supabase = getAdminSupabase()
    await deactivateConnection(supabase, connection.id)
  },

  /* ── syncProfile ──────────────────────────────────────────────────────── */

  async syncProfile(connection: Connection): Promise<ProfileData> {
    // CRM não tem endpoint de perfil — retorna dados básicos a partir da conexão
    return {
      provider_user_id: connection.empresa_id,
      username: connection.username ?? connection.empresa_id,
      display_name: connection.display_name ?? 'CRM BGPGO',
      profile_picture_url: null,
      bio: 'Integração com o CRM BGPGO — funil de vendas, leads e conversões.',
      url: CRM_API_URL,
      followers_count: 0,
      following_count: 0,
      content_count: 0,
      extra: {
        source: 'crm',
        empresa_id: connection.empresa_id,
      },
    }
  },

  /* ── syncContent ──────────────────────────────────────────────────────── */

  async syncContent(
    connection: Connection,
    options?: SyncOptions
  ): Promise<ContentItem[]> {
    const period = getDefaultPeriod(options)

    const data = await fetchCrmExport({
      empresa_id: connection.empresa_id,
      date_from: period.date_from,
      date_to: period.date_to,
      metrics: 'email,whatsapp',
    })

    const now = new Date().toISOString()
    const items: ContentItem[] = []

    // Campanhas de email como ContentItem
    if (data.email) {
      items.push({
        id: '',
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'crm',
        provider_content_id: `crm-email-${period.date_from}-${period.date_to}`,
        content_type: 'email',
        title: `Campanhas de Email — ${period.date_from} a ${period.date_to}`,
        caption: `${data.email.campaigns} campanhas enviadas, ${data.email.totalSent} envios.`,
        url: `${CRM_API_URL}/email-campaigns`,
        thumbnail_url: null,
        published_at: period.date_to,
        metrics: {
          campaigns: data.email.campaigns,
          total_sent: data.email.totalSent,
          avg_open_rate: data.email.avgOpenRate,
          avg_click_rate: data.email.avgClickRate,
          avg_bounce_rate: data.email.avgBounceRate,
        },
        raw: data.email as unknown as Record<string, unknown>,
        synced_at: now,
      })
    }

    // Mensagens WhatsApp como ContentItem
    if (data.whatsapp) {
      items.push({
        id: '',
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'crm',
        provider_content_id: `crm-whatsapp-${period.date_from}-${period.date_to}`,
        content_type: 'whatsapp',
        title: `WhatsApp — ${period.date_from} a ${period.date_to}`,
        caption: `${data.whatsapp.messagesSent} mensagens enviadas, ${data.whatsapp.replies} respostas.`,
        url: `${CRM_API_URL}/whatsapp`,
        thumbnail_url: null,
        published_at: period.date_to,
        metrics: {
          messages_sent: data.whatsapp.messagesSent,
          messages_delivered: data.whatsapp.messagesDelivered,
          replies: data.whatsapp.replies,
          conversions: data.whatsapp.conversions,
        },
        raw: data.whatsapp as unknown as Record<string, unknown>,
        synced_at: now,
      })
    }

    // Persiste no Supabase se há itens
    if (items.length > 0) {
      const supabase = getAdminSupabase()
      await supabase.from('content_items').upsert(
        items.map(item => ({ ...item, id: undefined })),
        { onConflict: 'connection_id,provider_content_id' }
      )
    }

    return items
  },

  /* ── syncMetrics ──────────────────────────────────────────────────────── */

  async syncMetrics(
    connection: Connection,
    options?: SyncOptions
  ): Promise<MetricSet> {
    const period = getDefaultPeriod(options)

    const data = await fetchCrmExport({
      empresa_id: connection.empresa_id,
      date_from: period.date_from,
      date_to: period.date_to,
    })

    const today = formatDate(new Date())
    const now = new Date().toISOString()

    // Agrega todas as métricas em um objeto plano
    const metrics: Record<string, number> = {}

    if (data.leads) {
      metrics['leads_total'] = data.leads.totalNewLeads
      metrics['leads_hot'] = data.leads.leadScoreDistribution.hot
      metrics['leads_warm'] = data.leads.leadScoreDistribution.warm
      metrics['leads_cold'] = data.leads.leadScoreDistribution.cold
      for (const [origin, count] of Object.entries(data.leads.byOrigin)) {
        metrics[`leads_origin_${origin}`] = count
      }
    }

    if (data.funnel) {
      metrics['funnel_entered'] = data.funnel.totalEntered
      metrics['funnel_won'] = data.funnel.wonDeals
      metrics['funnel_revenue'] = data.funnel.wonRevenue
      metrics['funnel_conversion_rate'] = data.funnel.conversionRate
      for (const [stage, count] of Object.entries(data.funnel.atStage)) {
        const key = `funnel_stage_${stage.toLowerCase().replace(/\s+/g, '_')}`
        metrics[key] = count
      }
    }

    if (data.email) {
      metrics['email_campaigns'] = data.email.campaigns
      metrics['email_sent'] = data.email.totalSent
      metrics['email_open_rate'] = data.email.avgOpenRate
      metrics['email_click_rate'] = data.email.avgClickRate
      metrics['email_bounce_rate'] = data.email.avgBounceRate
    }

    if (data.whatsapp) {
      metrics['wa_sent'] = data.whatsapp.messagesSent
      metrics['wa_delivered'] = data.whatsapp.messagesDelivered
      metrics['wa_replies'] = data.whatsapp.replies
      metrics['wa_conversions'] = data.whatsapp.conversions
    }

    if (data.greatpages) {
      metrics['gp_landing_pages'] = data.greatpages.activeLandingPages
      metrics['gp_leads'] = data.greatpages.leadsGenerated
    }

    // Persiste metric_events no Supabase
    if (Object.keys(metrics).length > 0) {
      const supabase = getAdminSupabase()
      const metricEvents = Object.entries(metrics).map(([key, value]) => ({
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'crm' as const,
        metric_key: key,
        metric_value: value,
        dimension: {} as Record<string, unknown>,
        occurred_at: today,
        collected_at: now,
      }))

      await supabase.from('metric_events').upsert(metricEvents, {
        onConflict: 'connection_id,metric_key,occurred_at,dimension',
      })
    }

    return {
      connection_id: connection.id,
      provider: 'crm',
      snapshot_date: today,
      metrics,
      raw: data as unknown as Record<string, unknown>,
    }
  },

  /* ── syncInsights ─────────────────────────────────────────────────────── */

  async syncInsights(_connection: Connection, _contentIds: string[]) {
    // CRM não tem insights por item de conteúdo
    return []
  },
}

/* ── Auto-conexão (sem OAuth) ────────────────────────────────────────────── */

/**
 * Cria ou atualiza a conexão CRM para uma empresa.
 * Chamado pelo endpoint GET /api/crm/auth.
 *
 * Não requer token do usuário — o CRM autentica via API key do ambiente.
 * O campo access_token é armazenado vazio pois a key fica no env, não no DB.
 */
export async function connectCrmAuto(
  empresaId: string,
  userId: string
): Promise<Connection> {
  const supabase = getAdminSupabase()

  return upsertConnection(supabase, {
    empresa_id: empresaId,
    user_id: userId,
    provider: 'crm',
    provider_user_id: empresaId, // CRM é single-tenant — usamos empresa_id como ID
    username: 'crm-bgpgo',
    display_name: 'CRM BGPGO',
    display_label: 'CRM BGPGO',
    access_token: '', // autenticação real é via CRM_ANALYTICS_API_KEY do env
    is_active: true,
    metadata: {
      auto_connected: true,
      crm_api_url: CRM_API_URL,
      connected_at: new Date().toISOString(),
    },
  })
}
