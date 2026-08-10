// Pure, no DHIS2 dependency -- unit-testable in isolation.

export interface RawDataValue {
  dataElement: string
  period: string
  orgUnit: string
  categoryOptionCombo: string
  value: string
}

export interface CsvRow {
  dataElement: string
  dataElementName: string
  period: string
  orgUnit: string
  orgUnitName: string
  categoryOptionCombo: string
  value: string
}

const CSV_HEADER: (keyof CsvRow)[] = [
  'dataElement',
  'dataElementName',
  'period',
  'orgUnit',
  'orgUnitName',
  'categoryOptionCombo',
  'value',
]

// Empty dataElementIds means "all data elements in the dataset" -- there is
// no server-side dataValueSets param for "only these elements", so this
// client-side filter is what actually gets the admin the slice they picked
// rather than the whole dataset.
export function filterByDataElements(dataValues: RawDataValue[], dataElementIds: string[]): RawDataValue[] {
  if (dataElementIds.length === 0) return dataValues
  const allowed = new Set(dataElementIds)
  return dataValues.filter((dv) => allowed.has(dv.dataElement))
}

// Deliberately does NOT sum by categoryOptionCombo the way Data Quality
// Auditor's fetchAggregatedPoints does for its arithmetic -- that summing is
// correct there because it feeds quality-check math; here it would corrupt
// the fidelity of a raw export handed to a third party. Each COC stays its
// own row/column value.
export function buildCsvRows(
  dataValues: RawDataValue[],
  dataElementNameById: Map<string, string>,
  orgUnitNameById: Map<string, string>,
): CsvRow[] {
  return dataValues.map((dv) => ({
    dataElement: dv.dataElement,
    dataElementName: dataElementNameById.get(dv.dataElement) ?? '',
    period: dv.period,
    orgUnit: dv.orgUnit,
    orgUnitName: orgUnitNameById.get(dv.orgUnit) ?? '',
    categoryOptionCombo: dv.categoryOptionCombo,
    value: dv.value,
  }))
}

function escapeCsvField(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

export function rowsToCsvString(rows: CsvRow[]): string {
  const lines = [CSV_HEADER.join(',')]
  for (const row of rows) {
    lines.push(CSV_HEADER.map((key) => escapeCsvField(String(row[key]))).join(','))
  }
  return lines.join('\n')
}

export function buildCsvFilename(dataSetName: string, startDate: string, endDate: string): string {
  const safeName = dataSetName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
  return `${safeName}_${startDate}_${endDate}.csv`
}
