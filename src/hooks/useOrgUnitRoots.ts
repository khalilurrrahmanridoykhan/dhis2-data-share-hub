import { useDataQuery } from '@dhis2/app-runtime'

const query = {
  roots: {
    resource: 'organisationUnits',
    params: { filter: 'level:eq:1', fields: 'id', paging: 'false' },
  },
}

interface RootsResponse {
  roots: { organisationUnits: { id: string }[] }
}

export interface UseOrgUnitRootsResult {
  roots: string[]
  loading: boolean
}

// Feeds OrganisationUnitTree's `roots` prop -- the top-level org units this
// instance's hierarchy is browsed from.
export function useOrgUnitRoots(): UseOrgUnitRootsResult {
  const { data, loading } = useDataQuery<RootsResponse>(query)
  return {
    roots: data?.roots.organisationUnits.map((ou) => ou.id) ?? [],
    loading,
  }
}
