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

interface Ad {
  id: string
  name: string
  status: string
  campaign_id: string
  adset_id: string
  creative?: {
    id: string
    thumbnail_url?: string
    effective_instagram_story_id?: string
    effective_object_story_id?: string
  }
  created_time: string
  effective_status: string
}

/** Métricas by-platform retornadas com breakdown=publisher_platform */
export interface ByPlatformMetrics {
  reach?: number
  impressions?: number
  clicks?: number
  spend?: number
  inline_link_clicks?: number
}

export interface PlatformBreakdown {
  facebook?: ByPlatformMetrics
  instagram?: ByPlatformMetrics
  audience_network?: ByPlatformMetrics
  messenger?: ByPlatformMetrics
}

/* ── Token exchange (Facebook Graph API, NÃO Instagram) ─────────────────── */

/**
 * Troca short-lived user token por long-lived (~60 dias).
 * Endpoint: graph.facebook.com (NÃO graph.instagram.com).
 */
async function exchangeFBLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const url = new URL(`${FB_GRAPH}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('fb_exchange_token', shortToken)

  const res = await fetch(url.toString())
  const data = (await res.json()) as {
    access_token?: string
    token_type?: string
    expires_in?: number
    error?: { message: string; code: number; type: string }
  }

  if (data.error) {
    throw new Error(
      `Erro ao trocar long-lived token FB [${data.error.code}] ${data.error.type}: ${data.error.message}`
    )
  }

  if (!data.access_token) {
    throw new Error('Resposta do Facebook sem access_token')
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type ?? 'bearer',
    expires_in: data.expires_in ?? 5184000, // 60 dias default
  }
}

/**
 * Renova um long-lived token estendendo por mais ~60 dias.
 * Mesma chamada do exchange — basta passar o token atual.
 */
async function refreshFBLongLivedToken(
  token: string,
  appId: string,
  appSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const result = await exchangeFBLongLivedToken(token, appId, appSecret)
  return { access_token: result.access_token, expires_in: result.expires_in }
}

/* ── Helpers de action stats ─────────────────────────────────────────────── */

type ActionStat = { action_type: string; value: string }

/**
 * Soma os valores (em moeda) de actions cujo action_type contém uma das chaves.
 * Usado pra extrair conversion_value de `action_values` da Graph API.
 */
function sumActionValues(
  actions: ActionStat[] | undefined,
  matchKeys: string[]
): number {
  if (!actions || actions.length === 0) return 0
  return actions
    .filter((a) => matchKeys.some((k) => a.action_type.includes(k)))
    .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0)
}

/**
 * Soma o COUNT de actions cujo action_type contém uma das chaves.
 * Diferente de sumActionValues que soma `value` (valor monetário) — esse soma quantidade.
 */
function sumActions(
  actions: ActionStat[] | undefined,
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
  actions: ActionStat[] | undefined,
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

/**
 * Extrai métricas numéricas de uma linha de insights da Marketing API.
 * Suporta tanto `actions[]` (conversions count) quanto `action_values[]` (valor).
 *
 * Conversões separadas por tipo:
 *   - leads: action_type contém 'lead' ou 'onsite_conversion.lead_grouped'
 *   - purchases: action_type contém 'purchase' ou 'omni_purchase'
 *   - registrations: action_type contém 'complete_registration'
 *   - conversions: soma legacy de todos os tipos (retrocompatibilidade)
 *   - link_clicks: inline_link_clicks (diferente de clicks total)
 */
function parseMetricsRow(raw: {
  spend?: string
  impressions?: string
  clicks?: string
  inline_link_clicks?: string
  ctr?: string
  cpc?: string
  reach?: string
  frequency?: string
  cpm?: string
  actions?: ActionStat[]
  action_values?: ActionStat[]
  purchase_roas?: ActionStat[]
}): Record<string, number> {
  const conversionValue = sumActionValues(raw.action_values, ['purchase', 'lead', 'complete_registration'])
  // Legacy aggregate conversions (retrocompatibilidade)
  const conversions = sumActions(raw.actions, ['offsite_conversion', 'lead', 'complete_registration', 'purchase'])
  // Tipos separados de conversão
  const leads = sumActions(raw.actions, [
    'lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
  ])
  const purchases = sumActions(raw.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ])
  const complete_registrations = sumActions(raw.actions, [
    'complete_registration',
    'offsite_conversion.fb_pixel_complete_registration',
  ])
  const roas = avgActionValues(raw.purchase_roas, ['purchase'])

  // link_clicks: prefer inline_link_clicks field, then fall back to inline actions
  const link_clicks = raw.inline_link_clicks
    ? parseInt(raw.inline_link_clicks, 10) || 0
    : sumActions(raw.actions, ['link_click', 'inline_link_clicks'])

  return {
    spend: parseFloat(raw.spend ?? '0') || 0,
    impressions: parseInt(raw.impressions ?? '0', 10) || 0,
    clicks: parseInt(raw.clicks ?? '0', 10) || 0,
    link_clicks,
    ctr: parseFloat(raw.ctr ?? '0') || 0,
    cpc: parseFloat(raw.cpc ?? '0') || 0,
    cpm: parseFloat(raw.cpm ?? '0') || 0,
    reach: parseInt(raw.reach ?? '0', 10) || 0,
    frequency: parseFloat(raw.frequency ?? '0') || 0,
    conversions,
    conversion_value: conversionValue,
    leads,
    purchases,
    complete_registrations,
    roas,
  }
}

/**
 * Resolve o accountId ativo: prefere `active_account_id` (selecionado via picker)
 * antes de cair no `ad_account_id` original do callback.
 */
function resolveAccountId(connection: Connection): string {
  return (
    (connection.metadata?.active_account_id as string | undefined) ??
    (connection.metadata?.ad_account_id as string | undefined) ??
    `act_${connection.provider_user_id}`
  )
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

    // 2. Long-lived token (~60 dias) — usa Facebook Graph API
    const longToken = await exchangeFBLongLivedToken(shortToken.access_token, appId, appSecret)
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
      const accountId = resolveAccountId(connection)

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
        err instanceof Error
          ? `Meta API: ${err.message}`
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
    // Tokens do Meta expiram em ~60 dias — renova via Graph API do Facebook
    const token = decryptToken(connection.access_token)
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      throw new Error('META_APP_ID ou META_APP_SECRET não configurados')
    }

    let newToken: { access_token: string; expires_in: number }
    try {
      newToken = await refreshFBLongLivedToken(token, appId, appSecret)
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
    const accountId = resolveAccountId(connection)

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
    const accountId = resolveAccountId(connection)
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
      caption: c.name, // popula caption com o nome da campanha para evitar título vazio na UI
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
    options?: SyncOptions & { dateRange?: { since: string; until: string } }
  ): Promise<MetricSet> {
    const token = decryptToken(connection.access_token)
    const accountId = resolveAccountId(connection)
    const today = new Date().toISOString().split('T')[0]
    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // Aceita 3 formas de definir o range:
    //   1. options.dateRange = { since: "YYYY-MM-DD", until: "YYYY-MM-DD" } (explicit)
    //   2. options.since + options.until = Date (do SyncOptions padrão — usado por cron/sync)
    //   3. nenhum — usa date_preset: 'today' (modo legacy)
    const toDateString = (d: Date | string): string =>
      typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0]

    let resolvedRange: { since: string; until: string } | null = null
    if (options?.dateRange) {
      resolvedRange = options.dateRange
    } else if (options?.since && options?.until) {
      resolvedRange = {
        since: toDateString(options.since),
        until: toDateString(options.until),
      }
    }

    // Parâmetros de data: range real com time_increment=1 (1 row/dia) ou preset today
    const dateParams: Record<string, string> = resolvedRange
      ? {
          time_range: JSON.stringify(resolvedRange),
          time_increment: '1',
        }
      : { date_preset: 'today' }

    type InsightsRow = {
      date_start?: string
      date_stop?: string
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
      purchase_roas?: ActionStat[]
    }

    type PlatformBreakdownRow = InsightsRow & {
      publisher_platform?: string
    }

    let insightsData: { data: InsightsRow[] } = { data: [] }
    let platformData: { data: PlatformBreakdownRow[] } = { data: [] }

    const insightFields =
      'spend,impressions,clicks,inline_link_clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,purchase_roas'

    let fetchSucceeded = false
    try {
      // Fetch 1: aggregate totals (same as before)
      insightsData = await fbFetch<typeof insightsData>(`/${accountId}/insights`, {
        access_token: token,
        fields: insightFields,
        level: 'account',
        ...dateParams,
      })

      // Fetch 2: breakdown by publisher_platform (single aggregate for the period)
      // We use date_preset=last_30d or aggregate for the range — no time_increment here
      // to keep payload small (1 row per platform rather than 1 per day per platform)
      const platformDateParams: Record<string, string> = resolvedRange
        ? { time_range: JSON.stringify(resolvedRange) }
        : { date_preset: 'today' }

      try {
        platformData = await fbFetch<typeof platformData>(`/${accountId}/insights`, {
          access_token: token,
          fields: 'spend,impressions,clicks,inline_link_clicks,reach,publisher_platform',
          level: 'account',
          breakdowns: 'publisher_platform',
          ...platformDateParams,
        })
      } catch (platformErr) {
        // platform breakdown is best-effort — don't fail the whole sync
        console.warn('[MetaAdsDriver.syncMetrics] Falha ao buscar breakdown por platform (non-fatal):', platformErr instanceof Error ? platformErr.message : platformErr)
      }

      fetchSucceeded = true
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('[MetaAdsDriver.syncMetrics] Falha ao buscar insights:', errMsg)

      // Registrar last_error na conexão
      await supabase
        .from('social_connections')
        .update({
          last_error: `syncMetrics ${now}: ${errMsg}`,
          updated_at: now,
        })
        .eq('id', connection.id)
    }

    // Limpar last_error em caso de sucesso (preserva erros antigos não resolvidos
    // se a chamada falhou; apaga o erro stale se a chamada agora passou).
    if (fetchSucceeded) {
      await supabase
        .from('social_connections')
        .update({ last_error: null, updated_at: now })
        .eq('id', connection.id)
    }

    // Build byPlatform object from breakdown rows
    const byPlatform: PlatformBreakdown = {}
    for (const row of platformData.data ?? []) {
      const platform = row.publisher_platform?.toLowerCase()
      if (!platform) continue
      const key = platform as keyof PlatformBreakdown
      byPlatform[key] = {
        reach: parseInt(row.reach ?? '0', 10) || 0,
        impressions: parseInt(row.impressions ?? '0', 10) || 0,
        clicks: parseInt(row.clicks ?? '0', 10) || 0,
        spend: parseFloat(row.spend ?? '0') || 0,
        inline_link_clicks: parseInt(row.inline_link_clicks ?? '0', 10) || 0,
      }
    }

    const dailyRows = insightsData.data ?? []

    // --- Modo backfill: BATCH upsert de todos os snapshots do range em 1 query ---
    // (loop sequencial estourava timeout 30s do cron)
    if (resolvedRange && dailyRows.length > 0) {
      const snapshotRows = dailyRows.map((row) => {
        const baseMetrics = parseMetricsRow(row)
        return {
          empresa_id: connection.empresa_id,
          connection_id: connection.id,
          provider: 'meta_ads' as const,
          snapshot_date: row.date_start ?? today,
          // byPlatform only on the last day (single aggregate for entire range)
          metrics: {
            ...baseMetrics,
            ...(row.date_start === (dailyRows[dailyRows.length - 1]?.date_start ?? '')
              ? { byPlatform }
              : {}),
          } as Record<string, unknown>,
        }
      })

      await supabase.from('provider_snapshots').upsert(snapshotRows, {
        onConflict: 'connection_id,snapshot_date',
      })

      // Achatar todos metric_events em 1 array e fazer 1 upsert só
      const allMetricEvents = snapshotRows.flatMap((s) => {
        const numericMetrics = Object.fromEntries(
          Object.entries(s.metrics).filter(([, v]) => typeof v === 'number')
        ) as Record<string, number>
        return Object.keys(numericMetrics).length > 0
          ? Object.entries(numericMetrics).map(([key, value]) => ({
              empresa_id: connection.empresa_id,
              connection_id: connection.id,
              provider: 'meta_ads' as const,
              metric_key: key,
              metric_value: value,
              dimension: {} as Record<string, unknown>,
              occurred_at: s.snapshot_date,
              collected_at: now,
            }))
          : []
      })

      if (allMetricEvents.length > 0) {
        await supabase.from('metric_events').upsert(allMetricEvents, {
          onConflict: 'connection_id,metric_key,occurred_at,dimension',
        })
      }

      // Retornar o snapshot do último dia do range como representante
      const lastRow = dailyRows[dailyRows.length - 1]
      return {
        connection_id: connection.id,
        provider: 'meta_ads',
        snapshot_date: lastRow.date_start ?? today,
        metrics: parseMetricsRow(lastRow),
        raw: { insights: dailyRows, byPlatform } as Record<string, unknown>,
      }
    }

    // --- Modo legacy (today) ---
    const raw = dailyRows[0] ?? {}
    const metrics = parseMetricsRow(raw)
    const metricsWithPlatform = {
      ...metrics,
      ...(Object.keys(byPlatform).length > 0 ? { byPlatform } : {}),
    } as Record<string, unknown>

    // Escrita em provider_snapshots
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'meta_ads',
        snapshot_date: today,
        metrics: metricsWithPlatform,
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Escrita em metric_events (só campos numéricos)
    const numericMetrics = Object.fromEntries(
      Object.entries(metricsWithPlatform).filter(([, v]) => typeof v === 'number')
    ) as Record<string, number>

    if (Object.keys(numericMetrics).length > 0) {
      const metricEvents = Object.entries(numericMetrics).map(([key, value]) => ({
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
      raw: { insights: dailyRows, byPlatform } as Record<string, unknown>,
    }
  },

  /* ── syncInsights ──────────────────────────────────────────────────────── */

  async syncInsights(
    connection: Connection,
    campaignIds: string[],
    options?: SyncOptions & { dateRange?: { since: string; until: string } }
  ): Promise<InsightData[]> {
    if (campaignIds.length === 0) return []

    const token = decryptToken(connection.access_token)
    const accountId = resolveAccountId(connection)
    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // Resolver range (mesma lógica de syncMetrics)
    const toDateString = (d: Date | string): string =>
      typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0]

    let resolvedRange: { since: string; until: string } | null = null
    if (options?.dateRange) {
      resolvedRange = options.dateRange
    } else if (options?.since && options?.until) {
      resolvedRange = {
        since: toDateString(options.since),
        until: toDateString(options.until),
      }
    }

    const dateParams: Record<string, string> = resolvedRange
      ? { time_range: JSON.stringify(resolvedRange) }
      : { date_preset: 'last_30d' } // padrão: últimos 30d em vez de lifetime

    // Carrega map de content_items pra fazer update em batch
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

    // 1 ÚNICO request: /{accountId}/insights?level=campaign retorna 1 row por campanha com atividade
    let perCampaign: Array<{
      campaign_id?: string
      campaign_name?: string
      spend?: string
      impressions?: string
      clicks?: string
      ctr?: string
      cpc?: string
      reach?: string
      frequency?: string
      actions?: ActionStat[]
      action_values?: ActionStat[]
      purchase_roas?: ActionStat[]
    }> = []

    try {
      const res = await fbFetch<{ data: typeof perCampaign }>(
        `/${accountId}/insights`,
        {
          access_token: token,
          fields:
            'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,purchase_roas',
          level: 'campaign',
          limit: '500',
          ...dateParams,
        }
      )
      perCampaign = res.data ?? []
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('[MetaAdsDriver.syncInsights] Falha ao buscar insights por campanha:', errMsg)
      await supabase
        .from('social_connections')
        .update({ last_error: `syncInsights ${now}: ${errMsg}`, updated_at: now })
        .eq('id', connection.id)
      return []
    }

    const results: InsightData[] = []

    // Update individual mas em paralelo (Promise.all) — muito mais rápido que loop sequencial
    await Promise.all(
      perCampaign.map(async (row) => {
        if (!row.campaign_id) return
        const rawInsights = parseMetricsRow(row)
        const contentRow = contentMap.get(row.campaign_id)
        if (!contentRow?.id) return

        const merged: Record<string, number> = {
          ...(contentRow.metrics ?? {}),
          ...rawInsights,
        }

        await supabase
          .from('content_items')
          .update({ metrics: merged, synced_at: now })
          .eq('id', contentRow.id)

        results.push({
          provider_content_id: row.campaign_id,
          metrics: rawInsights,
          raw: row as unknown as Record<string, unknown>,
        })
      })
    )

    return results
  },

  /* ── syncAds ───────────────────────────────────────────────────────────── */
  /**
   * Sincroniza anúncios individuais (nível Ad, não Campaign) dos últimos 30 dias.
   *
   * Para cada ad ativo ou pausado recentemente:
   *   1. Busca lista de ads com campos creative, campaign_id, adset_id
   *   2. Busca insights por ad (spend, impressions, reach, clicks, actions, inline_link_clicks, etc.)
   *   3. Persiste em content_items com content_type='ad'
   *
   * Salva campos extras necessários para tabela "Anúncios em Destaque":
   *   - thumbnail_url: creative.thumbnail_url (se disponível)
   *   - title: nome do ad
   *   - metrics: mesmas separações de conversion que campaigns
   *   - raw: inclui campaign_id, adset_id, creative para cruzamento
   */
  async syncAds(
    connection: Connection,
    options?: SyncOptions & { dateRange?: { since: string; until: string } }
  ): Promise<ContentItem[]> {
    const token = decryptToken(connection.access_token)
    const accountId = resolveAccountId(connection)
    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    const toDateString = (d: Date | string): string =>
      typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0]

    let resolvedRange: { since: string; until: string } | null = null
    if (options?.dateRange) {
      resolvedRange = options.dateRange
    } else if (options?.since && options?.until) {
      resolvedRange = {
        since: toDateString(options.since),
        until: toDateString(options.until),
      }
    } else {
      // Default: últimos 30 dias
      const until = new Date()
      const since = new Date(until)
      since.setDate(since.getDate() - 30)
      resolvedRange = {
        since: since.toISOString().split('T')[0],
        until: until.toISOString().split('T')[0],
      }
    }

    const dateParams: Record<string, string> = resolvedRange
      ? { time_range: JSON.stringify(resolvedRange) }
      : { date_preset: 'last_30d' }

    // 1. Fetch ads list
    let ads: Ad[] = []
    try {
      const res = await fbFetch<{ data: Ad[] }>(`/${accountId}/ads`, {
        access_token: token,
        fields: 'id,name,status,campaign_id,adset_id,creative{thumbnail_url},created_time,effective_status',
        effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED']),
        limit: '200',
        ...dateParams,
      })
      ads = res.data ?? []
    } catch (err) {
      console.warn('[MetaAdsDriver.syncAds] Falha ao buscar ads:', err instanceof Error ? err.message : err)
      return []
    }

    if (ads.length === 0) return []

    // 2. Fetch insights for all ads in 1 request (level=ad)
    type AdInsightRow = {
      ad_id?: string
      ad_name?: string
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
      purchase_roas?: ActionStat[]
    }

    let adInsights: AdInsightRow[] = []
    try {
      const res = await fbFetch<{ data: AdInsightRow[] }>(`/${accountId}/insights`, {
        access_token: token,
        fields:
          'ad_id,ad_name,spend,impressions,clicks,inline_link_clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,purchase_roas',
        level: 'ad',
        limit: '500',
        ...dateParams,
      })
      adInsights = res.data ?? []
    } catch (err) {
      console.warn('[MetaAdsDriver.syncAds] Falha ao buscar insights por ad:', err instanceof Error ? err.message : err)
      // Continue without metrics — still upsert ad records
    }

    // Build insights map by ad_id
    const insightsMap = new Map<string, AdInsightRow>(
      adInsights.filter((r) => r.ad_id).map((r) => [r.ad_id as string, r])
    )

    // 3. Build content rows
    const contentRows = ads.map((ad) => {
      const insight = insightsMap.get(ad.id) ?? {}
      const metrics = parseMetricsRow(insight)
      const thumbnailUrl = ad.creative?.thumbnail_url ?? null

      return {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'meta_ads' as const,
        provider_content_id: ad.id,
        content_type: 'ad' as const,
        title: ad.name,
        caption: ad.name,
        url: `https://business.facebook.com/adsmanager/manage/ads?act=${connection.provider_user_id}&selected_ad_ids=${ad.id}`,
        thumbnail_url: thumbnailUrl,
        published_at: ad.created_time,
        metrics,
        raw: {
          ad_id: ad.id,
          ad_name: ad.name,
          campaign_id: ad.campaign_id,
          adset_id: ad.adset_id,
          status: ad.status,
          effective_status: ad.effective_status,
          creative_id: ad.creative?.id ?? null,
        } as Record<string, unknown>,
        synced_at: now,
      }
    })

    const { data: upserted, error } = await supabase
      .from('content_items')
      .upsert(contentRows, { onConflict: 'connection_id,provider_content_id' })
      .select()

    if (error) {
      console.error('[MetaAdsDriver.syncAds] Erro ao upsert content_items:', error.message)
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
}
