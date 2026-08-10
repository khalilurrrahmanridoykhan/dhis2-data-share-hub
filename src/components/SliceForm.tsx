import { CheckboxField, InputField, MultiSelectField, MultiSelectOption, SimpleSingleSelectField } from '@dhis2/ui'
import { useEffect, useState } from 'react'
import { useDataSetDetail, type DataSetDetail } from '../hooks/useDataSetDetail'
import { useDataSets } from '../hooks/useDataSets'
import { validateDataSlice } from '../lib/dataSlice'
import type { DataSlice } from '../types/share'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultStartDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

// The shared data-slice picker used by both the CSV export flow and the
// API-account sharing flow. v1 only offers aggregate datasets
// (GET /api/dataSets) -- tracker programs use a structurally different
// API/sharing model and are out of scope, so there is no program picker
// here at all rather than a half-working one.
export function SliceForm({
  onChange,
}: {
  onChange: (slice: DataSlice | null, detail: DataSetDetail | null, validationError: string | null) => void
}) {
  const [datasetSearchTerm, setDatasetSearchTerm] = useState('')
  const [dataSetId, setDataSetId] = useState<string | null>(null)
  const [dataSetName, setDataSetName] = useState('')
  const [allDataElements, setAllDataElements] = useState(true)
  const [dataElementIds, setDataElementIds] = useState<string[]>([])
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState(defaultStartDate())
  const [endDate, setEndDate] = useState(todayIso())

  const { dataSets, loading: dataSetsLoading } = useDataSets(datasetSearchTerm)
  const { detail, loading: detailLoading } = useDataSetDetail(dataSetId)

  useEffect(() => {
    setDataElementIds([])
    setAllDataElements(true)
    setOrgUnitIds([])
  }, [dataSetId])

  useEffect(() => {
    const slice: Partial<DataSlice> = {
      dataSetId: dataSetId ?? undefined,
      dataSetName,
      periodType: detail?.periodType ?? '',
      dataElementIds: allDataElements ? [] : dataElementIds,
      dataElementNames: allDataElements
        ? []
        : (detail?.dataElements ?? []).filter((de) => dataElementIds.includes(de.id)).map((de) => de.name),
      orgUnitIds,
      orgUnitNames: (detail?.organisationUnits ?? []).filter((ou) => orgUnitIds.includes(ou.id)).map((ou) => ou.name),
      startDate,
      endDate,
    }
    const validationError = validateDataSlice(slice)
    onChange(validationError ? null : (slice as DataSlice), detail, validationError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSetId, dataSetName, allDataElements, dataElementIds, orgUnitIds, startDate, endDate, detail])

  const orgUnitOptions = detail?.organisationUnits ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SimpleSingleSelectField
        name="dataset"
        label="Dataset"
        required
        filterable
        filterPlaceholder="Search datasets by name..."
        filterValue={datasetSearchTerm}
        onFilterChange={setDatasetSearchTerm}
        loading={dataSetsLoading}
        noMatchText="No datasets match this search."
        options={dataSets.map((ds) => ({ label: `${ds.name} (${ds.periodType})`, value: ds.id }))}
        value={dataSetId ?? ''}
        valueLabel={dataSetName || undefined}
        onChange={(value) => {
          const chosen = dataSets.find((ds) => ds.id === value)
          setDataSetId(value)
          setDataSetName(chosen?.name ?? dataSetName)
        }}
      />

      {dataSetId && (
        <>
          {detail && (
            <div style={{ fontSize: 13, color: '#6e7a89' }}>
              Period type: <strong>{detail.periodType}</strong>
            </div>
          )}

          <CheckboxField
            label="Include all data elements in this dataset"
            checked={allDataElements}
            onChange={({ checked }) => setAllDataElements(checked)}
          />

          {!allDataElements && (
            <MultiSelectField
              label="Data elements to include"
              loading={detailLoading}
              filterable
              filterPlaceholder="Filter data elements..."
              noMatchText="No data elements found."
              selected={dataElementIds}
              onChange={({ selected }) => setDataElementIds(selected)}
            >
              {(detail?.dataElements ?? []).map((de) => (
                <MultiSelectOption key={de.id} label={`${de.name} (${de.valueType})`} value={de.id} />
              ))}
            </MultiSelectField>
          )}

          <MultiSelectField
            label="Org units to include"
            required
            loading={detailLoading}
            filterable
            filterPlaceholder="Filter org units..."
            noMatchText="No org units found."
            selected={orgUnitIds}
            onChange={({ selected }) => setOrgUnitIds(selected)}
          >
            {orgUnitOptions.map((ou) => (
              <MultiSelectOption key={ou.id} label={ou.name} value={ou.id} />
            ))}
          </MultiSelectField>

          <div style={{ display: 'flex', gap: 16 }}>
            <InputField
              label="Start date"
              type="date"
              value={startDate}
              onChange={({ value }) => setStartDate(value ?? '')}
            />
            <InputField label="End date" type="date" value={endDate} onChange={({ value }) => setEndDate(value ?? '')} />
          </div>
        </>
      )}
    </div>
  )
}
