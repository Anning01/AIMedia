import { cn } from '@/lib/utils'

// Adapted from Galaxy / A-nshuman_fluffy-fox-90; source and MIT notice: design.md.
export function LoadingState({ label = '正在加载…', className }: { label?: string; className?: string }) {
  return <div role="status" aria-live="polite" className={cn('ui-loading', className)}>
    <span className="ui-loader" aria-hidden="true">{[0, 1, 2, 3].map(index => <i key={index}/>)}</span>
    <span>{label}</span>
  </div>
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('ui-skeleton', className)}/>
}
