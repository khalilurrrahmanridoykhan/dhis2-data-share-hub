import { Button, ButtonStrip, Card, NoticeBox } from '@dhis2/ui'
import type { ReactNode } from 'react'
import i18n from '../locales'
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
  siblingCount,
  canManage,
  revoking,
  revokeError,
  onRevoke,
  onDelete,
  onMarkActive,
}: {
  share: ShareRecord
  // How many OTHER active shares use the same service account right now --
  // 0 for csv_export shares (siblingCount is meaningless there). Drives
  // both the "Shared with" row below and the revoke button's caption, so
  // an admin never mistakes a shared-account revoke for a full cutoff or
  // vice versa.
  siblingCount: number
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
            {slice.dataSetName} · {share.method === 'csv_export' ? i18n.t('CSV export') : i18n.t('API account')}
          </p>
        </div>
        <ButtonStrip>
          {share.method === 'api_account' && share.status !== 'revoked' && canManage && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <Button small destructive onClick={onRevoke} loading={revoking}>
                {i18n.t('Revoke')}
              </Button>
              <span style={{ fontSize: 11, color: '#a0a7ae' }}>
                {siblingCount > 0 ? i18n.t('Removes only this share’s access') : i18n.t('Also offers to disable the account')}
              </span>
            </div>
          )}
          <Button small onClick={onDelete}>
            {i18n.t('Delete record')}
          </Button>
        </ButtonStrip>
      </div>

      {revokeError && (
        <NoticeBox error title={i18n.t('Could not revoke this share')}>
          {revokeError}
        </NoticeBox>
      )}

      <div>
        <ShareStatusTag status={share.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>{i18n.t('Data slice')}</h3>
            <SummaryRow label={i18n.t('Dataset')} value={slice.dataSetName} />
            <SummaryRow
              label={i18n.t('Data elements')}
              value={slice.dataElementNames.length === 0 ? i18n.t('All') : i18n.t('{{count}} selected', { count: slice.dataElementNames.length })}
            />
            <SummaryRow label={i18n.t('Org units')} value={slice.orgUnitNames.join(', ') || i18n.t('None')} />
            <SummaryRow label={i18n.t('Date range')} value={`${slice.startDate} – ${slice.endDate}`} />
          </div>
        </Card>

        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>{i18n.t('Sharing')}</h3>
            <SummaryRow label={i18n.t('Recipient / notes')} value={share.recipientNote ?? i18n.t('Not specified')} />
            {share.method === 'api_account' && (
              <>
                <SummaryRow label={i18n.t('Service account')} value={share.serviceAccountUsername ?? i18n.t('Not specified')} />
                <SummaryRow
                  label={i18n.t('Account usage')}
                  value={share.accountOrigin === 'attached' ? i18n.t('Attached to an existing account') : i18n.t('Created for this share')}
                />
                <SummaryRow
                  label={i18n.t('Shared with')}
                  value={
                    siblingCount > 0
                      ? i18n.t('{{count}} other active share(s) use this account', { count: siblingCount })
                      : share.status === 'revoked'
                        ? i18n.t('N/A -- revoked')
                        : i18n.t('This share is currently the only one using this account')
                  }
                />
                <SummaryRow
                  label={i18n.t('Credential delivery')}
                  value={
                    share.credentialDeliveryMethod === 'invite_email'
                      ? i18n.t('Email invite to {{email}}', { email: share.recipientEmail })
                      : share.credentialDeliveryMethod === 'temp_password'
                        ? i18n.t('One-time temporary password (shown once at creation)')
                        : i18n.t('Not specified')
                  }
                />
                <SummaryRow
                  label={i18n.t("Recipient's dashboard")}
                  value={
                    share.dashboardUrl ? (
                      <a href={share.dashboardUrl} target="_blank" rel="noreferrer">
                        {i18n.t('Open link')}
                      </a>
                    ) : (
                      i18n.t('Not created')
                    )
                  }
                />
              </>
            )}
            <SummaryRow label={i18n.t('Created')} value={i18n.t('{{date}} by {{by}}', { date: share.createdAt.slice(0, 10), by: share.createdBy })} />
            {share.revokedAt && (
              <SummaryRow
                label={i18n.t('Revoked')}
                value={i18n.t('{{date}} by {{by}}', { date: share.revokedAt.slice(0, 10), by: share.revokedBy })}
              />
            )}
          </div>
        </Card>
      </div>

      {share.method === 'api_account' && share.status === 'account_created' && (
        <NoticeBox warning title={i18n.t('One manual step left')}>
          <p style={{ marginTop: 0 }}>
            {i18n.t(
              'DHIS2 personal access tokens are self-service only -- there is no API for creating one on behalf of another account. To finish this share, log in once as',
            )}{' '}
            <strong>{share.serviceAccountUsername}</strong> {i18n.t('and generate its token from Profile → API tokens.')}
          </p>
          <p>
            {i18n.t(
              "This account can browse the data in DHIS2's own Dashboard and Data Visualizer apps, but confirmed live it can't open Data Share Hub itself from DHIS2's own menu (a platform limitation, not fixable here). It can always reach the login page, Profile, Dashboard, and Data Visualizer. If you didn't already send full instructions when this share was created, you'll need to relay the login and steps to them directly.",
            )}
          </p>
          {canManage && (
            <Button small onClick={onMarkActive}>
              {i18n.t("I've done this -- mark Active")}
            </Button>
          )}
        </NoticeBox>
      )}

      {share.method === 'csv_export' && (
        <p style={{ fontSize: 12, color: '#a0a7ae', margin: 0 }}>
          {i18n.t('This is a log entry of a completed export -- there is no ongoing account to revoke.')}
        </p>
      )}
    </div>
  )
}
