import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import {
  CURRENT_SCHEMA_VERSION,
  DATASTORE_RESOURCE,
  SHARES_KEY,
  isNotFoundError,
  type SharesBlob,
} from '../lib/dataStore'
import type { ShareRecord } from '../types/share'

interface State {
  loading: boolean
  error: string | null
  shares: ShareRecord[]
}

interface DataStoreGetResponse {
  blob: SharesBlob
}

export interface UseSharesResult extends State {
  refresh: () => Promise<void>
  saveShare: (share: ShareRecord) => Promise<void>
  deleteShare: (id: string) => Promise<void>
}

export function useShares(): UseSharesResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, shares: [] })
  // Whether the dataStore key has ever been created -- determines POST
  // (create) vs. PUT (update) on the next save.
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: DATASTORE_RESOURCE, id: SHARES_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, shares: response.blob.shares ?? [] })
    } catch (error) {
      if (isNotFoundError(error)) {
        // Expected on a fresh install -- the key hasn't been created yet.
        setKeyExists(false)
        setState({ loading: false, error: null, shares: [] })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), shares: [] })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const persist = useCallback(
    async (shares: ShareRecord[]) => {
      const blob: SharesBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, shares }
      if (keyExists) {
        await engine.mutate({ resource: DATASTORE_RESOURCE, id: SHARES_KEY, type: 'update', data: blob })
      } else {
        // 'create' mutations reject an `id` property at runtime -- the key
        // is embedded directly in `resource` instead. See lib/dataStore.ts.
        await engine.mutate({ resource: `${DATASTORE_RESOURCE}/${SHARES_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, shares })
    },
    [engine, keyExists],
  )

  const saveShare = useCallback(
    async (share: ShareRecord) => {
      const next = [...state.shares]
      const index = next.findIndex((s) => s.id === share.id)
      if (index >= 0) next[index] = share
      else next.push(share)
      await persist(next)
    },
    [persist, state.shares],
  )

  const deleteShare = useCallback(
    async (id: string) => {
      await persist(state.shares.filter((s) => s.id !== id))
    },
    [persist, state.shares],
  )

  return { ...state, refresh: load, saveShare, deleteShare }
}
