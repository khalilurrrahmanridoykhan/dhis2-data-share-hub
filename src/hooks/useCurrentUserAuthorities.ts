import { useDataQuery } from '@dhis2/app-runtime'

const query = {
  me: {
    resource: 'me',
    params: { fields: 'username,authorities' },
  },
}

interface MeResponse {
  me: { username: string; authorities: string[] }
}

export interface CurrentUserAuthorities {
  loading: boolean
  error: string | null
  username: string
  canManage: boolean
}

// Checks for ALL or F_USER_ADD. Unlike Data Quality Auditor's version of
// this hook, this gate is not purely cosmetic: creating users (POST
// /api/users) and editing a dataset's sharing ARE real, DHIS2-server-
// enforced privileged operations -- the server checks independently
// regardless of what this UI shows. This client-side check only controls
// whether the "Create API share" / "Revoke" entry points are shown; it is
// never treated as a guarantee that the underlying call will succeed
// (per-dataset "manage sharing" access can't be fully pre-validated with
// one global boolean), so every real POST/PATCH in
// hooks/useCreateServiceAccount.ts and useRevokeServiceAccount.ts still
// surfaces a genuine 403 from the server if it occurs.
export function useCurrentUserAuthorities(): CurrentUserAuthorities {
  const { loading, error, data } = useDataQuery<MeResponse>(query)
  const authorities = data?.me.authorities ?? []
  return {
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    username: data?.me.username ?? '',
    canManage: authorities.includes('ALL') || authorities.includes('F_USER_ADD'),
  }
}
