import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ExternalLink, Globe, Monitor, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, type Account } from '@/lib/api'
import { messages } from '@/lib/messages'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { QueryFeedback } from '@/components/ui/query-feedback'
import { isWechatPlatform, WECHAT_ENTRY_URL, WECHAT_PLATFORM } from '../../../shared/publishing'

type Form = { id?: string; name: string; platform: string; adapter: 'browser' | 'webhook'; entry_url: string; webhook_url: string; token: string; publish_policy: string; daily_slots: string; delay_min: number; delay_max: number; branding_enabled: boolean; header_html: string; footer_html: string }
const availablePlatforms = [{ value: WECHAT_PLATFORM, label: '微信公众号', entryUrl: WECHAT_ENTRY_URL }] as const
const emptyForm: Form = { name: '', platform: WECHAT_PLATFORM, adapter: 'browser', entry_url: WECHAT_ENTRY_URL, webhook_url: '', token: '', publish_policy: 'manual', daily_slots: '10:00,18:00', delay_min: 10, delay_max: 30, branding_enabled: true, header_html: '', footer_html: '' }
export const publishPolicyLabels: Record<string, string> = { manual: '手动发布', immediate: '生成后立即发布', daily_slots: '每日时间槽', random_delay: '随机延迟' }

export function AccountSettings() {
  const queryClient = useQueryClient()
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api<Account[]>('/api/admin/accounts') })
  const [form, setForm] = useState<Form>(emptyForm)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }))
  const setPlatform = (platform: string) => setForm(current => {
    const definition = availablePlatforms.find(item => item.value === platform)
    return { ...current, platform, entry_url: definition?.entryUrl ?? current.entry_url }
  })
  const edit = (account: Account) => setForm({ id: account.id, name: account.name, platform: account.platform, adapter: account.adapter === 'browser' ? 'browser' : 'webhook', entry_url: account.entry_url ?? '', webhook_url: account.webhook_url ?? '', token: '', publish_policy: account.publish_policy, daily_slots: (account.daily_slots ?? []).join(','), delay_min: account.delay_min, delay_max: account.delay_max, branding_enabled: account.branding_enabled, header_html: account.header_html ?? '', footer_html: account.footer_html ?? '' })
  const save = async () => {
    if (pendingAction) return
    const payload = { platform: form.platform, name: form.name, adapter: form.adapter, entry_url: form.entry_url || null, webhook_url: form.webhook_url || null, credentials: { token: form.token }, publish_policy: form.publish_policy, daily_slots: form.daily_slots.split(',').map(v => v.trim()).filter(Boolean), delay_min: form.delay_min, delay_max: form.delay_max, branding_enabled: form.branding_enabled, header_html: form.header_html, footer_html: form.footer_html }
    setPendingAction('save')
    try {
      const saved = await messages.promise(
        api<Account>(form.id ? `/api/admin/accounts/${form.id}` : '/api/admin/accounts', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }),
        { loading: '正在保存账号…', success: '账号已保存' },
      )
      queryClient.setQueryData<Account[]>(['accounts'], current => [saved, ...(current ?? []).filter(account => account.id !== saved.id)])
      setSavedName(saved.name)
      setForm(emptyForm)
      await accounts.refetch()
    } catch {
      // The message client has already displayed the request error.
    } finally {
      setPendingAction(null)
    }
  }
  const remove = async (account: Account) => {
    if (pendingAction) return
    setPendingAction(`delete:${account.id}`)
    try {
      await messages.promise(
        api(`/api/admin/accounts/${account.id}`, { method: 'DELETE' }),
        { loading: '正在删除账号…', success: '账号已删除' },
      )
      setSavedName(null)
      queryClient.setQueryData<Account[]>(['accounts'], current => (current ?? []).filter(item => item.id !== account.id))
      await accounts.refetch()
    } catch {
      // The message client has already displayed the request error.
    } finally {
      setPendingAction(null)
    }
  }
  const openSession = async (account: Account) => {
    if (!window.desktop || !account.entry_url || pendingAction) return
    setPendingAction(`open:${account.id}`)
    try {
      await messages.promise(window.desktop.openBrowserSession(account.id, account.entry_url, true), { loading: '正在打开平台浏览器…', success: '平台浏览器已打开' })
    } catch {
      // Global feedback already reports the error.
    } finally {
      setPendingAction(null)
    }
  }
  const validTarget = form.adapter === 'browser' ? form.entry_url : form.webhook_url
  return <div className="account-settings"><div className="account-settings-layout">
    <section aria-label="已保存账号" className="min-w-0 space-y-4">
      <div className="account-list-heading"><h3>已保存账号</h3>{accounts.data && <span>{accounts.data.length}</span>}</div>
      {savedName && <p role="status" className="account-save-feedback">已保存“{savedName}”。下方可继续打开平台；新增表单已清空，账号不会被清除。</p>}
      <QueryFeedback query={accounts} label="账号" errorMessage="账号列表读取失败，不代表账号丢失。请重试，暂时不要重复添加。"/>
      {!accounts.isLoading && !accounts.isError && accounts.data?.length === 0 && <div className="account-empty"><Globe size={24}/><p>还没有保存账号。填写账号名称并保存后，再打开平台登录。</p></div>}
      <div className="space-y-3">{accounts.data?.map(account => <Card key={account.id} className="account-card">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="account-platform-icon" aria-hidden="true">{account.adapter === 'browser' ? <Monitor size={19}/> : <Globe size={19}/>}</span><div className="min-w-0"><CardTitle className="break-words text-sm">{account.name}</CardTitle><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{account.platform} · {account.adapter === 'browser' ? '浏览器发布' : 'Webhook 兼容'}</p></div></div><div className="flex"><Button variant="ghost" size="icon" aria-label="编辑账号" disabled={pendingAction !== null} onClick={() => edit(account)}><Pencil size={15}/></Button><Button variant="ghost" size="icon" aria-label="删除账号" busy={pendingAction === `delete:${account.id}`} disabled={pendingAction !== null} onClick={() => remove(account)}><Trash2 size={15}/></Button></div></div>
        <div className="account-metadata"><p>账号配置：已保存</p><p>策略：{publishPolicyLabels[account.publish_policy] || account.publish_policy}</p>{account.publish_policy === 'daily_slots' && <p>时间槽：{account.daily_slots.join('、') || '未设置'}</p>}{account.publish_policy === 'random_delay' && <p>延迟：{account.delay_min}–{account.delay_max} 分钟</p>}<p className="break-all">{account.adapter === 'browser' ? account.entry_url || '未配置平台页面' : account.webhook_url || '未配置 Webhook'}</p></div>
        {account.adapter === 'browser' && <div className="account-browser"><p className="font-medium text-foreground">登录状态：未自动检测</p><p>账号名称由你填写。请在平台窗口核对登录状态与目标账号。</p>{!isWechatPlatform(account.platform) && <p className="text-warning">第一版尚不支持该平台发布。</p>}{account.entry_url && <Button variant="secondary" className="w-full" busy={pendingAction === `open:${account.id}`} disabled={!window.desktop || pendingAction !== null} onClick={() => openSession(account)}><ExternalLink size={16}/>{isWechatPlatform(account.platform) ? '打开公众号' : '打开平台'}</Button>}{!window.desktop && <p>请在桌面应用中打开平台窗口。</p>}</div>}
      </Card>)}</div>
    </section>
    <Card className="account-form">
      <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{form.id ? '编辑账号' : '新增发布账号'}</CardTitle>{form.id && <Button variant="ghost" size="sm" onClick={() => setForm(emptyForm)}>取消编辑</Button>}</div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">保存发布目标后，再打开平台完成登录。</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="账号名称"><Input value={form.name} onChange={e => set('name', e.target.value)}/></Field>
        <Field label="发布平台"><Input aria-label="发布平台" list="account-platform-options" value={form.platform} onChange={e => setPlatform(e.target.value)} placeholder="例如：微信公众号"/><datalist id="account-platform-options">{availablePlatforms.map(platform => <option key={platform.value} value={platform.value}>{platform.label}</option>)}</datalist><span className="studio-field-hint">浏览器发布目前支持微信公众号；其他平台可先保留兼容配置，后续沿用同一流程接入。</span></Field>
        <Field label="发布方式" wide><Select aria-label="发布方式" value={form.adapter} onChange={e => set('adapter', e.target.value as Form['adapter'])}><option value="browser">浏览器发布</option><option value="webhook">Webhook（兼容）</option></Select></Field>
        {form.adapter === 'browser' ? <Field label="平台登录或发布页" wide><Input value={form.entry_url} onChange={e => set('entry_url', e.target.value)} placeholder="https://平台发布页"/><span className="studio-field-hint">首版支持微信公众号。登录、扫码、验证码和页面异常都由你在隔离浏览器中接管。</span></Field> : <><Field label="Webhook URL" wide><Input value={form.webhook_url} onChange={e => set('webhook_url', e.target.value)} placeholder="https://…/publish"/></Field><Field label={form.id ? 'Token（留空保持不变）' : 'Token'} wide><Input type="password" value={form.token} onChange={e => set('token', e.target.value)}/></Field></>}
        <Field label="默认发布策略" wide><Select value={form.publish_policy} onChange={e => set('publish_policy', e.target.value)} disabled={form.adapter === 'browser'}><option value="manual">手动发布</option>{form.adapter !== 'browser' && <><option value="immediate">生成后立即发布</option><option value="daily_slots">每日时间槽</option><option value="random_delay">随机延迟</option></>}</Select></Field>
        {form.publish_policy === 'daily_slots' && <Field label="每日时间槽（逗号分隔）" wide><Input value={form.daily_slots} onChange={e => set('daily_slots', e.target.value)} placeholder="10:00,18:00"/></Field>}
        {form.publish_policy === 'random_delay' && <><Field label="最小延迟（分钟）"><Input type="number" value={form.delay_min} onChange={e => set('delay_min', Number(e.target.value))}/></Field><Field label="最大延迟（分钟）"><Input type="number" value={form.delay_max} onChange={e => set('delay_max', Number(e.target.value))}/></Field></>}
      </div>
      {form.adapter === 'webhook' && <details className="studio-disclosure mt-5"><summary><span className="text-sm font-medium">账号贴牌</span><ChevronRight size={16}/></summary><div className="studio-disclosure-content space-y-4"><label className="flex min-h-11 items-center gap-2 text-xs leading-6 text-muted-foreground"><input type="checkbox" checked={form.branding_enabled} onChange={e => set('branding_enabled', e.target.checked)}/>启用贴牌（账号内容覆盖全局默认）</label><Field label="账号头部 HTML" wide><Textarea className="min-h-20" value={form.header_html} onChange={e => set('header_html', e.target.value)}/></Field><Field label="账号底部 HTML" wide><Textarea className="min-h-20" value={form.footer_html} onChange={e => set('footer_html', e.target.value)}/></Field></div></details>}
      <Button className="mt-6 w-full" busy={pendingAction === 'save'} disabled={!form.name || !form.platform || !validTarget || pendingAction !== null || (form.adapter === 'browser' && !isWechatPlatform(form.platform))} onClick={save}>{form.id ? <Pencil size={16}/> : <Plus size={16}/>}保存账号</Button>
    </Card>
  </div></div>
}
export function AccountsPage() { return <div className="studio-secondary-page accounts-page">
  <header className="studio-page-heading"><div><h1 className="studio-page-title">账号管理</h1><p className="studio-page-description">统一管理多平台发布账号，目前已接入微信公众号</p></div></header>
  <section className="account-platform-summary" aria-label="已接入平台">
    <span className="account-platform-icon" aria-hidden="true"><Monitor size={19}/></span>
    <div><h2>微信公众号</h2><p>通过隔离浏览器登录、填写与发布；验证码和安全验证由你接管。</p></div>
    <span className="account-platform-state">已支持</span>
  </section>
  <AccountSettings/>
</div> }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}><span className="studio-field-label">{label}</span>{children}</label> }
