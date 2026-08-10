import { Button, ButtonStrip, InputField, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox, Radio } from '@dhis2/ui'
import { useState } from 'react'
import { useCreateServiceAccount } from '../hooks/useCreateServiceAccount'
import type { DataSetDetail } from '../hooks/useDataSetDetail'
import type { DataSlice, ShareRecord } from '../types/share'
import { CredentialHandoff } from './CredentialHandoff'
import { SliceForm } from './SliceForm'

function todayIso(): string {
  return new Date().toISOString()
}

interface Props {
  currentUsername: string
  onClose: () => void
  onSaveShare: (share: ShareRecord) => Promise<void>
}

export function ApiShareForm({ currentUsername, onClose, onSaveShare }: Props) {
  const [label, setLabel] = useState('')
  const [recipientNote, setRecipientNote] = useState('')
  const [slice, setSlice] = useState<DataSlice | null>(null)
  const [, setDetail] = useState<DataSetDetail | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<'invite_email' | 'temp_password'>('temp_password')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const [handoff, setHandoff] = useState<{ username: string; password: string } | null>(null)

  const { creating, createShare } = useCreateServiceAccount()

  async function handleCreate() {
    if (!slice) {
      setFormError(validationError ?? 'Complete the data slice above first.')
      return
    }
    if (!label.trim()) {
      setFormError('Name is required.')
      return
    }
    if (deliveryMethod === 'invite_email' && !recipientEmail.trim()) {
      setFormError('Enter the recipient email for the invite.')
      return
    }
    setFormError(null)

    const outcome = await createShare({
      label: label.trim(),
      orgUnitIds: slice.orgUnitIds,
      dataSetId: slice.dataSetId,
      credential:
        deliveryMethod === 'invite_email' ? { method: 'invite_email', email: recipientEmail.trim() } : { method: 'temp_password' },
    })
    if (!outcome) {
      setFormError('Could not create the service account -- see below.')
      return
    }

    const record: ShareRecord = {
      id: crypto.randomUUID(),
      label: label.trim(),
      recipientNote: recipientNote.trim() || null,
      method: 'api_account',
      slice,
      serviceAccountUsername: outcome.username,
      serviceAccountUserId: outcome.userId,
      userRoleId: outcome.roleId,
      credentialDeliveryMethod: deliveryMethod,
      recipientEmail: deliveryMethod === 'invite_email' ? recipientEmail.trim() : null,
      status: 'account_created',
      createdAt: todayIso(),
      createdBy: currentUsername,
      revokedAt: null,
      revokedBy: null,
    }

    try {
      await onSaveShare(record)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
      return
    }

    if (deliveryMethod === 'temp_password' && outcome.tempPassword) {
      setHandoff({ username: outcome.username, password: outcome.tempPassword })
    } else {
      onClose()
    }
  }

  if (handoff && slice) {
    return <CredentialHandoff username={handoff.username} password={handoff.password} slice={slice} onDone={onClose} />
  }

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>Create API share</ModalTitle>
      <ModalContent>
        {formError && (
          <div style={{ marginBottom: 16 }}>
            <NoticeBox error title="Could not create this share">
              {formError}
            </NoticeBox>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <NoticeBox title="How this works">
            This creates a new, read-only DHIS2 account scoped to the data below and grants it read access to the
            dataset. DHIS2 API tokens are self-service only, so one manual step remains after this: whoever
            administers the new account has to log in once to generate its token.
          </NoticeBox>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField
            label="Name"
            required
            value={label}
            onChange={({ value }) => setLabel(value ?? '')}
            placeholder="e.g. Partner dashboard - Malaria data"
          />
          <InputField
            label="Notes (optional)"
            value={recipientNote}
            onChange={({ value }) => setRecipientNote(value ?? '')}
            placeholder="Who or what this share is for"
          />

          <SliceForm onChange={(s, d, err) => (setSlice(s), setDetail(d), setValidationError(err))} />

          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Credential delivery</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Radio
                label="Email an invite (requires this instance's email/SMTP to be configured)"
                checked={deliveryMethod === 'invite_email'}
                onChange={() => setDeliveryMethod('invite_email')}
              />
              <Radio
                label="Generate a one-time temporary password (shown once, not emailed)"
                checked={deliveryMethod === 'temp_password'}
                onChange={() => setDeliveryMethod('temp_password')}
              />
            </div>
          </div>

          {deliveryMethod === 'invite_email' && (
            <InputField
              label="Recipient email"
              required
              value={recipientEmail}
              onChange={({ value }) => setRecipientEmail(value ?? '')}
            />
          )}
        </div>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button primary onClick={handleCreate} loading={creating} disabled={!slice}>
            Create share
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  )
}
