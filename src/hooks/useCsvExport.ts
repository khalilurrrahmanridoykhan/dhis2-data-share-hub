import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import { buildCsvFilename, buildCsvRows, filterByDataElements, rowsToCsvString, type RawDataValue } from '../lib/csvExport'
import type { DataSlice } from '../types/share'

interface DataValueSetsResponse {
  result: { dataValues?: RawDataValue[] }
}

interface State {
  exporting: boolean
  error: string | null
}

export interface UseCsvExportResult extends State {
  exportCsv: (
    slice: DataSlice,
    dataElementNameById: Map<string, string>,
    orgUnitNameById: Map<string, string>,
  ) => Promise<{ rowCount: number } | null>
}

function triggerDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Queries dataValueSets as JSON using the admin's own already-authenticated
// session -- no new credential, no new security surface -- then builds and
// downloads the CSV entirely client-side via Blob + a hidden <a download>.
// No server-side export capability is relied on at all, which is also why
// this sidesteps the unconfirmed XLSX-support question: a client-side
// conversion of this same JSON is a bounded future addition, not something
// this path depends on today.
export function useCsvExport(): UseCsvExportResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ exporting: false, error: null })

  const exportCsv = useCallback(
    async (slice: DataSlice, dataElementNameById: Map<string, string>, orgUnitNameById: Map<string, string>) => {
      setState({ exporting: true, error: null })
      try {
        const query = {
          result: {
            resource: 'dataValueSets',
            params: {
              dataSet: slice.dataSetId,
              orgUnit: slice.orgUnitIds,
              startDate: slice.startDate,
              endDate: slice.endDate,
            },
          },
        }
        const response = (await engine.query(query)) as unknown as DataValueSetsResponse
        const all = response.result.dataValues ?? []
        const filtered = filterByDataElements(all, slice.dataElementIds)
        const rows = buildCsvRows(filtered, dataElementNameById, orgUnitNameById)
        const csv = rowsToCsvString(rows)
        triggerDownload(csv, buildCsvFilename(slice.dataSetName, slice.startDate, slice.endDate))
        setState({ exporting: false, error: null })
        return { rowCount: rows.length }
      } catch (error) {
        setState({ exporting: false, error: error instanceof Error ? error.message : String(error) })
        return null
      }
    },
    [engine],
  )

  return { ...state, exportCsv }
}
