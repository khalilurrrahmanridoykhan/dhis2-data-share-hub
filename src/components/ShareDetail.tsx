import { Button, ButtonStrip, Card, NoticeBox } from '@dhis2/ui'
import type { ReactNode } from 'react'
import type { ShareRecord } from '../types/share'
import { ShareStatusTag } from './StatusTag'

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e0e0e0' }}>
      <span style={{ color: '#6e7a89' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export function ShareDetail({
  share,
  canManage,
  revoking,
  revokeError,
  onRevoke,
  onDelete,
  onMarkActive,
}: {
  share: ShareRecord
  canManage: boolean
  revoking: boolean
  revokeError: string | null
  onRevoke: () => void
  onDelete: () => void
  onMarkActive: () => void
}) {
  const { slice } = share

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{share.label}</h2>
          <p style={{ margin: 0, color: '#6e7a89' }}>
            {slice.dataSetName} · {share.method === 'csv_export' ? 'CSV export' : 'API account'}
          </p>
        </div>
        <ButtonStrip>
          {share.method === 'api_account' && share.status !== 'revoked' && canManage && (
            <Button small destructive onClick={onRevoke} loading={revoking}>
              Revoke
            </Button>
          )}
          <Button small onClick={onDelete}>
            Delete record
          </Button>
        </ButtonStrip>
      </div>

      {revokeError && (
        <NoticeBox error title="Could not revoke this share">
          {revokeError}
        </NoticeBox>
      )}

      <div>
        <ShareStatusTag status={share.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Data slice</h3>
            <SummaryRow label="Dataset" value={slice.dataSetName} />
            <SummaryRow
              label="Data elements"
              value={slice.dataElementNames.length === 0 ? 'All' : `${slice.dataElementNames.length} selected`}
            />
            <SummaryRow label="Org units" value={slice.orgUnitNames.join(', ') || 'None'} />
            <SummaryRow label="Date range" value={`${slice.startDate} – ${slice.endDate}`} />
          </div>
        </Card>

        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Sharing</h3>
            <SummaryRow label="Recipient / notes" value={share.recipientNote ?? 'Not specified'} />
            {share.method === 'api_account' && (
              <>
                <SummaryRow label="Service account" value={share.serviceAccountUsername ?? 'Not specified'} />
                <SummaryRow
                  label="Credential delivery"
                  value={
                    share.credentialDeliveryMethod === 'invite_email'
                      ? `Email invite to ${share.recipientEmail}`
                      : share.credentialDeliveryMethod === 'temp_password'
                        ? 'One-time temporary password (shown once at creation)'
                        : 'Not specified'
                  }
                />
              </>
            )}
            <SummaryRow label="Created" value={`${share.createdAt.slice(0, 10)} by ${share.createdBy}`} />
            {share.revokedAt && <SummaryRow label="Revoked" value={`${share.revokedAt.slice(0, 10)} by ${share.revokedBy}`} />}
          </div>
        </Card>
      </div>

      {share.method === 'api_account' && share.status === 'account_created' && (
        <NoticeBox warning title="One manual step left">
          <p style={{ marginTop: 0 }}>
            DHIS2 personal access tokens are self-service only -- there is no API for creating one on behalf of another
            account. To finish this share, log in once as <strong>{share.serviceAccountUsername}</strong> and generate
            its token from Profile → API tokens.
          </p>
          <p>
            Confirmed live: this account may not be able to open Data Share Hub itself from DHIS2's own menu, even
            though its login and data access both work correctly. It can always reach the login page and its own
            Profile, which is all it needs -- don't rely on it opening this app. If you didn't already send full
            instructions when this share was created, you'll need to relay the login and steps to them directly.
          </p>
          {canManage && (
            <Button small onClick={onMarkActive}>
              I've done this -- mark Active
            </Button>
          )}
        </NoticeBox>
      )}

      {share.method === 'csv_export' && (
        <p style={{ fontSize: 12, color: '#a0a7ae', margin: 0 }}>
          This is a log entry of a completed export -- there is no ongoing account to revoke.
        </p>
      )}
    </div>
  )
}
