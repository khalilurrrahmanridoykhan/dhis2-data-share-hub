import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'

interface State {
  revoking: boolean
  error: string | null
}

// The only v1 revoke mechanism: disabling the service account. Well
// documented, reliable, cuts off all access regardless of token specifics.
// Whether an admin can delete a specific PAT belonging to another user via
// API is unconfirmed, so per-token revocation is not attempted here.
export function useRevokeServiceAccount() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ revoking: false, error: null })

  const revoke = useCallback(
    async (userId: string): Promise<boolean> => {
      setState({ revoking: true, error: null })
      try {
        await engine.mutate({
          resource: 'users',
          id: userId,
          type: 'update',
          partial: true,
          data: { disabled: true },
        })
        setState({ revoking: false, error: null })
        return true
      } catch (error) {
        setState({ revoking: false, error: error instanceof Error ? error.message : String(error) })
        return false
      }
    },
    [engine],
  )

  return { ...state, revoke }
}
