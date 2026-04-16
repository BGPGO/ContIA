/**
 * Registry de drivers de conexão — ContIA 2.0
 *
 * Padrão plugin: cada driver se registra aqui ao ser importado.
 * O resto do app usa getDriver/listDrivers sem saber qual provider existe.
 */

import type { ConnectionDriver, ProviderKey, ProviderMetadata } from '@/types/providers'

/* ── Store interno ────────────────────────────────────────────────────────── */

const drivers: Partial<Record<ProviderKey, ConnectionDriver>> = {}

/* ── API pública ──────────────────────────────────────────────────────────── */

/**
 * Registra um driver para um provider.
 * Chamado no boot (index.ts) por cada driver implementado.
 */
export function registerDriver(key: ProviderKey, driver: ConnectionDriver): void {
  if (drivers[key]) {
    console.warn(`[Registry] Driver "${key}" já registrado — sobrescrevendo`)
  }
  drivers[key] = driver
}

/**
 * Retorna o driver de um provider, ou null se não implementado.
 */
export function getDriver(key: ProviderKey): ConnectionDriver | null {
  return drivers[key] ?? null
}

/**
 * Lista todos os drivers registrados (implementados).
 */
export function listDrivers(): ConnectionDriver[] {
  return Object.values(drivers).filter(
    (d): d is ConnectionDriver => d !== undefined
  )
}

/**
 * Lista metadata de todos os drivers registrados.
 * Útil para a UI de /conexoes mostrar cards.
 */
export function listMetadata(): ProviderMetadata[] {
  return listDrivers().map((d) => d.metadata)
}

/**
 * Verifica se um provider tem driver implementado.
 */
export function hasDriver(key: ProviderKey): boolean {
  return key in drivers
}
