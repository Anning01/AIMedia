import { Badge } from '@/components/ui/badge'
import { formatTime } from '@/lib/utils'

export type RunTimelineEvent = { id: string; stage: string; status: string; message: string; created_at: string }

const stageLabels: Record<string, string> = {
  created: '准备发布',
  prepare: '填写公众号',
  confirm: '真实发布',
  recovery: '恢复检查',
  cancel: '取消',
}

export function RunTimeline({ events }: { events: RunTimelineEvent[] }) {
  return events.length ? <ol className="space-y-3" aria-label="发布执行步骤">
    {events.map(event => <li key={event.id} className="grid grid-cols-[12px_minmax(0,1fr)] gap-3">
      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary"/>
      <div className="rounded-xl bg-muted p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{stageLabels[event.stage] ?? event.stage}</strong><Badge value={event.status}/></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{event.message}</p><time className="mt-1 block text-[11px] text-muted-foreground" dateTime={event.created_at}>{formatTime(event.created_at)}</time></div>
    </li>)}
  </ol> : <p className="py-8 text-center text-sm text-muted-foreground">尚无执行步骤</p>
}
