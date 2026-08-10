import { Button, ButtonStrip, Menu, MenuItem } from '@dhis2/ui'
import type { ShareRecord } from '../types/share'
import { ShareStatusTag } from './StatusTag'

// Unlike Data Quality Auditor's AuditList, there is no per-item live DHIS2
// query to fetch here -- a ShareRecord is static config data already in the
// dataStore blob, not something with an ongoing report to compute. So this
// stays a plain list, no shared-fetch-cache context needed.
export function ShareList({
  shares,
  selectedId,
  onSelect,
  canManage,
  onExportCsv,
  onCreateApiShare,
}: {
  shares: ShareRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
  canManage: boolean
  onExportCsv: () => void
  onCreateApiShare: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 12 }}>
        <ButtonStrip>
          <Button small primary onClick={onExportCsv}>
            Export as CSV
          </Button>
          {canManage && (
            <Button small onClick={onCreateApiShare}>
              API share
            </Button>
          )}
        </ButtonStrip>
      </div>
      <Menu>
        {shares.map((share) => (
          <MenuItem
            key={share.id}
            label={share.label}
            active={share.id === selectedId}
            onClick={() => onSelect(share.id)}
            suffix={<ShareStatusTag status={share.status} />}
          />
        ))}
      </Menu>
    </div>
  )
}
