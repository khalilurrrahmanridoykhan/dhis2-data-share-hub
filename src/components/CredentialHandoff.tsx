import { Button, ButtonStrip, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'

// Shows a generated temporary password exactly once. It is never persisted
// anywhere in this app's dataStore record -- once this modal closes, this
// component's local state is the only place it ever existed on this side.
export function CredentialHandoff({
  username,
  password,
  onDone,
}: {
  username: string
  password: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
  }

  return (
    <Modal onClose={onDone} position="middle">
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
            <Button small onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
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
