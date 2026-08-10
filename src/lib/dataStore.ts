// Same pattern confirmed working in Data Quality Auditor's lib/dataStore.ts:
// single-blob-per-key, read-modify-write. Two keys here instead of one --
// `shares` (the registry) and `settings` (caches the shared "read only"
// userRole id so it's looked up/created once, not on every share).

import type { ShareRecord } from '../types/share'

export const DATASTORE_NAMESPACE = 'dataShareHub'
export const SHARES_KEY = 'shares'
export const SETTINGS_KEY = 'settings'
// resource + id (not a combined path string) is the DHIS2 app-runtime data
// engine's own convention for building /api/dataStore/{namespace}/{key} --
// see hooks/useShares.ts and hooks/useShareHubSettings.ts, which are the
// only places these are used together. Confirmed live in the sibling
// Data Quality Auditor app: a 'create' mutation rejects an `id` property at
// runtime even though the TS type allows it, so first-ever key creation
// embeds the key directly in `resource` instead (see those hooks).
export const DATASTORE_RESOURCE = `dataStore/${DATASTORE_NAMESPACE}`

export const CURRENT_SCHEMA_VERSION = 1 as const

export interface SharesBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  shares: ShareRecord[]
}

export interface SettingsBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  minimalRoleId: string | null
}

export function emptySharesBlob(): SharesBlob {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, shares: [] }
}

export function emptySettingsBlob(): SettingsBlob {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, minimalRoleId: null }
}

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /404|not\s*found/i.test(error.message)
}
