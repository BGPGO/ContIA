/**
 * Tipos do sistema de drivers multi-provider — ContIA 2.0
 *
 * Cada provider implementa ConnectionDriver com metadata, lifecycle e coleta.
 * Os tipos aqui batem 1:1 com o schema SQL (009_inteligencia_schema).
 */

/* ── Provider Keys ────────────────────────────────────────────────────────── */

export type ProviderKey =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'ga4'
  | 'google_ads'
  | 'meta_ads'
  | 'greatpages'
  | 'crm'

export type ProviderCategory = 'social' | 'ads' | 'analytics' | 'landing' | 'crm'

export type ProviderStatus = 'available' | 'coming_soon' | 'beta'

/* ── Connection (social_connections row) ──────────────────────────────────── */

export interface Connection {
  id: string
  empresa_id: string
  user_id: string
  provider: ProviderKey
  provider_user_id: string
  username: string | null
  display_name: string | null
  display_label: string | null
  profile_picture_url: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  page_id: string | null
  page_access_token: string | null
  app_id: string | null
  scopes: string[]
  is_active: boolean
  last_verified_at: string | null
  last_error: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/* ── ProfileData — forma comum entre providers ────────────────────────────── */

export interface ProfileData {
  provider_user_id: string
  username: string
  display_name: string
  profile_picture_url: string | null
  bio: string | null
  url: string | null
  followers_count: number
  following_count: number
  content_count: number
  /** Métricas extras específicas do provider (ex: views totais do YT) */
  extra: Record<string, unknown>
}

/* ── ContentItem (content_items row) ──────────────────────────────────────── */

export type ContentType =
  | 'post'
  | 'reel'
  | 'story'
  | 'carousel'
  | 'video'
  | 'landing_page'
  | 'ad_campaign'
  | 'ad'
  | 'email'
  | 'whatsapp'
  | 'youtube_video'
  | 'youtube_short'

export interface ContentItem {
  id: string
  empresa_id: string
  connection_id: string
  provider: ProviderKey
  provider_content_id: string
  content_type: ContentType
  title: string | null
  caption: string | null
  url: string | null
  thumbnail_url: string | null
  published_at: string | null
  metrics: Record<string, number>
  raw: Record<string, unknown>
  synced_at: string
}

/* ── MetricSet — coleção de métricas com período ──────────────────────────── */

export interface MetricSet {
  connection_id: string
  provider: ProviderKey
  snapshot_date: string
  metrics: Record<string, number>
  /** Dados brutos para debug/auditoria */
  raw?: Record<string, unknown>
}

/* ── InsightData — insights detalhados por conteúdo ───────────────────────── */

export interface InsightData {
  provider_content_id: string
  metrics: Record<string, number>
  demographics?: {
    age?: Record<string, number>
    gender?: Record<string, number>
    city?: Record<string, number>
    country?: Record<string, number>
  }
  /** Dados brutos da API do provider */
  raw?: Record<string, unknown>
}

/* ── Capabilities de cada conexão ─────────────────────────────────────────── */

export interface ConnectionCapabilities {
  canPublish: boolean
  canSchedule: boolean
  canReadEngagement: boolean
  canReadDemographics: boolean
  canReadAds: boolean
  canReadComments: boolean
}

/* ── Requirements e Instructions para UI de /conexoes ─────────────────────── */

export type RequirementType = 'account' | 'permission' | 'setup' | 'external'

export interface ProviderRequirement {
  type: RequirementType
  label: string
  description: string
  link?: string
}

export interface InstructionStep {
  step: number
  title: string
  description: string
  icon?: string
}

/* ── SyncOptions — opções para coleta de dados ────────────────────────────── */

export interface SyncOptions {
  since?: Date
  until?: Date
  contentLimit?: number
  includeInsights?: boolean
}

/* ── ProviderMetadata — tudo que a UI precisa para exibir um provider ─────── */

export interface ProviderMetadata {
  key: ProviderKey
  displayName: string
  description: string
  color: string
  iconName: string
  category: ProviderCategory
  requirements: ProviderRequirement[]
  instructions: InstructionStep[]
  capabilities: ConnectionCapabilities
  status: ProviderStatus
  estimatedTime: string
}

/* ── ConnectionDriver — interface que cada provider implementa ────────────── */

export interface ConnectionDriver {
  metadata: ProviderMetadata

  // Lifecycle
  buildAuthUrl(empresaId: string, userId: string): Promise<string>
  handleCallback(code: string, state: string): Promise<Connection>
  verify(connection: Connection): Promise<boolean>
  refreshToken(connection: Connection): Promise<Connection>
  disconnect(connection: Connection): Promise<void>

  // Coleta de dados
  syncProfile(connection: Connection): Promise<ProfileData>
  syncContent(connection: Connection, options?: SyncOptions): Promise<ContentItem[]>
  syncMetrics(connection: Connection, options?: SyncOptions): Promise<MetricSet>

  /** Insights detalhados por conteúdo — opcional (nem todo provider suporta) */
  syncInsights?(connection: Connection, contentIds: string[], options?: SyncOptions): Promise<InsightData[]>

  /** Sync de anúncios individuais (level=ad) — opcional, específico de Meta Ads */
  syncAds?(connection: Connection, options?: SyncOptions): Promise<ContentItem[]>
}

/* ── SyncJob (sync_jobs row) ──────────────────────────────────────────────── */

export type SyncJobType =
  | 'profile_sync'
  | 'content_sync'
  | 'insights_sync'
  | 'backfill'
  | 'token_refresh'

export type SyncJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface SyncJob {
  id: string
  empresa_id: string
  connection_id: string | null
  provider: ProviderKey
  job_type: SyncJobType
  status: SyncJobStatus
  priority: number
  scheduled_for: string
  attempts: number
  last_error: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

/* ── ProviderSnapshot (provider_snapshots row) ────────────────────────────── */

export interface ProviderSnapshot {
  id: string
  empresa_id: string
  connection_id: string
  provider: ProviderKey
  snapshot_date: string
  metrics: Record<string, number>
  created_at: string
}

/* ── MetricEvent (metric_events row) ──────────────────────────────────────── */

export interface MetricEvent {
  id: string
  empresa_id: string
  connection_id: string | null
  provider: ProviderKey
  metric_key: string
  metric_value: number | null
  dimension: Record<string, unknown>
  occurred_at: string
  collected_at: string
}

/* ── AiAnalysis (ai_analyses row) ─────────────────────────────────────────── */

export interface AiAnalysis {
  id: string
  empresa_id: string
  scope: string
  provider: ProviderKey | null
  period_start: string
  period_end: string
  inputs_hash: string
  analysis: Record<string, unknown>
  generated_at: string
}
