import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import { countOtherActiveSharesForAccount } from '../lib/serviceAccount'
import type { ShareRecord } from '../types/share'

export interface ExistingServiceAccount {
  id: string
  username: string
  // How many OTHER active shares already use this account -- purely
  // client-side, cross-referenced against the already-loaded share
  // registry (DHIS2's users API has no concept of "share count").
  activeShareCount: number
}

interface State {
  loading: boolean
  error: string | null
  accounts: ExistingServiceAccount[]
}

interface RawUser {
  id: string
  username: string
}

interface UsersResponse {
  accounts: { users: RawUser[] }
}

// Existing Data Share Hub service accounts, for the "attach to an existing
// account" picker. Only ever fires once a shared role exists (roleId
// non-null) -- if no api_account share has ever been created on this
// instance, the role doesn't exist yet, so the picker shows "none yet"
// with zero API calls, rather than the picker itself having the side
// effect of creating the shared role.
export function useServiceAccounts(roleId: string | null, shares: ShareRecord[]): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, accounts: [] })

  useEffect(() => {
    if (!roleId) {
      setState({ loading: false, error: null, accounts: [] })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const query = {
      accounts: {
        resource: 'users',
        params: {
          filter: [`userRoles.id:eq:${roleId}`, 'disabled:eq:false'],
          fields: 'id,username',
          paging: false,
        },
      },
    }

    engine
      .query(query)
      .then((response) => {
        if (cancelled) return
        const users = (response as unknown as UsersResponse).accounts.users ?? []
        const accounts = users.map((u) => ({
          id: u.id,
          username: u.username,
          activeShareCount: countOtherActiveSharesForAccount(shares, u.id, ''),
        }))
        setState({ loading: false, error: null, accounts })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ loading: false, error: error.message, accounts: [] })
      })

    return () => {
      cancelled = true
    }
    // shares intentionally excluded from deps -- activeShareCount is a
    // display nicety, not something that should re-fire the users query on
    // every registry change; it's recomputed from whatever `shares` value
    // is current at the time roleId changes/first fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, roleId])

  return state
}
