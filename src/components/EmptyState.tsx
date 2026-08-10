import { Button, ButtonStrip } from '@dhis2/ui'

export function EmptyState({
  canManage,
  onExportCsv,
  onCreateApiShare,
}: {
  canManage: boolean
  onExportCsv: () => void
  onCreateApiShare: () => void
}) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 24px', textAlign: 'center' }}
    >
      <h2 style={{ margin: 0 }}>No shares yet</h2>
      <p style={{ margin: 0, color: '#6e7a89', maxWidth: 480 }}>
        A share is one dataset + data elements + org units + a date range, exported either as a CSV file right now, or
        provisioned as a scoped, revocable external API account. Nothing is bundled -- pick your own data to get started.
      </p>
      <ButtonStrip>
        <Button primary onClick={onExportCsv}>
          Export as CSV
        </Button>
        {canManage && <Button onClick={onCreateApiShare}>Create API share</Button>}
      </ButtonStrip>
      {!canManage && (
        <p style={{ margin: 0, color: '#6e7a89', fontStyle: 'italic' }}>
          Ask a user with user-management authority to create an API share.
        </p>
      )}
    </div>
  )
}
