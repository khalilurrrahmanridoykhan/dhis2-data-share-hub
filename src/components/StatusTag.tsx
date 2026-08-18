import { Tag } from '@dhis2/ui'
import i18n from '../locales'
import type { ShareStatus } from '../types/share'

const STATUS_PROPS: Record<ShareStatus, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  draft: { neutral: true },
  account_created: { neutral: true },
  active: { positive: true },
  revoked: { negative: true },
}

function statusLabel(status: ShareStatus): string {
  switch (status) {
    case 'draft':
      return i18n.t('DRAFT')
    case 'account_created':
      return i18n.t('AWAITING TOKEN')
    case 'active':
      return i18n.t('ACTIVE')
    case 'revoked':
      return i18n.t('REVOKED')
  }
}

export function ShareStatusTag({ status }: { status: ShareStatus }) {
  return <Tag {...STATUS_PROPS[status]}>{statusLabel(status)}</Tag>
}
