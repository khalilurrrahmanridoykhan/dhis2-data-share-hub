import {
  addUserAccess,
  buildServiceAccountPayload,
  buildUserRolePayload,
  countOtherActiveSharesForAccount,
  generateServiceUsername,
  generateTempPassword,
  otherActiveSharesOnSameDataset,
  removeUserAccess,
  type SharingObject,
} from './serviceAccount'
import { SHARE_HUB_ROLE_NAME, type ShareRecord } from '../types/share'

function makeShare(overrides: Partial<ShareRecord> = {}): ShareRecord {
  return {
    id: 's1',
    label: 'Test share',
    recipientNote: null,
    method: 'api_account',
    slice: {
      dataSetId: 'ds1',
      dataSetName: 'Dataset 1',
      periodType: 'Monthly',
      dataElementIds: [],
      dataElementNames: [],
      orgUnitIds: ['ou1'],
      orgUnitNames: ['Org unit 1'],
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    },
    serviceAccountUsername: 'share.test.abc123',
    serviceAccountUserId: 'account1',
    userRoleId: 'role1',
    accountOrigin: 'created',
    credentialDeliveryMethod: 'temp_password',
    recipientEmail: null,
    dashboardId: 'dash1',
    dashboardUrl: 'https://example.org/dashboard/dash1',
    visualizationId: 'vis1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    revokedAt: null,
    revokedBy: null,
    ...overrides,
  }
}

describe('buildUserRolePayload', () => {
  test('uses the shared role name and grants only Dashboard + Data Visualizer visibility', () => {
    // Confirmed live: a zero-authority account can't open ANY custom app
    // (including Data Share Hub itself) from DHIS2's own menu, and the only
    // authority that unlocks custom-app visibility at all is
    // M_dhis-web-app-management -- far too broad for a read-only recipient.
    // These two authorities were confirmed live to each unlock only their
    // own one app, nothing else. M_dhis-web-data-visualizer (not
    // M_dhis-web-pivot, which does nothing on modern DHIS2) covers pivot
    // tables too, since that standalone app was merged into Data Visualizer.
    expect(buildUserRolePayload()).toEqual({
      name: SHARE_HUB_ROLE_NAME,
      authorities: ['M_dhis-web-dashboard', 'M_dhis-web-data-visualizer'],
    })
  })
})

describe('generateServiceUsername', () => {
  test('slugifies the label and prefixes it', () => {
    const username = generateServiceUsername('Malaria Donor Report!!')
    expect(username).toMatch(/^share\.malaria-donor-report\.[a-z0-9]{6}$/)
  })

  test('falls back to "account" when the label has no alphanumeric characters', () => {
    const username = generateServiceUsername('!!!')
    expect(username).toMatch(/^share\.account\.[a-z0-9]{6}$/)
  })

  test('produces different suffixes across calls', () => {
    const a = generateServiceUsername('Test')
    const b = generateServiceUsername('Test')
    expect(a).not.toBe(b)
  })
})

describe('generateTempPassword', () => {
  test('is at least 12 characters and contains upper, lower, digit, and special characters', () => {
    const password = generateTempPassword()
    expect(password.length).toBeGreaterThanOrEqual(12)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[!@#$%^&*]/)
  })

  test('produces different passwords across calls', () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword())
  })
})

describe('buildServiceAccountPayload', () => {
  test('sets both organisationUnits and dataViewOrganisationUnits to the slice org units', () => {
    // Confirmed live against play.dhis2.org: GET /api/dataValueSets rejects
    // reads for an org unit that's only in dataViewOrganisationUnits -- the
    // capture-scope organisationUnits list is what this endpoint actually
    // checks, even for a pure read. Safe because the role's authorities
    // stay empty, so this account still cannot write data (also verified
    // live: a data value POST from an account like this 403s).
    const payload = buildServiceAccountPayload({
      username: 'share.test.abc123',
      label: 'Test share',
      userRoleId: 'role1',
      orgUnitIds: ['ou1', 'ou2'],
      credential: { method: 'temp_password', password: 'Abc123!@#xyz' },
    })
    expect(payload.organisationUnits).toEqual([{ id: 'ou1' }, { id: 'ou2' }])
    expect(payload.dataViewOrganisationUnits).toEqual([{ id: 'ou1' }, { id: 'ou2' }])
    expect(payload.userRoles).toEqual([{ id: 'role1' }])
    expect(payload.password).toBe('Abc123!@#xyz')
    expect(payload.invite).toBeUndefined()
  })

  test('sets email and invite for the invite_email credential method', () => {
    const payload = buildServiceAccountPayload({
      username: 'share.test.abc123',
      label: 'Test share',
      userRoleId: 'role1',
      orgUnitIds: ['ou1'],
      credential: { method: 'invite_email', email: 'partner@example.org' },
    })
    expect(payload.email).toBe('partner@example.org')
    expect(payload.invite).toBe(true)
    expect(payload.password).toBeUndefined()
  })
})

describe('addUserAccess / removeUserAccess', () => {
  function existingSharing(): SharingObject {
    return {
      publicAccess: 'r-------',
      userGroupAccesses: [{ id: 'ug1' }],
      userAccesses: [{ id: 'existingUser', access: 'rw------' }],
    }
  }

  test('addUserAccess preserves existing publicAccess and userGroupAccesses untouched', () => {
    const result = addUserAccess(existingSharing(), 'newUser')
    expect(result.publicAccess).toBe('r-------')
    expect(result.userGroupAccesses).toEqual([{ id: 'ug1' }])
  })

  test('addUserAccess appends the new user without removing the existing one', () => {
    const result = addUserAccess(existingSharing(), 'newUser')
    expect(result.userAccesses).toEqual([
      { id: 'existingUser', access: 'rw------' },
      { id: 'newUser', access: 'r-r-----' },
    ])
  })

  test('addUserAccess replaces an existing entry for the same user id rather than duplicating it', () => {
    const sharing = existingSharing()
    const result = addUserAccess(sharing, 'existingUser', 'rwrw----')
    expect(result.userAccesses).toEqual([{ id: 'existingUser', access: 'rwrw----' }])
  })

  test('removeUserAccess drops only the specified user', () => {
    const sharing = addUserAccess(existingSharing(), 'newUser')
    const result = removeUserAccess(sharing, 'newUser')
    expect(result.userAccesses).toEqual([{ id: 'existingUser', access: 'rw------' }])
  })
})

describe('countOtherActiveSharesForAccount', () => {
  test('returns 0 when no other share references the account', () => {
    const shares = [makeShare({ id: 's1', serviceAccountUserId: 'account1' })]
    expect(countOtherActiveSharesForAccount(shares, 'account1', 's1')).toBe(0)
  })

  test('counts only api_account shares, ignoring csv_export records on an unrelated field', () => {
    const shares = [
      makeShare({ id: 's1', serviceAccountUserId: 'account1' }),
      makeShare({ id: 's2', method: 'csv_export', serviceAccountUserId: null }),
    ]
    expect(countOtherActiveSharesForAccount(shares, 'account1', 's1')).toBe(0)
  })

  test('excludes the share matching excludeShareId itself', () => {
    const shares = [
      makeShare({ id: 's1', serviceAccountUserId: 'account1' }),
      makeShare({ id: 's2', serviceAccountUserId: 'account1' }),
    ]
    expect(countOtherActiveSharesForAccount(shares, 'account1', 's1')).toBe(1)
    expect(countOtherActiveSharesForAccount(shares, 'account1', 's2')).toBe(1)
  })

  test('excludes shares with status revoked', () => {
    const shares = [
      makeShare({ id: 's1', serviceAccountUserId: 'account1' }),
      makeShare({ id: 's2', serviceAccountUserId: 'account1', status: 'revoked' }),
    ]
    expect(countOtherActiveSharesForAccount(shares, 'account1', 's1')).toBe(0)
  })

  test('counts draft/account_created/active shares as active', () => {
    const shares = [
      makeShare({ id: 's1', serviceAccountUserId: 'account1' }),
      makeShare({ id: 's2', serviceAccountUserId: 'account1', status: 'draft' }),
      makeShare({ id: 's3', serviceAccountUserId: 'account1', status: 'account_created' }),
      makeShare({ id: 's4', serviceAccountUserId: 'account1', status: 'active' }),
    ]
    expect(countOtherActiveSharesForAccount(shares, 'account1', 's1')).toBe(3)
  })
})

describe('otherActiveSharesOnSameDataset', () => {
  test('returns empty when the sibling is on the same account but a different dataset', () => {
    const share = makeShare({ id: 's1', serviceAccountUserId: 'account1', slice: { ...makeShare().slice, dataSetId: 'ds1' } })
    const sibling = makeShare({ id: 's2', serviceAccountUserId: 'account1', slice: { ...makeShare().slice, dataSetId: 'ds2' } })
    expect(otherActiveSharesOnSameDataset([share, sibling], share)).toEqual([])
  })

  test('returns the sibling when same account and same dataset, even with different org units/dates', () => {
    const share = makeShare({
      id: 's1',
      serviceAccountUserId: 'account1',
      slice: { ...makeShare().slice, dataSetId: 'ds1', orgUnitIds: ['ouA'], startDate: '2025-01-01', endDate: '2025-06-30' },
    })
    const sibling = makeShare({
      id: 's2',
      serviceAccountUserId: 'account1',
      slice: { ...makeShare().slice, dataSetId: 'ds1', orgUnitIds: ['ouB'], startDate: '2025-07-01', endDate: '2025-12-31' },
    })
    expect(otherActiveSharesOnSameDataset([share, sibling], share)).toEqual([sibling])
  })

  test('excludes revoked siblings', () => {
    const share = makeShare({ id: 's1', serviceAccountUserId: 'account1', slice: { ...makeShare().slice, dataSetId: 'ds1' } })
    const sibling = makeShare({
      id: 's2',
      serviceAccountUserId: 'account1',
      status: 'revoked',
      slice: { ...makeShare().slice, dataSetId: 'ds1' },
    })
    expect(otherActiveSharesOnSameDataset([share, sibling], share)).toEqual([])
  })
})
