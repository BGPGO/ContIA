/**
 * Utilities compartilhadas para drivers de conexão — ContIA 2.0
 *
 * Funções auxiliares de state OAuth, criptografia de tokens
 * e operações CRUD em social_connections via Supabase.
 */

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Connection, ProviderKey } from '@/types/providers'

/* ── State OAuth (CSRF protection) ────────────────────────────────────────── */

interface StatePayload {
  empresa_id: string
  user_id: string
  nonce: string
  [key: string]: unknown
}

/**
 * Gera um state para OAuth — base64url JSON com nonce criptográfico.
 * Segue o padrão já usado em /api/instagram/auth/route.ts.
 */
export function generateState(payload: Record<string, unknown>): string {
  const stateData: StatePayload = {
    ...payload,
    empresa_id: String(payload.empresa_id ?? ''),
    user_id: String(payload.user_id ?? ''),
    nonce: crypto.randomBytes(16).toString('hex'),
  }
  return Buffer.from(JSON.stringify(stateData)).toString('base64url')
}

/**
 * Decodifica e valida um state OAuth. Retorna o payload original.
 * Lança erro se o state for inválido ou não contiver nonce.
 */
export function parseState(state: string): StatePayload {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8')
    const payload = JSON.parse(decoded) as StatePayload

    if (!payload.nonce || typeof payload.nonce !== 'string') {
      throw new Error('State inválido: nonce ausente')
    }
    if (!payload.empresa_id) {
      throw new Error('State inválido: empresa_id ausente')
    }
    if (!payload.user_id) {
      throw new Error('State inválido: user_id ausente')
    }

    return payload
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('State inválido: JSON malformado')
    }
    throw err
  }
}

/* ── Token encryption (placeholder) ───────────────────────────────────────── */

/**
 * Encripta um token para armazenamento seguro.
 * PLACEHOLDER: em produção, usar AES-256-GCM com secret do ambiente.
 * Por enquanto retorna o token como está (Supabase já protege via RLS).
 */
export function encryptToken(token: string): string {
  // TODO: implementar criptografia real com process.env.TOKEN_ENCRYPTION_KEY
  return token
}

/**
 * Decripta um token armazenado.
 * PLACEHOLDER: corresponde ao encryptToken acima.
 */
export function decryptToken(token: string): string {
  // TODO: implementar decriptografia real
  return token
}

/* ── CRUD social_connections ──────────────────────────────────────────────── */

interface UpsertConnectionData {
  empresa_id: string
  user_id: string
  provider: ProviderKey
  provider_user_id: string
  username?: string | null
  display_name?: string | null
  display_label?: string | null
  profile_picture_url?: string | null
  access_token: string
  refresh_token?: string | null
  token_expires_at?: string | null
  page_id?: string | null
  page_access_token?: string | null
  app_id?: string | null
  scopes?: string[]
  is_active?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Insere ou atualiza uma conexão em social_connections.
 * Usa a UNIQUE constraint (empresa_id, provider, provider_user_id).
 */
export async function upsertConnection(
  supabase: SupabaseClient,
  data: UpsertConnectionData
): Promise<Connection> {
  const row = {
    empresa_id: data.empresa_id,
    user_id: data.user_id,
    provider: data.provider,
    provider_user_id: data.provider_user_id,
    username: data.username ?? null,
    display_name: data.display_name ?? null,
    display_label: data.display_label ?? data.username ?? data.display_name ?? data.provider_user_id,
    profile_picture_url: data.profile_picture_url ?? null,
    access_token: encryptToken(data.access_token),
    refresh_token: data.refresh_token ? encryptToken(data.refresh_token) : null,
    token_expires_at: data.token_expires_at ?? null,
    page_id: data.page_id ?? null,
    page_access_token: data.page_access_token ? encryptToken(data.page_access_token) : null,
    app_id: data.app_id ?? null,
    scopes: data.scopes ?? [],
    is_active: data.is_active ?? true,
    metadata: data.metadata ?? {},
    updated_at: new Date().toISOString(),
  }

  const { data: result, error } = await supabase
    .from('social_connections')
    .upsert(row, {
      onConflict: 'empresa_id,provider,provider_user_id',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar conexão ${data.provider}: ${error.message}`)
  }

  return result as Connection
}

/**
 * Busca uma conexão ativa por empresa e provider.
 * Se provider_user_id for informado, busca a conta específica.
 * Caso contrário, retorna a primeira conexão ativa do provider.
 */
export async function getConnection(
  supabase: SupabaseClient,
  empresaId: string,
  provider: ProviderKey,
  providerUserId?: string
): Promise<Connection | null> {
  let query = supabase
    .from('social_connections')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('provider', provider)
    .eq('is_active', true)

  if (providerUserId) {
    query = query.eq('provider_user_id', providerUserId)
  }

  const { data, error } = await query.limit(1).single()

  if (error) {
    // PGRST116 = no rows found — não é erro real
    if (error.code === 'PGRST116') return null
    throw new Error(`Erro ao buscar conexão ${provider}: ${error.message}`)
  }

  return data as Connection
}

/**
 * Busca todas as conexões ativas de uma empresa.
 * Útil para a tela de /conexoes e para sync geral.
 */
export async function getConnections(
  supabase: SupabaseClient,
  empresaId: string,
  provider?: ProviderKey
): Promise<Connection[]> {
  let query = supabase
    .from('social_connections')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (provider) {
    query = query.eq('provider', provider)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar conexões: ${error.message}`)
  }

  return (data ?? []) as Connection[]
}

/**
 * Marca uma conexão como inativa (soft delete).
 * Não remove dados — content_items e snapshots permanecem.
 */
export async function deactivateConnection(
  supabase: SupabaseClient,
  connectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('social_connections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', connectionId)

  if (error) {
    throw new Error(`Erro ao desconectar: ${error.message}`)
  }
}
