// Pure payload builders, unit-testable without a live server. The actual
// HTTP orchestration lives in hooks/useCreateServiceAccount.ts.

import { SHARE_HUB_ROLE_NAME } from '../types/share'

export interface UserRolePayload {
  name: string
  authorities: string[]
}

// M_dhis-web-dashboard / M_dhis-web-data-visualizer grant visibility into
// exactly those two DHIS2-native, read-only apps -- confirmed live that
// each individually unlocks only that one app in DHIS2's own menu, nothing
// more. (M_dhis-web-pivot was tried first and does nothing on modern DHIS2
// -- the standalone Pivot Table app was merged into Data Visualizer, which
// includes a pivot-table view mode; M_dhis-web-data-visualizer is its real
// authority, confirmed live.)
//
// This exists because of a real, confirmed DHIS2 platform limitation: a
// role with zero authorities can authenticate and its data access works
// correctly, but DHIS2's own app menu excludes ALL custom (non-core) apps
// for such an account -- including Data Share Hub itself -- even though
// this app declares no restriction. The only authority found that unlocks
// custom-app visibility at all is M_dhis-web-app-management, which is
// nowhere near appropriate here (it grants install/manage/uninstall over
// every app on the instance). So instead of leaving the recipient with no
// way to see their data inside DHIS2 at all, this grants access to DHIS2's
// own polished, native data-viewing tools -- not a workaround for opening
// this app, a legitimately better outcome than a hand-built table anyway.
export function buildUserRolePayload(): UserRolePayload {
  return { name: SHARE_HUB_ROLE_NAME, authorities: ['M_dhis-web-dashboard', 'M_dhis-web-data-visualizer'] }
}

// e.g. "share.malaria-donor-report.a1b2c3" -- readable, unique enough to
// avoid collisions without needing a server round trip to check first.
export function generateServiceUsername(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `share.${slug || 'account'}.${suffix}`
}

const PASSWORD_LOWER = 'abcdefghijkmnpqrstuvwxyz' // no l/o, avoids visual ambiguity
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I/O
const PASSWORD_DIGITS = '23456789' // no 0/1
const PASSWORD_SPECIAL = '!@#$%^&*'

function randomChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

// Meets DHIS2's typical default password policy: minimum length, at least
// one upper/lower/digit/special character. Verify against the target
// instance's actual configured password policy at implementation time --
// some instances tighten this further.
export function generateTempPassword(): string {
  const required = [randomChar(PASSWORD_UPPER), randomChar(PASSWORD_LOWER), randomChar(PASSWORD_DIGITS), randomChar(PASSWORD_SPECIAL)]
  const allPools = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS + PASSWORD_SPECIAL
  const rest = Array.from({ length: 8 }, () => randomChar(allPools))
  const combined = [...required, ...rest]
  // Fisher-Yates shuffle so the required characters aren't always in the
  // same leading positions.
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[combined[i], combined[j]] = [combined[j], combined[i]]
  }
  return combined.join('')
}

export interface ServiceAccountPayload {
  username: string
  firstName: string
  surname: string
  userRoles: { id: string }[]
  organisationUnits: { id: string }[]
  dataViewOrganisationUnits: { id: string }[]
  password?: string
  email?: string
  invite?: boolean
}

export interface BuildServiceAccountPayloadOptions {
  username: string
  label: string
  userRoleId: string
  orgUnitIds: string[]
  credential: { method: 'invite_email'; email: string } | { method: 'temp_password'; password: string }
}

// organisationUnits (capture scope) is set to the same org units as
// dataViewOrganisationUnits -- confirmed live against play.dhis2.org that
// this is required, not optional: GET /api/dataValueSets rejects a read
// with "User is not allowed to view org unit(s)" when the org unit is only
// in dataViewOrganisationUnits, even though it's plainly a *read*, not a
// write. This is safe despite capture scope normally implying data-entry
// ability: also confirmed live that a POST to /api/dataValues from this
// account still 403s, because the role's authorities array is empty (see
// buildUserRolePayload) -- capture org units alone grant no write authority
// without the corresponding F_DATAVALUE_ADD-type authority on the role.
export function buildServiceAccountPayload(options: BuildServiceAccountPayloadOptions): ServiceAccountPayload {
  const orgUnits = options.orgUnitIds.map((id) => ({ id }))
  const payload: ServiceAccountPayload = {
    username: options.username,
    firstName: 'Data Share Hub',
    surname: `Share: ${options.label}`.slice(0, 160),
    userRoles: [{ id: options.userRoleId }],
    organisationUnits: orgUnits,
    dataViewOrganisationUnits: orgUnits,
  }
  if (options.credential.method === 'invite_email') {
    payload.email = options.credential.email
    payload.invite = true
  } else {
    payload.password = options.credential.password
  }
  return payload
}

export interface SharingObject {
  publicAccess?: string
  userGroupAccesses?: unknown[]
  userAccesses?: { id: string; access: string }[]
  external?: boolean
}

// DHIS2's read-metadata + read-data access string. Verify live before
// shipping (see README) -- this must be confirmed against a real GET
// /api/sharing response for the exact access-string convention this
// instance's DHIS2 core version uses; do not assume it's correct from
// memory alone.
export const READ_ONLY_ACCESS = 'r-r-----'

// Never blind-overwrites: takes the existing sharing object from a live GET
// and appends one userAccesses entry, preserving everything else untouched.
export function addUserAccess(existing: SharingObject, userId: string, access: string = READ_ONLY_ACCESS): SharingObject {
  const userAccesses = (existing.userAccesses ?? []).filter((ua) => ua.id !== userId)
  userAccesses.push({ id: userId, access })
  return { ...existing, userAccesses }
}

// Reverses a prior addUserAccess -- used if a share is ever deleted before
// being revoked, so the dataset's sharing doesn't accumulate stale entries
// for accounts that no longer need access. (The primary revoke mechanism is
// still disabling the account -- see README -- this is a secondary cleanup,
// not relied on as the security boundary.)
export function removeUserAccess(existing: SharingObject, userId: string): SharingObject {
  return { ...existing, userAccesses: (existing.userAccesses ?? []).filter((ua) => ua.id !== userId) }
}
