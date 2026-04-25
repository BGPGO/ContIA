/**
 * MetaAdsDriver — implementa ConnectionDriver para Meta Ads (Facebook/Instagram Ads)
 *
 * Usa o MESMO Meta App do Instagram (META_APP_ID / META_APP_SECRET).
 * Scopes: ads_read, business_management, public_profile, email.
 * O fluxo OAuth obtém um long-lived user token e lista as Ad Accounts.
 * O ad_account_id é guardado em provider_user_id.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type {
  ConnectionDriver,
  Connection,
  ProfileData,
  ContentItem,
  MetricSet,
  InsightData,
  SyncOptions,
} from '@/types/providers'
import { METADATA_BY_PROVIDER } from './metadata'
import {
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  InstagramAPIError,
} from '@/lib/instagram'
import { generateState, parseState, upsertConnection, decryptToken } from './base'

/* ── Constantes ──────────────────────────────────────────────────────────── */

const FB_GRAPH = 'https://graph.facebook.com/v23.0'
const FB_OAUTH_URL = 'https://www.facebook.com/v23.0/dialog/oauth'

// Mantemos só o estritamente necessário pra leitura.
// business_management e email exigem App Review e dão "Invalid Scopes" sem aprovação.
const META_ADS_SCOPES = [
  'ads_read',
  'public_profile',
].join(',')

/* ── Admin Supabase ──────────────────────────────────────────────────────── */

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

/* ── Tipos locais ────────────────────────────────────────────────────────── */

interface FBTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

interface AdAccount {
  id: string
  name: string
  currency: string
  timezone_name: string
  account_status: number
  account_id: string
}

interface Campaign {
  id: string
  name: string
  status: string
  objective: string
  created_time: string
  effective_status: string
}

/* ── Helpers de action stats ─────────────────────────────────────────────── */

/**
 * Soma os valores (em moeda) de actions cujo action_type contém uma das chaves.
 * Usado pra extrair conversion_value de `action_values` da Graph API.
 */
function sumActionValues(
  actions: Array<{ action_type: string; value: string }> | undefined,
  matchKeys: string[]
): number {
  if (!actions || actions.length === 0) return 0
  return actions
    .filter((a) => matchKeys.some((k) => a.action_type.includes(k)))
    .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0)
}

/**
 * Média ponderada simples de purchase_roas: pega o maior valor entre actions
 * cujo type contém uma das chaves. Meta retorna ROAS por tipo de conversão.
 */
function avgActionValues(
  actions: Array<{ action_type: string; value: string }> | undefined,
  matchKeys: string[]
): number {
  if (!actions || actions.length === 0) return 0
  const values = actions
    .filter((a) => matchKeys.some((k) => a.action_type.includes(k)))
    .map((a) => parseFloat(a.value) || 0)
    .filter((v) => v > 0)
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/* ── HTTP helper ─────────────────────────────────────────────────────────── */

async function fbFetch<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${FB_GRAPH}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString())
  const data = (await res.json()) as { error?: { message: string; code: number; type: string } } & T

  if (data.error) {
    throw new Error(
      `Meta API [${data.error.code}] ${data.error.type}: ${data.error.message}`
    )
  }
  return data
}

/* ── Helpers de OAuth ────────────────────────────────────────────────────── */

async function exchangeMetaCode(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<FBTokenResponse> {
  const url = new URL(`${FB_GRAPH}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code', code)

  const res = await fetch(url.toString())
  const data = (await res.json()) as FBTokenResponse & { error?: { message: string } }

  if (data.error) {
    throw new Error(`Erro ao trocar code Meta: ${data.error.message}`)
  }
  return data
}

async function listAdAccounts(userToken: string): Promise<AdAccount[]> {
  const res = await fbFetch<{ data: AdAccount[] }>('/me/adaccounts', {
    access_token: userToken,
    fields: 'id,name,currency,timezone_name,account_status,account_id',
  })
  return res.data ?? []
}

/* ── Driver ──────────────────────────────────────────────────────────────── */

export const metaAdsDriver: ConnectionDriver = {
  metadata: METADATA_BY_PROVIDER.meta_ads,

  /* ── buildAuthUrl ──────────────────────────────────────────────────────── */

  async buildAuthUrl(empresaId: string, userId: string): Promise<string> {
    const appId = process.env.META_APP_ID
    if (!appId) {
      throw new Error(
        'META_APP_ID não configurado — defina a variável de ambiente no servidor'
      )
    }

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const redirectUri = `${appUrl}/api/meta-ads/callback`
    const state = generateState({ empresa_id: empresaId, user_id: userId })

    const url = new URL(FB_OAUTH_URL)
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', META_ADS_SCOPES)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('state', state)

    return url.toString()
  },

  /* ── handleCallback ────────────────────────────────────────────────────── */

  async handleCallback(code: string, stateParam: string): Promise<Connection> {
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error('META_APP_ID ou META_APP_SECRET não configurados')
    }

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const redirectUri = `${appUrl}/api/meta-ads/callback`

    // Valida CSRF state
    const stateData = parseState(stateParam)

    // 1. Short-lived token
    const shortToken = await exchangeMetaCode(code, appId, appSecret, redirectUri)

    // 2. Long-lived token (~60 dias) — reutiliza função de instagram.ts
    const longToken = await exchangeForLongLivedToken(shortToken.access_token, appSecret)
    const userToken = longToken.access_token

    // 3. Listar Ad Accounts
    const adAccounts = await listAdAccounts(userToken)
    if (adAccounts.length === 0) {
      throw new Error(
        'Nenhuma Ad Account encontrada. Você precisa ter acesso a pelo menos uma conta de anúncios Meta.'
      )
    }

    // 4. Usar a primeira Ad Account (interface poderá implementar picker)
    const account = adAccounts[0]
    // O ID retornado pela API já vem como "act_XXXXXXX"
    const accountId = account.id.startsWith('act_') ? account.id : `act_${account.id}`
    // Guardar só o número limpo como provider_user_id para normalização
    const numericAccountId = accountId.replace('act_', '')

    const supabase = getAdminSupabase()

    const connection = await upsertConnection(supabase, {
      empresa_id: stateData.empresa_id,
      user_id: stateData.user_id,
      provider: 'meta_ads',
      provider_user_id: numericAccountId, // ID numérico em provider_user_id
      username: account.name,
      display_name: account.name,
      display_label: account.name,
      profile_picture_url: null,
      access_token: userToken, // user token para Meta Ads API
      token_expires_at: new Date(Date.now() + longToken.expires_in * 1000).toISOString(),
      app_id: appId,
      scopes: META_ADS_SCOPES.split(','),
      is_active: true,
      metadata: {
        ad_account_id: accountId,
        currency: account.currency,
        timezone_name: account.timezone_name,
        account_status: account.account_status,
        available_accounts: adAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          currency: a.currency,
        })),
      },
    })

    return connection
  },

  /* ── verify ────────────────────────────────────────────────────────────── */

  async verify(connection: Connection): Promise<boolean> {
    try {
      const token = decryptToken(connection.access_token)
      const accountId = (connection.metadata?.ad_account_id as string | undefined) ??
        `act_${connection.provider_user_id}`

      await fbFetch<{ id: string; name: string }>(`/${accountId}`, {
        access_token: token,
        fields: 'id,name,account_status',
      })

      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({ last_verified_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id)

      return true
    } catch (err) {
      const msg =
        err instanceof InstagramAPIError
          ? `Meta API [${err.code}]: ${err.message}`
          : err instanceof Error
          ? err.message
          : 'Erro desconhecido na verificação'

      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({ last_error: msg })
        .eq('id', connection.id)

      return false
    }
  },

  /* ── refreshToken ──────────────────────────────────────────────────────── */

  async refreshToken(connection: Connection): Promise<Connection> {
    // Tokens do Meta expiram em ~60 dias — renova usando refresh_access_token
    const token = decryptToken(connection.access_token)

    let newToken: { access_token: string; expires_in: number }
    try {
      newToken = await refreshLongLivedToken(token)
    } catch (err) {
      throw new Error(
        `Falha ao renovar token Meta Ads: ${err instanceof Error ? err.message : err}. Reconecte a conta.`
      )
    }

    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('social_connections')
      .update({
        access_token: newToken.access_token,
        token_expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao salvar token renovado: ${error.message}`)
    }

    return data as Connection
  },

  /* ── disconnect ────────────────────────────────────────────────────────── */

  async disconnect(connection: Connection): Promise<void> {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', connection.id)

    if (error) {
      throw new Error(`Erro ao desconectar Meta Ads: ${error.message}`)
    }
  },

  /* ── syncProfile ───────────────────────────────────────────────────────── */

  async syncProfile(connection: Connection): Promise<ProfileData> {
    const token = decryptToken(connection.access_token)
    const accountId = (connection.metadata?.ad_account_id as string | undefined) ??
      `act_${connection.provider_user_id}`

    const account = await fbFetch<{
      id: string
      name: string
      currency: string
      timezone_name: string
      account_status: number
    }>(`/${accountId}`, {
      access_token: token,
      fields: 'id,name,currency,timezone_name,account_status',
    })

    const today = new Date().toISOString().split('T')[0]
    const supabase = getAdminSupabase()

    const metrics: Record<string, number> = {
      account_status: account.account_status,
    }

    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'meta_ads',
        snapshot_date: today,
        metrics,
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Atualizar dados da conexão
    await supabase
      .from('social_connections')
      .update({
        display_name: account.name,
        display_label: account.name,
        username: account.name,
        metadata: {
          ...connection.metadata,
          currency: account.currency,
          timezone_name: account.timezone_name,
          account_status: account.account_status,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return {
      provider_user_id: account.id,
      username: account.name,
      display_name: account.name,
      profile_picture_url: null,
      bio: null,
      url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${connection.provider_user_id}`,
      followers_count: 0,
      following_count: 0,
      content_count: 0,
      extra: {
        currency: account.currency,
        timezone_name: account.timezone_name,
        account_status: account.account_status,
      },
    }
  },

  /* ── syncContent ───────────────────────────────────────────────────────── */

  async syncContent(
    connection: Connection,
    options?: SyncOptions
  ): Promise<ContentItem[]> {
    const token = decryptToken(connection.access_token)
    const accountId = (connection.metadata?.ad_account_id as string | undefined) ??
      `act_${connection.provider_user_id}`
    const limit = options?.contentLimit ?? 50

    let res: { data: Campaign[] }
    try {
      res = await fbFetch<{ data: Campaign[] }>(`/${accountId}/campaigns`, {
        access_token: token,
        fields: 'id,name,status,objective,created_time,effective_status',
        limit: String(limit),
      })
    } catch (err) {
      console.warn('[MetaAdsDriver.syncContent] Falha ao buscar campanhas:', err instanceof Error ? err.message : err)
      return []
    }

    const campaigns = res.data ?? []
    if (campaigns.length === 0) return []

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    const contentRows = campaigns.map((c) => ({
      empresa_id: connection.empresa_id,
      connection_id: connection.id,
      provider: 'meta_ads' as const,
      provider_content_id: c.id,
      content_type: 'ad_campaign' as const,
      title: c.name,
      caption: null,
      url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${connection.provider_user_id}&selected_campaign_ids=${c.id}`,
      thumbnail_url: null,
      published_at: c.created_time,
      metrics: {} as Record<string, number>,
      raw: c as unknown as Record<string, unknown>,
      synced_at: now,
    }))

    const { data: upserted, error } = await supabase
      .from('content_items')
      .upsert(contentRows, { onConflict: 'connection_id,provider_content_id' })
      .select()

    if (error) {
      console.error('[MetaAdsDriver.syncContent] Erro ao upsert content_items:', error.message)
    }

    return (upserted ?? contentRows).map((row) => ({
      id: (row as { id?: string }).id ?? '',
      empresa_id: row.empresa_id,
      connection_id: row.connection_id,
      provider: row.provider,
      provider_content_id: row.provider_content_id,
      content_type: row.content_type,
      title: row.title,
      caption: row.caption,
      url: row.url,
      thumbnail_url: row.thumbnail_url,
      published_at: row.published_at,
      metrics: row.metrics,
      raw: row.raw,
      synced_at: row.synced_at,
    }))
  },

  /* ── syncMetrics ───────────────────────────────────────────────────────── */

  async syncMetrics(
    connection: Connection,
    _options?: SyncOptions
  ): Promise<MetricSet> {
    const token = decryptToken(connection.access_token)
    const accountId = (connection.metadata?.ad_account_id as string | undefined) ??
      `act_${connection.provider_user_id}`
    const today = new Date().toISOString().split('T')[0]

    type ActionStat = { action_type: string; value: string }
    let insightsData: {
      data: Array<{
        spend?: string
        impressions?: string
        clicks?: string
        ctr?: string
        cpc?: string
        conversions?: string
        action_values?: ActionStat[]
        purchase_roas?: ActionStat[]
        conversion_rate_ranking?: string
      }>
    } = { data: [] }

    try {
      insightsData = await fbFetch<typeof insightsData>(`/${accountId}/insights`, {
        access_token: token,
        fields:
          'spend,impressions,clicks,ctr,cpc,conversions,action_values,purchase_roas,conversion_rate_ranking',
        level: 'account',
        date_preset: 'today',
      })
    } catch (err) {
      console.warn('[MetaAdsDriver.syncMetrics] Falha ao buscar insights:', err instanceof Error ? err.message : err)
    }

    const raw = insightsData.data?.[0] ?? {}
    const conversionValue = sumActionValues(raw.action_values, ['purchase', 'lead', 'complete_registration'])
    const roas = avgActionValues(raw.purchase_roas, ['purchase'])
    const metrics: Record<string, number> = {
      spend: parseFloat(raw.spend ?? '0') || 0,
      impressions: parseInt(raw.impressions ?? '0', 10) || 0,
      clicks: parseInt(raw.clicks ?? '0', 10) || 0,
      ctr: parseFloat(raw.ctr ?? '0') || 0,
      cpc: parseFloat(raw.cpc ?? '0') || 0,
      conversions: parseFloat(raw.conversions ?? '0') || 0,
      conversion_value: conversionValue,
      roas: roas,
    }

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // Escrita em provider_snapshots
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'meta_ads',
        snapshot_date: today,
        metrics,
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Escrita em metric_events
    if (Object.keys(metrics).length > 0) {
      const metricEvents = Object.entries(metrics).map(([key, value]) => ({
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'meta_ads' as const,
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
      provider: 'meta_ads',
      snapshot_date: today,
      metrics,
      raw: { insights: insightsData.data } as Record<string, unknown>,
    }
  },

  /* ── syncInsights ──────────────────────────────────────────────────────── */

  async syncInsights(
    connection: Connection,
    campaignIds: string[]
  ): Promise<InsightData[]> {
    if (campaignIds.length === 0) return []

    const token = decryptToken(connection.access_token)
    const supabase = getAdminSupabase()

    const { data: contentRows } = await supabase
      .from('content_items')
      .select('id, provider_content_id, metrics')
      .eq('connection_id', connection.id)
      .in('provider_content_id', campaignIds)

    const contentMap = new Map(
      (contentRows ?? []).map((r) => [
        r.provider_content_id as string,
        r as { id: string; provider_content_id: string; metrics: Record<string, number> },
      ])
    )

    const results: InsightData[] = []

    for (const campaignId of campaignIds) {
      try {
        type ActionStat = { action_type: string; value: string }
        const insightRes = await fbFetch<{
          data: Array<{
            spend?: string
            impressions?: string
            clicks?: string
            ctr?: string
            cpc?: string
            conversions?: string
            reach?: string
            frequency?: string
            action_values?: ActionStat[]
            purchase_roas?: ActionStat[]
          }>
        }>(`/${campaignId}/insights`, {
          access_token: token,
          fields:
            'spend,impressions,clicks,ctr,cpc,conversions,reach,frequency,action_values,purchase_roas',
          date_preset: 'lifetime',
        })

        const raw = insightRes.data?.[0] ?? {}
        const conversionValue = sumActionValues(raw.action_values, ['purchase', 'lead', 'complete_registration'])
        const roas = avgActionValues(raw.purchase_roas, ['purchase'])
        const rawInsights: Record<string, number> = {
          spend: parseFloat(raw.spend ?? '0') || 0,
          impressions: parseInt(raw.impressions ?? '0', 10) || 0,
          clicks: parseInt(raw.clicks ?? '0', 10) || 0,
          ctr: parseFloat(raw.ctr ?? '0') || 0,
          cpc: parseFloat(raw.cpc ?? '0') || 0,
          conversions: parseFloat(raw.conversions ?? '0') || 0,
          reach: parseInt(raw.reach ?? '0', 10) || 0,
          frequency: parseFloat(raw.frequency ?? '0') || 0,
          conversion_value: conversionValue,
          roas: roas,
        }

        if (Object.values(rawInsights).every((v) => v === 0)) continue

        const row = contentMap.get(campaignId)
        if (row?.id) {
          const mergedMetrics: Record<string, number> = {
            ...(row.metrics ?? {}),
            ...rawInsights,
          }
          await supabase
            .from('content_items')
            .update({ metrics: mergedMetrics, synced_at: new Date().toISOString() })
            .eq('id', row.id)
        }

        results.push({
          provider_content_id: campaignId,
          metrics: rawInsights,
          raw: raw as unknown as Record<string, unknown>,
        })
      } catch (err) {
        console.warn(
          `[MetaAdsDriver.syncInsights] Falha ao buscar insights para campanha ${campaignId}:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    return results
  },
}
