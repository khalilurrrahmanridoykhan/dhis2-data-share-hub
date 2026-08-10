import { useConfig } from '@dhis2/app-runtime'
import { Button, ButtonStrip, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import type { DataSlice } from '../types/share'

// Shows a generated temporary password exactly once. It is never persisted
// anywhere in this app's dataStore record -- once this modal closes, this
// component's local state is the only place it ever existed on this side.
//
// This is also the ONLY reliable place this information reaches anyone:
// confirmed live that a zero-authority service account cannot open Data
// Share Hub itself from DHIS2's own app menu, even though the account, its
// data access, and the app's URL all work correctly. The shared role now
// grants Dashboard + Data Visualizer visibility instead (see
// lib/serviceAccount.ts's buildUserRolePayload) so the recipient can
// actually browse their shared data using DHIS2's own native tools after
// logging in -- but Data Share Hub itself stays unreachable to them (the
// only authority that unlocks custom-app visibility at all is
// M_dhis-web-app-management, which is far too broad to grant a read-only
// recipient). So this modal is written to be self-sufficient regardless:
// everything the recipient needs is here, so the admin can hand it off
// directly (email, chat, however) without depending on them ever opening
// this app.
export function CredentialHandoff({
  username,
  password,
  slice,
  onDone,
}: {
  username: string
  password: string
  slice: DataSlice
  onDone: () => void
}) {
  const { baseUrl, apiVersion } = useConfig()
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  const exampleUrl = `${baseUrl}/api/${apiVersion}/dataValueSets.json?dataSet=${slice.dataSetId}&${slice.orgUnitIds
    .map((id) => `orgUnit=${id}`)
    .join('&')}&startDate=${slice.startDate}&endDate=${slice.endDate}`

  const fullInstructions = [
    `You've been given read access to "${slice.dataSetName}" in DHIS2 (org units: ${slice.orgUnitNames.join(', ')}, ${slice.startDate} to ${slice.endDate}).`,
    '',
    `Username: ${username}`,
    `Temporary password: ${password}`,
    '',
    `1. Log in at: ${baseUrl}`,
    '2. Change your password when prompted.',
    '3. Click your avatar (top right) -> Profile.',
    '4. Find "API tokens" and generate a new one.',
    '5. Use that token in your own tools with an "Authorization: ApiToken <your token>" header -- not this password.',
    '',
    'Example request for exactly the data shared with you:',
    exampleUrl,
    '',
    'To browse the data visually instead: after logging in, open the Dashboard or Data Visualizer app from the DHIS2 menu -- both are enabled for this account.',
    '',
    'Note: this account will not show up in the DHIS2 app menu/search for Data Share Hub itself -- that is expected. It only needs the login page, Profile, Dashboard, and Data Visualizer, all of which work.',
  ].join('\n')

  async function handleCopyPassword() {
    await navigator.clipboard.writeText(password)
    setCopiedPassword(true)
  }

  async function handleCopyAll() {
    await navigator.clipboard.writeText(fullInstructions)
    setCopiedAll(true)
  }

  return (
    <Modal onClose={onDone} large position="middle">
      <ModalTitle>Account created -- one manual step left</ModalTitle>
      <ModalContent>
        <NoticeBox warning title="This password is shown once and is not saved anywhere">
          DHIS2 personal access tokens can only be created by the account itself logging in -- there is no API for
          creating one on behalf of another user. Share this temporary password with whoever will administer this
          account, have them log in once, change the password, and generate their own token from Profile → API
          tokens.
        </NoticeBox>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <strong>Username:</strong> {username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>Temporary password:</strong>
            <code
              style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: 4, fontSize: 14, letterSpacing: 0.5 }}
            >
              {password}
            </code>
            <Button small onClick={handleCopyPassword}>
              {copiedPassword ? 'Copied' : 'Copy password'}
            </Button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <NoticeBox title="This account can browse the data in Dashboard / Data Visualizer, but not open Data Share Hub itself">
            Confirmed live: a truly zero-authority account can't open ANY custom app in DHIS2 (a platform limitation,
            not something fixable from this app's side) -- so this account is instead given access to DHIS2's own
            native Dashboard and Data Visualizer apps, which is enough to explore the shared data visually. It also
            always has the login page and its own Profile, which is all it needs to generate a token. Use the copy
            button below to send the recipient everything they need directly.
          </NoticeBox>
          <div style={{ marginTop: 8 }}>
            <Button onClick={handleCopyAll}>{copiedAll ? 'Copied full instructions' : 'Copy full instructions to send'}</Button>
          </div>
        </div>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button primary onClick={onDone}>
            Done
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  )
}
