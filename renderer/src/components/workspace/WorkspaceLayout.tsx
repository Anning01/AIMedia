import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { BookOpenText, FileSearch, MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type WorkspacePanel = 'article' | 'agent'

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    callback => {
      const media = window.matchMedia?.(query)
      media?.addEventListener('change', callback)
      return () => media?.removeEventListener('change', callback)
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}

export function WorkspaceLayout({ article, agent, evidence, activePanel, onPanelChange, approvalCount = 0 }: {
  article: ReactNode
  agent: ReactNode
  evidence: ReactNode
  activePanel: WorkspacePanel
  onPanelChange(panel: WorkspacePanel): void
  approvalCount?: number
}) {
  const wide = useMediaQuery('(min-width: 1440px)')
  const split = useMediaQuery('(min-width: 1100px)')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const id = useId()
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const evidenceScroll = useRef(0)

  useEffect(() => { if (wide) setEvidenceOpen(false) }, [wide])

  // Only the evidence container moves between the inline column and drawer.
  // Editor and conversation remain mounted, including unsent input and undo history.
  const evidenceBody = <div
    className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    ref={node => { if (node) node.scrollTop = evidenceScroll.current }}
    onScroll={event => { evidenceScroll.current = event.currentTarget.scrollTop }}
  >{evidence}</div>

  return <div className="workspace-layout flex min-h-0 flex-1 flex-col gap-3">
    {(!wide || approvalCount > 0) && <div className="workspace-controls">
      {!split ? <div role="tablist" aria-label="文章工作区面板" className="workspace-panel-tabs">
        {(['article', 'agent'] as const).map((panel, index) => <button
          key={panel} ref={node => { tabs.current[index] = node }} type="button" role="tab"
          id={`${id}-tab-${panel}`} aria-controls={`${id}-panel-${panel}`} aria-selected={activePanel === panel}
          tabIndex={activePanel === panel ? 0 : -1}
          className={cn('workspace-panel-tab', activePanel === panel ? 'bg-surface text-primary' : 'text-muted-foreground')}
          onClick={() => onPanelChange(panel)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index
            onPanelChange(next === 0 ? 'article' : 'agent')
            tabs.current[next]?.focus()
          }}
        >{panel === 'article' ? <BookOpenText size={16}/> : <MessageSquare size={16}/>}{panel === 'article' ? '正文' : '对话'}
          {panel === 'agent' && approvalCount > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">{approvalCount} 待确认</span>}
        </button>)}
      </div> : approvalCount > 0 ? <p className="text-xs text-warning">{approvalCount} 项内容待确认，请在对话区审阅</p> : null}
      {!wide && <Dialog.Root open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <Dialog.Trigger asChild><Button variant="ghost" className="ml-auto min-h-11"><FileSearch size={16}/>资料</Button></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay"/>
          <Dialog.Content className="workspace-evidence-drawer ui-drawer-left fixed inset-y-0 left-0 z-50 flex w-[min(380px,100%)] flex-col bg-background p-4">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2"><Dialog.Title className="font-semibold">文章资料</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" className="h-11 w-11" aria-label="关闭资料"><X size={18}/></Button></Dialog.Close></div>
            <Dialog.Description className="mb-4 text-sm text-muted-foreground">查看事实结论、来源、历史版本和媒体。</Dialog.Description>
            {evidenceBody}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>}
    </div>}
    <div className={cn('workspace-grid grid min-h-0 flex-1 gap-4', wide ? 'grid-cols-[220px_minmax(0,1fr)_360px]' : split ? 'grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-[minmax(0,1fr)]')}>
      {wide && <div className="flex min-h-0 min-w-0 flex-col">{evidenceBody}</div>}
      <div id={`${id}-panel-article`} role={split ? 'region' : 'tabpanel'} aria-label={split ? '文章正文' : undefined} aria-labelledby={split ? undefined : `${id}-tab-article`} tabIndex={0}
        onFocusCapture={() => onPanelChange('article')}
        hidden={!split && activePanel !== 'article'} className="studio-tab-panel workspace-article min-h-0 min-w-0 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{article}</div>
      <div id={`${id}-panel-agent`} role={split ? 'region' : 'tabpanel'} aria-label={split ? '文章对话' : undefined} aria-labelledby={split ? undefined : `${id}-tab-agent`} tabIndex={0}
        onFocusCapture={() => onPanelChange('agent')}
        hidden={!split && activePanel !== 'agent'} className="studio-tab-panel workspace-agent min-h-0 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{agent}</div>
    </div>
  </div>
}
