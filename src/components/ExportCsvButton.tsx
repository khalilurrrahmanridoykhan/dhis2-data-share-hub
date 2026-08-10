import { Button, ButtonStrip, InputField, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import type { DataSetDetail } from '../hooks/useDataSetDetail'
import { useCsvExport } from '../hooks/useCsvExport'
import type { DataSlice, ShareRecord } from '../types/share'
import { SliceForm } from './SliceForm'

function todayIso(): string {
  return new Date().toISOString()
}

interface Props {
  currentUsername: string
  onClose: () => void
  onSaveShare: (share: ShareRecord) => Promise<void>
}

// The fully-automatable, zero-new-credential path: runs entirely on the
// admin's own already-authenticated session. No account is created, so
// there is nothing to revoke -- a successful export just logs a ShareRecord
// for the registry.
export function ExportCsvButton({ currentUsername, onClose, onSaveShare }: Props) {
  const [label, setLabel] = useState('')
  const [recipientNote, setRecipientNote] = useState('')
  const [slice, setSlice] = useState<DataSlice | null>(null)
  const [detail, setDetail] = useState<DataSetDetail | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { exporting, exportCsv } = useCsvExport()

  async function handleExport() {
    if (!slice || !detail) {
      setFormError(validationError ?? 'Complete the data slice above first.')
      return
    }
    if (!label.trim()) {
      setFormError('Name is required.')
      return
    }
    setFormError(null)

    const dataElementNameById = new Map(detail.dataElements.map((de) => [de.id, de.name]))
    const orgUnitNameById = new Map(detail.organisationUnits.map((ou) => [ou.id, ou.name]))

    const result = await exportCsv(slice, dataElementNameById, orgUnitNameById)
    if (!result) {
      setFormError('The export failed -- see below.')
      return
    }

    const record: ShareRecord = {
      id: crypto.randomUUID(),
      label: label.trim(),
      recipientNote: recipientNote.trim() || null,
      method: 'csv_export',
      slice,
      serviceAccountUsername: null,
      serviceAccountUserId: null,
      userRoleId: null,
      credentialDeliveryMethod: null,
      recipientEmail: null,
      status: 'active',
      createdAt: todayIso(),
      createdBy: currentUsername,
      revokedAt: null,
      revokedBy: null,
    }

    try {
      await onSaveShare(record)
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>Export as CSV</ModalTitle>
      <ModalContent>
        {formError && (
          <div style={{ marginBottom: 16 }}>
            <NoticeBox error title="Could not export">
              {formError}
            </NoticeBox>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField
            label="Name"
            required
            value={label}
            onChange={({ value }) => setLabel(value ?? '')}
            placeholder="e.g. Malaria data for donor report, Jan-Jun"
          />
          <InputField
            label="Notes (optional)"
            value={recipientNote}
            onChange={({ value }) => setRecipientNote(value ?? '')}
            placeholder="Who or what this export is for"
          />
          <SliceForm onChange={(s, d, err) => (setSlice(s), setDetail(d), setValidationError(err))} />
        </div>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button primary onClick={handleExport} loading={exporting} disabled={!slice}>
            Download CSV
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  )
}
