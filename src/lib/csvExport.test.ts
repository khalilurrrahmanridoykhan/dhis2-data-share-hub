import { buildCsvFilename, buildCsvRows, filterByDataElements, rowsToCsvString, type RawDataValue } from './csvExport'

function dv(overrides: Partial<RawDataValue> = {}): RawDataValue {
  return {
    dataElement: 'de1',
    period: '202401',
    orgUnit: 'ou1',
    categoryOptionCombo: 'coc1',
    value: '10',
    ...overrides,
  }
}

describe('filterByDataElements', () => {
  test('empty dataElementIds means "all" -- returns everything unchanged', () => {
    const values = [dv({ dataElement: 'de1' }), dv({ dataElement: 'de2' })]
    expect(filterByDataElements(values, [])).toEqual(values)
  })

  test('non-empty dataElementIds filters to only those elements', () => {
    const values = [dv({ dataElement: 'de1' }), dv({ dataElement: 'de2' }), dv({ dataElement: 'de3' })]
    const result = filterByDataElements(values, ['de1', 'de3'])
    expect(result.map((v) => v.dataElement)).toEqual(['de1', 'de3'])
  })
})

describe('buildCsvRows', () => {
  test('maps ids to names and keeps every categoryOptionCombo as its own row', () => {
    const values = [
      dv({ dataElement: 'de1', orgUnit: 'ou1', categoryOptionCombo: 'male', value: '5' }),
      dv({ dataElement: 'de1', orgUnit: 'ou1', categoryOptionCombo: 'female', value: '7' }),
    ]
    const nameById = new Map([['de1', 'ANC 1st visit']])
    const ouNameById = new Map([['ou1', 'Ngelehun CHC']])
    const rows = buildCsvRows(values, nameById, ouNameById)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ dataElementName: 'ANC 1st visit', orgUnitName: 'Ngelehun CHC', categoryOptionCombo: 'male', value: '5' })
    expect(rows[1]).toMatchObject({ categoryOptionCombo: 'female', value: '7' })
  })

  test('falls back to an empty name string when an id has no mapping', () => {
    const rows = buildCsvRows([dv({ dataElement: 'unknown' })], new Map(), new Map())
    expect(rows[0].dataElementName).toBe('')
  })
})

describe('rowsToCsvString', () => {
  test('produces a header row plus one line per data row', () => {
    const rows = buildCsvRows([dv()], new Map([['de1', 'Test element']]), new Map([['ou1', 'Test org unit']]))
    const csv = rowsToCsvString(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('dataElement,dataElementName,period,orgUnit,orgUnitName,categoryOptionCombo,value')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('Test element')
  })

  test('escapes fields containing commas, quotes, or newlines', () => {
    const rows = buildCsvRows([dv({ dataElement: 'de,1' })], new Map([['de,1', 'Name with "quotes", and, commas']]), new Map())
    const csv = rowsToCsvString(rows)
    expect(csv).toContain('"Name with ""quotes"", and, commas"')
  })

  test('an empty row set produces just the header', () => {
    expect(rowsToCsvString([]).split('\n')).toHaveLength(1)
  })
})

describe('buildCsvFilename', () => {
  test('sanitizes non-alphanumeric characters and includes the date range', () => {
    expect(buildCsvFilename('Reproductive Health / Monthly', '2024-01-01', '2024-12-31')).toBe(
      'Reproductive_Health_Monthly_2024-01-01_2024-12-31.csv',
    )
  })
})
