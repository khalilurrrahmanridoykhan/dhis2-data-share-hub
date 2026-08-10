import { useConfig } from '@dhis2/app-runtime'
import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import { useRecipientData } from '../hooks/useRecipientData'
import type { ShareRecord } from '../types/share'

// Shown instead of the admin registry when the currently logged-in account
// IS one of the service accounts this app created for an api_account share
// -- detected in App.tsx by matching the logged-in username against
// ShareRecord.serviceAccountUsername. This keeps the recipient from ever
// seeing the full admin share registry (other shares, other recipients'
// notes) -- they only ever see their own single share.
export function RecipientView({ share }: { share: ShareRecord }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, maxWidth: 1000 }}>
      <div>
        <h2 style={{ margin: '0 0 4px' }}>You have read access to: {share.slice.dataSetName}</h2>
        <p style={{ margin: 0, color: '#6e7a89' }}>
          Org units: {share.slice.orgUnitNames.join(', ')} · {share.slice.startDate} – {share.slice.endDate}
        </p>
        {share.recipientNote && <p style={{ margin: '4px 0 0', color: '#6e7a89' }}>Note: {share.recipientNote}</p>}
      </div>

      <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Get your own API token</h3>
        <p>
          This login (username + temporary password) works, but it's meant to be used once to set yourself up
          properly:
        </p>
        <ol>
          <li>
            Click your avatar in the top-right corner → <strong>Profile</strong>
          </li>
          <li>Change your password if you haven't already</li>
          <li>
            Find <strong>API tokens</strong> and generate a new one
          </li>
          <li>
            Use it in your own tools with an <code>Authorization: ApiToken &lt;your token&gt;</code> header --{' '}
            <strong>not</strong> this username/password, and not anyone else's token
          </li>
        </ol>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Example request for exactly the data shared with you:</div>
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
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3>Your data</h3>
        <p style={{ color: '#6e7a89', fontSize: 13, marginTop: -8 }}>
          Fetched live, right now, using your own account -- this is a working demonstration that your access is
          already active, not a preview.
        </p>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <CircularLoader small />
          </div>
        ) : error ? (
          <NoticeBox error title="Could not load your data">
            {error}
          </NoticeBox>
        ) : points.length === 0 ? (
          <NoticeBox title="No data values found">
            No data values were returned for this dataset, org units, and date range yet.
          </NoticeBox>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: 8 }}>Data element</th>
                  <th style={{ padding: 8 }}>Period</th>
                  <th style={{ padding: 8 }}>Org unit</th>
                  <th style={{ padding: 8 }}>Category</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Value</th>
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
    </div>
  )
}
