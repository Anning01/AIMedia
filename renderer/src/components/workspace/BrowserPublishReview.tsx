import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PublishPreview, type PublishPreviewData } from './PublishPreview'

export type BrowserContext = PublishPreviewData & {
  schedule: { id: string; status: string; requires_outcome_review?: boolean }
  account: { id: string; name: string; platform: string; entry_url: string }
}

export function BrowserPublishReview({ context, busy, onClose, onConfirm, onResolve, onOpenBrowser }: {
  context: BrowserContext | null
  busy: boolean
  onClose(): void
  onConfirm(): void
  onResolve(outcome: 'published' | 'not_published'): void
  onOpenBrowser(): void
}) {
  const [checked, setChecked] = useState(false)
  const [intent, setIntent] = useState<'open' | 'confirm' | 'published' | 'not_published' | null>(null)
  useEffect(() => { setChecked(false); setIntent(null) }, [context])
  useEffect(() => { if (!busy) setIntent(null) }, [busy])
  const outcomeReview = context?.schedule.requires_outcome_review
  return <Dialog.Root open={Boolean(context)} onOpenChange={open => { if (!open && !busy) onClose() }}>
    <Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay"/>
      <Dialog.Content className="ui-dialog-center fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-surface p-6">
        <Dialog.Title className="text-lg font-semibold">{outcomeReview ? '核对公众号发布结果' : '确认公众号真实发布'}</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">{outcomeReview
          ? '上次操作可能已经发布成功。请先在公众号的发表记录中核对这篇文章；未核对前不能重新填写或发布。'
          : '请先在公众号浏览器核对填入内容。确认后才点击真实发布；结果不明确时停止且不自动重试。'}</Dialog.Description>
        {context && <div className="mt-4"><PublishPreview account={context.account} article={context.article} bodyLimit={400}/></div>}
        <Button className="mt-4" variant="secondary" onClick={() => { setIntent('open'); onOpenBrowser() }} busy={busy && intent === 'open'} disabled={busy || !window.desktop?.openBrowserSession}>打开公众号核对</Button>
        {outcomeReview && <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          <input type="checkbox" checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)}/>我已在公众号平台核对这篇文章的发表记录
        </label>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>暂不处理</Button>
          {outcomeReview ? <>
            <Button variant="secondary" onClick={() => { setIntent('not_published'); onResolve('not_published') }} busy={busy && intent === 'not_published'} disabled={busy || !checked}>确认未发布，允许重新填写</Button>
            <Button onClick={() => { setIntent('published'); onResolve('published') }} busy={busy && intent === 'published'} disabled={busy || !checked}>确认已发布，结束任务</Button>
          </> : <Button onClick={() => { setIntent('confirm'); onConfirm() }} busy={busy && intent === 'confirm'} disabled={busy}>确认真实发布</Button>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
