import { useConfig } from '@dhis2/app-runtime'
import { Button, ButtonStrip, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import type { DataSlice } from '../types/share'

// Shows a generated temporary password exactly once. It is never persisted
// anywhere in this app's dataStore record -- once this modal closes, this
// component's local state is the only place it ever existed on this side.
//
// This is also the ONLY reliable place this information reaches anyone:
// confirmed live that a zero-authority service account like this one cannot
// actually open Data Share Hub itself from DHIS2's own app menu, even
// though the account, its data access, and the app's URL all work
// correctly. DHIS2's app-menu visibility check for custom (non-core) apps
// declaring "no restriction" still appears to require the requesting
// account to already have some app-specific authority -- confirmed by
// testing three different authorities live, only an app's own exact
// authority unlocked visibility for that one app, and no authority was
// found that unlocks a custom app whose manifest declares none required.
// Rather than keep guessing at undocumented platform behavior, this modal
// is written to be self-sufficient: everything the recipient needs is here,
// so the admin can hand it off directly (email, chat, however) without
// depending on the recipient ever successfully opening this app.
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
    'Note: this account may not show up in the DHIS2 app menu/search -- that is expected. Steps 1-4 above use only the login page and your own Profile, which will work.',
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
          <NoticeBox title="This account may not appear in the DHIS2 app menu -- that's expected">
            Confirmed live: a newly-created, minimal-permission account like this one can authenticate and its data
            access works correctly, but it may not be able to open custom apps (including Data Share Hub itself)
            from DHIS2's own menu or search. It CAN always reach the login page and its own Profile, which is all it
            needs to generate a token. Don't rely on the recipient being able to open Data Share Hub -- use the copy
            button below to send them everything directly instead.
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
