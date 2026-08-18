import { useConfig } from '@dhis2/app-runtime'
import { Button, CircularLoader, NoticeBox, SegmentedControl } from '@dhis2/ui'
import { useState } from 'react'
import { useRecipientData } from '../hooks/useRecipientData'
import i18n from '../locales'
import type { ShareRecord } from '../types/share'

// Shown instead of the admin registry when the currently logged-in account
// IS one of the service accounts this app created for an api_account share
// -- detected in App.tsx by matching the logged-in username against
// ShareRecord.serviceAccountUsername. This keeps the recipient from ever
// seeing the full admin share registry (other shares, other recipients'
// notes) -- they only ever see their own share(s). `shares` can now have
// more than one entry: since one account can be attached to several
// shares, a recipient logging in may have multiple active shares, not just
// the first one (a direct consequence of the attach-existing-account
// feature -- see useCreateServiceAccount.ts).
export function RecipientView({ shares }: { shares: ShareRecord[] }) {
  const [selectedId, setSelectedId] = useState(shares[0].id)
  const share = shares.find((s) => s.id === selectedId) ?? shares[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, maxWidth: 1000 }}>
      {shares.length > 1 && (
        <SegmentedControl
          options={shares.map((s) => ({ label: s.label, value: s.id }))}
          selected={selectedId}
          onChange={({ value }) => setSelectedId(value)}
        />
      )}
      <RecipientShareView share={share} />
    </div>
  )
}

function RecipientShareView({ share }: { share: ShareRecord }) {
  const { baseUrl, apiVersion } = useConfig()
  const { loading, error, points } = useRecipientData(share)
  const [copied, setCopied] = useState(false)

  const exampleUrl = `${baseUrl}/api/${apiVersion}/dataValueSets.json?dataSet=${share.slice.dataSetId}&${share.slice.orgUnitIds
    .map((id) => `orgUnit=${id}`)
    .join('&')}&startDate=${share.slice.startDate}&endDate=${share.slice.endDate}`

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(exampleUrl)
    setCopied(true)
  }

  return (
    <>
      <div>
        <h2 style={{ margin: '0 0 4px' }}>{i18n.t('You have read access to -- {{dataSetName}}', { dataSetName: share.slice.dataSetName })}</h2>
        <p style={{ margin: 0, color: '#6e7a89' }}>
          {i18n.t('Org units -- {{orgUnits}} · {{startDate}} – {{endDate}}', {
            orgUnits: share.slice.orgUnitNames.join(', '),
            startDate: share.slice.startDate,
            endDate: share.slice.endDate,
          })}
        </p>
        {share.recipientNote && (
          <p style={{ margin: '4px 0 0', color: '#6e7a89' }}>{i18n.t('Note -- {{note}}', { note: share.recipientNote })}</p>
        )}
      </div>

      <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{i18n.t('Get your own API token')}</h3>
        <p>{i18n.t("This login (username + temporary password) works, but it's meant to be used once to set yourself up properly --")}</p>
        <ol>
          <li>
            {i18n.t('Click your avatar in the top-right corner →')} <strong>{i18n.t('Profile')}</strong>
          </li>
          <li>{i18n.t("Change your password if you haven't already")}</li>
          <li>
            {i18n.t('Find')} <strong>{i18n.t('API tokens')}</strong> {i18n.t('and generate a new one')}
          </li>
          <li>
            {i18n.t('Use it in your own tools with an')} <code>Authorization: ApiToken &lt;your token&gt;</code>{' '}
            {i18n.t('header --')} <strong>{i18n.t('not')}</strong> {i18n.t("this username/password, and not anyone else's token")}
          </li>
        </ol>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{i18n.t('Example request for exactly the data shared with you --')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code
              style={{
                background: '#f0f0f0',
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 12,
                wordBreak: 'break-all',
                flex: 1,
              }}
            >
              {exampleUrl}
            </code>
            <Button small onClick={handleCopyUrl}>
              {copied ? i18n.t('Copied') : i18n.t('Copy')}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3>{i18n.t('Your data')}</h3>
        <p style={{ color: '#6e7a89', fontSize: 13, marginTop: -8 }}>
          {i18n.t(
            'Fetched live, right now, using your own account -- this is a working demonstration that your access is already active, not a preview.',
          )}
        </p>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <CircularLoader small />
          </div>
        ) : error ? (
          <NoticeBox error title={i18n.t('Could not load your data')}>
            {error}
          </NoticeBox>
        ) : points.length === 0 ? (
          <NoticeBox title={i18n.t('No data values found')}>
            {i18n.t('No data values were returned for this dataset, org units, and date range yet.')}
          </NoticeBox>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: 8 }}>{i18n.t('Data element')}</th>
                  <th style={{ padding: 8 }}>{i18n.t('Period')}</th>
                  <th style={{ padding: 8 }}>{i18n.t('Org unit')}</th>
                  <th style={{ padding: 8 }}>{i18n.t('Category')}</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>{i18n.t('Value')}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: 8 }}>{p.dataElementName}</td>
                    <td style={{ padding: 8 }}>{p.period}</td>
                    <td style={{ padding: 8 }}>{p.orgUnitName}</td>
                    <td style={{ padding: 8 }}>{p.categoryOptionCombo}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
