import { validateDataSlice } from './dataSlice'

function validSlice() {
  return {
    dataSetId: 'ds1',
    orgUnitIds: ['ou1'],
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  }
}

describe('validateDataSlice', () => {
  test('passes for a fully valid slice', () => {
    expect(validateDataSlice(validSlice())).toBeNull()
  })

  test('requires a dataset', () => {
    expect(validateDataSlice({ ...validSlice(), dataSetId: undefined })).toMatch(/dataset/i)
  })

  test('requires at least one org unit', () => {
    expect(validateDataSlice({ ...validSlice(), orgUnitIds: [] })).toMatch(/org unit/i)
  })

  test('requires both dates', () => {
    expect(validateDataSlice({ ...validSlice(), startDate: undefined })).toMatch(/start and end date/i)
    expect(validateDataSlice({ ...validSlice(), endDate: undefined })).toMatch(/start and end date/i)
  })

  test('rejects a start date after the end date', () => {
    expect(validateDataSlice({ ...validSlice(), startDate: '2025-01-01', endDate: '2024-01-01' })).toMatch(/before/i)
  })
})
