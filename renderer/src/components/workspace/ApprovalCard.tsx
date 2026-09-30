import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ApprovalCard({ title, description, children, confirmLabel = '确认', cancelLabel = '取消', busy = false, confirmDisabled = false, onConfirm, onCancel }: {
  title: string
  description?: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm(): void
  onCancel(): void
}) {
  return <section className="approval-card bg-surface" aria-label={title} aria-busy={busy}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>}</div>
      <span className="approval-state">{busy ? '处理中' : '待确认'}</span>
    </div>
    {children && <div className="mt-3">{children}</div>}
    <div className="approval-actions">
      <Button size="sm" onClick={onConfirm} busy={busy} disabled={confirmDisabled}><Check size={14}/>{confirmLabel}</Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}><X size={14}/>{cancelLabel}</Button>
    </div>
  </section>
}
