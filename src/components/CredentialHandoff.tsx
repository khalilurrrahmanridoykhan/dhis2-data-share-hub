import { useConfig } from '@dhis2/app-runtime'
import { Button, ButtonStrip, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import i18n from '../locales'
import type { DataSlice } from '../types/share'

// Shows a generated temporary password exactly once. It is never persisted
// anywhere in this app's dataStore record -- once this modal closes, this
// component's local state is the only place it ever existed on this side.
//
// This is also the ONLY reliable place this information reaches anyone:
// confirmed live that a zero-authority service account cannot open Data
// Share Hub itself from DHIS2's own app menu, even though the account, its
// data access, and the app's URL all work correctly. The shared role also
// grants Dashboard + Data Visualizer visibility (see
// lib/serviceAccount.ts's buildUserRolePayload) -- but that alone would
// only let the recipient open those general-purpose apps and see EVERY
// dashboard already public on the instance, not just their own data. So
// this app also builds a dedicated, private pivot-table dashboard scoped to
// exactly this share (see lib/dashboard.ts) and shares only that one with
// the recipient -- dashboardUrl is the direct link to it.
export function CredentialHandoff({
  username,
  password,
  slice,
  dashboardUrl,
  onDone,
}: {
  username: string
  password: string
  slice: DataSlice
  dashboardUrl: string | null
  onDone: () => void
}) {
  const { baseUrl, apiVersion } = useConfig()
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  const exampleUrl = `${baseUrl}/api/${apiVersion}/dataValueSets.json?dataSet=${slice.dataSetId}&${slice.orgUnitIds
    .map((id) => `orgUnit=${id}`)
    .join('&')}&startDate=${slice.startDate}&endDate=${slice.endDate}`

  const fullInstructions = [
    i18n.t('You\'ve been given read access to "{{dataSetName}}" in DHIS2 (org units -- {{orgUnits}}, {{startDate}} to {{endDate}}).', {
      dataSetName: slice.dataSetName,
      orgUnits: slice.orgUnitNames.join(', '),
      startDate: slice.startDate,
      endDate: slice.endDate,
    }),
    '',
    i18n.t('Username -- {{username}}', { username }),
    i18n.t('Temporary password -- {{password}}', { password }),
    '',
    i18n.t('1. Log in at -- {{baseUrl}}', { baseUrl }),
    i18n.t('2. Change your password when prompted.'),
    i18n.t('3. Click your avatar (top right) -> Profile.'),
    i18n.t('4. Find "API tokens" and generate a new one.'),
    // The header name/value syntax ("Authorization: ApiToken ...") is HTTP
    // protocol syntax, not prose -- left untranslated (like a code sample)
    // so the colon inside it never lands inside an i18n.t() key, which
    // i18next's default extraction otherwise misparses as a namespace
    // separator (silently dropping the whole string).
    `${i18n.t('5. Use that token in your own tools with an')} "Authorization: ApiToken <your token>" ${i18n.t(
      'header -- not this password.',
    )}`,
    '',
    i18n.t('Example request for exactly the data shared with you --'),
    exampleUrl,
    '',
    ...(dashboardUrl
      ? [
          i18n.t('To browse the data visually instead, open your dedicated dashboard (bookmark this) -- {{dashboardUrl}}', { dashboardUrl }),
          '',
        ]
      : [
          i18n.t('To browse the data visually instead -- after logging in, open the Dashboard or Data Visualizer app from the DHIS2 menu.'),
          '',
        ]),
    i18n.t(
      'Note -- this account will not show up in the DHIS2 app menu/search for Data Share Hub itself -- that is expected. It only needs the login page, Profile, and the dashboard link above, all of which work.',
    ),
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
      <ModalTitle>{i18n.t('Account created -- one manual step left')}</ModalTitle>
      <ModalContent>
        <NoticeBox warning title={i18n.t('This password is shown once and is not saved anywhere')}>
          {i18n.t(
            'DHIS2 personal access tokens can only be created by the account itself logging in -- there is no API for creating one on behalf of another user. Share this temporary password with whoever will administer this account, have them log in once, change the password, and generate their own token from Profile → API tokens.',
          )}
        </NoticeBox>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <strong>{i18n.t('Username --')}</strong> {username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{i18n.t('Temporary password --')}</strong>
            <code
              style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: 4, fontSize: 14, letterSpacing: 0.5 }}
            >
              {password}
            </code>
            <Button small onClick={handleCopyPassword}>
              {copiedPassword ? i18n.t('Copied') : i18n.t('Copy password')}
            </Button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {dashboardUrl ? (
            <NoticeBox title={i18n.t('A dedicated dashboard was created for this share')}>
              {i18n.t(
                "This dashboard shows only the data included in this share -- not the general Dashboard app, which would also show every other dashboard already public on this instance. It also includes the token-generation steps directly on the page, so the recipient has them even if this message doesn't reach them. Send the recipient this exact link --",
              )}
              <div style={{ marginTop: 8 }}>
                <code style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: 4, fontSize: 12, wordBreak: 'break-all' }}>
                  {dashboardUrl}
                </code>
              </div>
            </NoticeBox>
          ) : (
            <NoticeBox warning title={i18n.t('Could not create a dedicated dashboard for this share')}>
              {i18n.t(
                'The service account and its data access were created successfully, but building a personalized dashboard failed. The recipient can still use the general Dashboard/Data Visualizer apps after logging in, though those will also show other content already public on this instance.',
              )}
            </NoticeBox>
          )}
          <div style={{ marginTop: 8 }}>
            <Button onClick={handleCopyAll}>
              {copiedAll ? i18n.t('Copied full instructions') : i18n.t('Copy full instructions to send')}
            </Button>
          </div>
        </div>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button primary onClick={onDone}>
            {i18n.t('Done')}
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  )
}
