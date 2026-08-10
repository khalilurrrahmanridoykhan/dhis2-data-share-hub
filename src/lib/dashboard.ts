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
  rows: { dimension: string; items: never[] }[]
  columns: { dimension: string; items: { id: string }[] }[]
  filters: { dimension: string; items: { id: string }[] }[]
  dataDimensionItems: { dataDimensionItemType: 'DATA_ELEMENT'; dataElement: { id: string } }[]
  relativePeriods: { last12Months: boolean }
}

// Confirmed live against play.dhis2.org: this exact shape (columns=dx,
// filters=ou, rows=pe with relativePeriods) creates a working pivot table
// whose data respects the viewing account's own org-unit/dataset access --
// it doesn't grant any access itself, it only visualizes whatever the
// service account (built in serviceAccount.ts) already has.
export function buildVisualizationPayload(label: string, dataElementIds: string[], orgUnitIds: string[]): VisualizationPayload {
  return {
    name: `Data Share Hub: ${label}`.slice(0, 230),
    type: 'PIVOT_TABLE',
    rows: [{ dimension: 'pe', items: [] }],
    columns: [{ dimension: 'dx', items: dataElementIds.map((id) => ({ id })) }],
    filters: [{ dimension: 'ou', items: orgUnitIds.map((id) => ({ id })) }],
    dataDimensionItems: dataElementIds.map((id) => ({ dataDimensionItemType: 'DATA_ELEMENT' as const, dataElement: { id } })),
    relativePeriods: { last12Months: true },
  }
}

export interface DashboardPayload {
  name: string
  dashboardItems: { type: 'VISUALIZATION'; visualization: { id: string } }[]
}

export function buildDashboardPayload(label: string, visualizationId: string): DashboardPayload {
  return {
    name: `Data Share Hub: ${label}`.slice(0, 230),
    dashboardItems: [{ type: 'VISUALIZATION', visualization: { id: visualizationId } }],
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
