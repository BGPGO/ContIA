/**
 * Tipos para o pipeline de sincronizacao de conexoes — ContIA 2.0
 *
 * Usados pelos crons sync-snapshots, refresh-tokens
 * e pelo endpoint on-demand /api/connections/sync/[connectionId].
 */

export type SyncStatus = 'ok' | 'error' | 'skipped'

export interface ConnectionSyncResult {
  connection_id: string
  empresa_id: string
  provider: string
  username: string | null
  status: SyncStatus
  /** Contagem de snapshots/itens gravados (quando disponivel) */
  snapshot_count?: number
  synced_at?: string
  error?: string
}

export interface CronSyncResponse {
  message: string
  synced: number
  failed: number
  skipped: number
  details: ConnectionSyncResult[]
}

export interface OnDemandSyncResponse {
  status: 'ok' | 'error'
  synced_at?: string
  snapshot_count?: number
  message?: string
}

export interface TokenRefreshResult {
  connection_id: string
  empresa_id: string
  provider: string
  username: string | null
  status: 'refreshed' | 'skipped' | 'deactivated' | 'error'
  error?: string
}

export interface TokenRefreshResponse {
  message: string
  refreshed: number
  deactivated: number
  skipped: number
  details: TokenRefreshResult[]
}
