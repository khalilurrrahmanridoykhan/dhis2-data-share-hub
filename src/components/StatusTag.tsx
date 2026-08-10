import { Tag } from '@dhis2/ui'
import type { ShareStatus } from '../types/share'

const STATUS_PROPS: Record<ShareStatus, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  draft: { neutral: true },
  account_created: { neutral: true },
  active: { positive: true },
  revoked: { negative: true },
}

const STATUS_LABELS: Record<ShareStatus, string> = {
  draft: 'DRAFT',
  account_created: 'AWAITING TOKEN',
  active: 'ACTIVE',
  revoked: 'REVOKED',
}

export function ShareStatusTag({ status }: { status: ShareStatus }) {
  return <Tag {...STATUS_PROPS[status]}>{STATUS_LABELS[status]}</Tag>
}
