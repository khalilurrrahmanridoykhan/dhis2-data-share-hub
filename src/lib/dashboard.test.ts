import {
  buildDashboardPayload,
  buildDashboardUrl,
  buildInstructionsText,
  buildVisualizationPayload,
  DASHBOARD_READ_ACCESS,
  isVisualizableValueType,
  VISUALIZABLE_VALUE_TYPES,
} from './dashboard'

describe('isVisualizableValueType', () => {
  test('accepts numeric value types', () => {
    for (const valueType of VISUALIZABLE_VALUE_TYPES) {
      expect(isVisualizableValueType(valueType)).toBe(true)
    }
  })

  test('rejects FILE_RESOURCE -- the real type that broke a live pivot table', () => {
    // Confirmed live: a real "Project Management" dataset's FILE_RESOURCE
    // elements reported aggregationType "SUM" from the API despite being
    // file uploads, so aggregationType alone can't be trusted -- this must
    // filter on valueType.
    expect(isVisualizableValueType('FILE_RESOURCE')).toBe(false)
  })

  test('rejects text and boolean types', () => {
    expect(isVisualizableValueType('TEXT')).toBe(false)
    expect(isVisualizableValueType('LONG_TEXT')).toBe(false)
    expect(isVisualizableValueType('BOOLEAN')).toBe(false)
  })
})

describe('buildVisualizationPayload', () => {
  test('builds a pivot table with data elements on columns and org units as a filter', () => {
    const payload = buildVisualizationPayload('Malaria share', ['de1', 'de2'], ['ou1'])
    expect(payload.type).toBe('PIVOT_TABLE')
    expect(payload.columns).toEqual([{ dimension: 'dx', items: [{ id: 'de1' }, { id: 'de2' }] }])
    expect(payload.filters).toEqual([{ dimension: 'ou', items: [{ id: 'ou1' }] }])
    expect(payload.dataDimensionItems).toEqual([
      { dataDimensionItemType: 'DATA_ELEMENT', dataElement: { id: 'de1' } },
      { dataDimensionItemType: 'DATA_ELEMENT', dataElement: { id: 'de2' } },
    ])
    expect(payload.relativePeriods).toEqual({ last12Months: true })
  })

  test('includes the relative period as an item on the pe dimension, not just relativePeriods', () => {
    // Regression test: confirmed live that leaving `pe` items empty and
    // relying on `relativePeriods` alone produces a real error on the
    // recipient's dashboard ("A end date was not specified...").
    const payload = buildVisualizationPayload('Malaria share', ['de1'], ['ou1'])
    expect(payload.rows).toEqual([{ dimension: 'pe', items: [{ id: 'LAST_12_MONTHS' }] }])
  })

  test('prefixes the name so it is identifiable as created by this app', () => {
    const payload = buildVisualizationPayload('Test share', ['de1'], ['ou1'])
    expect(payload.name).toBe('Data Share Hub: Test share')
  })

  test('truncates a very long label to stay within DHIS2 name length limits', () => {
    const longLabel = 'x'.repeat(300)
    const payload = buildVisualizationPayload(longLabel, ['de1'], ['ou1'])
    expect(payload.name.length).toBeLessThanOrEqual(230)
  })
})

describe('buildDashboardPayload', () => {
  test('wraps the visualization plus a TEXT item with token instructions', () => {
    const payload = buildDashboardPayload('Test share', 'vis1', 'https://example.org')
    expect(payload.dashboardItems).toHaveLength(2)
    expect(payload.dashboardItems[0]).toEqual({ type: 'VISUALIZATION', visualization: { id: 'vis1' } })
    expect(payload.dashboardItems[1].type).toBe('TEXT')
    expect(payload.name).toBe('Data Share Hub: Test share')
  })
})

describe('buildInstructionsText', () => {
  test('includes the login URL and mentions API tokens, not the recipient password', () => {
    const text = buildInstructionsText('https://example.org')
    expect(text).toContain('https://example.org')
    expect(text).toContain('API tokens')
    expect(text).not.toContain('password:')
  })
})

describe('DASHBOARD_READ_ACCESS', () => {
  test('is metadata-read-only -- dashboards have no separate data dimension', () => {
    expect(DASHBOARD_READ_ACCESS).toBe('r-------')
  })
})

describe('buildDashboardUrl', () => {
  test('builds the confirmed-live deep-link format', () => {
    expect(buildDashboardUrl('https://example.org', 'abc123')).toBe(
      'https://example.org/dhis-web-dashboard/index.html?redirect=false#/abc123',
    )
  })
})
