import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUp, Check, ImagePlus, Search, Sparkles, TriangleAlert } from 'lucide-react'
import type { RewriteTemplate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FACT_CHECK_MAX_CLAIMS } from '../../../../shared/research'
import { MAX_RUN_SKILLS, type SkillInvocation } from '../../../../shared/skills'
import { permissionLabels } from '@/lib/skills'

export type AgentMessage = { id: string; role: 'user' | 'assistant'; content: string }
export type AgentActivity = { label: string; status: 'running' | 'completed' | 'failed' }

export function AgentPanel({ messages, activities, skills, skillId, invocations, busy, approval, active = true, awaitingReview = false, canRevise = false, onSkillChange, onSubmit, onRequestImage }: {
  messages: AgentMessage[]
  activities: AgentActivity[]
  skills: RewriteTemplate[]
  skillId: string
  invocations?: SkillInvocation[]
  busy: boolean
  approval?: ReactNode
  active?: boolean
  awaitingReview?: boolean
  canRevise?: boolean
  onSkillChange(value: string): void
  onSubmit(value: string): void
  onRequestImage(): void
}) {
  const [value, setValue] = useState('')
  const conversationRef = useRef<HTMLDivElement>(null)
  const previousReview = useRef({ visible: false, hasApproval: false })
  const hasApproval = Boolean(approval)
  const showWelcome = !messages.length || (messages.length === 1 && messages[0].id === 'welcome')
  useLayoutEffect(() => {
    const conversation = conversationRef.current
    const visible = !!conversation && conversation.clientHeight > 0
    // Focusing an already-visible desktop panel must not move a button between
    // pointerdown and click. Reveal only a newly arrived or newly visible card.
    if (conversation && visible && hasApproval && (!previousReview.current.hasApproval || !previousReview.current.visible)) conversation.scrollTop = conversation.scrollHeight
    previousReview.current = { visible, hasApproval }
  }, [hasApproval, active])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const instruction = value.trim()
    if (!instruction || busy || (awaitingReview && !canRevise)) return
    setValue('')
    onSubmit(instruction)
  }
  return <aside className="agent-panel bg-surface" aria-label="Agent 对话">
    <header className="agent-header">
      <div className="flex items-center gap-2"><span className="agent-avatar"><Sparkles size={16}/></span><h2 className="text-sm font-semibold">文章 Agent</h2></div>
      <span className={cn('agent-status', busy ? 'text-info' : awaitingReview ? 'text-warning' : 'text-muted-foreground')}><span aria-hidden="true"/>{busy ? '正在处理' : awaitingReview ? '等待确认' : '准备就绪'}</span>
    </header>
    <div ref={conversationRef} className="agent-conversation" aria-live="polite">
      {showWelcome ? <div className="agent-welcome">
        <span className="agent-welcome-icon" aria-hidden="true"><Sparkles size={22} strokeWidth={1.5}/></span>
        <h3>让好文章更进一步</h3>
        <p>{messages[0]?.content ?? '告诉我你希望怎样改稿、配图或准备发布。改稿先审阅差异，配图先确认提示词，发布先核对内容和账号。'}</p>
      </div> : messages.map(message => <div key={message.id} className={cn('studio-message agent-message', message.role === 'user' ? 'agent-message-user' : 'agent-message-assistant')}>
        <span className="agent-message-author">{message.role === 'user' ? '你' : '文章 Agent'}</span><p>{message.content}</p>
      </div>)}
      {invocations && <details className="agent-skill-record">
        <summary>{invocations.length ? `本轮 Skills：${invocations.map(skill => skill.name).join(' → ')}` : '本轮未使用 Skill（无额外工具权限）'}</summary>
        <p className="mt-2 leading-5 text-muted-foreground">按下列顺序应用，风格冲突以靠后者为准；你的要求及事实、审批规则优先。</p>
        <ol className="mt-3 space-y-3">{invocations.map((skill, index) => <li key={skill.id} className="break-words leading-5">
          <strong>{index + 1}. {skill.name} · v{skill.version}</strong><p>{skill.reason}</p>
          <p>声明权限：{skill.permissions.map(permission => permissionLabels[permission] ?? permission).join('、') || '无'}</p>
          <p>加载资料：{skill.references.join('、') || '仅 Skill 说明'}</p>
        </li>)}</ol>
      </details>}
      {activities.length > 0 && <div className="agent-activities">{activities.map((activity, index) => <div key={`${activity.label}-${index}`} className="agent-activity">
        <span className={cn('shrink-0', activity.status === 'failed' ? 'text-danger' : activity.status === 'completed' ? 'text-success' : 'text-info')} aria-hidden="true">{activity.status === 'completed' ? <Check size={14}/> : activity.status === 'failed' ? <TriangleAlert size={14}/> : <Search size={14}/>}</span>
        <span className="min-w-0 flex-1">{activity.label}</span><span className="sr-only">{activity.status === 'running' ? '执行中' : activity.status === 'completed' ? '已完成' : '失败'}</span>
      </div>)}</div>}
      {approval}
    </div>
    <div className="agent-composer">
      <div className="agent-shortcuts"><Button type="button" size="sm" variant="ghost" onClick={() => onSubmit('请核实文章中的关键事实，补充可靠来源，并修正不准确或无法证实的表述。')} disabled={busy || awaitingReview}><Search size={14}/>核实关键事实</Button><Button type="button" size="sm" variant="ghost" onClick={onRequestImage} disabled={busy || awaitingReview}><ImagePlus size={14}/>添加配图</Button></div>
      <form onSubmit={submit} className="agent-compose-box">
        <label htmlFor="agent-instruction" className="sr-only">向文章 Agent 提出修改要求</label>
        <textarea id="agent-instruction" rows={3} placeholder="例如：核实关键数据，再把开头写得更吸引人" value={value} onChange={event => setValue(event.target.value)} disabled={busy}/>
        <div className="agent-compose-toolbar">
          <label className="agent-skill-picker"><span>本轮 Skill</span><Select value={skillId} onChange={event => onSkillChange(event.target.value)} disabled={busy}>
            <option value="">自动匹配</option>
            {skills.map(skill => <option key={skill.id} value={skill.id} disabled={skill.enabled === false}>{skill.name}{skill.enabled === false ? ' · 已停用' : skill.is_builtin ? ' · 内置' : ''}</option>)}
          </Select></label>
          <Button size="icon" className="agent-send" type="submit" busy={busy} disabled={(awaitingReview && !canRevise) || !value.trim()} aria-label="发送修改要求"><ArrowUp size={18}/></Button>
        </div>
      </form>
      {(canRevise || awaitingReview) && <p className="agent-review-note">{canRevise ? '可继续提出修改要求，Agent 会基于候选稿迭代；接受前不会改变正文' : '请先处理上方确认事项；新要求会保留在输入框中'}</p>}
      <details className="agent-help">
        <summary>使用说明与确认规则</summary>
        <p>改稿按用途匹配；配图自动匹配声明图片能力的 Skill。也可选择或输入 $标识 明确调用，最多 {MAX_RUN_SKILLS} 个。图片权限不会跳过生图确认。</p>
        <p>可直接要求改稿、配图或准备发布；识别要求使用文字模型。核查最多 {FACT_CHECK_MAX_CLAIMS} 条事实，会使用模型与检索额度；生图、发布仍需另行确认。</p>
      </details>
    </div>
  </aside>
}
