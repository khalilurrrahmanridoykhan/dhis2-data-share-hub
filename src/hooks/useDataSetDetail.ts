import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'

export interface DataSetDataElement {
  id: string
  name: string
  valueType: string
}

export interface DataSetOrgUnit {
  id: string
  name: string
}

export interface DataSetDetail {
  id: string
  name: string
  periodType: string
  dataElements: DataSetDataElement[]
  organisationUnits: DataSetOrgUnit[]
}

interface State {
  loading: boolean
  error: string | null
  detail: DataSetDetail | null
}

interface RawDetail {
  id: string
  name: string
  periodType: string
  dataSetElements: { dataElement: DataSetDataElement }[]
  organisationUnits: DataSetOrgUnit[]
}

// Adapted from Data Quality Auditor's useDataSetDetail.ts, with one
// deliberate change: no isNumericValueType filter. A data *share* has no
// arithmetic reason to exclude text/boolean data elements the way an audit
// (which feeds quality-check math) does -- every data element in the
// dataset is offered, with valueType still returned for display as a type
// badge in the picker.
export function useDataSetDetail(dataSetId: string | null): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, detail: null })

  useEffect(() => {
    if (!dataSetId) {
      setState({ loading: false, error: null, detail: null })
      return
    }

    let cancelled = false
    setState({ loading: true, error: null, detail: null })

    const query = {
      result: {
        resource: `dataSets/${dataSetId}`,
        params: {
          fields: 'id,name,periodType,dataSetElements[dataElement[id,name,valueType]],organisationUnits[id,name]',
        },
      },
    }

    engine
      .query(query)
      .then((response) => {
        if (cancelled) return
        const raw = (response as unknown as { result: RawDetail }).result
        setState({
          loading: false,
          error: null,
          detail: {
            id: raw.id,
            name: raw.name,
            periodType: raw.periodType,
            dataElements: (raw.dataSetElements ?? []).map((dse) => dse.dataElement),
            organisationUnits: raw.organisationUnits ?? [],
          },
        })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ loading: false, error: error.message, detail: null })
      })

    return () => {
      cancelled = true
    }
  }, [engine, dataSetId])

  return state
}
