import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Check, ImagePlus, Save, Send } from 'lucide-react'
import { api, API_BASE, type Account, type GenerationEvent, type RewriteTemplate, type Task, type Version } from '@/lib/api'
import { getErrorMessage, messages } from '@/lib/messages'
import { withSourceMediaPreviews, resolveMediaUrl } from '@/lib/source-media'
import { articleSourceLabel, cn, escapeHtml } from '@/lib/utils'
import { promptText } from '@/lib/prompt'
import { AgentPanel, type AgentActivity, type AgentMessage } from '@/components/workspace/AgentPanel'
import { ApprovalCard } from '@/components/workspace/ApprovalCard'
import { PublishPreview } from '@/components/workspace/PublishPreview'
import { EvidencePanel, type EvidenceSource } from '@/components/workspace/EvidencePanel'
import { WorkspaceLayout, type WorkspacePanel } from '@/components/workspace/WorkspaceLayout'
import { DiffReview, reviewText } from '@/components/workspace/DiffReview'
import { useArticleDraft, taskEditorHtml } from '@/lib/article-draft'
import { RichEditor } from '@/components/RichEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { QueryFeedback } from '@/components/ui/query-feedback'
import { factCheckStatusLabels, type FactCheckReport } from '../../../shared/research'
import type { SkillInvocation } from '../../../shared/skills'
import { isWechatPlatform } from '../../../shared/publishing'
import { proposalDecisionMessages, type AgentPlan } from '../../../shared/agent'

type Proposal = { runId: string; html: string; baseHtml: string | null; baseVersionId: string | null; localBaseline: string; restored?: boolean }
type ArticleSnapshot = { current_html: string; base_version_id: string | null }
type ImageApproval = { prompt: string; aspect_ratio: '1:1' | '4:3' | '3:4' | '16:9'; alt_text: string; source_asset_id: string }
type GeneratedImages = { items: Array<{ id: string; url: string; alt_text: string }>; selectedId: string; request: ImageApproval }
type BrowserPublish = { scheduleId: string; accountId: string; preview: { account: { name: string; platform: string }; article: { title: string; html: string; image_count: number; version_id: string } } }

const messageId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export function TaskDetailPage() {
  const { articleId } = useParams({ from: '/articles/$articleId' })
  return <ArticleWorkspace key={articleId} articleId={articleId}/>
}

function ArticleWorkspace({ articleId }: { articleId: string }) {
  const client = useQueryClient()
  const generationStream = useRef<EventSource | null>(null)
  const restoredHistory = useRef(false)
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('article')
  const [editorView, setEditorView] = useState<'draft' | 'changes' | 'saved'>('draft')
  const [decisionBusy, setDecisionBusy] = useState(false)
  const [skillId, setSkillId] = useState('')
  const [invocations, setInvocations] = useState<SkillInvocation[]>()
  const [accountId, setAccountId] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [imageApproval, setImageApproval] = useState<ImageApproval | null>(null)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImages | null>(null)
  const [publishApproval, setPublishApproval] = useState(false)
  const [browserPublish, setBrowserPublish] = useState<BrowserPublish | null>(null)
  const [agentBusy, setAgentBusy] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [sources, setSources] = useState<EvidenceSource[]>([])
  const [factReport, setFactReport] = useState<FactCheckReport | null>(null)
  const [activities, setActivities] = useState<AgentActivity[]>([])
  const [chat, setChat] = useState<AgentMessage[]>([
    { id: 'welcome', role: 'assistant', content: '告诉我你希望怎样改稿、配图或准备发布。改稿先审阅差异，配图先确认提示词，发布先核对内容和账号。' },
  ])

  const task = useQuery({ queryKey: ['task', articleId], queryFn: () => api<Task>(`/api/tasks/${articleId}`) })
  const versions = useQuery({ queryKey: ['versions', articleId], queryFn: () => api<Version[]>(`/api/tasks/${articleId}/versions`) })
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api<Account[]>('/api/admin/accounts') })
  const skills = useQuery({ queryKey: ['rewrite-templates'], queryFn: () => api<RewriteTemplate[]>('/api/rewrite-templates') })
  const history = useQuery({ queryKey: ['agent-history', articleId], queryFn: () => api<GenerationEvent[]>(`/api/tasks/${articleId}/agent-history`) })
  const skillOptions = Array.isArray(skills.data) ? skills.data : []
  const draft = useArticleDraft(articleId, task.data)
  const { html, setHtml } = draft
  const proposalConflict = !!proposal && (proposal.baseHtml === null || proposal.baseVersionId !== draft.versionId || draft.conflict ||
    (proposal.restored ? reviewText(proposal.localBaseline) !== reviewText(html) : proposal.localBaseline !== html))

  useEffect(() => {
    if (restoredHistory.current || !Array.isArray(history.data)) return
    restoredHistory.current = true
    const messageEvents = history.data.filter(event => event.event_type === 'agent_message')
    const conversation = history.data.flatMap<AgentMessage>(event => {
      if (event.event_type === 'agent_message') return [{ id: String(event.id), role: event.payload.role === 'user' ? 'user' : 'assistant', content: String(event.payload.content || '') }]
      if (event.event_type === 'agent_proposal' && (event.payload.status === 'accepted' || event.payload.status === 'rejected' || event.payload.status === 'superseded')) return [{ id: String(event.id), role: 'assistant', content: proposalDecisionMessages[event.payload.status] }]
      return []
    })
    if (conversation.length) setChat(conversation)
    const lastRequest = [...messageEvents].reverse().find(event => event.payload.role === 'user')
    const lastImageSkills = [...messageEvents].reverse().find(event => event.payload.role === 'assistant' && Array.isArray(event.payload.skills) && event.id > (lastRequest?.id ?? 0))
    const lastSkills = [...history.data].reverse().find(event => event.event_type === 'status' && ['running', 'skills_selected'].includes(String(event.payload.status)))
    if (lastImageSkills) setInvocations(lastImageSkills.payload.skills as SkillInvocation[])
    else if (lastSkills?.payload.status === 'skills_selected' && lastSkills.run_id && lastSkills.run_id === lastRequest?.run_id && Array.isArray(lastSkills.payload.skills)) setInvocations(lastSkills.payload.skills as SkillInvocation[])
    const latestResearch = [...history.data].reverse().find(event => event.event_type === 'status' && ['running', 'fact_check_started', 'fact_check_completed', 'search_completed'].includes(String(event.payload.status)))
    if (latestResearch?.payload.status === 'fact_check_completed') {
      const report = latestResearch.payload.report as FactCheckReport
      if (report?.schema_version === 1) { setFactReport(report); setSources(report.sources) }
    } else if (latestResearch?.payload.status === 'search_completed' && Array.isArray(latestResearch.payload.sources)) setSources(latestResearch.payload.sources as EvidenceSource[])
    const decided = new Set(history.data.filter(event => event.event_type === 'agent_proposal').map(event => event.run_id))
    const pending = [...messageEvents].reverse().find(event => event.payload.status === 'awaiting_approval' && event.run_id && !decided.has(event.run_id))
    if (pending) {
      const baseHtml = typeof pending.payload.base_html === 'string' ? pending.payload.base_html : null
      setProposal({ runId: pending.run_id!, html: String(pending.payload.proposal_html || ''), baseHtml, baseVersionId: typeof pending.payload.base_version_id === 'string' ? pending.payload.base_version_id : null, localBaseline: withSourceMediaPreviews(baseHtml ?? '', [], API_BASE), restored: true })
      setEditorView('changes')
    }
  }, [history.data])
  useEffect(() => () => generationStream.current?.close(), [])

  const addMessage = (role: AgentMessage['role'], content: string) => setChat(current => [...current, { id: messageId(), role, content }])
  const save = useMutation({
    mutationFn: async () => {
      const submitted = draft.currentHtml()
      const saved = await messages.promise(api<Task>(`/api/tasks/${articleId}/draft`, { method: 'PATCH', body: JSON.stringify({ html: submitted, base_version_id: draft.versionId }) }), { loading: '正在保存文章…', success: '文章已保存' })
      if (draft.currentHtml() !== submitted) messages.info('已保存提交时的正文；等待期间的新编辑仍未保存。')
      draft.saved(saved, submitted)
      return saved
    },
    onSuccess: (saved) => {
      client.setQueryData(['task', articleId], { ...task.data, ...saved })
      void Promise.all([task.refetch(), versions.refetch(), client.invalidateQueries({ queryKey: ['tasks'] })])
    },
    onError: () => { void task.refetch() },
  })

  const runAgent = async (instruction: string, snapshot: ArticleSnapshot, previous: Proposal | null = null) => {
    if (agentBusy || (proposal && !previous) || decisionBusy || save.isPending || draft.conflict) return
    setAgentBusy(true)
    setSources([])
    setFactReport(null)
    setInvocations(undefined)
    setActivities([])
    const localBaseline = snapshot.current_html
    let run: { id: string; base_html: string; base_version_id: string | null }
    try {
      run = await api(`/api/tasks/${articleId}/agent-runs`, { method: 'POST', body: JSON.stringify({ instruction, template_id: skillId || null, ...(previous ? { revise_run_id: previous.runId, base_version_id: previous.baseVersionId } : snapshot) }) })
    } catch (error) {
      addMessage('assistant', `无法开始处理：${getErrorMessage(error)}`)
      setAgentBusy(false)
      void task.refetch()
      return
    }
    const baseline = { baseHtml: run.base_html, baseVersionId: run.base_version_id, localBaseline }
    setEditorView('changes')
    let partial = ''
    const stream = new EventSource(`${API_BASE}/api/generation-runs/${run.id}/events`, { withCredentials: true })
    generationStream.current = stream
    let settled = false
    const close = () => {
      if (settled) return false
      settled = true
      stream.close()
      if (generationStream.current === stream) generationStream.current = null
      setAgentBusy(false)
      return true
    }
    stream.addEventListener('tool_call', event => {
      const payload = JSON.parse((event as MessageEvent).data)
      if (payload.name === 'web_search') setActivities([{ label: `正在检索：${payload.arguments?.query || task.data?.original_title}`, status: 'running' }])
    })
    stream.addEventListener('status', event => {
      const payload = JSON.parse((event as MessageEvent).data)
      if (payload.status === 'skills_selected' && Array.isArray(payload.skills)) {
        setInvocations(payload.skills)
        return
      }
      if (payload.status === 'fact_check_started' || payload.status === 'fact_check_assessing') {
        setActivities([{ label: payload.message, status: 'running' }])
        return
      }
      if (payload.status === 'fact_check_completed' && payload.report?.schema_version === 1) {
        const report = payload.report as FactCheckReport
        setFactReport(report)
        setSources(report.sources)
        setActivities([{ label: `${factCheckStatusLabels[report.status]}：${report.note}`, status: report.status === 'partial' || report.status === 'failed' ? 'failed' : 'completed' }])
        return
      }
      if (payload.status !== 'search_completed') return
      setSources(current => [...new Map([...current, ...(Array.isArray(payload.sources) ? payload.sources : [])].map(source => [source.url, source])).values()])
      setActivities([{ label: payload.has_context ? '已取得检索资料，尚待核查结论' : '本条未找到可用来源', status: 'running' }])
    })
    stream.addEventListener('text_delta', event => {
      partial += JSON.parse((event as MessageEvent).data).delta
      setProposal({ runId: run.id, html: partial, ...baseline })
    })
    stream.addEventListener('completed', event => {
      if (!close()) return
      const completed = JSON.parse((event as MessageEvent).data).html
      setProposal({ runId: run.id, html: completed, ...baseline })
      addMessage('assistant', '候选稿已经完成。请查看修改对比，接受后才会成为当前文章。')
    })
    stream.addEventListener('error', event => {
      try {
        const payload = JSON.parse((event as MessageEvent).data)
        if (payload.scope === 'search') {
          setActivities([{ label: `求实失败：${payload.message}`, status: 'failed' }])
          return
        }
      } catch {
        // Native connection errors do not carry a JSON payload.
      }
      if (!close()) return
      setProposal(previous)
      setEditorView(previous ? 'changes' : 'draft')
      addMessage('assistant', previous ? '这轮修改未完成，上一版候选稿仍保留，正文没有变化。连接中断时请先等待后台结束，再重试或处理候选稿。' : '这次处理失败了，原文没有被覆盖。你可以稍后重试。')
    })
  }

  const acceptProposal = async () => {
    if (!proposal || proposalConflict || decisionBusy || agentBusy || planning) return
    const submitted = draft.currentHtml()
    setDecisionBusy(true)
    try {
      const accepted = await messages.promise(api<Task>(`/api/tasks/${articleId}/agent-runs/${proposal.runId}/accept`, { method: 'POST' }), { loading: '正在接受修改…', success: '修改已应用' })
      const editedDuringAccept = draft.currentHtml() !== submitted
      draft.saved({ ...accepted, media: accepted.media ?? task.data?.media }, submitted)
      client.setQueryData(['task', articleId], { ...task.data, ...accepted })
      setProposal(null)
      setEditorView('draft')
      addMessage('assistant', editedDuringAccept ? '候选稿已保存为新版本。等待期间的新编辑仍保留在编辑器，尚未与候选稿合并；可以在历史版本中查看已接受稿。' : '修改已经应用为新版本。你可以继续提出要求。')
      await Promise.all([task.refetch(), versions.refetch(), client.invalidateQueries({ queryKey: ['tasks'] })])
    } catch {
      void task.refetch()
    } finally { setDecisionBusy(false) }
  }

  const rejectProposal = async () => {
    if (!proposal || decisionBusy || agentBusy || planning) return
    setDecisionBusy(true)
    try {
      await api(`/api/tasks/${articleId}/agent-runs/${proposal.runId}/reject`, { method: 'POST' })
      setProposal(null)
      setEditorView('draft')
      addMessage('assistant', '已放弃这版候选稿，当前文章没有变化。')
    } catch (error) {
      messages.error(getErrorMessage(error))
    } finally { setDecisionBusy(false) }
  }

  const requestImage = async () => {
    if (mediaBusy || planning || imageApproval) return
    const instruction = await promptText('希望图片表达什么？', `为“${task.data?.original_title ?? '这篇文章'}”生成一张真实、克制的新闻配图`)
    if (!instruction) return
    addMessage('user', instruction)
    await prepareImagePrompt(instruction, { current_html: draft.currentHtml(), base_version_id: draft.versionId })
  }

  const prepareImagePrompt = async (instruction: string, snapshot: ArticleSnapshot) => {
    setMediaBusy(true)
    setInvocations(undefined)
    setActivities([{ label: '文字模型正在准备图片提示词', status: 'running' }])
    try {
      const selection = await api<{ invocations: SkillInvocation[] }>(`/api/tasks/${articleId}/image-skills`, { method: 'POST', body: JSON.stringify({ instruction, skill_ids: skillId ? [skillId] : undefined }) })
      setInvocations(selection.invocations)
      setActivities([{ label: selection.invocations.length ? `已加载配图 Skill：${selection.invocations.map(skill => skill.name).join(' → ')}` : '本轮未匹配额外配图 Skill', status: 'completed' }])
      const result = await messages.promise(api<Omit<ImageApproval, 'source_asset_id'> & { skills: SkillInvocation[] }>(`/api/tasks/${articleId}/image-prompt`, { method: 'POST', body: JSON.stringify({ instruction, ...snapshot, skill_ids: skillId ? [skillId] : undefined }) }), { loading: 'Agent 正在准备图片提示词…', success: '图片提示词等待确认' })
      setImageApproval({ ...result, source_asset_id: '' })
      setInvocations(result.skills)
      setActivePanel('agent')
      setActivities([{ label: '文字模型已准备提示词，尚未调用图片模型', status: 'completed' }])
      addMessage('assistant', '我先准备了图片提示词。你确认或修改后，我才会调用图片模型。')
    } catch (error) {
      setActivities([{ label: '图片提示词准备失败，尚未调用图片模型', status: 'failed' }])
      addMessage('assistant', `图片提示词准备失败，尚未生图：${getErrorMessage(error)}`)
    } finally {
      setMediaBusy(false)
    }
  }

  const submitInstruction = async (instruction: string) => {
    if (planning || agentBusy || mediaBusy || publishing || proposalConflict || imageApproval || generatedImages || publishApproval || browserPublish || decisionBusy || save.isPending || draft.conflict) return
    const snapshot = { current_html: draft.currentHtml(), base_version_id: draft.versionId }
    addMessage('user', instruction)
    setPlanning(true)
    setActivities([{ label: '文字模型正在识别本轮要求', status: 'running' }])
    setInvocations(undefined)
    try {
      const plan = await api<AgentPlan>(`/api/tasks/${articleId}/agent-plan`, { method: 'POST', body: JSON.stringify({ instruction }) })
      setActivities([])
      if (proposal && (plan.action === 'image_prompt' || plan.action === 'publish_preview')) {
        addMessage('assistant', '当前还有待审阅的候选稿。请先接受或放弃，再配图或准备发布；你也可以继续提出改稿要求。')
        return
      }
      switch (plan.action) {
        case 'article_edit': await runAgent(instruction, snapshot, proposal); break
        case 'image_prompt': await prepareImagePrompt(instruction, snapshot); break
        case 'publish_preview':
          setPublishApproval(true)
          setActivePanel('agent')
          addMessage('assistant', '请先选择账号并核对当前文章。此时还没有打开发布浏览器，也没有提交发布。')
          break
        case 'clarify': addMessage('assistant', plan.message); break
        default: throw new Error('无法确认要执行的动作，请明确要求后重试')
      }
    } catch (error) {
      setActivities([{ label: '动作识别失败，未执行改稿、生图或发布', status: 'failed' }])
      addMessage('assistant', getErrorMessage(error))
    } finally { setPlanning(false) }
  }

  const generateApprovedImage = async () => {
    if (!imageApproval || mediaBusy) return
    setMediaBusy(true)
    try {
      const path = imageApproval.source_asset_id ? `/api/media/${imageApproval.source_asset_id}/edit` : '/api/media/generate'
      const request = { task_id: articleId, prompt: imageApproval.prompt, aspect_ratio: imageApproval.aspect_ratio, alt_text: imageApproval.alt_text, source_asset_id: imageApproval.source_asset_id || null }
      const approval = await api<{ id: string }>(`/api/tasks/${articleId}/image-approval`, { method: 'POST', body: JSON.stringify(request) })
      const items = await messages.promise(api<Array<{ id: string; url: string; alt_text: string }>>(path, { method: 'POST', body: JSON.stringify({ ...request, approval_id: approval.id }) }), { loading: imageApproval.source_asset_id ? '正在根据参考图生成…' : '正在生成图片…', success: '图片已生成，等待选择' })
      if (!items.length) throw new Error('图片服务没有返回可选结果')
      setGeneratedImages({ items, selectedId: items[0].id, request: imageApproval })
      setImageApproval(null)
      addMessage('assistant', '图片已经生成，但还没有插入文章。请选择结果，确认插入后再保存正文。')
      void task.refetch()
    } catch {
      // Global feedback already reports the error.
    } finally {
      setMediaBusy(false)
    }
  }

  const insertGeneratedImage = async () => {
    if (!generatedImages || mediaBusy) return
    const chosen = generatedImages.items.find(item => item.id === generatedImages.selectedId)
    if (!chosen) return
    setMediaBusy(true)
    try {
      await api(`/api/tasks/${articleId}/media/${chosen.id}/select`, { method: 'POST' })
      const url = resolveMediaUrl(chosen.url, API_BASE)
      setHtml(current => `${current}<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(chosen.alt_text || generatedImages.request.alt_text)}" data-asset-id="${escapeHtml(chosen.id)}" loading="lazy"></figure>`)
      setGeneratedImages(null)
      addMessage('assistant', '所选图片已插入编辑器，尚未保存。保存文章后会成为新版本。')
      void task.refetch()
    } catch (error) {
      messages.error(getErrorMessage(error))
    } finally { setMediaBusy(false) }
  }

  const uploadMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || mediaBusy) return
    setMediaBusy(true)
    try {
      const body = new FormData()
      body.append('task_id', articleId)
      body.append('file', file)
      const asset = await messages.promise(api<{ url: string; media_type: 'image' | 'video' }>('/api/media/upload', { method: 'POST', body }), { loading: '正在上传媒体…', success: '媒体已加入文章' })
      const url = `${API_BASE}${asset.url}`
      setHtml(current => asset.media_type === 'video' ? `${current}<video controls src="${url}"></video>` : `${current}<img src="${url}" alt="">`)
    } catch {
      // Global feedback already reports the error.
    } finally {
      event.target.value = ''
      setMediaBusy(false)
    }
  }

  const activateVersion = async (version: Version) => {
    if (draft.dirty) { messages.info('请先保存当前编辑，再恢复历史版本。'); return }
    try {
      const submitted = draft.currentHtml()
      const activated = await api<Task>(`/api/tasks/${articleId}/versions/${version.id}/activate`, { method: 'POST', body: JSON.stringify({ base_version_id: draft.versionId }) })
      draft.saved({ ...activated, media: task.data?.media }, submitted)
      await client.invalidateQueries({ queryKey: ['task', articleId] })
    } catch (error) {
      messages.error(getErrorMessage(error))
    }
  }

  const publish = async () => {
    if (!accountId || publishing) return
    setPublishing(true)
    try {
      const result = await messages.promise((async () => {
        const saved = await api<Task>(`/api/tasks/${articleId}/draft`, { method: 'PATCH', body: JSON.stringify({ html, base_version_id: draft.versionId }) })
        draft.saved(saved, html)
        return api<{ id: string; browser?: boolean }>(`/api/tasks/${articleId}/publish`, { method: 'POST', body: JSON.stringify({ account_id: accountId }) })
      })(), { loading: '正在保存并准备发布…', success: '发布内容已锁定' })
      setPublishApproval(false)
      if (result.browser) {
        if (!window.desktop?.prepareBrowserPublish) throw new Error('公众号浏览器发布只能在桌面应用中使用')
        const prepared = await messages.promise(window.desktop.prepareBrowserPublish(result.id), { loading: '正在打开公众号并填写图文…', success: '公众号浏览器已打开' })
        if (prepared.status === 'awaiting_approval') {
          setBrowserPublish({ scheduleId: result.id, accountId, preview: prepared.preview })
          addMessage('assistant', '标题和正文已填写到公众号。请在平台浏览器预览核对，再回到这里确认真实发布。')
        } else addMessage('assistant', prepared.message)
      } else addMessage('assistant', '文章已提交发布，你可以在“发布记录”中查看进度。')
      await Promise.all([task.refetch(), versions.refetch(), client.invalidateQueries({ queryKey: ['tasks'] })])
    } catch {
      // Global feedback already reports the error.
    } finally {
      setPublishing(false)
    }
  }

  const confirmBrowserPublish = async () => {
    if (!browserPublish || publishing || !window.desktop?.confirmBrowserPublish) return
    setPublishing(true)
    try {
      const result = await messages.promise(window.desktop.confirmBrowserPublish(browserPublish.scheduleId), { loading: '正在执行公众号真实发布…', success: '公众号发布操作已完成' })
      setBrowserPublish(null)
      addMessage('assistant', result.message)
      await Promise.all([task.refetch(), client.invalidateQueries({ queryKey: ['tasks'] }), client.invalidateQueries({ queryKey: ['schedules'] })])
    } catch {
      // Global feedback already reports the error.
    } finally { setPublishing(false) }
  }

  if (!task.data) return <QueryFeedback query={task} label="文章"/>
  const selectedAccount = accounts.data?.find(account => account.id === (browserPublish?.accountId ?? accountId))
  const readyImages = (task.data.media ?? []).filter(item => item.media_type === 'image' && item.status === 'ready')
  const selectedReference = readyImages.find(item => item.id === imageApproval?.source_asset_id)
  const approval = proposal ? <ApprovalCard title="审阅 Agent 修改" description={agentBusy ? 'Agent 正在完成候选稿，结束后即可确认。' : proposalConflict ? '正文已变更或缺少改稿基准，不能覆盖当前编辑。请放弃这版，核对并保存正文后重新改稿。' : '接受后才会保存为新版本；也可在下方继续提出修改要求。'} confirmLabel="接受修改" cancelLabel="放弃这版" busy={planning || agentBusy || decisionBusy} confirmDisabled={proposalConflict} onConfirm={acceptProposal} onCancel={rejectProposal}><Button variant="secondary" onClick={() => { setActivePanel('article'); setEditorView('changes') }}>查看修改对比</Button></ApprovalCard>
    : imageApproval ? <ApprovalCard title="确认图片提示词" description="确认后将调用图片模型并产生费用。" confirmLabel={imageApproval.source_asset_id ? '确认图生图' : '确认生成'} busy={mediaBusy} onConfirm={generateApprovedImage} onCancel={() => setImageApproval(null)}>
      <label className="block text-xs font-medium text-muted-foreground">提示词<Textarea className="mt-2 min-h-28 text-xs leading-5" value={imageApproval.prompt} onChange={event => setImageApproval({ ...imageApproval, prompt: event.target.value })}/></label>
      <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-medium text-muted-foreground">画幅<Select className="mt-2 px-2 text-xs" value={imageApproval.aspect_ratio} onChange={event => setImageApproval({ ...imageApproval, aspect_ratio: event.target.value as ImageApproval['aspect_ratio'] })}><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option><option value="3:4">3:4</option></Select></label><label className="text-xs font-medium text-muted-foreground">参考图<Select className="mt-2 px-2 text-xs" value={imageApproval.source_asset_id} onChange={event => setImageApproval({ ...imageApproval, source_asset_id: event.target.value })}><option value="">不使用</option>{readyImages.map((image, index) => <option key={image.id} value={image.id}>文章图片 {index + 1}</option>)}</Select></label></div>{selectedReference && <figure className="approval-reference mt-3 bg-surface-subtle p-3"><img className="max-h-40 w-full object-contain" src={resolveMediaUrl(selectedReference.url || '', API_BASE)} alt={`图生图参考：${selectedReference.alt_text || '文章图片'}`}/><figcaption className="mt-2 text-center text-xs text-muted-foreground">本次图生图使用的参考图</figcaption></figure>}
    </ApprovalCard>
    : generatedImages ? <ApprovalCard title="选择生成结果" description="生成已经产生额度消耗；只有你选中并确认后，图片才会插入正文。" confirmLabel="插入正文" cancelLabel="暂不插入" busy={mediaBusy} onConfirm={insertGeneratedImage} onCancel={() => setGeneratedImages(null)}>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="生成图片结果">{generatedImages.items.map((item, index) => <label key={item.id} className={cn('approval-image-choice studio-choice cursor-pointer border p-2 focus-within:ring-2 focus-within:ring-primary', generatedImages.selectedId === item.id ? 'border-primary bg-accent' : 'border-border')}><input className="sr-only" type="radio" name="generated-image" checked={generatedImages.selectedId === item.id} onChange={() => setGeneratedImages({ ...generatedImages, selectedId: item.id })}/><img className="aspect-video w-full object-cover" src={resolveMediaUrl(item.url, API_BASE)} alt={item.alt_text || `生成结果 ${index + 1}`}/><span className="mt-2 block text-center text-xs">结果 {index + 1}{generatedImages.selectedId === item.id ? ' · 已选择' : ''}</span></label>)}</div>
      <Button className="mt-3" variant="secondary" onClick={() => { setImageApproval(generatedImages.request); setGeneratedImages(null) }} disabled={mediaBusy}>修改提示词后重新生成</Button>
    </ApprovalCard>
    : browserPublish ? <ApprovalCard title="确认公众号真实发布" description="请先在已打开的公众号浏览器核对填入内容。确认后 Agent 才会点击平台的真实发布按钮；结果不明确时会停止，不自动重试。" confirmLabel="确认真实发布" busy={publishing} onConfirm={confirmBrowserPublish} onCancel={() => setBrowserPublish(null)}>
      <PublishPreview {...browserPublish.preview} bodyLimit={180}/>
    </ApprovalCard>
    : publishApproval ? <ApprovalCard title="核对发布内容" description={selectedAccount?.adapter === 'browser' ? '确认后只会打开隔离浏览器并填写公众号，不会点击真实发布；填写完成后还会再确认一次。' : '请核对目标账号和最终内容。'} confirmLabel={selectedAccount?.adapter === 'browser' ? '填写公众号' : '确认发布'} busy={publishing} confirmDisabled={!accountId} onConfirm={publish} onCancel={() => setPublishApproval(false)}><label className="block text-xs font-medium text-muted-foreground">目标账号<Select className="mt-2 px-2 text-xs" value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">请选择账号</option>{accounts.data?.map(account => { const supported = account.adapter !== 'browser' || (isWechatPlatform(account.platform) && Boolean(window.desktop?.prepareBrowserPublish)); return <option key={account.id} value={account.id} disabled={!supported}>{account.name} · {account.platform}{supported ? '' : '（当前不可用）'}</option> })}</Select></label>{selectedAccount && <div className="approval-reference mt-3 space-y-1 bg-surface-subtle p-3 text-xs leading-5"><p><strong>平台：</strong>{selectedAccount.platform}</p><p><strong>账号：</strong>{selectedAccount.name}</p><p><strong>标题：</strong>{task.data.original_title}</p><p><strong>正文：</strong>{reviewText(html).slice(0, 180)}{reviewText(html).length > 180 ? '…' : ''}</p><p><strong>图片：</strong>{(html.match(/<img\b/gi) ?? []).length} 张</p></div>}</ApprovalCard>
    : undefined

  return <div className="article-workspace flex h-full min-h-0 min-w-0 flex-col">
    <header className="workspace-document-header">
      <div className="workspace-document-heading"><h2 title={task.data.original_title}>{task.data.original_title}</h2><div className="workspace-document-meta"><span>{articleSourceLabel(task.data.platform)}</span><span aria-hidden="true">·</span><span>{versions.data?.length ?? 0} 个版本</span><span className="workspace-save-state">{!draft.dirty && !save.isPending && <Check size={12} aria-hidden="true"/>}{save.isPending ? '保存中…' : draft.dirty ? '未保存' : '已保存'}</span><Badge value={agentBusy ? 'running' : proposal ? 'awaiting_approval' : task.data.generation_status}/></div></div>
      <div className="workspace-document-actions"><Button variant="ghost" onClick={requestImage} disabled={planning || mediaBusy || agentBusy || !!approval}><ImagePlus size={16}/>配图</Button><Button variant="secondary" onClick={() => save.mutate()} busy={save.isPending} disabled={decisionBusy || publishing || draft.conflict}><Save size={16}/>保存</Button><Button onClick={() => { setPublishApproval(true); setActivePanel('agent') }} disabled={planning || mediaBusy || agentBusy || Boolean(approval) || draft.conflict}><Send size={16}/>发布</Button></div>
    </header>
    <WorkspaceLayout activePanel={activePanel} onPanelChange={setActivePanel} approvalCount={approval && !agentBusy ? 1 : 0}
      evidence={<EvidencePanel sources={sources} report={factReport} versions={Array.isArray(versions.data) ? versions.data : []} media={Array.isArray(task.data.media) ? task.data.media : []} activeVersionId={task.data.active_version_id} mediaBusy={mediaBusy} onActivateVersion={activateVersion} onUpload={uploadMedia}/>}
      article={<div className="workspace-document min-w-0 space-y-3">
        {draft.conflict && <ApprovalCard title="已保存正文有更新" description="本地编辑仍然保留。请先查看差异；选择已保存版本会舍弃当前未保存内容。" confirmLabel="使用已保存版本" cancelLabel="继续保留本地" confirmDisabled={editorView !== 'saved'} onConfirm={() => { draft.useSavedVersion(); setEditorView('draft') }} onCancel={() => setEditorView('draft')}><Button variant="secondary" onClick={() => setEditorView('saved')}>核对已保存版本</Button></ApprovalCard>}
        {(proposal || editorView === 'saved') && <div className="flex flex-wrap gap-2"><Button variant={editorView === 'draft' ? 'default' : 'secondary'} aria-pressed={editorView === 'draft'} onClick={() => setEditorView('draft')}>编辑正文</Button>{proposal && <Button variant={editorView === 'changes' ? 'default' : 'secondary'} aria-pressed={editorView === 'changes'} onClick={() => setEditorView('changes')}>修改对比</Button>}</div>}
        {editorView === 'changes' && proposal && <DiffReview before={proposal.baseHtml ?? ''} after={proposal.html} busy={agentBusy}/>}
        {editorView === 'saved' && <DiffReview title="本地正文 → 已保存版本" before={html} after={taskEditorHtml(task.data)}/>}
        <div className="workspace-editor-slot" hidden={editorView !== 'draft' && (!!proposal || editorView === 'saved')}><RichEditor value={html} onChange={setHtml}/></div>
      </div>}
      agent={<AgentPanel messages={chat} activities={activities} skills={skillOptions} skillId={skillId} invocations={invocations} busy={planning || agentBusy || mediaBusy || publishing || save.isPending || decisionBusy} approval={approval} active={activePanel === 'agent'} awaitingReview={Boolean(approval) || draft.conflict} canRevise={!!proposal && !proposalConflict && !agentBusy} onSkillChange={setSkillId} onSubmit={submitInstruction} onRequestImage={requestImage}/>}
    />
  </div>
}
