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

// Mínimo para listar Pages e ler engajamento (analytics orgânico).
// pages_manage_posts/pages_read_user_content/email exigem App Review e dão "Invalid Scopes".
// Quando precisar publicar via API, reativar pages_manage_posts após aprovação.
const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
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
  attachments?: { data: Array<{ type?: string }> }
  reactions?: { summary: { total_count: number } }
  comments?: { summary: { total_count: number } }
  shares?: { count: number }
}

interface FBPostInsight {
  name: string
  // values may be a number or an object (e.g. reactions breakdown)
  values: Array<{ value: number | Record<string, number> }>
}

interface FBReel {
  id: string
  title?: string
  description?: string
  permalink_url?: string
  picture?: string
  created_time: string
  length?: number
}

interface FBVideoInsight {
  name: string
  values: Array<{ value: number }>
}

interface FBPageInsightLifetime {
  name: string
  // lifetime insights return a single values array (period=lifetime)
  values: Array<{ value: number | Record<string, number> }>
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
  const pages = res.data ?? []
  console.log(`[FB Driver] /me/accounts retornou ${pages.length} pages:`, pages.map(p => ({ id: p.id, name: p.name })))
  return pages
}

/**
 * Inspeciona um user_token e retorna scopes concedidos.
 * Útil pra diagnosticar quando granular_scopes derrubam permissions.
 */
async function debugToken(userToken: string, appId: string, appSecret: string): Promise<{ scopes: string[]; granular_scopes?: Array<{ scope: string; target_ids?: string[] }> }> {
  const url = new URL(`${FB_GRAPH}/debug_token`)
  url.searchParams.set('input_token', userToken)
  url.searchParams.set('access_token', `${appId}|${appSecret}`)
  const res = await fetch(url.toString())
  const data = (await res.json()) as { data?: { scopes?: string[]; granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } }
  return {
    scopes: data.data?.scopes ?? [],
    granular_scopes: data.data?.granular_scopes,
  }
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
    let pages = await listPages(userToken)

    // Fallback: Pages em Business Manager não aparecem em /me/accounts sem business_management
    // mas o user concedeu pages_show_list por Page específica (granular_scopes).
    // Buscar cada Page por ID retornado em target_ids.
    if (pages.length === 0) {
      const debug = await debugToken(userToken, appId, appSecret)
      console.log('[FB Driver] Token concedeu scopes:', debug.scopes, 'granular:', debug.granular_scopes)

      const hasPagesScope = debug.scopes.includes('pages_show_list')
      if (!hasPagesScope) {
        throw new Error(
          'Permissão pages_show_list não foi concedida. Reconecte autorizando todas as permissões pedidas.'
        )
      }

      const granularPages = debug.granular_scopes?.find((g) => g.scope === 'pages_show_list')
      const pageIds = granularPages?.target_ids ?? []

      if (pageIds.length === 0) {
        throw new Error(
          'Você precisa selecionar pelo menos uma Página no diálogo de autorização do Facebook. Clique "Edit access" e marque a página.'
        )
      }

      // Buscar cada Page direto pelo ID (funciona mesmo em Business Manager)
      console.log(`[FB Driver] Buscando ${pageIds.length} pages por ID via Business fallback`)
      const fetchedPages: FBPage[] = []
      for (const pageId of pageIds) {
        try {
          const page = await fbFetch<FBPage>(`/${pageId}`, {
            access_token: userToken,
            fields: 'id,name,username,picture,fan_count,followers_count,access_token',
          })
          if (page?.access_token) {
            fetchedPages.push(page)
          } else {
            console.warn(`[FB Driver] Page ${pageId} sem access_token retornado — pode ser que user não seja admin`)
          }
        } catch (err) {
          console.warn(`[FB Driver] Falha ao buscar Page ${pageId}:`, err instanceof Error ? err.message : err)
        }
      }

      if (fetchedPages.length === 0) {
        throw new Error(
          'Página selecionada não retornou access_token. Você precisa ser ADMIN da página (não Editor/Analista). Confira em facebook.com/settings?tab=pages.'
        )
      }
      pages = fetchedPages
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

    // Fix 3: ler snapshot existente e mesclar metrics (JSONB merge — preserva dados de syncMetrics)
    const { data: existingProfileSnapshot } = await supabase
      .from('provider_snapshots')
      .select('metrics')
      .eq('connection_id', connection.id)
      .eq('snapshot_date', today)
      .maybeSingle()

    const mergedProfileMetrics = { ...(existingProfileSnapshot?.metrics ?? {}), ...metrics }

    // Escrita em provider_snapshots com metrics mesclados
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'facebook',
        snapshot_date: today,
        metrics: mergedProfileMetrics,
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

    // Calcular janela de 30 dias (ou usar o since/until de options)
    const until = options?.until ?? new Date()
    const since = options?.since ?? new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sinceTs = Math.floor(since.getTime() / 1000).toString()
    const untilTs = Math.floor(until.getTime() / 1000).toString()

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // ── 1. Posts orgânicos publicados (published_posts) ────────────────────
    let posts: FBPost[] = []
    try {
      const res = await fbFetch<{ data: FBPost[] }>(`/${pageId}/published_posts`, {
        access_token: token,
        fields: 'id,message,permalink_url,full_picture,created_time,attachments',
        limit: String(limit),
        since: sinceTs,
        until: untilTs,
      })
      posts = res.data ?? []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[FacebookDriver.syncContent] /published_posts falhou, tentando /feed:', msg)

      // Fallback para /feed (mais permissivo) com campos compatíveis
      try {
        const fallback = await fbFetch<{ data: FBPost[] }>(`/${pageId}/feed`, {
          access_token: token,
          fields: 'id,message,created_time,full_picture,permalink_url,attachments',
          limit: String(limit),
          since: sinceTs,
          until: untilTs,
        })
        posts = fallback.data ?? []
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2)
        const isPermErr =
          msg2.includes('#10') ||
          msg2.includes('pages_read_user_content') ||
          msg2.includes('OAuthException')
        if (isPermErr) {
          console.warn(
            '[FacebookDriver.syncContent] /feed sem permissão. Pulando posts. Solicite pages_read_user_content via App Review.'
          )
        } else {
          console.warn('[FacebookDriver.syncContent] Falha ao buscar feed:', msg2)
        }
        await supabase.from('social_connections').update({
          last_error: `[${new Date().toISOString()}] syncContent: ${msg2}`,
        }).eq('id', connection.id)

        // Prosseguir para tentar reels mesmo sem posts
        posts = []
      }
    }

    // ── 2. Per-post insights (organic reach, paid reach, reactions breakdown, clicks) ──
    const POST_INSIGHT_METRICS = [
      'post_impressions',
      'post_impressions_organic',
      'post_impressions_paid',
      'post_engaged_users',
      'post_reactions_by_type_total',
      'post_clicks',
    ].join(',')

    const postInsightsMap = new Map<string, Record<string, number>>()

    for (const p of posts) {
      try {
        const insightRes = await fbFetch<{ data: FBPostInsight[] }>(`/${p.id}/insights`, {
          access_token: token,
          metric: POST_INSIGHT_METRICS,
        })
        const insightMetrics: Record<string, number> = {}
        for (const item of insightRes.data ?? []) {
          const rawVal = item.values?.[0]?.value
          if (typeof rawVal === 'number') {
            insightMetrics[item.name] = rawVal
          } else if (rawVal && typeof rawVal === 'object') {
            // post_reactions_by_type_total — soma total e salva breakdown
            const breakdown = rawVal as Record<string, number>
            insightMetrics[item.name + '_total'] = Object.values(breakdown).reduce((a, b) => a + b, 0)
            for (const [reactionType, count] of Object.entries(breakdown)) {
              insightMetrics[`reaction_${reactionType}`] = count
            }
          }
        }
        postInsightsMap.set(p.id, insightMetrics)
      } catch {
        // Insights podem falhar por permissão — continuar sem eles
        // TODO(wave1-B): se pages_read_engagement não cobrir post insights, precisará de App Review
      }
    }

    // ── 3. Persistir posts orgânicos ──────────────────────────────────────
    const postRows = posts.map((p) => {
      const insights = postInsightsMap.get(p.id) ?? {}
      return {
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
          // Enriched per-post insights
          organic_reach: insights.post_impressions_organic ?? 0,
          paid_reach: insights.post_impressions_paid ?? 0,
          impressions: insights.post_impressions ?? 0,
          engaged_users: insights.post_engaged_users ?? 0,
          clicks: insights.post_clicks ?? 0,
          ...insights,
        } as Record<string, number>,
        raw: p as unknown as Record<string, unknown>,
        synced_at: now,
      }
    })

    if (postRows.length > 0) {
      const { error } = await supabase
        .from('content_items')
        .upsert(postRows, { onConflict: 'connection_id,provider_content_id' })
      if (error) {
        console.error('[FacebookDriver.syncContent] Erro ao upsert posts:', error.message)
      }
    }

    // ── 4. Reels do Facebook ──────────────────────────────────────────────
    let reels: FBReel[] = []
    try {
      // TODO(wave1-B): endpoint video_reels requer pages_read_engagement + pages_show_list.
      // Se retornar erro de permissão, o fallback é pular silenciosamente.
      const reelRes = await fbFetch<{ data: FBReel[] }>(`/${pageId}/video_reels`, {
        access_token: token,
        fields: 'id,title,description,permalink_url,picture,created_time,length',
        limit: String(limit),
      })
      reels = reelRes.data ?? []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[FacebookDriver.syncContent] /video_reels falhou (pode precisar de permissão adicional):', msg)
      // TODO(wave1-B): se o erro for de permissão (OAuthException / #10), solicitar
      // pages_read_user_content ou publish_video via App Review para acessar reels
    }

    // Per-reel video insights
    const REEL_INSIGHT_METRICS = [
      'total_video_impressions',
      'total_video_avg_time_watched',
      'total_video_views',
      'total_video_complete_views',
      'post_video_view_time',
    ].join(',')

    const reelInsightsMap = new Map<string, Record<string, number>>()

    for (const r of reels) {
      try {
        const vInsightRes = await fbFetch<{ data: FBVideoInsight[] }>(`/${r.id}/video_insights`, {
          access_token: token,
          metric: REEL_INSIGHT_METRICS,
        })
        const vMetrics: Record<string, number> = {}
        for (const item of vInsightRes.data ?? []) {
          const val = item.values?.[0]?.value
          if (typeof val === 'number') {
            vMetrics[item.name] = val
          }
        }
        reelInsightsMap.set(r.id, vMetrics)
      } catch {
        // TODO(wave1-B): métricas de vídeo podem variar por versão de API — ignorar falhas individuais
      }
    }

    const reelRows = reels.map((r) => {
      const vInsights = reelInsightsMap.get(r.id) ?? {}
      return {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'facebook' as const,
        provider_content_id: r.id,
        content_type: 'reel' as const,
        title: r.title ?? null,
        caption: r.description ?? null,
        url: r.permalink_url ?? null,
        thumbnail_url: r.picture ?? null,
        published_at: r.created_time,
        metrics: {
          impressions: vInsights.total_video_impressions ?? 0,
          views: vInsights.total_video_views ?? 0,
          complete_views: vInsights.total_video_complete_views ?? 0,
          avg_watch_time: vInsights.total_video_avg_time_watched ?? 0,
          view_time_ms: vInsights.post_video_view_time ?? 0,
          duration_seconds: r.length ?? 0,
          ...vInsights,
        } as Record<string, number>,
        raw: r as unknown as Record<string, unknown>,
        synced_at: now,
      }
    })

    if (reelRows.length > 0) {
      const { error } = await supabase
        .from('content_items')
        .upsert(reelRows, { onConflict: 'connection_id,provider_content_id' })
      if (error) {
        console.error('[FacebookDriver.syncContent] Erro ao upsert reels:', error.message)
      }
    }

    // ── 5. Retornar todos os items sincronizados ───────────────────────────
    const allRows = [...postRows, ...reelRows]
    return allRows.map((row) => ({
      id: '',
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

    // ── Métricas diárias (period=day) ─────────────────────────────────────
    const DAILY_METRICS = [
      'page_impressions',
      'page_impressions_unique',
      'page_engaged_users',
      'page_post_engagements',
      'page_fan_adds',
      'page_fan_removes',
      'page_views_total',
      'page_messages_new_conversations',
    ].join(',')

    // ── Métricas lifetime (period=lifetime) ───────────────────────────────
    // page_fans_city e page_fans_gender_age são somente lifetime
    const LIFETIME_METRICS = [
      'page_fans_city',
      'page_fans_gender_age',
    ].join(',')

    type InsightRow = { data: Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }> }

    let dailyData: InsightRow = { data: [] }
    let lifetimeData: InsightRow = { data: [] }
    let insightsFetchSucceeded = false

    const supabase = getAdminSupabase()

    try {
      dailyData = await fbFetch<InsightRow>(`/${pageId}/insights`, {
        access_token: token,
        metric: DAILY_METRICS,
        period: 'day',
      })
      insightsFetchSucceeded = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[FacebookDriver.syncMetrics] Falha ao buscar insights diários:', msg)
      await supabase.from('social_connections').update({
        last_error: `[${new Date().toISOString()}] syncMetrics: ${msg}`,
      }).eq('id', connection.id)
    }

    // Lifetime metrics — falha silenciosa (podem estar indisponíveis por permissão)
    try {
      lifetimeData = await fbFetch<InsightRow>(`/${pageId}/insights`, {
        access_token: token,
        metric: LIFETIME_METRICS,
        period: 'lifetime',
      })
    } catch (err) {
      // TODO(wave1-B): page_fans_city e page_fans_gender_age requerem
      // pages_read_engagement — se falhar, continua sem demographics
      console.warn(
        '[FacebookDriver.syncMetrics] Falha ao buscar insights lifetime (demographics):',
        err instanceof Error ? err.message : err
      )
    }

    // Limpar last_error em caso de sucesso da chamada principal
    if (insightsFetchSucceeded) {
      await supabase
        .from('social_connections')
        .update({ last_error: null })
        .eq('id', connection.id)
    }

    const metrics: Record<string, number | Record<string, number>> = {}
    const numericMetrics: Record<string, number> = {}

    // Processar métricas diárias (todas numéricas)
    for (const insight of dailyData.data) {
      const val = insight.values?.[0]?.value ?? 0
      if (typeof val === 'number') {
        metrics[insight.name] = val
        numericMetrics[insight.name] = val
      }
    }

    // Processar métricas lifetime (podem ser objetos: {city: count})
    for (const insight of lifetimeData.data) {
      const val = insight.values?.[0]?.value
      if (val === undefined || val === null) continue
      if (typeof val === 'number') {
        metrics[insight.name] = val
        numericMetrics[insight.name] = val
      } else if (typeof val === 'object') {
        // Armazenar top-10 cities / gender-age breakdown como JSON serializado em metrics
        // Para page_fans_city: {city_name: count} — pegar top 10 por count
        if (insight.name === 'page_fans_city') {
          const cityMap = val as Record<string, number>
          const top10 = Object.entries(cityMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
          // Guardar como string JSON em uma chave especial do snapshot
          metrics['page_fans_city_json'] = JSON.stringify(top10) as unknown as number
          // Também salvar total de cidades
          numericMetrics['page_fans_city_total'] = Object.values(cityMap).reduce((a, b) => a + b, 0)
          metrics['page_fans_city_total'] = numericMetrics['page_fans_city_total']
        } else if (insight.name === 'page_fans_gender_age') {
          // {M.18-24: count, F.18-24: count, ...}
          metrics['page_fans_gender_age_json'] = JSON.stringify(val) as unknown as number
        }
      }
    }

    const now = new Date().toISOString()

    // Fix 2: guard — não upsert com metrics vazio
    if (Object.keys(numericMetrics).length === 0) {
      console.warn('[FacebookDriver.syncMetrics] Nenhum metric retornado — pulando upsert pra preservar dados de syncProfile')
      return {
        connection_id: connection.id,
        provider: 'facebook',
        snapshot_date: today,
        metrics: {},
        raw: {} as Record<string, unknown>,
      }
    }

    // Fix 3: ler snapshot existente e mesclar metrics (JSONB merge)
    const { data: existingSnapshot } = await supabase
      .from('provider_snapshots')
      .select('metrics')
      .eq('connection_id', connection.id)
      .eq('snapshot_date', today)
      .maybeSingle()

    // Mesclar — metrics com objetos JSON string coexistem com métricas numéricas no JSONB
    const mergedMetrics = { ...(existingSnapshot?.metrics ?? {}), ...metrics }

    // Escrita em provider_snapshots com metrics mesclados
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'facebook',
        snapshot_date: today,
        metrics: mergedMetrics,
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Escrita em metric_events (apenas métricas numéricas)
    if (Object.keys(numericMetrics).length > 0) {
      const metricEvents = Object.entries(numericMetrics).map(([key, value]) => ({
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
      metrics: numericMetrics,
      raw: {
        daily_insights: dailyData.data,
        lifetime_insights: lifetimeData.data,
      } as Record<string, unknown>,
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
          data: Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }>
        }>(`/${postId}/insights`, {
          access_token: token,
          metric: 'post_impressions,post_impressions_organic,post_impressions_paid,post_engaged_users,post_reactions_by_type_total,post_clicks',
        })

        const rawInsights: Record<string, number> = {}
        for (const insight of insightRes.data ?? []) {
          const val = insight.values?.[0]?.value
          if (typeof val === 'number') {
            rawInsights[insight.name] = val
          } else if (val && typeof val === 'object') {
            // post_reactions_by_type_total returns an object
            const breakdown = val as Record<string, number>
            rawInsights[insight.name + '_total'] = Object.values(breakdown).reduce((a, b) => a + b, 0)
            for (const [reactionType, count] of Object.entries(breakdown)) {
              rawInsights[`reaction_${reactionType}`] = count
            }
          }
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
