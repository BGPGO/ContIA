/**
 * GreatPagesDriver — implementa ConnectionDriver para GreatPages via CRM BGPGO
 *
 * GreatPages NÃO tem API própria. Os dados chegam ao CRM via webhook (UTM tags).
 * Este driver é um proxy para o endpoint /api/analytics/export do CRM,
 * filtrando apenas a seção `greatpages`.
 *
 * REQUISITO: CRM deve estar conectado na mesma empresa antes de usar GreatPages.
 *
 * Fluxo:
 *   1. Usuário conecta o CRM (via crmDriver / connectCrmAuto)
 *   2. GreatPages é conectado automaticamente via connectGreatPagesAuto
 *   3. syncMetrics e syncContent buscam dados do CRM export, filtrando greatpages
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
import { upsertConnection, deactivateConnection, getConnection } from './base'

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

/* ── Interfaces ──────────────────────────────────────────────────────────── */

interface GreatPagesData {
  activeLandingPages: number
  leadsGenerated: number
  topLP: { name: string; leads: number }[]
  utmBreakdown: Record<string, number>
}

/* ── Helper: busca dados GreatPages via CRM ─────────────────────────────── */

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

async function fetchGreatPagesData(
  empresaId: string,
  period: { date_from: string; date_to: string }
): Promise<GreatPagesData> {
  const apiKey = getCrmApiKey()
  if (!apiKey) {
    throw new Error(
      'CRM_ANALYTICS_API_KEY não configurada — defina a variável de ambiente no servidor'
    )
  }

  const qs = new URLSearchParams({
    empresa_id: empresaId,
    date_from: period.date_from,
    date_to: period.date_to,
    metrics: 'greatpages',
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

  const data = await response.json() as { greatpages?: GreatPagesData }

  if (!data.greatpages) {
    return {
      activeLandingPages: 0,
      leadsGenerated: 0,
      topLP: [],
      utmBreakdown: {},
    }
  }

  return data.greatpages
}

/* ── Driver ──────────────────────────────────────────────────────────────── */

export const greatpagesDriver: ConnectionDriver = {
  metadata: METADATA_BY_PROVIDER.greatpages,

  /* ── buildAuthUrl ─────────────────────────────────────────────────────── */

  async buildAuthUrl(_empresaId: string, _userId: string): Promise<string> {
    throw new Error(
      'GreatPages conecta automaticamente via CRM. Conecte o CRM primeiro e então use /api/greatpages/auth.'
    )
  },

  /* ── handleCallback ───────────────────────────────────────────────────── */

  async handleCallback(_code: string, _state: string): Promise<Connection> {
    throw new Error('GreatPages não usa OAuth. Não há callback para processar.')
  },

  /* ── verify ───────────────────────────────────────────────────────────── */

  async verify(connection: Connection): Promise<boolean> {
    try {
      // Verifica se o CRM está conectado na mesma empresa
      const supabase = getAdminSupabase()
      const crmConnection = await getConnection(supabase, connection.empresa_id, 'crm')

      if (!crmConnection || !crmConnection.is_active) {
        await supabase
          .from('social_connections')
          .update({
            last_error: 'CRM não conectado. Conecte o CRM BGPGO primeiro.',
          })
          .eq('id', connection.id)

        return false
      }

      // Testa o endpoint com período mínimo
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      await fetchGreatPagesData(connection.empresa_id, {
        date_from: formatDate(yesterday),
        date_to: formatDate(new Date()),
      })

      await supabase
        .from('social_connections')
        .update({ last_verified_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id)

      return true
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Erro desconhecido na verificação GreatPages'

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
    // GreatPages não tem token
    return connection
  },

  /* ── disconnect ───────────────────────────────────────────────────────── */

  async disconnect(connection: Connection): Promise<void> {
    const supabase = getAdminSupabase()
    await deactivateConnection(supabase, connection.id)
  },

  /* ── syncProfile ──────────────────────────────────────────────────────── */

  async syncProfile(connection: Connection): Promise<ProfileData> {
    // Busca dados de sumário para montar o perfil
    const period = {
      date_from: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      date_to: formatDate(new Date()),
    }

    let gpData: GreatPagesData = {
      activeLandingPages: 0,
      leadsGenerated: 0,
      topLP: [],
      utmBreakdown: {},
    }

    try {
      gpData = await fetchGreatPagesData(connection.empresa_id, period)
    } catch {
      // Falha silenciosa — retorna perfil vazio
    }

    return {
      provider_user_id: connection.empresa_id,
      username: connection.username ?? 'greatpages',
      display_name: 'GreatPages',
      profile_picture_url: null,
      bio: 'Landing pages e captura de leads via GreatPages + UTM tracking.',
      url: null,
      followers_count: 0,
      following_count: 0,
      content_count: gpData.activeLandingPages,
      extra: {
        active_landing_pages: gpData.activeLandingPages,
        leads_last_30d: gpData.leadsGenerated,
        top_lp: gpData.topLP[0]?.name ?? null,
        source: 'greatpages_via_crm',
      },
    }
  },

  /* ── syncContent ──────────────────────────────────────────────────────── */

  async syncContent(
    connection: Connection,
    options?: SyncOptions
  ): Promise<ContentItem[]> {
    const period = getDefaultPeriod(options)
    const gpData = await fetchGreatPagesData(connection.empresa_id, period)

    if (gpData.leadsGenerated === 0) return []

    const now = new Date().toISOString()
    const items: ContentItem[] = []

    // Cada landing page do topLP vira um ContentItem
    for (const lp of gpData.topLP) {
      const safeId = lp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

      items.push({
        id: '',
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'greatpages',
        provider_content_id: `gp-lp-${safeId}-${period.date_from}`,
        content_type: 'landing_page',
        title: lp.name,
        caption: `${lp.leads} lead(s) capturado(s) entre ${period.date_from} e ${period.date_to}.`,
        url: null,
        thumbnail_url: null,
        published_at: period.date_from,
        metrics: {
          leads: lp.leads,
        },
        raw: lp as unknown as Record<string, unknown>,
        synced_at: now,
      })
    }

    // Se não há topLP mas há leads, cria um item agregado
    if (items.length === 0 && gpData.leadsGenerated > 0) {
      items.push({
        id: '',
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'greatpages',
        provider_content_id: `gp-aggregate-${period.date_from}-${period.date_to}`,
        content_type: 'landing_page',
        title: `Landing Pages — ${period.date_from} a ${period.date_to}`,
        caption: `${gpData.leadsGenerated} leads gerados em ${gpData.activeLandingPages} landing page(s).`,
        url: null,
        thumbnail_url: null,
        published_at: period.date_to,
        metrics: {
          leads: gpData.leadsGenerated,
          active_pages: gpData.activeLandingPages,
        },
        raw: gpData as unknown as Record<string, unknown>,
        synced_at: now,
      })
    }

    // Persiste no Supabase
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
    const gpData = await fetchGreatPagesData(connection.empresa_id, period)

    const today = formatDate(new Date())
    const now = new Date().toISOString()

    const metrics: Record<string, number> = {
      active_landing_pages: gpData.activeLandingPages,
      leads_generated: gpData.leadsGenerated,
    }

    // Métricas por campanha UTM
    for (const [campaign, count] of Object.entries(gpData.utmBreakdown)) {
      const key = `utm_${campaign.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      metrics[key] = count
    }

    // Top 5 LPs como métricas individuais
    gpData.topLP.forEach((lp, idx) => {
      const key = `top_lp_${idx + 1}_leads`
      metrics[key] = lp.leads
    })

    // Persiste metric_events no Supabase
    if (Object.keys(metrics).length > 0) {
      const supabase = getAdminSupabase()
      const metricEvents = Object.entries(metrics).map(([key, value]) => ({
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'greatpages' as const,
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
      provider: 'greatpages',
      snapshot_date: today,
      metrics,
      raw: gpData as unknown as Record<string, unknown>,
    }
  },

  /* ── syncInsights ─────────────────────────────────────────────────────── */

  async syncInsights(_connection: Connection, _contentIds: string[]) {
    // GreatPages não tem insights por item via esta integração
    return []
  },
}

/* ── Auto-conexão ────────────────────────────────────────────────────────── */

/**
 * Cria ou atualiza a conexão GreatPages para uma empresa.
 * Chamado pelo endpoint GET /api/greatpages/auth.
 *
 * REQUER que o CRM já esteja conectado para a mesma empresa.
 * Lança erro se o CRM não estiver ativo.
 */
export async function connectGreatPagesAuto(
  empresaId: string,
  userId: string
): Promise<Connection> {
  const supabase = getAdminSupabase()

  // Valida pré-requisito: CRM deve estar conectado
  const crmConnection = await getConnection(supabase, empresaId, 'crm')
  if (!crmConnection || !crmConnection.is_active) {
    throw new Error(
      'Conecte o CRM BGPGO antes de ativar o GreatPages. Acesse /api/crm/auth primeiro.'
    )
  }

  return upsertConnection(supabase, {
    empresa_id: empresaId,
    user_id: userId,
    provider: 'greatpages',
    provider_user_id: empresaId, // derivado do CRM
    username: 'greatpages',
    display_name: 'GreatPages',
    display_label: 'GreatPages (via CRM)',
    access_token: '', // sem token — dados vêm via CRM
    is_active: true,
    metadata: {
      auto_connected: true,
      source: 'crm_derived',
      connected_at: new Date().toISOString(),
    },
  })
}
