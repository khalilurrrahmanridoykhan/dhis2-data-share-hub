import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import {
  CURRENT_SCHEMA_VERSION,
  DATASTORE_RESOURCE,
  SETTINGS_KEY,
  isNotFoundError,
  type SettingsBlob,
} from '../lib/dataStore'

interface State {
  loading: boolean
  error: string | null
  minimalRoleId: string | null
}

interface DataStoreGetResponse {
  blob: SettingsBlob
}

export interface UseShareHubSettingsResult extends State {
  setMinimalRoleId: (roleId: string) => Promise<void>
}

// Caches the "Data Share Hub - Read Only" userRole id once it's been
// looked up or created (see lib/serviceAccount.ts), so it's not re-searched
// or re-created on every share.
export function useShareHubSettings(): UseShareHubSettingsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, minimalRoleId: null })
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: DATASTORE_RESOURCE, id: SETTINGS_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, minimalRoleId: response.blob.minimalRoleId ?? null })
    } catch (error) {
      if (isNotFoundError(error)) {
        setKeyExists(false)
        setState({ loading: false, error: null, minimalRoleId: null })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), minimalRoleId: null })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const setMinimalRoleId = useCallback(
    async (roleId: string) => {
      const blob: SettingsBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, minimalRoleId: roleId }
      if (keyExists) {
        await engine.mutate({ resource: DATASTORE_RESOURCE, id: SETTINGS_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: `${DATASTORE_RESOURCE}/${SETTINGS_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, minimalRoleId: roleId })
    },
    [engine, keyExists],
  )

  return { ...state, setMinimalRoleId }
}
