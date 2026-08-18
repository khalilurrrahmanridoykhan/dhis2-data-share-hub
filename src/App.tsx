import { AlertBar, Button, ButtonStrip, CircularLoader, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox } from '@dhis2/ui'
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
import i18n from './locales'
import { countOtherActiveSharesForAccount } from './lib/serviceAccount'
import type { ShareRecord } from './types/share'

export default function App() {
  const { loading, error, shares, saveShare, deleteShare } = useShares()
  const { canManage, username } = useCurrentUserAuthorities()
  const { revoking, error: revokeError, revoke, disableAccount } = useRevokeServiceAccount()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCsvForm, setShowCsvForm] = useState(false)
  const [showApiForm, setShowApiForm] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShareRecord | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ShareRecord | null>(null)
  // Only ever set right after a revoke that left zero active siblings on
  // the account -- the second, separately-worded confirmation for the
  // fully independent "disable the account too?" decision.
  const [offerDisableFor, setOfferDisableFor] = useState<ShareRecord | null>(null)

  // If the logged-in account IS one of the service accounts this app
  // created for a share, they see ONLY their own shares -- never the full
  // admin registry, which would otherwise leak other recipients' labels
  // and notes to someone who isn't the admin. filter (not find): one
  // account can now legitimately back several attached shares.
  const recipientShares = username
    ? shares.filter((s) => s.method === 'api_account' && s.serviceAccountUsername === username && s.status !== 'revoked')
    : []

  const selected = shares.find((s) => s.id === selectedId) ?? shares[0] ?? null

  const revokeSiblingCount = revokeTarget
    ? countOtherActiveSharesForAccount(shares, revokeTarget.serviceAccountUserId ?? '', revokeTarget.id)
    : 0

  async function confirmRevoke() {
    if (!revokeTarget) return
    const ok = await revoke(revokeTarget, shares)
    if (ok) {
      try {
        await saveShare({ ...revokeTarget, status: 'revoked', revokedAt: new Date().toISOString(), revokedBy: username })
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : String(err))
      }
      // Only the no-siblings path gets a second, separate prompt -- if
      // other active shares still use this account, disabling it is never
      // offered here at all.
      if (revokeSiblingCount === 0) setOfferDisableFor(revokeTarget)
    }
    setRevokeTarget(null)
  }

  async function confirmDisableAccount() {
    if (!offerDisableFor?.serviceAccountUserId) return
    await disableAccount(offerDisableFor.serviceAccountUserId)
    setOfferDisableFor(null)
  }

  async function handleMarkActive() {
    if (!selected) return
    try {
      await saveShare({ ...selected, status: 'active' })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteShare(deleteTarget.id)
      setSelectedId(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
    setDeleteTarget(null)
  }

  if (!loading && !error && recipientShares.length > 0) {
    return <RecipientView shares={recipientShares} />
  }

  return (
    <>
      {saveError && (
        <AlertBar critical onHidden={() => setSaveError(null)}>
          {i18n.t('Could not save -- {{error}}', { error: saveError })}
        </AlertBar>
      )}
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
            <NoticeBox error title={i18n.t('Could not load shares')}>
              {error}
            </NoticeBox>
          ) : shares.length === 0 ? (
            <EmptyState canManage={canManage} onExportCsv={() => setShowCsvForm(true)} onCreateApiShare={() => setShowApiForm(true)} />
          ) : selected ? (
            <ShareDetail
              share={selected}
              siblingCount={countOtherActiveSharesForAccount(shares, selected.serviceAccountUserId ?? '', selected.id)}
              canManage={canManage}
              revoking={revoking}
              revokeError={revokeError}
              onRevoke={() => setRevokeTarget(selected)}
              onDelete={() => setDeleteTarget(selected)}
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
          shares={shares}
          onClose={() => setShowApiForm(false)}
          onSaveShare={async (share) => {
            await saveShare(share)
            setSelectedId(share.id)
          }}
        />
      )}

      {deleteTarget && (
        <Modal small onClose={() => setDeleteTarget(null)}>
          <ModalTitle>{i18n.t('Delete share record')}</ModalTitle>
          <ModalContent>
            {i18n.t('Delete "{{label}}"? This only removes it from the registry -- it does not disable any account.', {
              label: deleteTarget.label,
            })}
          </ModalContent>
          <ModalActions>
            <ButtonStrip end>
              <Button onClick={() => setDeleteTarget(null)}>{i18n.t('Cancel')}</Button>
              <Button destructive onClick={confirmDelete}>
                {i18n.t('Delete')}
              </Button>
            </ButtonStrip>
          </ModalActions>
        </Modal>
      )}

      {revokeTarget && (
        <Modal small onClose={() => setRevokeTarget(null)}>
          <ModalTitle>{i18n.t("Remove this share's access")}</ModalTitle>
          <ModalContent>
            {revokeSiblingCount > 0
              ? i18n.t(
                  'Remove this share\'s access? The account "{{username}}" stays active -- it\'s still used by {{count}} other active share(s).',
                  { username: revokeTarget.serviceAccountUsername, count: revokeSiblingCount },
                )
              : i18n.t(
                  'Remove this share\'s access? This is the last active share on the account "{{username}}" -- you\'ll be asked next whether to disable it too.',
                  { username: revokeTarget.serviceAccountUsername },
                )}
          </ModalContent>
          <ModalActions>
            <ButtonStrip end>
              <Button onClick={() => setRevokeTarget(null)}>{i18n.t('Cancel')}</Button>
              <Button destructive onClick={confirmRevoke} loading={revoking}>
                {i18n.t('Remove access')}
              </Button>
            </ButtonStrip>
          </ModalActions>
        </Modal>
      )}

      {offerDisableFor && (
        <Modal small onClose={() => setOfferDisableFor(null)}>
          <ModalTitle>{i18n.t('Disable the account too?')}</ModalTitle>
          <ModalContent>
            {i18n.t(
              'This was the last active share on the account "{{username}}". Disable it too? (You can leave it enabled and attach a future share to it instead.)',
              { username: offerDisableFor.serviceAccountUsername },
            )}
          </ModalContent>
          <ModalActions>
            <ButtonStrip end>
              <Button onClick={() => setOfferDisableFor(null)}>{i18n.t('Leave it enabled')}</Button>
              <Button destructive onClick={confirmDisableAccount} loading={revoking}>
                {i18n.t('Disable account')}
              </Button>
            </ButtonStrip>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
