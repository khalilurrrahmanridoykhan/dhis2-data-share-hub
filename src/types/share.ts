// Runtime, admin-defined -- same philosophy as Data Quality Auditor's
// AuditConfig: nothing bundled, everything created through this app's own
// UI, persisted in this instance's own dataStore. See lib/dataStore.ts.

export type ShareMethod = 'csv_export' | 'api_account'

// account_created: service account exists, data-view scope set, dataset
//   sharing configured -- waiting on the recipient to log in once and mint
//   their own PAT. This app cannot do that step for them: DHIS2 personal
//   access tokens are self-service only (confirmed against DHIS2's own
//   docs), there is no API for an admin to mint a token on behalf of
//   another account.
// active: admin has manually confirmed the recipient generated their own
//   token. This is a self-reported flag, not something this app can verify
//   -- it has no way to know whether a PAT exists for another account.
//   Stated as such in the UI, not hidden behind false confidence.
// revoked: service account has been disabled (PATCH /api/users/{id},
//   disabled: true). The reliable, documented revoke mechanism -- see
//   README for why this is used instead of deleting a specific PAT
//   (whether an admin can delete another user's PAT via API is unconfirmed).
export type ShareStatus = 'draft' | 'account_created' | 'active' | 'revoked'

export interface DataSlice {
  dataSetId: string
  dataSetName: string
  periodType: string
  // Empty array = "all data elements in the dataset". Deliberately NOT
  // filtered to numeric value types the way Data Quality Auditor's
  // AuditConfig is -- that constraint exists there to feed arithmetic
  // quality checks; a data share has no such reason to exclude
  // text/boolean elements.
  dataElementIds: string[]
  dataElementNames: string[]
  orgUnitIds: string[]
  orgUnitNames: string[]
  startDate: string // ISO date, yyyy-MM-dd
  endDate: string
}

export type CredentialDeliveryMethod = 'invite_email' | 'temp_password'

export interface ShareRecord {
  id: string
  label: string
  recipientNote: string | null
  method: ShareMethod
  slice: DataSlice

  // api_account-only fields; null for csv_export records.
  serviceAccountUsername: string | null
  serviceAccountUserId: string | null
  userRoleId: string | null
  credentialDeliveryMethod: CredentialDeliveryMethod | null
  recipientEmail: string | null

  status: ShareStatus
  createdAt: string
  createdBy: string
  revokedAt: string | null
  revokedBy: string | null
}

export const SHARE_HUB_ROLE_NAME = 'Data Share Hub - Read Only'

export function newShareId(): string {
  return crypto.randomUUID()
}
