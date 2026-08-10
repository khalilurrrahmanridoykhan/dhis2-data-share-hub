import type { DataSlice } from '../types/share'

// Deliberately simpler than Data Quality Auditor's lib/period.ts: DHIS2's
// dataValueSets API accepts raw startDate/endDate directly, so there's no
// period-string enumeration/snapping logic needed here.
export function validateDataSlice(slice: Partial<DataSlice>): string | null {
  if (!slice.dataSetId) return 'Select a dataset.'
  if (!slice.orgUnitIds || slice.orgUnitIds.length === 0) return 'Select at least one org unit.'
  if (!slice.startDate || !slice.endDate) return 'Select a start and end date.'
  if (slice.startDate > slice.endDate) return 'Start date must be before end date.'
  return null
}
