import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bot, ChevronRight, ExternalLink, Eye, EyeOff, Image, Save, Search, Settings2 } from 'lucide-react'
import { api } from '@/lib/api'
import { messages } from '@/lib/messages'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { DesktopSettings } from '@/components/DesktopSettings'
import { QueryFeedback } from '@/components/ui/query-feedback'

type ConfigValue = string | boolean | number
type SecretName = 'openai_api_key' | 'firecrawl_api_key' | 'image_api_key' | 'github_token'

const EMPTY_SECRETS: Record<SecretName, string> = {
  openai_api_key: '',
  firecrawl_api_key: '',
  image_api_key: '',
  github_token: '',
}

export function SettingsPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['config'], queryFn: () => api<Record<string, ConfigValue>>('/api/admin/config') })
  const [form, setForm] = useState<Record<string, ConfigValue>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [secrets, setSecrets] = useState(EMPTY_SECRETS)
  const [visibleSecrets, setVisibleSecrets] = useState<Partial<Record<SecretName, boolean>>>({})
  const [loadingSecret, setLoadingSecret] = useState<SecretName | null>(null)

  const editRevision = useRef(0)
  const dirty = useRef(false)
  useEffect(() => { if (query.data && !dirty.current) setForm(query.data) }, [query.data])
  const markEdited = () => { dirty.current = true; editRevision.current++ }
  const set = (key: string, value: ConfigValue) => { markEdited(); setForm(current => ({ ...current, [key]: value })) }
  const setSecret = (name: SecretName, value: string) => { markEdited(); setSecrets(current => ({ ...current, [name]: value })) }
  const toggleSecret = async (name: SecretName, label: string) => {
    if (visibleSecrets[name]) {
      setVisibleSecrets(current => ({ ...current, [name]: false }))
      return
    }
    if (secrets[name]) {
      setVisibleSecrets(current => ({ ...current, [name]: true }))
      return
    }
    if (!form[`${name}_configured`] || loadingSecret) return
    setLoadingSecret(name)
    try {
      const secret = await messages.promise(
        api<{ value: string }>(`/api/admin/config/secrets/${name}`),
        { loading: `正在读取${label}…`, success: `${label}已显示` },
      )
      setSecret(name, secret.value)
      setVisibleSecrets(current => ({ ...current, [name]: true }))
    } catch {
      // The global message component already reports the request error.
    } finally {
      setLoadingSecret(null)
    }
  }
  const save = async () => {
    if (isSaving || !query.data) return
    const submittedRevision = editRevision.current
    setIsSaving(true)
    try {
      const values = Object.fromEntries(
        Object.entries(form).filter(([key]) => !key.endsWith('_configured')),
      )
      for (const [name, value] of Object.entries(secrets) as [SecretName, string][]) {
        if (value.trim()) values[name] = value.trim()
      }
      await messages.promise(
        api('/api/admin/config', { method: 'PATCH', body: JSON.stringify({ values }) }),
        { loading: '正在保存设置…', success: '设置已保存' },
      )
      setVisibleSecrets({})
      if (editRevision.current === submittedRevision) dirty.current = false
      await client.invalidateQueries({ queryKey: ['config'] })
    } catch {
      // The message client has already displayed the request error.
    } finally {
      setIsSaving(false)
    }
  }

  return <div className="studio-secondary-page settings-page">
    <header className="studio-page-heading">
      <div><h1 className="studio-page-title">设置</h1><p className="studio-page-description">配置 Agent 的模型、检索与图像能力。</p></div>
      {query.data && <div className="studio-page-actions"><Button onClick={save} busy={isSaving}><Save size={16}/>保存全部设置</Button></div>}
    </header>
    <QueryFeedback query={query} label="设置"/>
    {query.data && <>
      <p className="settings-save-note">修改将在保存后用于新的请求；留空的密钥会保留原配置。</p>
      <Card className="settings-panel">
        <section className="settings-section" aria-labelledby="settings-model-title">
          <div className="settings-section-heading"><span className="settings-section-icon"><Bot size={21}/></span><div><CardTitle id="settings-model-title">Agent 与文字模型</CardTitle><p>用于理解要求、核实内容和生成候选稿。</p></div></div>
          <div className="settings-fields">
            <Field label="LLM 模型"><Input value={String(form.llm_model ?? '')} onChange={event => set('llm_model', event.target.value)}/></Field>
            <Field label="API Base URL"><Input value={String(form.llm_base_url ?? '')} onChange={event => set('llm_base_url', event.target.value)}/></Field>
            <div className="sm:col-span-2"><SecretField label="LLM API Key" name="openai_api_key" value={secrets.openai_api_key} configured={Boolean(form.openai_api_key_configured)} visible={Boolean(visibleSecrets.openai_api_key)} loading={loadingSecret === 'openai_api_key'} onChange={value => setSecret('openai_api_key', value)} onToggle={() => toggleSecret('openai_api_key', 'LLM API Key')}/></div>
          </div>
          <details className="studio-disclosure settings-inline-disclosure"><summary><span className="text-sm font-medium">默认改写提示词</span><ChevronRight size={16}/></summary><div className="studio-disclosure-content"><Field label="默认改写提示词"><Textarea className="min-h-36 leading-6" value={String(form.rewrite_prompt ?? '')} onChange={event => set('rewrite_prompt', event.target.value)}/></Field></div></details>
        </section>
        <section className="settings-section" aria-labelledby="settings-search-title">
          <div className="settings-section-heading"><span className="settings-section-icon"><Search size={21}/></span><div className="min-w-0 flex-1"><CardTitle id="settings-search-title">Firecrawl 网络检索</CardTitle><p>为事实核查与资料补充保留可追溯的来源。</p></div><Button asChild variant="ghost" size="sm"><a href="https://firecrawl.dev/app/api-keys" target="_blank" rel="noreferrer">获取 / 查看 Key<ExternalLink size={14}/></a></Button></div>
          <div className="settings-fields">
            <SecretField label="Firecrawl API Key" name="firecrawl_api_key" value={secrets.firecrawl_api_key} configured={Boolean(form.firecrawl_api_key_configured)} visible={Boolean(visibleSecrets.firecrawl_api_key)} loading={loadingSecret === 'firecrawl_api_key'} placeholder="fc-…" onChange={value => setSecret('firecrawl_api_key', value)} onToggle={() => toggleSecret('firecrawl_api_key', 'Firecrawl API Key')}/>
            <Field label="最大检索结果数"><Input type="number" min={1} max={10} value={Number(form.max_search_results ?? 3)} onChange={event => set('max_search_results', Number(event.target.value))}/><span className="studio-field-hint">按每次查询计算；逐条核查会发起多次查询并使用模型与检索额度。</span></Field>
          </div>
          <div className="settings-option-row"><label><input type="checkbox" checked={Boolean(form.search_enabled ?? true)} onChange={event => set('search_enabled', event.target.checked)}/>启用网络检索</label><p>仅供获得搜索权限的 Skills 调用。</p></div>
        </section>
        <section className="settings-section" aria-labelledby="settings-image-title">
          <div className="settings-section-heading"><span className="settings-section-icon"><Image size={21}/></span><div><CardTitle id="settings-image-title">GPT Image 2</CardTitle><p>文生图与图生图共用的图片服务，生成前仍需确认提示词。</p></div></div>
          <div className="settings-fields">
            <Field label="图片实现器"><Select value={String(form.image_provider ?? 'gpt-image-2')} onChange={event => set('image_provider', event.target.value)}><option value="gpt-image-2">GPT Image 2</option></Select></Field>
            <Field label="图片模型"><Input value={String(form.image_model ?? 'gpt-image-2')} onChange={event => set('image_model', event.target.value)} placeholder="gpt-image-2"/></Field>
            <Field label="图片 API Base URL"><Input value={String(form.image_base_url ?? 'https://api.openai.com/v1')} onChange={event => set('image_base_url', event.target.value)} placeholder="https://api.openai.com/v1"/></Field>
            <SecretField label="图片 API Key" name="image_api_key" value={secrets.image_api_key} configured={Boolean(form.image_api_key_configured)} visible={Boolean(visibleSecrets.image_api_key)} loading={loadingSecret === 'image_api_key'} onChange={value => setSecret('image_api_key', value)} onToggle={() => toggleSecret('image_api_key', '图片 API Key')}/>
            <Field label="生成质量"><Select value={String(form.image_quality ?? 'auto')} onChange={event => set('image_quality', event.target.value)}><option value="auto">自动</option><option value="low">低（快速草稿）</option><option value="medium">中</option><option value="high">高</option></Select></Field>
          </div>
          <div className="settings-option-row"><label><input type="checkbox" checked={form.image_custom_size_quality !== false} onChange={event => set('image_custom_size_quality', event.target.checked)}/>使用指定尺寸与质量</label><p>若服务不支持，请关闭并由图片服务决定。</p></div>
        </section>
      </Card>
      <div className="settings-secondary-heading"><h2>应用与发布</h2><p>账号、数据与兼容配置</p></div>
      <Card className="settings-publishing-link"><span className="settings-section-icon"><Settings2 size={21}/></span><div className="min-w-0 flex-1"><CardTitle>浏览器与发布</CardTitle><p className="mt-1 text-xs leading-6 text-muted-foreground">平台账号和隔离浏览器会话在账号管理中配置。</p></div><Button asChild variant="secondary"><Link to="/accounts">管理平台与账号<ChevronRight size={15}/></Link></Button></Card>
      {window.desktop && <DesktopSettings/>}
      <div className="settings-secondary-panel">
        <details className="studio-disclosure"><summary><span><span className="block text-sm font-medium">应用与集成</span><span className="mt-1 block text-xs text-muted-foreground">时区、外部访问与项目版本</span></span><ChevronRight size={16}/></summary><div className="studio-disclosure-content settings-fields">
          <Field label="外部访问地址"><Input value={String(form.public_base_url ?? '')} onChange={event => set('public_base_url', event.target.value)} placeholder="https://api.example.com"/></Field>
          <Field label="系统时区"><Input value={String(form.timezone ?? 'Asia/Shanghai')} onChange={event => set('timezone', event.target.value)}/></Field>
          <Field label="GitHub 仓库"><Input value={String(form.github_repository ?? '')} onChange={event => set('github_repository', event.target.value)} placeholder="owner/repository"/></Field>
          <SecretField label="GitHub Token" name="github_token" value={secrets.github_token} configured={Boolean(form.github_token_configured)} visible={Boolean(visibleSecrets.github_token)} loading={loadingSecret === 'github_token'} onChange={value => setSecret('github_token', value)} onToggle={() => toggleSecret('github_token', 'GitHub Token')}/>
        </div></details>
        <details className="studio-disclosure"><summary><span><span className="block text-sm font-medium">全局贴牌</span><span className="mt-1 block text-xs text-muted-foreground">兼容发布的文章头部与底部内容</span></span><ChevronRight size={16}/></summary><div className="studio-disclosure-content settings-fields"><Field label="文章头部 HTML"><Textarea value={String(form.branding_header_html ?? '')} onChange={event => set('branding_header_html', event.target.value)}/></Field><Field label="文章底部 HTML"><Textarea value={String(form.branding_footer_html ?? '')} onChange={event => set('branding_footer_html', event.target.value)}/></Field></div></details>
        <details className="studio-disclosure"><summary><span><span className="block text-sm font-medium">社群与项目</span><span className="mt-1 block text-xs text-muted-foreground">社群展示信息与联系方式</span></span><ChevronRight size={16}/></summary><div className="studio-disclosure-content settings-fields"><Field label="社群标题"><Input value={String(form.community_title ?? '')} onChange={event => set('community_title', event.target.value)}/></Field><Field label="二维码 URL"><Input value={String(form.community_qr_url ?? '')} onChange={event => set('community_qr_url', event.target.value)}/></Field><Field label="联系方式" className="sm:col-span-2"><Input value={String(form.community_contact ?? '')} onChange={event => set('community_contact', event.target.value)}/></Field></div></details>
      </div>
    </>}
  </div>
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block min-w-0 ${className ?? ''}`}><span className="studio-field-label">{label}</span>{children}</label>
}

function SecretField({ label, name, value, configured, visible, loading, placeholder, onChange, onToggle }: {
  label: string
  name: SecretName
  value: string
  configured: boolean
  visible: boolean
  loading: boolean
  placeholder?: string
  onChange(value: string): void
  onToggle(): void
}) {
  const inputId = useId()
  const displayLabel = configured ? `${label}（已配置）` : label
  return <div className="min-w-0"><label htmlFor={inputId} className="studio-field-label">{displayLabel}</label><div className="relative"><Input id={inputId} name={name} className="pr-11" type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} placeholder={configured ? '••••••••••••••••' : placeholder} autoComplete="new-password"/><button type="button" className="settings-secret-toggle ui-icon-control" onClick={onToggle} disabled={loading || (!value && !configured)} aria-label={visible ? `隐藏 ${label}` : `显示 ${label}`} title={visible ? '隐藏 Key' : '显示 Key'}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></div>
}
