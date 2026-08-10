// Pure payload builders, unit-testable without a live server. Orchestration
// lives in hooks/useCreateServiceAccount.ts.
//
// Why this exists: granting Dashboard/Data Visualizer app authorities (see
// serviceAccount.ts) only lets a recipient open those tools -- it does not
// scope what they see. DHIS2's Dashboard app lists every dashboard already
// visible to the account per each dashboard's OWN sharing settings, which on
// a busy instance means a recipient sees unrelated pre-existing content
// alongside (or instead of) their own data. The fix is to actually build a
// dedicated dashboard containing exactly the shared data, and share only
// that one with the recipient.

export interface VisualizationPayload {
  name: string
  type: 'PIVOT_TABLE'
  rows: { dimension: string; items: { id: string }[] }[]
  columns: { dimension: string; items: { id: string }[] }[]
  filters: { dimension: string; items: { id: string }[] }[]
  dataDimensionItems: { dataDimensionItemType: 'DATA_ELEMENT'; dataElement: { id: string } }[]
  relativePeriods: { last12Months: boolean }
}

// Confirmed live against play.dhis2.org, the hard way: the first version of
// this only set the top-level `relativePeriods` field and left the `pe`
// dimension's `items` empty, which produced a real, user-facing error on
// the recipient's dashboard -- "A end date was not specified in periods,
// dimensions, filters". The client resolves the actual date range from the
// `pe` dimension's items, not from `relativePeriods` alone; the relative
// period has to be present as an item there too (id: "LAST_12_MONTHS" is
// DHIS2's standard relative-period identifier, valid anywhere a period item
// is expected). `relativePeriods` is kept alongside it since some contexts
// do read it, but it is not sufficient on its own.
export function buildVisualizationPayload(label: string, dataElementIds: string[], orgUnitIds: string[]): VisualizationPayload {
  return {
    name: `Data Share Hub: ${label}`.slice(0, 230),
    type: 'PIVOT_TABLE',
    rows: [{ dimension: 'pe', items: [{ id: 'LAST_12_MONTHS' }] }],
    columns: [{ dimension: 'dx', items: dataElementIds.map((id) => ({ id })) }],
    filters: [{ dimension: 'ou', items: orgUnitIds.map((id) => ({ id })) }],
    dataDimensionItems: dataElementIds.map((id) => ({ dataDimensionItemType: 'DATA_ELEMENT' as const, dataElement: { id } })),
    relativePeriods: { last12Months: true },
  }
}

// Confirmed live: DHIS2 dashboards support a real TEXT item type
// ({ type: 'TEXT', text: '...' }), so the token-generation instructions can
// live directly on the recipient's own dashboard -- not just in the
// one-time admin-facing handoff modal, which the recipient never sees if
// the admin forgets to relay it.
export function buildInstructionsText(baseUrl: string): string {
  return [
    'How to get your own API access:',
    '1. Click your avatar (top right) -> Profile.',
    '2. Change your password if you have not already.',
    '3. Find "API tokens" and generate a new one.',
    '4. Use that token in your own tools with an "Authorization: ApiToken <your token>" header -- not your login password.',
    '',
    `Log in at: ${baseUrl}`,
  ].join('\n')
}

export type DashboardItemPayload =
  | { type: 'VISUALIZATION'; visualization: { id: string } }
  | { type: 'TEXT'; text: string }

export interface DashboardPayload {
  name: string
  dashboardItems: DashboardItemPayload[]
}

export function buildDashboardPayload(label: string, visualizationId: string, baseUrl: string): DashboardPayload {
  return {
    name: `Data Share Hub: ${label}`.slice(0, 230),
    dashboardItems: [
      { type: 'VISUALIZATION', visualization: { id: visualizationId } },
      { type: 'TEXT', text: buildInstructionsText(baseUrl) },
    ],
  }
}

// A dedicated pivot table is not a data-bearing sharing target the way a
// dataset is -- it has no separate "data" read/write dimension, only
// metadata read/write. Confirmed live: a freshly-created dashboard defaults
// to fully private (publicAccess "--------", empty group/user access), so
// this grants exactly the one entry needed, nothing is exposed by default.
export const DASHBOARD_READ_ACCESS = 'r-------'

export function buildDashboardUrl(baseUrl: string, dashboardId: string): string {
  return `${baseUrl}/dhis-web-dashboard/index.html?redirect=false#/${dashboardId}`
}
