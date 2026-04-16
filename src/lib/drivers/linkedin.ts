/**
 * LinkedInDriver — implementa ConnectionDriver para LinkedIn (Nível 1)
 *
 * Nível 1 usa apenas scopes auto-aprovados:
 *   openid, profile, email, w_member_social
 *
 * Funcionalidades disponíveis:
 *   - Login OAuth e callback
 *   - Perfil pessoal (nome, foto, email, headline)
 *   - Publicar no feed pessoal
 *
 * Funcionalidades DEFERRED (aguardando CMA approval):
 *   - syncContent   — não há API de leitura do feed pessoal no Nível 1
 *   - syncMetrics   — analytics requerem r_member_postAnalytics (CMA)
 *   - syncInsights  — idem
 *   - refreshToken  — Nível 1 não emite refresh_token
 *   - Company Page  — requer r_organization_social / w_organization_social (CMA)
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
  getProfile,
  publishPost,
  LinkedInAPIError,
} from '@/lib/linkedin'
import { generateState, parseState, upsertConnection, decryptToken } from './base'

/* ── Supabase admin client (bypassa RLS) ─────────────────────────────────── */

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

/* ── Erro padrão para funcionalidades CMA ────────────────────────────────── */

function cmaNotAvailable(feature: string): never {
  throw new Error(
    `[LinkedIn] "${feature}" requer LinkedIn Community Management API (CMA) aprovada. ` +
      'Aguarde aprovação ou contate suporte@bgpgo.com.'
  )
}

/* ── Driver ──────────────────────────────────────────────────────────────── */

export const linkedinDriver: ConnectionDriver = {
  metadata: METADATA_BY_PROVIDER.linkedin,

  /* ── buildAuthUrl ─────────────────────────────────────────────────────── */

  async buildAuthUrl(empresaId: string, userId: string): Promise<string> {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      throw new Error(
        'LINKEDIN_CLIENT_ID não configurado — defina a variável de ambiente no servidor'
      )
    }

    const state = generateState({ empresa_id: empresaId, user_id: userId })
    return getOAuthURL(state)
  },

  /* ── handleCallback ───────────────────────────────────────────────────── */

  async handleCallback(code: string, stateParam: string): Promise<Connection> {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      throw new Error('LINKEDIN_CLIENT_ID não configurado')
    }

    // 1. Valida state (proteção CSRF)
    const stateData = parseState(stateParam)

    // 2. Troca code por access_token
    //    LinkedIn Nível 1 não emite refresh_token
    const tokenData = await exchangeCodeForToken(code)

    // 3. Busca perfil via OpenID /userinfo
    const profile = await getProfile(tokenData.access_token)

    // 4. Calcula expiração (token dura 60 dias)
    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString()

    // 5. Persiste em social_connections
    const supabase = getAdminSupabase()

    const connection = await upsertConnection(supabase, {
      empresa_id: stateData.empresa_id,
      user_id: stateData.user_id,
      provider: 'linkedin',
      provider_user_id: profile.sub,
      username: null, // LinkedIn não tem username público
      display_name: profile.name,
      display_label: profile.name,
      profile_picture_url: profile.picture ?? null,
      access_token: tokenData.access_token,
      refresh_token: null, // Nível 1 não emite refresh_token
      token_expires_at: expiresAt,
      app_id: clientId,
      scopes: ['openid', 'profile', 'email', 'w_member_social'],
      is_active: true,
      metadata: {
        email: profile.email,
        locale: profile.locale,
        given_name: profile.given_name,
        family_name: profile.family_name,
        level: 1, // marcador de nível — facilita upgrade para CMA
      },
    })

    return connection
  },

  /* ── verify ───────────────────────────────────────────────────────────── */

  async verify(connection: Connection): Promise<boolean> {
    try {
      const token = decryptToken(connection.access_token)
      await getProfile(token)

      const supabase = getAdminSupabase()
      await supabase
        .from('social_connections')
        .update({
          last_verified_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', connection.id)

      return true
    } catch (err) {
      const msg =
        err instanceof LinkedInAPIError
          ? `LinkedIn API [${err.code}]: ${err.message}`
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

  /* ── refreshToken ─────────────────────────────────────────────────────── */

  async refreshToken(connection: Connection): Promise<Connection> {
    // LinkedIn Nível 1 não emite refresh_token.
    // O usuário precisa reconectar manualmente quando o token de 60 dias expirar.
    // Quando CMA for aprovado, tokens de 365 dias com refresh estarão disponíveis.
    throw new Error(
      '[LinkedIn] Reconexão manual necessária: tokens do Nível 1 não suportam refresh automático. ' +
        'O token expira em 60 dias. Acesse /conexoes para reconectar.'
    )
    return connection // unreachable — satisfaz TS
  },

  /* ── disconnect ───────────────────────────────────────────────────────── */

  async disconnect(connection: Connection): Promise<void> {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', connection.id)

    if (error) {
      throw new Error(`Erro ao desconectar LinkedIn: ${error.message}`)
    }
  },

  /* ── syncProfile ──────────────────────────────────────────────────────── */

  async syncProfile(connection: Connection): Promise<ProfileData> {
    const token = decryptToken(connection.access_token)
    const profile = await getProfile(token)

    const today = new Date().toISOString().split('T')[0]
    const supabase = getAdminSupabase()

    // Salva snapshot no provider_snapshots (sem métricas numéricas no Nível 1)
    await supabase.from('provider_snapshots').upsert(
      {
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: 'linkedin',
        snapshot_date: today,
        metrics: {}, // métricas vazias no Nível 1 — followers exigem CMA
      },
      { onConflict: 'connection_id,snapshot_date' }
    )

    // Atualiza dados da conexão com perfil mais recente
    await supabase
      .from('social_connections')
      .update({
        display_name: profile.name,
        display_label: profile.name,
        profile_picture_url: profile.picture ?? null,
        metadata: {
          ...connection.metadata,
          email: profile.email,
          locale: profile.locale,
          given_name: profile.given_name,
          family_name: profile.family_name,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return {
      provider_user_id: profile.sub,
      username: profile.email, // LinkedIn não tem @username público
      display_name: profile.name,
      profile_picture_url: profile.picture ?? null,
      bio: null, // headline não disponível via /userinfo Nível 1
      url: `https://www.linkedin.com/in/${profile.sub}`,
      followers_count: 0, // requer CMA
      following_count: 0, // requer CMA
      content_count: 0,   // requer CMA
      extra: {
        email: profile.email,
        locale: profile.locale,
        level: 1,
        note: 'Métricas de seguidores requerem LinkedIn CMA approval',
      },
    }
  },

  /* ── syncContent ──────────────────────────────────────────────────────── */

  async syncContent(
    _connection: Connection,
    _options?: SyncOptions
  ): Promise<ContentItem[]> {
    // LinkedIn não oferece API de leitura do feed pessoal sem CMA.
    // Retornamos array vazio para não quebrar flows de sync automático.
    // Logar aviso para diagnóstico.
    console.warn(
      '[LinkedInDriver.syncContent] Funcionalidade não disponível no Nível 1. ' +
        'Requer LinkedIn Community Management API (CMA) aprovada.'
    )
    return []
  },

  /* ── syncMetrics ──────────────────────────────────────────────────────── */

  async syncMetrics(
    connection: Connection,
    _options?: SyncOptions
  ): Promise<MetricSet> {
    // Analytics de posts e perfil requerem r_member_postAnalytics (CMA).
    // Retornamos MetricSet vazio para não quebrar o scheduler.
    console.warn(
      '[LinkedInDriver.syncMetrics] Funcionalidade não disponível no Nível 1. ' +
        'Requer LinkedIn Community Management API (CMA) aprovada.'
    )

    return {
      connection_id: connection.id,
      provider: 'linkedin',
      snapshot_date: new Date().toISOString().split('T')[0],
      metrics: {},
      raw: {
        note: 'Métricas requerem LinkedIn CMA approval',
        level: 1,
      },
    }
  },

  /* ── syncInsights ─────────────────────────────────────────────────────── */

  async syncInsights(
    _connection: Connection,
    _contentIds: string[]
  ): Promise<InsightData[]> {
    // Insights por post requerem r_member_postAnalytics (CMA).
    console.warn(
      '[LinkedInDriver.syncInsights] Funcionalidade não disponível no Nível 1. ' +
        'Requer LinkedIn Community Management API (CMA) aprovada.'
    )
    return []
  },

  /* ── publishToFeed (método extra) ────────────────────────────────────── */
  // Nota: este método NÃO faz parte da interface ConnectionDriver.
  // É acessível via cast: (linkedinDriver as LinkedInDriverExtended).publishToFeed(...)
  // ou diretamente pelas API routes do LinkedIn.
}

/* ── Extensão typed para uso nas routes ──────────────────────────────────── */

export interface LinkedInDriverExtended extends ConnectionDriver {
  publishToFeed(
    connection: Connection,
    content: string,
    visibility?: 'PUBLIC' | 'CONNECTIONS'
  ): Promise<{ postId: string }>
}

/**
 * Driver com método publishToFeed exposto para as API routes.
 * Usar `linkedinDriverExtended` nas routes de /api/linkedin/publish.
 */
export const linkedinDriverExtended: LinkedInDriverExtended = {
  ...linkedinDriver,

  async publishToFeed(
    connection: Connection,
    content: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC'
  ): Promise<{ postId: string }> {
    const token = decryptToken(connection.access_token)

    const result = await publishPost(token, connection.provider_user_id, {
      commentary: content,
      visibility,
    })

    // Salvar referência em content_items para histórico
    const supabase = getAdminSupabase()
    await supabase.from('content_items').insert({
      empresa_id: connection.empresa_id,
      connection_id: connection.id,
      provider: 'linkedin' as const,
      provider_content_id: result.id,
      content_type: 'post' as const,
      title: null,
      caption: content,
      url: null, // URL do post não disponível imediatamente
      thumbnail_url: null,
      published_at: new Date().toISOString(),
      metrics: {} as Record<string, number>,
      raw: { post_id: result.id, visibility } as Record<string, unknown>,
      synced_at: new Date().toISOString(),
    })

    return { postId: result.id }
  },
}
