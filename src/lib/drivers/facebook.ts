/**
 * FacebookDriver — implementa ConnectionDriver para Facebook Pages
 *
 * Usa o MESMO Meta App do Instagram (META_APP_ID / META_APP_SECRET).
 * O fluxo OAuth obtém um user access_token, lista as Pages administradas,
 * captura o page access_token (que não expira) e o persiste como access_token
 * em social_connections. O user token original é guardado em metadata.
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

const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_read_user_content',
  'public_profile',
  'email',
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

interface FBPage {
  id: string
  name: string
  username?: string
  picture?: { data: { url: string } }
  fan_count?: number
  followers_count?: number
  access_token: string
}

interface FBPost {
  id: string
  message?: string
  created_time: string
  full_picture?: string
  permalink_url?: string
  reactions?: { summary: { total_count: number } }
  comments?: { summary: { total_count: number } }
  shares?: { count: number }
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
      `Facebook API [${data.error.code}] ${data.error.type}: ${data.error.message}`
    )
  }
  return data
}

/* ── Helpers de OAuth ────────────────────────────────────────────────────── */

async function exchangeFBCode(
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
    throw new Error(`Erro ao trocar code Facebook: ${data.error.message}`)
  }
  return data
}

async function getFBUserToken(
  shortToken: string,
  appId: string,
  appSecret: string
): Promise<FBTokenResponse> {
  return fbFetch<FBTokenResponse>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  })
}

async function listPages(userToken: string): Promise<FBPage[]> {
  const res = await fbFetch<{ data: FBPage[] }>('/me/accounts', {
    access_token: userToken,
    fields: 'id,name,username,picture,fan_count,followers_count,access_token',
  })
  return res.data ?? []
}

/* ── Driver ──────────────────────────────────────────────────────────────── */

export const facebookDriver: ConnectionDriver = {
  metadata: METADATA_BY_PROVIDER.facebook,

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

    const redirectUri = `${appUrl}/api/facebook/callback`
    const state = generateState({ empresa_id: empresaId, user_id: userId })

    const url = new URL(FB_OAUTH_URL)
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', FB_SCOPES)
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

    const redirectUri = `${appUrl}/api/facebook/callback`

    // Valida CSRF state
    const stateData = parseState(stateParam)

    // 1. Short-lived user token
    const shortToken = await exchangeFBCode(code, appId, appSecret, redirectUri)

    // 2. Long-lived user token (~60 dias)
    const longToken = await getFBUserToken(shortToken.access_token, appId, appSecret)
    const userToken = longToken.access_token

    // 3. Listar Pages administradas pelo usuário
    const pages = await listPages(userToken)
    if (pages.length === 0) {
      throw new Error(
        'Nenhuma Facebook Page encontrada. Você precisa ser administrador de pelo menos uma página.'
      )
    }

    // 4. Usar a primeira page (interface poderá implementar picker posteriormente)
    const page = pages[0]
    const pageToken = page.access_token // page token não expira

    const supabase = getAdminSupabase()

    const connection = await upsertConnection(supabase, {
      empresa_id: stateData.empresa_id,
      user_id: stateData.user_id,
      provider: 'facebook',
      provider_user_id: page.id,
      username: page.username ?? page.name,
      display_name: page.name,
      display_label: page.name,
      profile_picture_url: page.picture?.data?.url ?? null,
      access_token: pageToken, // page token como token principal
      token_expires_at: null, // page tokens não expiram
      page_id: page.id,
      app_id: appId,
      scopes: FB_SCOPES.split(','),
      is_active: true,
      metadata: {
        user_token: userToken, // guardar para renovação futura
        fan_count: page.fan_count ?? 0,
        followers_count: page.followers_count ?? 0,
        available_pages: pages.map((p) => ({ id: p.id, name: p.name })),
      },
    })

    return connection
  },

  /* ── verify ────────────────────────────────────────────────────────────── */

  async verify(connection: Connection): Promise<boolean> {
    try {
      const token = decryptToken(connection.access_token)
      const pageId = connection.page_id ?? connection.provider_user_id

      await fbFetch<{ id: string; name: string }>(`/${pageId}`, {
        access_token: token,
        fields: 'id,name',
      })

      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({ last_verified_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id)

      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido na verificação'

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
    // Page access tokens não expiram — nenhuma ação necessária
    // Se o user token tiver expirado, lança erro para forçar reconexão
    const userToken = connection.metadata?.user_token as string | undefined

    if (!userToken) {
      // Sem user token guardado, apenas confirmar que page token ainda funciona
      const isValid = await facebookDriver.verify(connection)
      if (!isValid) {
        throw new Error(
          'Token da Facebook Page inválido. Reconecte a página para restaurar o acesso.'
        )
      }
      return connection
    }

    // Tentar renovar o long-lived user token (se disponível)
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    if (!appId || !appSecret) {
      // Sem credenciais para renovar, verificar page token apenas
      return connection
    }

    try {
      const renewed = await getFBUserToken(userToken, appId, appSecret)

      const supabase = getAdminSupabase()
      const { data, error } = await supabase
        .from('social_connections')
        .update({
          metadata: {
            ...connection.metadata,
            user_token: renewed.access_token,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao salvar user token renovado: ${error.message}`)
      }

      return data as Connection
    } catch {
      // Renovação falhou, page token pode ainda ser válido
      return connection
    }
  },

  /* ── disconnect ────────────────────────────────────────────────────────── */

  async disconnect(connection: Connection): Promise<void> {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', connection.id)

    if (error) {
      throw new Error(`Erro ao desconectar Facebook Page: ${error.message}`)
    }
  },

  /* ── syncProfile ───────────────────────────────────────────────────────── */

  async syncProfile(connection: Connection): Promise<ProfileData> {
    const token = decryptToken(connection.access_token)
    const pageId = connection.page_id ?? connection.provider_user_id

    const page = await fbFetch<{
      id: string
      name: string
      username?: string
      picture?: { data: { url: string } }
      fan_count?: number
      followers_count?: number
    }>(`/${pageId}`, {
      access_token: token,
      fields: 'id,name,username,picture,fan_count,followers_count',
    })

    const today = new Date().toISOString().split('T')[0]
    const supabase = getAdminSupabase()

    const metrics: Record<string, number> = {
      fan_count: page.fan_count ?? 0,
      followers_count: page.followers_count ?? 0,
    }

    // Escrita em provider_snapshots
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'facebook',
        snapshot_date: today,
        metrics,
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Atualizar dados na própria conexão
    await supabase
      .from('social_connections')
      .update({
        display_name: page.name,
        display_label: page.name,
        username: page.username ?? page.name,
        profile_picture_url: page.picture?.data?.url ?? null,
        metadata: {
          ...connection.metadata,
          fan_count: page.fan_count ?? 0,
          followers_count: page.followers_count ?? 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return {
      provider_user_id: page.id,
      username: page.username ?? page.name,
      display_name: page.name,
      profile_picture_url: page.picture?.data?.url ?? null,
      bio: null,
      url: `https://www.facebook.com/${page.id}`,
      followers_count: page.followers_count ?? 0,
      following_count: 0,
      content_count: 0,
      extra: {
        fan_count: page.fan_count ?? 0,
      },
    }
  },

  /* ── syncContent ───────────────────────────────────────────────────────── */

  async syncContent(
    connection: Connection,
    options?: SyncOptions
  ): Promise<ContentItem[]> {
    const token = decryptToken(connection.access_token)
    const pageId = connection.page_id ?? connection.provider_user_id
    const limit = options?.contentLimit ?? 50

    let res: { data: FBPost[] }
    try {
      res = await fbFetch<{ data: FBPost[] }>(`/${pageId}/posts`, {
        access_token: token,
        fields:
          'id,message,created_time,full_picture,permalink_url,reactions.summary(total_count),comments.summary(total_count),shares',
        limit: String(limit),
      })
    } catch (err) {
      console.warn('[FacebookDriver.syncContent] Falha ao buscar posts:', err instanceof Error ? err.message : err)
      return []
    }

    const posts = res.data ?? []
    if (posts.length === 0) return []

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    const contentRows = posts.map((p) => ({
      empresa_id: connection.empresa_id,
      connection_id: connection.id,
      provider: 'facebook' as const,
      provider_content_id: p.id,
      content_type: 'post' as const,
      title: null,
      caption: p.message ?? null,
      url: p.permalink_url ?? null,
      thumbnail_url: p.full_picture ?? null,
      published_at: p.created_time,
      metrics: {
        reactions: p.reactions?.summary?.total_count ?? 0,
        comments: p.comments?.summary?.total_count ?? 0,
        shares: p.shares?.count ?? 0,
      } as Record<string, number>,
      raw: p as unknown as Record<string, unknown>,
      synced_at: now,
    }))

    const { data: upserted, error } = await supabase
      .from('content_items')
      .upsert(contentRows, { onConflict: 'connection_id,provider_content_id' })
      .select()

    if (error) {
      console.error('[FacebookDriver.syncContent] Erro ao upsert content_items:', error.message)
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
    const pageId = connection.page_id ?? connection.provider_user_id
    const today = new Date().toISOString().split('T')[0]

    const INSIGHT_METRICS = [
      'page_impressions',
      'page_engaged_users',
      'page_fans',
    ].join(',')

    let insightsData: { data: Array<{ name: string; values: Array<{ value: number }> }> } = { data: [] }

    try {
      insightsData = await fbFetch<typeof insightsData>(`/${pageId}/insights`, {
        access_token: token,
        metric: INSIGHT_METRICS,
        period: 'day',
      })
    } catch (err) {
      console.warn('[FacebookDriver.syncMetrics] Falha ao buscar insights:', err instanceof Error ? err.message : err)
    }

    const metrics: Record<string, number> = {}
    for (const insight of insightsData.data) {
      const val = insight.values?.[0]?.value ?? 0
      metrics[insight.name] = val
    }

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // Escrita em provider_snapshots
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'facebook',
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
        provider: 'facebook' as const,
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
      provider: 'facebook',
      snapshot_date: today,
      metrics,
      raw: { insights: insightsData.data } as Record<string, unknown>,
    }
  },

  /* ── syncInsights ──────────────────────────────────────────────────────── */

  async syncInsights(
    connection: Connection,
    contentIds: string[]
  ): Promise<InsightData[]> {
    if (contentIds.length === 0) return []

    const token = decryptToken(connection.access_token)
    const supabase = getAdminSupabase()

    const { data: contentRows } = await supabase
      .from('content_items')
      .select('id, provider_content_id, metrics')
      .eq('connection_id', connection.id)
      .in('provider_content_id', contentIds)

    const contentMap = new Map(
      (contentRows ?? []).map((r) => [
        r.provider_content_id as string,
        r as { id: string; provider_content_id: string; metrics: Record<string, number> },
      ])
    )

    const results: InsightData[] = []

    for (const postId of contentIds) {
      try {
        const insightRes = await fbFetch<{
          data: Array<{ name: string; values: Array<{ value: number }> }>
        }>(`/${postId}/insights`, {
          access_token: token,
          metric: 'post_impressions,post_engaged_users,post_reactions_by_type_total',
        })

        const rawInsights: Record<string, number> = {}
        for (const insight of insightRes.data ?? []) {
          rawInsights[insight.name] = insight.values?.[0]?.value ?? 0
        }

        if (Object.keys(rawInsights).length === 0) continue

        const row = contentMap.get(postId)
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
          provider_content_id: postId,
          metrics: rawInsights,
          raw: rawInsights as unknown as Record<string, unknown>,
        })
      } catch (err) {
        console.warn(
          `[FacebookDriver.syncInsights] Falha ao buscar insights para ${postId}:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    return results
  },
}
