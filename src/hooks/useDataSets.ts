import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'

export interface DataSetSummary {
  id: string
  name: string
  periodType: string
}

interface State {
  loading: boolean
  error: string | null
  dataSets: DataSetSummary[]
}

interface DataSetsResponse {
  dataSets: DataSetSummary[]
}

const DEBOUNCE_MS = 300

// Copied near-verbatim from Data Quality Auditor's useDataSets.ts -- already
// fully generic. Debounced dataset search, deliberately not `paging=false`,
// so this stays workable on instances with thousands of datasets.
export function useDataSets(searchTerm: string): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, dataSets: [] })

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const trimmed = searchTerm.trim()
      const query = {
        result: {
          resource: 'dataSets',
          params: {
            fields: 'id,name,periodType',
            pageSize: 25,
            order: 'name:asc',
            ...(trimmed ? { filter: `name:ilike:${trimmed}` } : {}),
          },
        },
      }

      engine
        .query(query)
        .then((response) => {
          if (cancelled) return
          const { dataSets } = (response as unknown as { result: DataSetsResponse }).result
          setState({ loading: false, error: null, dataSets: dataSets ?? [] })
        })
        .catch((error: Error) => {
          if (!cancelled) setState({ loading: false, error: error.message, dataSets: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [engine, searchTerm])

  return state
}
