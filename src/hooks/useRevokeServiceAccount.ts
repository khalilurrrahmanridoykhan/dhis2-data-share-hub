import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import { otherActiveSharesOnSameDataset, removeUserAccess, type SharingObject } from '../lib/serviceAccount'
import type { ShareRecord } from '../types/share'

interface State {
  revoking: boolean
  error: string | null
}

type Engine = ReturnType<typeof useDataEngine>

interface SharingGetResponse {
  sharing: { object: SharingObject }
}

// Best-effort, isolated cleanup -- a dashboard/visualization is always
// exclusively this share's (never reused across shares, even attached
// ones), so it's always safe to remove, but a failure here must not block
// the security-relevant step (dataset access removal / account disable).
async function cleanupDashboard(engine: Engine, share: ShareRecord): Promise<void> {
  try {
    if (share.dashboardId) {
      await engine.mutate({ resource: 'dashboards', id: share.dashboardId, type: 'delete' })
    }
    if (share.visualizationId) {
      await engine.mutate({ resource: 'visualizations', id: share.visualizationId, type: 'delete' })
    }
  } catch {
    // Swallow -- matches createRecipientDashboard's own isolation
    // philosophy in useCreateServiceAccount.ts.
  }
}

// The dataset's userAccesses sharing entry is keyed by (account, dataset)
// -- one row total, not one per share (see
// lib/serviceAccount.ts#otherActiveSharesOnSameDataset for why). So unlike
// the old version of this hook, revoking one share does NOT unconditionally
// disable the account or strip dataset access -- both are conditional on
// whether any other active share still needs them. Disabling the account
// itself is a fully separate, explicitly-confirmed second step (see
// disableAccount below and App.tsx's two-step confirm flow), never an
// automatic side effect of revoking one share.
export function useRevokeServiceAccount() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ revoking: false, error: null })

  const revoke = useCallback(
    async (share: ShareRecord, allShares: ShareRecord[]): Promise<boolean> => {
      if (!share.serviceAccountUserId) return false
      const userId = share.serviceAccountUserId
      setState({ revoking: true, error: null })
      try {
        // 1. Dataset grant: only remove if no other active share on this
        // account still needs access to this same dataset.
        if (otherActiveSharesOnSameDataset(allShares, share).length === 0) {
          const sharingResponse = (await engine.query({
            sharing: { resource: 'sharing', params: { type: 'dataSet', id: share.slice.dataSetId } },
          })) as unknown as SharingGetResponse
          const nextSharing = removeUserAccess(sharingResponse.sharing.object, userId)
          await engine.mutate({
            resource: 'sharing',
            type: 'create',
            params: { type: 'dataSet', id: share.slice.dataSetId },
            data: { object: nextSharing },
          })
        }

        // 2. Dashboard + visualization: always exclusively this share's.
        await cleanupDashboard(engine, share)

        setState({ revoking: false, error: null })
        return true
      } catch (error) {
        setState({ revoking: false, error: error instanceof Error ? error.message : String(error) })
        return false
      }
    },
    [engine],
  )

  // The second, separately-confirmed step: disabling an account that
  // revoke() has already fully unhooked from every share (grants/dashboard
  // already removed, so there's nothing left to touch here but the account
  // itself).
  const disableAccount = useCallback(
    async (userId: string): Promise<boolean> => {
      setState({ revoking: true, error: null })
      try {
        await engine.mutate({ resource: 'users', id: userId, type: 'update', partial: true, data: { disabled: true } })
        setState({ revoking: false, error: null })
        return true
      } catch (error) {
        setState({ revoking: false, error: error instanceof Error ? error.message : String(error) })
        return false
      }
    },
    [engine],
  )

  return { ...state, revoke, disableAccount }
}
