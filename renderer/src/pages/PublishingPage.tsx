import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, RotateCcw, Settings2, Send, X } from 'lucide-react'
import { api, type Account, type Schedule, type Task } from '@/lib/api'
import { messages, type MessageCopy } from '@/lib/messages'
import { formatTime } from '@/lib/utils'
import { AccountSettings, publishPolicyLabels } from '@/pages/AccountsPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrowserPublishReview, type BrowserContext } from '@/components/workspace/BrowserPublishReview'
import { RunTimeline, type RunTimelineEvent } from '@/components/workspace/RunTimeline'
import { QueryFeedback } from '@/components/ui/query-feedback'

export function PublishingPage() {
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: () => api<Schedule[]>('/api/publishing/schedules'), refetchInterval: 5000 })
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/api/tasks') })
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api<Account[]>('/api/admin/accounts') })
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [browserPreview, setBrowserPreview] = useState<BrowserContext | null>(null)
  const [timeline, setTimeline] = useState<{ title: string; events: RunTimelineEvent[] } | null>(null)
  const scheduleItems = Array.isArray(schedules.data) ? schedules.data : []
  const taskItems = Array.isArray(tasks.data) ? tasks.data : []
  const accountItems = Array.isArray(accounts.data) ? accounts.data : []
  const title = (taskId: string) => taskItems.find(task => task.id === taskId)?.original_title || taskId
  const runAction = async (scheduleId: string, operation: Promise<unknown>, copy: MessageCopy) => {
    if (activeScheduleId) return
    setActiveScheduleId(scheduleId)
    try {
      await messages.promise(operation, copy)
      await schedules.refetch()
    } catch {
      // Global feedback already reports the error.
    } finally {
      setActiveScheduleId(null)
    }
  }
  const continueBrowser = (schedule: Schedule) => {
    if (!window.desktop?.prepareBrowserPublish) return
    void runAction(schedule.id, window.desktop.prepareBrowserPublish(schedule.id), { loading: '正在打开公众号并填写…', success: '公众号浏览器已打开，请核对页面' })
  }
  const openBrowserPreview = async (schedule: Schedule) => {
    if (activeScheduleId) return
    setActiveScheduleId(schedule.id)
    try { setBrowserPreview(await api<BrowserContext>(`/api/publishing/browser/${schedule.id}/context`)) }
    catch { /* Global feedback already reports the error. */ }
    finally { setActiveScheduleId(null) }
  }
  const confirmBrowser = async () => {
    if (!browserPreview || activeScheduleId || !window.desktop?.confirmBrowserPublish) return
    const id = browserPreview.schedule.id
    setActiveScheduleId(id)
    try {
      const result = await messages.promise(window.desktop.confirmBrowserPublish(id), { loading: '正在执行公众号真实发布…', success: '公众号发布操作已完成' })
      setBrowserPreview(null)
      if (result.status === 'needs_handoff') messages.info(result.message)
      await schedules.refetch()
    } catch { /* Global feedback already reports the error. */ }
    finally { setActiveScheduleId(null) }
  }
  const resolveBrowser = async (outcome: 'published' | 'not_published') => {
    if (!browserPreview || activeScheduleId) return
    setActiveScheduleId(browserPreview.schedule.id)
    try {
      await messages.promise(api(`/api/publishing/browser/${browserPreview.schedule.id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome }) }), { loading: '正在记录核对结果…', success: outcome === 'published' ? '已记录为人工核对发布成功' : '已记录未发布，可重新填写并再次确认' })
      setBrowserPreview(null)
      await schedules.refetch()
    } catch { /* Global feedback already reports the error. */ }
    finally { setActiveScheduleId(null) }
  }
  const openBrowser = async () => {
    if (!browserPreview || activeScheduleId || !window.desktop?.openBrowserSession) return
    await runAction(browserPreview.schedule.id, window.desktop.openBrowserSession(browserPreview.account.id, browserPreview.account.entry_url, true), { loading: '正在打开公众号…', success: '请在公众号平台核对发表记录' })
  }
  const openTimeline = async (schedule: Schedule) => {
    if (activeScheduleId) return
    setActiveScheduleId(schedule.id)
    try { setTimeline({ title: title(schedule.task_id), events: await api<RunTimelineEvent[]>(`/api/publishing/schedules/${schedule.id}/events`) }) }
    catch { /* Global feedback already reports the error. */ }
    finally { setActiveScheduleId(null) }
  }
  return <div className="studio-secondary-page publishing-page">
    <header className="studio-page-heading">
      <div><h1 className="studio-page-title">发布记录</h1><p className="studio-page-description">查看发布结果、失败原因和需要接管的任务</p></div>
      <div className="studio-page-actions"><Dialog.Root>
        <Dialog.Trigger asChild><Button variant="secondary"><Settings2 size={16}/>平台与账号</Button></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay"/><Dialog.Content className="ui-drawer-right studio-account-drawer"><div className="studio-drawer-heading"><div><p className="studio-eyebrow">DESTINATIONS</p><Dialog.Title className="mt-2 text-xl font-semibold">平台与账号</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">管理发布目标、账号配置与浏览器会话。</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="关闭"><X size={18}/></Button></Dialog.Close></div><div className="studio-drawer-body"><AccountSettings/></div></Dialog.Content></Dialog.Portal>
      </Dialog.Root></div>
    </header>
    <QueryFeedback query={schedules} label="发布记录"/>
    <QueryFeedback query={tasks} label="文章标题"/>
    <QueryFeedback query={accounts} label="发布账号"/>
    {(schedules.isSuccess || scheduleItems.length > 0) && <section className="publishing-log" aria-label="发布历史">
      <div className="publishing-log-heading"><h2>全部记录<span>{scheduleItems.length}</span></h2><p>每次发布均保留执行记录</p></div>
      {scheduleItems.length > 0 && <div className="publishing-column-headings" aria-hidden="true"><span>文章与发布目标</span><span>执行时间</span><span>状态</span><span className="text-right">操作</span></div>}
      {scheduleItems.map(item => <article key={item.id} className="publishing-row">
        <div className="publishing-article"><div className="flex items-start gap-3"><span className="publishing-row-icon" aria-hidden="true"><Send size={17}/></span><div className="min-w-0"><h3 className="text-sm font-semibold leading-6">{title(item.task_id)}</h3><p className="publishing-target">{item.account_platform || '目标平台未记录'}<span aria-hidden="true"> / </span>{accountItems.find(account => account.id === item.account_id)?.name || item.account_id}</p><p className="mt-1.5 text-xs text-muted-foreground">{publishPolicyLabels[item.policy] || item.policy}<span className="mx-2" aria-hidden="true">·</span>尝试 {item.attempt_count ?? 0} 次</p></div></div>{item.last_error && <p className="publishing-error">{item.last_error}</p>}</div>
        <div className="publishing-time"><p className="publishing-mobile-label">执行时间</p><p className="text-xs leading-6 text-muted-foreground">{formatTime(item.scheduled_at)}</p></div>
        <div className="publishing-status"><p className="publishing-mobile-label">状态</p><Badge value={item.status}/></div>
        <div className="publishing-actions">
          {item.account_adapter === 'browser' && <Button variant="ghost" size="sm" disabled={activeScheduleId !== null} onClick={() => openTimeline(item)}>查看步骤</Button>}
          {item.account_adapter === 'browser' && ['awaiting_browser', 'needs_handoff'].includes(item.status) && !item.requires_outcome_review && <Button variant="secondary" size="sm" disabled={activeScheduleId !== null || !window.desktop?.prepareBrowserPublish} onClick={() => continueBrowser(item)}>继续填写</Button>}
          {item.account_adapter === 'browser' && item.status === 'awaiting_approval' && <Button size="sm" disabled={activeScheduleId !== null || !window.desktop?.confirmBrowserPublish} onClick={() => openBrowserPreview(item)}>核对并发布</Button>}
          {item.account_adapter === 'browser' && item.requires_outcome_review && <Button variant="secondary" size="sm" disabled={activeScheduleId !== null} onClick={() => openBrowserPreview(item)}>核对发布结果</Button>}
          {item.account_adapter !== 'browser' && item.status === 'failed' && item.latest_attempt_id && <Button variant="secondary" size="sm" disabled={activeScheduleId !== null} onClick={() => runAction(item.id, api(`/api/publishing/attempts/${item.latest_attempt_id}/retry`, { method: 'POST' }), { loading: '正在重新提交…', success: '已重新加入发布队列' })}><RotateCcw size={14}/>重试</Button>}
          {!item.requires_outcome_review && ['scheduled', 'failed', 'paused_import', 'awaiting_browser', 'awaiting_approval', 'needs_handoff'].includes(item.status) && <Button variant="ghost" size="sm" disabled={activeScheduleId !== null} onClick={() => runAction(item.id, api(`/api/publishing/schedules/${item.id}`, { method: 'DELETE' }), { loading: '正在取消发布…', success: '发布已取消' })}>取消</Button>}
          <Button asChild variant="ghost" size="icon"><a href={`/articles/${item.task_id}`} aria-label={`打开文章：${title(item.task_id)}`}><ArrowUpRight size={17}/></a></Button>
        </div>
      </article>)}
      {!scheduleItems.length && <div className="studio-empty-state publishing-empty"><span className="studio-empty-icon"><Send size={28}/></span><h2>还没有发布记录</h2><p>从文章工作区发起第一次发布。<br/>目标账号、执行过程与发布结果会在这里保留。</p><Button asChild variant="secondary"><Link to="/articles">前往文章工作区<ArrowUpRight size={15}/></Link></Button></div>}
    </section>}
    <BrowserPublishReview context={browserPreview} busy={Boolean(activeScheduleId)} onClose={() => setBrowserPreview(null)} onConfirm={confirmBrowser} onResolve={resolveBrowser} onOpenBrowser={openBrowser}/>
    <Dialog.Root open={Boolean(timeline)} onOpenChange={open => { if (!open) setTimeline(null) }}><Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay"/><Dialog.Content className="ui-dialog-center publishing-timeline-dialog"><p className="studio-eyebrow">ACTIVITY</p><Dialog.Title className="mt-2 text-lg font-semibold">公众号执行步骤</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{timeline?.title}</Dialog.Description><div className="mt-6">{timeline && <RunTimeline events={timeline.events}/>}</div><div className="studio-section-footer"><Button variant="secondary" onClick={() => setTimeline(null)}>关闭</Button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
