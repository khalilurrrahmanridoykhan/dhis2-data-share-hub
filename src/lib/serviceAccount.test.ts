import {
  addUserAccess,
  buildServiceAccountPayload,
  buildUserRolePayload,
  generateServiceUsername,
  generateTempPassword,
  removeUserAccess,
  type SharingObject,
} from './serviceAccount'
import { SHARE_HUB_ROLE_NAME } from '../types/share'

describe('buildUserRolePayload', () => {
  test('uses the shared role name and an empty authorities array', () => {
    expect(buildUserRolePayload()).toEqual({ name: SHARE_HUB_ROLE_NAME, authorities: [] })
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
