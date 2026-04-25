/**
 * InstagramDriver — implementa ConnectionDriver para Instagram Business Login
 *
 * Reutiliza toda lógica de src/lib/instagram.ts e os padrões de sync de
 * src/lib/instagram-sync.ts. Escreve PARALELAMENTE nas tabelas legadas
 * (instagram_*_cache) e nas novas (content_items, provider_snapshots, metric_events)
 * para migração suave.
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
  getOAuthURL,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  getProfile,
  getMedia,
  getInsights,
  getMediaInsights,
  InstagramAPIError,
} from '@/lib/instagram'
import { generateState, parseState, upsertConnection, decryptToken } from './base'

/* ── Supabase admin client (bypassa RLS) ─────────────────── */

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

/* ── Helpers de mapeamento ───────────────────────────────── */

/**
 * Mapeia media_type do Instagram para ContentType da interface driver.
 */
function mapMediaType(
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
): ContentItem['content_type'] {
  switch (mediaType) {
    case 'VIDEO':
      return 'reel'
    case 'CAROUSEL_ALBUM':
      return 'post'
    default:
      return 'post'
  }
}

/* ── Driver ──────────────────────────────────────────────── */

export const instagramDriver: ConnectionDriver = {
  metadata: METADATA_BY_PROVIDER.instagram,

  /* ── buildAuthUrl ─────────────────────────────────────── */

  async buildAuthUrl(empresaId: string, userId: string): Promise<string> {
    // Instagram Login usa "Instagram App" credentials (separado do Facebook App).
    const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID
    if (!appId) {
      throw new Error(
        'INSTAGRAM_APP_ID não configurado — defina a variável de ambiente no servidor'
      )
    }

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const redirectUri = `${appUrl}/api/instagram/callback`

    const state = generateState({ empresa_id: empresaId, user_id: userId })

    return getOAuthURL(appId, redirectUri, state)
  },

  /* ── handleCallback ───────────────────────────────────── */

  async handleCallback(code: string, stateParam: string): Promise<Connection> {
    const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID
    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error(
        'INSTAGRAM_APP_ID ou INSTAGRAM_APP_SECRET não configurados'
      )
    }

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const redirectUri = `${appUrl}/api/instagram/callback`

    // Decodifica e valida state (CSRF)
    const stateData = parseState(stateParam)

    // Remove sufixo #_ que o Instagram às vezes adiciona
    const cleanCode = code.replace(/#_$/, '')

    // 1. Short-lived token
    const tokenData = await exchangeCodeForToken(cleanCode, appId, appSecret, redirectUri)

    // 2. Long-lived token (~60 dias)
    const longToken = await exchangeForLongLivedToken(tokenData.access_token, appSecret)

    // 3. Perfil do Instagram
    const profile = await getProfile(tokenData.user_id, longToken.access_token)

    // 4. Persistir em social_connections
    const supabase = getAdminSupabase()

    const connection = await upsertConnection(supabase, {
      empresa_id: stateData.empresa_id,
      user_id: stateData.user_id,
      provider: 'instagram',
      provider_user_id: tokenData.user_id,
      username: profile.username,
      display_name: profile.name,
      display_label: `@${profile.username}`,
      profile_picture_url: profile.profile_picture_url,
      access_token: longToken.access_token,
      token_expires_at: new Date(Date.now() + longToken.expires_in * 1000).toISOString(),
      app_id: appId,
      scopes: [
        'instagram_business_basic',
        'instagram_business_content_publish',
        'instagram_business_manage_comments',
        'instagram_business_manage_insights',
      ],
      is_active: true,
      metadata: {
        followers_count: profile.followers_count,
        media_count: profile.media_count,
        biography: profile.biography,
      },
    })

    // 5. Atualizar redes_sociais na empresa (compat retroativa)
    await supabase
      .from('empresas')
      .update({
        redes_sociais: {
          instagram: {
            conectado: true,
            username: profile.username,
            provider_user_id: tokenData.user_id,
          },
        },
      })
      .eq('id', stateData.empresa_id)

    return connection
  },

  /* ── verify ───────────────────────────────────────────── */

  async verify(connection: Connection): Promise<boolean> {
    try {
      const token = decryptToken(connection.access_token)
      await getProfile(connection.provider_user_id, token)

      // Atualiza last_verified_at
      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({ last_verified_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id)

      return true
    } catch (err) {
      const msg =
        err instanceof InstagramAPIError
          ? `IG API [${err.code}]: ${err.message}`
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

  /* ── refreshToken ─────────────────────────────────────── */

  async refreshToken(connection: Connection): Promise<Connection> {
    const token = decryptToken(connection.access_token)
    const newToken = await refreshLongLivedToken(token)

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

  /* ── disconnect ───────────────────────────────────────── */

  async disconnect(connection: Connection): Promise<void> {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', connection.id)

    if (error) {
      throw new Error(`Erro ao desconectar Instagram: ${error.message}`)
    }

    // Compat retroativa: limpar flag em redes_sociais
    await supabase
      .from('empresas')
      .update({
        redes_sociais: {
          instagram: { conectado: false },
        },
      })
      .eq('id', connection.empresa_id)
  },

  /* ── syncProfile ──────────────────────────────────────── */

  async syncProfile(connection: Connection): Promise<ProfileData> {
    const token = decryptToken(connection.access_token)
    const profile = await getProfile(connection.provider_user_id, token)

    const today = new Date().toISOString().split('T')[0]
    const supabase = getAdminSupabase()

    // Escrita legada — instagram_profile_cache
    await supabase.from('instagram_profile_cache').upsert(
      {
        empresa_id: connection.empresa_id,
        user_id: connection.user_id,
        username: profile.username,
        followers_count: profile.followers_count,
        follows_count: profile.follows_count,
        media_count: profile.media_count,
        biography: profile.biography,
        profile_picture_url: profile.profile_picture_url,
        snapshot_date: today,
      },
      { onConflict: 'empresa_id,snapshot_date' }
    )

    // Escrita nova — provider_snapshots
    const metrics: Record<string, number> = {
      followers_count: profile.followers_count,
      following_count: profile.follows_count,
      media_count: profile.media_count,
    }

    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'instagram',
        snapshot_date: today,
        metrics,
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Atualizar dados do perfil na própria conexão
    await supabase
      .from('social_connections')
      .update({
        username: profile.username,
        display_name: profile.name,
        display_label: `@${profile.username}`,
        profile_picture_url: profile.profile_picture_url,
        metadata: {
          ...connection.metadata,
          followers_count: profile.followers_count,
          media_count: profile.media_count,
          biography: profile.biography,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return {
      provider_user_id: profile.id,
      username: profile.username,
      display_name: profile.name,
      profile_picture_url: profile.profile_picture_url || null,
      bio: profile.biography || null,
      url: profile.website || null,
      followers_count: profile.followers_count,
      following_count: profile.follows_count,
      content_count: profile.media_count,
      extra: {
        media_count: profile.media_count,
        biography: profile.biography,
        website: profile.website,
      },
    }
  },

  /* ── syncContent ──────────────────────────────────────── */

  async syncContent(
    connection: Connection,
    options?: SyncOptions
  ): Promise<ContentItem[]> {
    const token = decryptToken(connection.access_token)
    const limit = options?.contentLimit ?? 50

    const mediaItems = await getMedia(connection.provider_user_id, token, limit)

    if (mediaItems.length === 0) return []

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // Escrita legada — instagram_media_cache
    const legacyRows = mediaItems.map((m) => ({
      empresa_id: connection.empresa_id,
      user_id: connection.user_id,
      ig_media_id: m.id,
      caption: m.caption ?? null,
      media_type: m.media_type,
      media_url: m.media_url,
      thumbnail_url: m.thumbnail_url ?? null,
      permalink: m.permalink,
      timestamp: m.timestamp,
      like_count: m.like_count ?? 0,
      comments_count: m.comments_count ?? 0,
      synced_at: now,
    }))

    await supabase
      .from('instagram_media_cache')
      .upsert(legacyRows, { onConflict: 'empresa_id,ig_media_id' })

    // Escrita nova — content_items
    const contentRows = mediaItems.map((m) => ({
      empresa_id: connection.empresa_id,
      connection_id: connection.id,
      provider: 'instagram' as const,
      provider_content_id: m.id,
      content_type: mapMediaType(m.media_type),
      title: null,
      caption: m.caption ?? null,
      url: m.permalink,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      published_at: m.timestamp,
      metrics: {
        like_count: m.like_count ?? 0,
        comments_count: m.comments_count ?? 0,
      } as Record<string, number>,
      raw: m as unknown as Record<string, unknown>,
      synced_at: now,
    }))

    const { data: upserted, error } = await supabase
      .from('content_items')
      .upsert(contentRows, { onConflict: 'connection_id,provider_content_id' })
      .select()

    if (error) {
      console.error('[InstagramDriver.syncContent] Erro ao upsert content_items:', error.message)
    }

    // Retorna ContentItem[] normalizado
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

  /* ── syncMetrics ──────────────────────────────────────── */

  async syncMetrics(
    connection: Connection,
    _options?: SyncOptions
  ): Promise<MetricSet> {
    const token = decryptToken(connection.access_token)
    const today = new Date().toISOString().split('T')[0]

    // Busca insights de conta (período diário)
    const insights = await getInsights(connection.provider_user_id, token, 'day')

    // Agrupa métricas em um único objeto
    const metrics: Record<string, number> = {}
    for (const insight of insights) {
      const value = insight.values?.[0]?.value ?? 0
      metrics[insight.name] = value
    }

    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    // Escrita legada — instagram_insights_cache
    const legacyRows = insights.flatMap((insight) =>
      insight.values.map((v) => ({
        empresa_id: connection.empresa_id,
        user_id: connection.user_id,
        metric_name: insight.name,
        period: 'day',
        value: v.value,
        end_time: v.end_time ?? null,
        synced_at: now,
      }))
    )

    if (legacyRows.length > 0) {
      await supabase
        .from('instagram_insights_cache')
        .upsert(legacyRows, { onConflict: 'empresa_id,metric_name,period,end_time' })
    }

    // Escrita nova — metric_events (um evento por métrica)
    if (Object.keys(metrics).length > 0) {
      const metricEvents = Object.entries(metrics).map(([key, value]) => ({
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'instagram' as const,
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
      provider: 'instagram',
      snapshot_date: today,
      metrics,
      raw: { insights } as Record<string, unknown>,
    }
  },

  /* ── syncInsights ─────────────────────────────────────── */

  async syncInsights(
    connection: Connection,
    contentIds: string[]
  ): Promise<InsightData[]> {
    if (contentIds.length === 0) return []

    const token = decryptToken(connection.access_token)
    const supabase = getAdminSupabase()

    // Busca provider_content_id => content_items.id no banco
    const { data: contentRows } = await supabase
      .from('content_items')
      .select('id, provider_content_id, metrics, raw')
      .eq('connection_id', connection.id)
      .in('provider_content_id', contentIds)

    const contentMap = new Map(
      (contentRows ?? []).map((r) => [
        r.provider_content_id as string,
        r as {
          id: string
          provider_content_id: string
          metrics: Record<string, number>
          raw: Record<string, unknown>
        },
      ])
    )

    const results: InsightData[] = []

    for (const contentId of contentIds) {
      try {
        const row = contentMap.get(contentId)
        const mediaType =
          (row?.raw?.media_type as 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM') ?? 'IMAGE'

        const rawInsights = await getMediaInsights(contentId, token, mediaType)

        if (Object.keys(rawInsights).length === 0) continue

        // Atualiza content_items.metrics (JSONB merge)
        if (row?.id) {
          const mergedMetrics: Record<string, number> = {
            ...(row.metrics ?? {}),
            ...rawInsights,
          }

          await supabase
            .from('content_items')
            .update({ metrics: mergedMetrics, synced_at: new Date().toISOString() })
            .eq('id', row.id)

          // Compat: atualiza instagram_media_cache também
          await supabase
            .from('instagram_media_cache')
            .update({ insights: rawInsights })
            .eq('empresa_id', connection.empresa_id)
            .eq('ig_media_id', contentId)
        }

        results.push({
          provider_content_id: contentId,
          metrics: rawInsights,
          raw: rawInsights as unknown as Record<string, unknown>,
        })
      } catch (err) {
        // Insights de posts específicos podem falhar — continuar com o próximo
        console.warn(
          `[InstagramDriver.syncInsights] Falha ao buscar insights para ${contentId}:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    return results
  },
}
