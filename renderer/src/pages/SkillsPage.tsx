import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ChevronRight, Download, Pencil, Plus, Save, Search, ShieldCheck, Terminal, Trash2 } from 'lucide-react'
import { api, type RewriteTemplate } from '@/lib/api'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { SkillImportDialog } from '@/components/workspace/SkillImportDialog'
import { permissionLabels } from '@/lib/skills'
import { SkillReferences } from '@/components/workspace/SkillReferences'
import { QueryFeedback } from '@/components/ui/query-feedback'

type SkillDraft = Pick<RewriteTemplate, 'name' | 'description' | 'system_prompt' | 'user_prompt_template' | 'version' | 'enabled' | 'permissions'>
const EMPTY: SkillDraft = { name: '', description: '', system_prompt: '你是一位专业的中文媒体编辑。', user_prompt_template: '请根据本轮用户要求修改文章，保持事实准确。\n\n标题：{title}\n\n正文：\n{content}', version: '1.0.0', enabled: true, permissions: ['web_search'] }

export function SkillsPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['rewrite-templates'], queryFn: () => api<RewriteTemplate[]>('/api/rewrite-templates') })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<SkillDraft>(EMPTY)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<'save' | 'toggle' | 'remove' | null>(null)
  const skills = useMemo(() => (query.data ?? []).filter(skill => `${skill.name} ${skill.description}`.toLowerCase().includes(search.toLowerCase())), [query.data, search])
  const selected = query.data?.find(skill => skill.id === selectedId)
  const draftSkillId = useRef('')
  useEffect(() => {
    if (!selectedId && !editing && query.data?.length) setSelectedId(query.data[0].id)
  }, [query.data, selectedId, editing])
  useEffect(() => {
    if (!selected || (editing && selected.id === draftSkillId.current)) return
    draftSkillId.current = selected.id
    setDraft({ name: selected.name, description: selected.description, system_prompt: selected.system_prompt, user_prompt_template: selected.user_prompt_template, version: selected.version || '1.0.0', enabled: selected.enabled !== false, permissions: selected.permissions ?? [] })
    setEditing(false)
  }, [selected, editing])
  const set = <K extends keyof SkillDraft>(key: K, value: SkillDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const startInstall = () => { setSelectedId(''); setDraft(EMPTY); setEditing(true) }
  const installed = (skill: RewriteTemplate) => {
    client.setQueryData<RewriteTemplate[]>(['rewrite-templates'], current => [...(current ?? []).filter(item => item.id !== skill.id), skill])
    setSelectedId(skill.id)
    setEditing(false)
    void client.invalidateQueries({ queryKey: ['rewrite-templates'] })
  }
  const save = async () => {
    if (!draft.name.trim() || busy) return
    setBusy('save')
    try {
      const saved = await messages.promise(api<RewriteTemplate>(selectedId ? `/api/rewrite-templates/${selectedId}` : '/api/rewrite-templates', { method: selectedId ? 'PATCH' : 'POST', body: JSON.stringify(draft) }), { loading: selectedId ? '正在更新 Skill…' : '正在安装 Skill…', success: selectedId ? 'Skill 已更新' : 'Skill 已安装' })
      await client.invalidateQueries({ queryKey: ['rewrite-templates'] })
      setSelectedId(saved.id)
      setEditing(false)
    } catch {
      // Global feedback already reports the error.
    } finally {
      setBusy(null)
    }
  }
  const toggle = async () => {
    if (!selected || busy) return
    setBusy('toggle')
    try {
      await messages.promise(api(`/api/rewrite-templates/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !selected.enabled }) }), { loading: '正在更新状态…', success: selected.enabled ? 'Skill 已停用' : 'Skill 已启用' })
      await client.invalidateQueries({ queryKey: ['rewrite-templates'] })
    } catch {
      // Global feedback already reports the error.
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!selected || selected.is_builtin || busy || !window.confirm(`确定卸载“${selected.name}”吗？`)) return
    setBusy('remove')
    try {
      await messages.promise(api(`/api/rewrite-templates/${selected.id}`, { method: 'DELETE' }), { loading: '正在卸载 Skill…', success: 'Skill 已卸载' })
      setSelectedId('')
      await client.invalidateQueries({ queryKey: ['rewrite-templates'] })
    } catch {
      // Global feedback already reports the error.
    } finally {
      setBusy(null)
    }
  }
  return <div className="studio-secondary-page skills-page">
    <header className="studio-page-heading">
      <div><h1 className="studio-page-title">Skills</h1><p className="studio-page-description">管理写作方法与工具权限，在文章对话中按需调用。</p></div>
      <div className="studio-page-actions"><Button variant="secondary" onClick={startInstall} aria-label="手动创建 Skill"><Plus size={16}/>创建 Skill</Button><SkillImportDialog onInstalled={installed}/></div>
    </header>
    <QueryFeedback query={query} label="Skills"/>
    <div className="skills-layout">
      <aside className="skill-library" aria-label="Skills 列表">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" size={16}/><Input value={search} onChange={event => setSearch(event.target.value)} aria-label="搜索 Skills" placeholder="搜索名称或用途" className="pl-10"/></div>
        {[{ label: '内置', items: skills.filter(skill => skill.is_builtin) }, { label: '已安装', items: skills.filter(skill => !skill.is_builtin) }].map(group => <section key={group.label} className="skill-library-group" aria-label={`${group.label} Skills`}>
          <div className="skill-library-heading"><h2>{group.label}</h2><span>{group.items.length}</span></div>
          <div className="skill-library-items">{group.items.map(skill => <button key={skill.id} onClick={() => setSelectedId(skill.id)} className="skill-list-item" aria-pressed={selectedId === skill.id}>
            <span className="skill-list-icon" aria-hidden="true">{skill.is_builtin ? <BookOpen size={18}/> : <Download size={18}/>}</span>
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><strong className="text-sm font-semibold">{skill.name}</strong><span className={cn('skill-state', skill.enabled === false ? 'text-muted-foreground' : 'text-success')}>{skill.enabled === false ? '已停用' : '已启用'}</span></span><span className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{skill.description || '暂无说明'}</span><span className="mt-2 block text-xs text-muted-foreground">v{skill.version || '1.0.0'}{!skill.is_builtin && ` · ${skill.source === 'file' ? '文件安装' : '用户创建'}`}</span></span>
          </button>)}</div>
          {query.isSuccess && !group.items.length && <p className="skill-library-empty">{search ? '没有匹配的 Skill' : group.label === '已安装' ? '导入你的专业方法，拓展 Agent 能力。' : '暂无内置 Skill'}</p>}
        </section>)}
      </aside>
      <Card className="skill-detail">
        {selected || editing ? <>
          {!editing && selected ? <>
            <div className="skill-detail-intro"><span className="skill-detail-icon" aria-hidden="true">{selected.is_builtin ? <BookOpen size={24}/> : <Download size={24}/>}</span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{selected.is_builtin ? '内置能力' : selected.source === 'file' ? '从文件安装' : '自定义能力'}<span className="mx-2" aria-hidden="true">·</span>v{selected.version || '1.0.0'}</p><CardTitle className="mt-1.5 text-xl">{selected.name}</CardTitle></div></div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">{selected.description || '暂无说明'}</p>
            <div className="skill-detail-toolbar"><span className={cn('skill-status-label', selected.enabled === false ? 'text-muted-foreground' : 'text-success')}><span aria-hidden="true"/>{selected.enabled === false ? '已停用' : '已启用'}<span className="skill-status-note">{selected.enabled === false ? '不会在对话中调用' : '可在文章对话中调用'}</span></span><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={toggle} busy={busy === 'toggle'} disabled={Boolean(busy)}>{selected.enabled === false ? '启用' : '停用'}</Button>{selected.source !== 'file' && <Button variant="ghost" onClick={() => setEditing(true)} disabled={Boolean(busy)}><Pencil size={15}/>编辑</Button>}{!selected.is_builtin && <Button variant="ghost" className="text-danger" onClick={remove} busy={busy === 'remove'} disabled={Boolean(busy)}><Trash2 size={15}/>卸载</Button>}</div></div>
          </> : <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="studio-eyebrow">CUSTOM SKILL</p><CardTitle className="mt-2 text-xl">{selectedId ? '编辑 Skill' : '安装自定义 Skill'}</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">填写用途与指令，将你的写作方法交给 Agent。</p></div>{selected && <Button variant="ghost" onClick={() => setEditing(false)}>取消</Button>}</div>}
          {editing ? <div className="mt-7 space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]"><Field label="名称"><Input value={draft.name} onChange={event => set('name', event.target.value)} placeholder="例如：新闻求实"/></Field><Field label="版本"><Input value={draft.version} onChange={event => set('version', event.target.value)}/></Field></div>
            <Field label="用途说明"><Input value={draft.description} onChange={event => set('description', event.target.value)} placeholder="说明什么时候应该使用这个 Skill"/></Field>
            <Field label="系统指令"><Textarea className="min-h-28" value={draft.system_prompt} onChange={event => set('system_prompt', event.target.value)}/></Field>
            <Field label="文章处理模板"><Textarea className="min-h-44 font-mono text-xs leading-6" value={draft.user_prompt_template} onChange={event => set('user_prompt_template', event.target.value)}/><span className="mt-2 block text-xs text-muted-foreground">可用变量：{'{title} {content} {platform} {style}'}</span></Field>
            <fieldset><legend className="text-xs font-medium text-muted-foreground">允许使用的工具</legend><div className="mt-3 flex flex-wrap gap-2">{Object.entries(permissionLabels).map(([permission, label]) => <label key={permission} className="studio-checkbox-option"><input type="checkbox" checked={draft.permissions.includes(permission)} onChange={event => set('permissions', event.target.checked ? [...draft.permissions, permission] : draft.permissions.filter(item => item !== permission))}/>{label}</label>)}</div></fieldset>
            <div className="studio-section-footer"><Button onClick={save} busy={busy === 'save'} disabled={!draft.name.trim()}><Save size={15}/>{selectedId ? '保存修改' : '安装 Skill'}</Button></div>
          </div> : selected && <div className="skill-detail-sections">
            <section><h3 className="studio-section-label"><Terminal size={16}/>在对话中使用</h3><div className="skill-invocation"><span className="text-xs text-muted-foreground">明确调用</span><code>${selected.skill_key}</code></div><p className="mt-3 text-xs leading-6 text-muted-foreground">{selected.triggers?.length ? `自动匹配词：${selected.triggers.join('、')}` : '也可根据名称和用途中的关键词自动匹配。'}</p></section>
            <section><h3 className="studio-section-label"><ShieldCheck size={16}/>工具权限</h3><div className="mt-4 flex flex-wrap gap-2">{(selected.permissions ?? []).map(permission => <span key={permission} className="skill-permission">{permissionLabels[permission] ?? permission}</span>)}{!selected.permissions?.length && <span className="text-sm text-muted-foreground">无需额外工具权限</span>}</div><p className="mt-3 text-xs leading-6 text-muted-foreground">图片生成与真实发布仍需你逐次确认。</p></section>
            <SkillReferences files={selected.skill_files}/>
            <details className="studio-disclosure"><summary><span><span className="block text-sm font-medium">查看完整指令</span><span className="mt-1 block text-xs text-muted-foreground">系统指令与文章处理模板</span></span><ChevronRight size={16}/></summary><div className="studio-disclosure-content"><h3 className="studio-section-label">系统指令</h3><pre className="skill-instruction-text">{selected.system_prompt}</pre><h3 className="studio-section-label mt-5">文章处理模板</h3><pre className="skill-instruction-text">{selected.user_prompt_template}</pre></div></details>
            {selected.source === 'file' && <p className="text-xs leading-6 text-muted-foreground">需要更新时，重新导入完整 Skill 并确认。应用升级不会覆盖已安装内容。</p>}
          </div>}
        </> : <div className="studio-empty-state skill-detail-empty"><span className="studio-empty-icon"><BookOpen size={28}/></span><h2>选择一个 Skill 查看详情</h2><p>查看用途、工具权限和调用方式，<br/>为文章选择合适的专业能力。</p></div>}
      </Card>
    </div>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label> }
