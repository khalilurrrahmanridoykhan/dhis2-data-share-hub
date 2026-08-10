import { CircularLoader, HeaderBar, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import { ApiShareForm } from './components/ApiShareForm'
import { EmptyState } from './components/EmptyState'
import { ExportCsvButton } from './components/ExportCsvButton'
import { RecipientView } from './components/RecipientView'
import { ShareDetail } from './components/ShareDetail'
import { ShareList } from './components/ShareList'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useRevokeServiceAccount } from './hooks/useRevokeServiceAccount'
import { useShares } from './hooks/useShares'

export default function App() {
  const { loading, error, shares, saveShare, deleteShare } = useShares()
  const { canManage, username } = useCurrentUserAuthorities()
  const { revoking, error: revokeError, revoke } = useRevokeServiceAccount()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCsvForm, setShowCsvForm] = useState(false)
  const [showApiForm, setShowApiForm] = useState(false)

  // If the logged-in account IS one of the service accounts this app
  // created for a share, they see ONLY their own data -- never the full
  // admin registry, which would otherwise leak other recipients' labels
  // and notes to someone who isn't the admin.
  const recipientShare = username
    ? (shares.find((s) => s.method === 'api_account' && s.serviceAccountUsername === username) ?? null)
    : null

  const selected = shares.find((s) => s.id === selectedId) ?? shares[0] ?? null

  async function handleRevoke() {
    if (!selected || !selected.serviceAccountUserId) return
    if (!window.confirm(`Disable the service account "${selected.serviceAccountUsername}"? This cannot be undone.`)) return
    const ok = await revoke(selected.serviceAccountUserId)
    if (ok) {
      await saveShare({ ...selected, status: 'revoked', revokedAt: new Date().toISOString(), revokedBy: username })
    }
  }

  async function handleMarkActive() {
    if (!selected) return
    await saveShare({ ...selected, status: 'active' })
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm('Delete this share record? This only removes it from the registry -- it does not disable any account.')) return
    await deleteShare(selected.id)
    setSelectedId(null)
  }

  if (!loading && !error && recipientShare) {
    return (
      <>
        <HeaderBar appName="Data Share Hub" />
        <RecipientView share={recipientShare} />
      </>
    )
  }

  return (
    <>
      <HeaderBar appName="Data Share Hub" />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 48px)' }}>
        <aside style={{ width: 300, flexShrink: 0, borderRight: '1px solid #e0e0e0' }}>
          {!loading && !error && (
            <ShareList
              shares={shares}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              canManage={canManage}
              onExportCsv={() => setShowCsvForm(true)}
              onCreateApiShare={() => setShowApiForm(true)}
            />
          )}
        </aside>
        <main style={{ flex: 1, padding: 24, maxWidth: 1100 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <CircularLoader />
            </div>
          ) : error ? (
            <NoticeBox error title="Could not load shares">
              {error}
            </NoticeBox>
          ) : shares.length === 0 ? (
            <EmptyState canManage={canManage} onExportCsv={() => setShowCsvForm(true)} onCreateApiShare={() => setShowApiForm(true)} />
          ) : selected ? (
            <ShareDetail
              share={selected}
              canManage={canManage}
              revoking={revoking}
              revokeError={revokeError}
              onRevoke={handleRevoke}
              onDelete={handleDelete}
              onMarkActive={handleMarkActive}
            />
          ) : null}
        </main>
      </div>

      {showCsvForm && (
        <ExportCsvButton
          currentUsername={username}
          onClose={() => setShowCsvForm(false)}
          onSaveShare={async (share) => {
            await saveShare(share)
            setSelectedId(share.id)
          }}
        />
      )}

      {showApiForm && (
        <ApiShareForm
          currentUsername={username}
          onClose={() => setShowApiForm(false)}
          onSaveShare={async (share) => {
            await saveShare(share)
            setSelectedId(share.id)
          }}
        />
      )}
    </>
  )
}
