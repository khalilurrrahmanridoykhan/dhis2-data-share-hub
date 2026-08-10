import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import type { ShareRecord } from '../types/share'

interface RawDataValue {
  dataElement: string
  period: string
  orgUnit: string
  categoryOptionCombo: string
  value: string
}

export interface RecipientDataPoint {
  dataElement: string
  dataElementName: string
  period: string
  orgUnit: string
  orgUnitName: string
  categoryOptionCombo: string
  value: string
}

interface State {
  loading: boolean
  error: string | null
  points: RecipientDataPoint[]
}

interface DataValueSetsResponse {
  result: { dataValues?: RawDataValue[] }
}
interface DataElementsResponse {
  result: { dataElements: { id: string; name: string }[] }
}

// Fetches the recipient's own shared data using their own (limited) session
// -- this both displays the data and doubles as a live demonstration that
// their access actually works, since it uses the exact same scoped account
// the credential handoff created for them.
export function useRecipientData(share: ShareRecord | null): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, points: [] })

  useEffect(() => {
    if (!share) {
      setState({ loading: false, error: null, points: [] })
      return
    }
    let cancelled = false
    setState({ loading: true, error: null, points: [] })

    async function run() {
      try {
        const dvResponse = (await engine.query({
          result: {
            resource: 'dataValueSets',
            params: {
              dataSet: share!.slice.dataSetId,
              orgUnit: share!.slice.orgUnitIds,
              startDate: share!.slice.startDate,
              endDate: share!.slice.endDate,
            },
          },
        })) as unknown as DataValueSetsResponse

        let dataValues = dvResponse.result.dataValues ?? []
        if (share!.slice.dataElementIds.length > 0) {
          const allowed = new Set(share!.slice.dataElementIds)
          dataValues = dataValues.filter((dv) => allowed.has(dv.dataElement))
        }

        const distinctDataElementIds = [...new Set(dataValues.map((dv) => dv.dataElement))]
        let dataElementNameById = new Map<string, string>()
        if (distinctDataElementIds.length > 0) {
          const deResponse = (await engine.query({
            result: {
              resource: 'dataElements',
              params: { filter: `id:in:[${distinctDataElementIds.join(',')}]`, fields: 'id,name', paging: false },
            },
          })) as unknown as DataElementsResponse
          dataElementNameById = new Map((deResponse.result.dataElements ?? []).map((de) => [de.id, de.name]))
        }

        const orgUnitNameById = new Map(share!.slice.orgUnitIds.map((id, i) => [id, share!.slice.orgUnitNames[i] ?? id]))

        const points: RecipientDataPoint[] = dataValues.map((dv) => ({
          dataElement: dv.dataElement,
          dataElementName: dataElementNameById.get(dv.dataElement) ?? dv.dataElement,
          period: dv.period,
          orgUnit: dv.orgUnit,
          orgUnitName: orgUnitNameById.get(dv.orgUnit) ?? dv.orgUnit,
          categoryOptionCombo: dv.categoryOptionCombo,
          value: dv.value,
        }))

        if (!cancelled) setState({ loading: false, error: null, points })
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : String(error), points: [] })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [engine, share])

  return state
}
