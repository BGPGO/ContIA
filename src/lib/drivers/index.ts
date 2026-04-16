/**
 * Barrel export dos drivers — ContIA 2.0
 *
 * Importa e registra todos os drivers implementados.
 * Adicionar um novo driver: importar abaixo e chamar registerDriver().
 */

// ── Registro dos drivers implementados ────────────────────────────────────
import { instagramDriver } from './instagram'
import { linkedinDriver } from './linkedin'
import { facebookDriver } from './facebook'
import { metaAdsDriver } from './meta_ads'
import { crmDriver } from './crm'
import { greatpagesDriver } from './greatpages'
import { registerDriver } from './registry'

registerDriver('instagram', instagramDriver)
registerDriver('linkedin', linkedinDriver)
registerDriver('facebook', facebookDriver)
registerDriver('meta_ads', metaAdsDriver)
registerDriver('crm', crmDriver)
registerDriver('greatpages', greatpagesDriver)

// ── Exports públicos ───────────────────────────────────────────────────────

// InstagramDriver (para quem precisar de acesso direto)
export { instagramDriver } from './instagram'

// LinkedInDriver — Nível 1 (auto-aprovados: openid, profile, email, w_member_social)
export { linkedinDriver, linkedinDriverExtended } from './linkedin'
export type { LinkedInDriverExtended } from './linkedin'

// FacebookDriver — Facebook Pages (mesmo Meta App do Instagram)
export { facebookDriver } from './facebook'

// MetaAdsDriver — Meta Ads (ads_read + business_management)
export { metaAdsDriver } from './meta_ads'

// CRMDriver — CRM BGPGO (API key, sem OAuth)
export { crmDriver, connectCrmAuto } from './crm'

// GreatPagesDriver — Landing pages via CRM BGPGO (derivado, sem OAuth)
export { greatpagesDriver, connectGreatPagesAuto } from './greatpages'

// Registry (API pública)
export {
  registerDriver,
  getDriver,
  listDrivers,
  listMetadata,
  hasDriver,
} from './registry'

// Metadata de todos os providers
export {
  METADATA_BY_PROVIDER,
  PROVIDER_DISPLAY_ORDER,
  getProviderMetadata,
} from './metadata'

// Utilities compartilhadas
export {
  generateState,
  parseState,
  encryptToken,
  decryptToken,
  upsertConnection,
  getConnection,
  getConnections,
  deactivateConnection,
} from './base'

// Re-export types para conveniência
export type {
  ConnectionDriver,
  ProviderKey,
  ProviderMetadata,
  Connection,
  ProfileData,
  ContentItem,
  MetricSet,
  InsightData,
  SyncOptions,
  SyncJob,
  SyncJobType,
  SyncJobStatus,
} from '@/types/providers'
