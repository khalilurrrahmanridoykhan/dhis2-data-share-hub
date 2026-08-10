import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import { buildDashboardPayload, buildDashboardUrl, buildVisualizationPayload, DASHBOARD_READ_ACCESS } from '../lib/dashboard'
import {
  READ_ONLY_ACCESS,
  addUserAccess,
  buildServiceAccountPayload,
  buildUserRolePayload,
  generateServiceUsername,
  generateTempPassword,
  type SharingObject,
} from '../lib/serviceAccount'
import { SHARE_HUB_ROLE_NAME } from '../types/share'
import { useShareHubSettings } from './useShareHubSettings'

export type CredentialChoice = { method: 'invite_email'; email: string } | { method: 'temp_password' }

export interface CreateServiceAccountParams {
  label: string
  orgUnitIds: string[]
  dataSetId: string
  // The data elements to grant AND to visualize on the recipient's
  // dedicated dashboard. Resolved by the caller: slice.dataElementIds if
  // specific ones were picked, otherwise every data element in the dataset
  // (an empty slice.dataElementIds means "all" for CSV/table display, but a
  // dashboard visualization needs a concrete list either way).
  dataElementIds: string[]
  credential: CredentialChoice
}

export interface CreateServiceAccountOutcome {
  username: string
  userId: string
  roleId: string
  tempPassword: string | null // only ever held in memory, never persisted
  dashboardId: string | null
  dashboardUrl: string | null
}

interface State {
  creating: boolean
  error: string | null
}

type Engine = ReturnType<typeof useDataEngine>

interface RoleSearchResponse {
  roles: { userRoles: { id: string; authorities: string[] }[] }
}

interface RoleGetResponse {
  role: { id: string; authorities: string[] }
}

// engine.mutate() returns the raw API response body directly -- unlike
// engine.query(), there is no alias-dictionary wrapper (mutate() operates on
// exactly one resource, so there's nothing to key by). Confirmed live: a
// real POST /api/userRoles response is
// {"httpStatus":"Created",...,"response":{"uid":"...","klass":"...",...}}.
interface CreateResponse {
  response?: { uid?: string }
}

// Confirmed live against play.dhis2.org: GET /api/sharing?type=...&id=...
// returns { meta: { allowPublicAccess }, object: { publicAccess,
// userGroupAccesses, userAccesses, ... } } -- the sharing fields are nested
// under `object`, not returned flat at the top level as first assumed.
interface SharingGetResponse {
  sharing: { object: SharingObject }
}

function sameAuthorities(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((x) => setB.has(x))
}

// Keeps an already-existing role's authorities in sync with
// buildUserRolePayload() rather than trusting whatever it happened to have
// when first created. This matters in practice: this app originally shipped
// the shared role with an empty authorities array, then added Dashboard/
// Data Visualizer visibility after discovering that a zero-authority account
// can't open ANY custom app (including this one) from DHIS2's own menu --
// without this sync, a role created before that change would silently keep
// its stale, more-restrictive authorities forever, since it's found by
// name/cached id and never otherwise re-examined.
async function ensureRoleAuthorities(engine: Engine, roleId: string, currentAuthorities: string[]): Promise<void> {
  const desired = buildUserRolePayload().authorities
  if (sameAuthorities(currentAuthorities, desired)) return
  await engine.mutate({
    resource: 'userRoles',
    id: roleId,
    type: 'update',
    partial: true,
    data: { authorities: desired },
  })
}

async function findOrCreateRole(engine: Engine, cachedRoleId: string | null): Promise<string> {
  if (cachedRoleId) {
    const roleResponse = (await engine.query({
      role: { resource: `userRoles/${cachedRoleId}`, params: { fields: 'id,authorities' } },
    })) as unknown as RoleGetResponse
    await ensureRoleAuthorities(engine, cachedRoleId, roleResponse.role.authorities)
    return cachedRoleId
  }

  const searchResponse = (await engine.query({
    roles: {
      resource: 'userRoles',
      params: { filter: `name:eq:${SHARE_HUB_ROLE_NAME}`, fields: 'id,authorities' },
    },
  })) as unknown as RoleSearchResponse
  const existing = searchResponse.roles.userRoles[0]
  if (existing) {
    await ensureRoleAuthorities(engine, existing.id, existing.authorities)
    return existing.id
  }

  const createResponse = (await engine.mutate({
    resource: 'userRoles',
    type: 'create',
    data: buildUserRolePayload(),
  })) as unknown as CreateResponse
  const roleId = createResponse.response?.uid
  if (!roleId) throw new Error('Could not determine the created role id from the server response.')
  return roleId
}

// Creates a private pivot-table dashboard scoped to exactly this share's
// data and shares it with the recipient -- see lib/dashboard.ts for why
// this exists (Dashboard/Data Visualizer app access alone shows every
// dashboard already visible on the instance, not just this recipient's
// data). Deliberately isolated in its own try/catch: a dashboard is a
// visualization convenience, not the security-relevant part of the share
// (the account and its dataset access already work without it), so a
// failure here must not fail account creation itself.
async function createRecipientDashboard(
  engine: Engine,
  baseUrl: string,
  label: string,
  dataElementIds: string[],
  orgUnitIds: string[],
  userId: string,
): Promise<{ dashboardId: string | null; dashboardUrl: string | null }> {
  // Caller has already filtered to visualizable value types (see
  // ApiShareForm.tsx) -- if that leaves nothing (e.g. a dataset made
  // entirely of file uploads or text fields), don't attempt to create a
  // pivot table with an empty dx dimension. Unlike a real API error, an
  // empty dimension can succeed at creation time and only break when
  // viewed, so this has to be checked up front rather than left to the
  // try/catch below.
  if (dataElementIds.length === 0) return { dashboardId: null, dashboardUrl: null }

  try {
    const visResponse = (await engine.mutate({
      resource: 'visualizations',
      type: 'create',
      data: buildVisualizationPayload(label, dataElementIds, orgUnitIds),
    })) as unknown as CreateResponse
    const visualizationId = visResponse.response?.uid
    if (!visualizationId) return { dashboardId: null, dashboardUrl: null }

    const dashResponse = (await engine.mutate({
      resource: 'dashboards',
      type: 'create',
      data: buildDashboardPayload(label, visualizationId, baseUrl),
    })) as unknown as CreateResponse
    const dashboardId = dashResponse.response?.uid
    if (!dashboardId) return { dashboardId: null, dashboardUrl: null }

    // Confirmed live: a freshly-created dashboard defaults to fully
    // private, but read-then-append here anyway rather than trusting that
    // default blindly.
    const sharingResponse = (await engine.query({
      sharing: { resource: 'sharing', params: { type: 'dashboard', id: dashboardId } },
    })) as unknown as SharingGetResponse
    const nextSharing = addUserAccess(sharingResponse.sharing.object, userId, DASHBOARD_READ_ACCESS)
    await engine.mutate({
      resource: 'sharing',
      type: 'create',
      params: { type: 'dashboard', id: dashboardId },
      data: { object: nextSharing },
    })

    return { dashboardId, dashboardUrl: buildDashboardUrl(baseUrl, dashboardId) }
  } catch {
    return { dashboardId: null, dashboardUrl: null }
  }
}

// Orchestrates the honest, partially-automated API-sharing flow (README
// spells out the full rationale): creates a scoped read-only service
// account, grants it read access to the dataset, and builds a dedicated
// private dashboard for the recipient. Does NOT and cannot mint that
// account's own API token -- DHIS2 personal access tokens are self-service
// only, confirmed against DHIS2's own documentation. The caller is
// responsible for showing the recipient/admin the one remaining manual step.
export function useCreateServiceAccount() {
  const engine = useDataEngine()
  const { baseUrl } = useConfig()
  const { minimalRoleId, setMinimalRoleId } = useShareHubSettings()
  const [state, setState] = useState<State>({ creating: false, error: null })

  const createShare = useCallback(
    async (params: CreateServiceAccountParams): Promise<CreateServiceAccountOutcome | null> => {
      setState({ creating: true, error: null })
      try {
        const roleId = await findOrCreateRole(engine, minimalRoleId)
        if (roleId !== minimalRoleId) await setMinimalRoleId(roleId)

        const username = generateServiceUsername(params.label)
        const tempPassword = params.credential.method === 'temp_password' ? generateTempPassword() : null

        const userPayload = buildServiceAccountPayload({
          username,
          label: params.label,
          userRoleId: roleId,
          orgUnitIds: params.orgUnitIds,
          credential:
            params.credential.method === 'invite_email'
              ? { method: 'invite_email', email: params.credential.email }
              : { method: 'temp_password', password: tempPassword! },
        })

        // Verify live: exact required-field list and validation-error shape
        // vary by instance password policy -- surface any 400 verbatim.
        const userCreateResponse = (await engine.mutate({
          resource: 'users',
          type: 'create',
          data: userPayload,
        })) as unknown as CreateResponse
        const userId = userCreateResponse.response?.uid
        if (!userId) throw new Error('Could not determine the created service account id from the server response.')

        // Read-then-append: never blind-overwrite the dataset's existing
        // sharing settings.
        const sharingResponse = (await engine.query({
          sharing: { resource: 'sharing', params: { type: 'dataSet', id: params.dataSetId } },
        })) as unknown as SharingGetResponse
        const nextSharing = addUserAccess(sharingResponse.sharing.object, userId, READ_ONLY_ACCESS)

        // Request-body wrapper shape ({ object: ... }) confirmed live.
        await engine.mutate({
          resource: 'sharing',
          type: 'create',
          params: { type: 'dataSet', id: params.dataSetId },
          data: { object: nextSharing },
        })

        const { dashboardId, dashboardUrl } = await createRecipientDashboard(
          engine,
          baseUrl,
          params.label,
          params.dataElementIds,
          params.orgUnitIds,
          userId,
        )

        setState({ creating: false, error: null })
        return { username, userId, roleId, tempPassword, dashboardId, dashboardUrl }
      } catch (error) {
        setState({ creating: false, error: error instanceof Error ? error.message : String(error) })
        return null
      }
    },
    [engine, baseUrl, minimalRoleId, setMinimalRoleId],
  )

  return { ...state, createShare }
}
