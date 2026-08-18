import {
  Button,
  ButtonStrip,
  CircularLoader,
  InputField,
  Modal,
  ModalActions,
  ModalContent,
  ModalTitle,
  NoticeBox,
  Radio,
  SingleSelectField,
  SingleSelectOption,
} from '@dhis2/ui'
import { useState } from 'react'
import { useCreateServiceAccount, type AccountChoice } from '../hooks/useCreateServiceAccount'
import type { DataSetDetail } from '../hooks/useDataSetDetail'
import { useServiceAccounts } from '../hooks/useServiceAccounts'
import { useShareHubSettings } from '../hooks/useShareHubSettings'
import i18n from '../locales'
import { isVisualizableValueType } from '../lib/dashboard'
import type { DataSlice, ShareRecord } from '../types/share'
import { CredentialHandoff } from './CredentialHandoff'
import { SliceForm } from './SliceForm'

function todayIso(): string {
  return new Date().toISOString()
}

interface Props {
  currentUsername: string
  shares: ShareRecord[]
  onClose: () => void
  onSaveShare: (share: ShareRecord) => Promise<void>
}

export function ApiShareForm({ currentUsername, shares, onClose, onSaveShare }: Props) {
  const [label, setLabel] = useState('')
  const [recipientNote, setRecipientNote] = useState('')
  const [slice, setSlice] = useState<DataSlice | null>(null)
  const [detail, setDetail] = useState<DataSetDetail | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [accountMode, setAccountMode] = useState<'create' | 'attach'>('create')
  const [deliveryMethod, setDeliveryMethod] = useState<'invite_email' | 'temp_password'>('temp_password')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [attachAccountId, setAttachAccountId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [handoff, setHandoff] = useState<{ username: string; password: string; dashboardUrl: string | null } | null>(null)

  const { creating, createShare } = useCreateServiceAccount()
  const { minimalRoleId } = useShareHubSettings()
  const { loading: accountsLoading, accounts } = useServiceAccounts(minimalRoleId, shares)

  async function handleCreate() {
    if (!slice) {
      setFormError(validationError ?? i18n.t('Complete the data slice above first.'))
      return
    }
    if (!label.trim()) {
      setFormError(i18n.t('Name is required.'))
      return
    }
    if (accountMode === 'create' && deliveryMethod === 'invite_email' && !recipientEmail.trim()) {
      setFormError(i18n.t('Enter the recipient email for the invite.'))
      return
    }
    const attachTarget = accountMode === 'attach' ? accounts.find((a) => a.id === attachAccountId) : null
    if (accountMode === 'attach' && !attachTarget) {
      setFormError(i18n.t('Select an existing service account to attach to.'))
      return
    }
    setFormError(null)

    // A dashboard visualization needs a concrete data-element list either
    // way -- slice.dataElementIds is only empty to mean "all" for CSV/table
    // display purposes, so resolve the full dataset element list here when
    // that's the case. Then filter to genuinely visualizable value types --
    // confirmed live that DHIS2 rejects a pivot table containing e.g.
    // FILE_RESOURCE elements ("Data elements must be of a value and
    // aggregation type that allow aggregation"), and that dataset's own
    // aggregationType field is NOT a reliable signal for this (a real
    // FILE_RESOURCE element reported aggregationType "SUM"). This only
    // narrows what gets visualized -- it does not narrow what the recipient
    // is granted read access to, which stays dataset-wide as designed.
    const candidateIds = slice.dataElementIds.length > 0 ? slice.dataElementIds : (detail?.dataElements.map((de) => de.id) ?? [])
    const dataElementIds = (detail?.dataElements ?? [])
      .filter((de) => candidateIds.includes(de.id) && isVisualizableValueType(de.valueType))
      .map((de) => de.id)

    const account: AccountChoice =
      accountMode === 'attach'
        ? { mode: 'attach', userId: attachTarget!.id, username: attachTarget!.username }
        : {
            mode: 'create',
            credential:
              deliveryMethod === 'invite_email' ? { method: 'invite_email', email: recipientEmail.trim() } : { method: 'temp_password' },
          }

    const outcome = await createShare({
      label: label.trim(),
      orgUnitIds: slice.orgUnitIds,
      dataSetId: slice.dataSetId,
      dataElementIds,
      account,
    })
    if (!outcome) {
      setFormError(i18n.t('Could not create the service account -- see below.'))
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
      accountOrigin: outcome.accountOrigin,
      // No new credential is ever minted for the attach path -- the
      // recipient already has their own login/token from an earlier share.
      credentialDeliveryMethod: accountMode === 'attach' ? null : deliveryMethod,
      recipientEmail: accountMode === 'create' && deliveryMethod === 'invite_email' ? recipientEmail.trim() : null,
      dashboardId: outcome.dashboardId,
      dashboardUrl: outcome.dashboardUrl,
      visualizationId: outcome.visualizationId,
      status: accountMode === 'attach' ? 'active' : 'account_created',
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
      setHandoff({ username: outcome.username, password: outcome.tempPassword, dashboardUrl: outcome.dashboardUrl })
    } else {
      onClose()
    }
  }

  if (handoff && slice) {
    return (
      <CredentialHandoff
        username={handoff.username}
        password={handoff.password}
        slice={slice}
        dashboardUrl={handoff.dashboardUrl}
        onDone={onClose}
      />
    )
  }

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>{i18n.t('Create API share')}</ModalTitle>
      <ModalContent>
        {formError && (
          <div style={{ marginBottom: 16 }}>
            <NoticeBox error title={i18n.t('Could not create this share')}>
              {formError}
            </NoticeBox>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <NoticeBox title={i18n.t('How this works')}>
            {accountMode === 'attach'
              ? i18n.t(
                  'This attaches the share below to the recipient’s existing service account. No new login or password is created — they’ll see this data the next time they use their existing token.',
                )
              : i18n.t(
                  'This creates a new, read-only DHIS2 account scoped to the data below and grants it read access to the dataset. DHIS2 API tokens are self-service only, so one manual step remains after this -- whoever administers the new account has to log in once to generate its token.',
                )}
          </NoticeBox>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField
            label={i18n.t('Name')}
            required
            value={label}
            onChange={({ value }) => setLabel(value ?? '')}
            placeholder={i18n.t('e.g. Partner dashboard - Malaria data')}
          />
          <InputField
            label={i18n.t('Notes (optional)')}
            value={recipientNote}
            onChange={({ value }) => setRecipientNote(value ?? '')}
            placeholder={i18n.t('Who or what this share is for')}
          />

          <SliceForm onChange={(s, d, err) => (setSlice(s), setDetail(d), setValidationError(err))} />

          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{i18n.t('Service account')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Radio
                label={i18n.t('Create a new service account')}
                checked={accountMode === 'create'}
                onChange={() => setAccountMode('create')}
              />
              <Radio
                label={i18n.t('Attach to an existing service account')}
                checked={accountMode === 'attach'}
                onChange={() => setAccountMode('attach')}
              />
            </div>
          </div>

          {accountMode === 'create' ? (
            <>
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{i18n.t('Credential delivery')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Radio
                    label={i18n.t("Email an invite (requires this instance's email/SMTP to be configured)")}
                    checked={deliveryMethod === 'invite_email'}
                    onChange={() => setDeliveryMethod('invite_email')}
                  />
                  <Radio
                    label={i18n.t('Generate a one-time temporary password (shown once, not emailed)')}
                    checked={deliveryMethod === 'temp_password'}
                    onChange={() => setDeliveryMethod('temp_password')}
                  />
                </div>
              </div>

              {deliveryMethod === 'invite_email' && (
                <InputField
                  label={i18n.t('Recipient email')}
                  required
                  value={recipientEmail}
                  onChange={({ value }) => setRecipientEmail(value ?? '')}
                />
              )}
            </>
          ) : accountsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <CircularLoader small />
            </div>
          ) : accounts.length === 0 ? (
            <NoticeBox title={i18n.t('No existing service accounts yet')}>
              {i18n.t(
                'No Data Share Hub service account has been created on this instance yet -- switch to "Create a new service account" for this first share.',
              )}
            </NoticeBox>
          ) : (
            <SingleSelectField
              label={i18n.t('Existing service account')}
              required
              selected={attachAccountId ?? ''}
              onChange={({ selected }) => setAttachAccountId(selected)}
            >
              {accounts.map((a) => (
                <SingleSelectOption
                  key={a.id}
                  value={a.id}
                  label={
                    a.activeShareCount > 0
                      ? i18n.t('{{username}} — {{count}} other active share(s)', { username: a.username, count: a.activeShareCount })
                      : i18n.t('{{username}} — not currently used by any other share', { username: a.username })
                  }
                />
              ))}
            </SingleSelectField>
          )}
        </div>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={creating}>
            {i18n.t('Cancel')}
          </Button>
          <Button primary onClick={handleCreate} loading={creating} disabled={!slice}>
            {i18n.t('Create share')}
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  )
}
