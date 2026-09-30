import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountsPage } from './AccountsPage'
import { PublishingPage } from './PublishingPage'
import { SkillsPage } from './SkillsPage'
import { TasksPage } from './TasksPage'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  promise: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({ Link: ({ to, children, ...props }: React.ComponentProps<'a'> & { to: string }) => <a href={to} {...props}>{children}</a> }))

vi.mock('@/lib/api', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api')>()
  return { ...original, api: mocks.api }
})
vi.mock('@/lib/messages', () => ({
  messages: { promise: mocks.promise },
}))

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.api.mockReset()
  mocks.promise.mockReset()
  mocks.promise.mockImplementation((operation: Promise<unknown>) => operation)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllTimers()
})

describe('regular action messages', () => {
  it('notifies when an account is saved', async () => {
    mocks.api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/admin/accounts' && !init) return Promise.resolve([])
      return Promise.resolve({ id: 'a1', name: '主账号', platform: '测试平台', adapter: 'webhook', daily_slots: [] })
    })
    renderWithQuery(<AccountsPage/>)

    fireEvent.change(screen.getByLabelText('发布方式'), { target: { value: 'webhook' } })
    fireEvent.change(screen.getByText('账号名称').closest('label')!.querySelector('input')!, { target: { value: '主账号' } })
    fireEvent.change(screen.getByPlaceholderText('例如：微信公众号'), { target: { value: '测试平台' } })
    fireEvent.change(screen.getByPlaceholderText('https://…/publish'), { target: { value: 'https://example.com/publish' } })
    fireEvent.click(screen.getByRole('button', { name: '保存账号' }))

    await waitFor(() => expect(mocks.promise).toHaveBeenCalledWith(
      expect.any(Promise),
      { loading: '正在保存账号…', success: '账号已保存' },
    ))
  })

  it('notifies when an account is deleted', async () => {
    const account = { id: 'a1', name: '主账号', platform: 'webhook', adapter: 'webhook', webhook_url: 'https://example.com', credentials: {}, status: 'active', publish_policy: 'manual', daily_slots: [], delay_min: 10, delay_max: 30, branding_enabled: false }
    mocks.api.mockImplementation((path: string, init?: RequestInit) => path === '/api/admin/accounts' && !init ? Promise.resolve([account]) : Promise.resolve(undefined))
    renderWithQuery(<AccountsPage/>)

    fireEvent.click(await screen.findByRole('button', { name: '删除账号' }))
    await waitFor(() => expect(mocks.promise).toHaveBeenCalledWith(
      expect.any(Promise),
      { loading: '正在删除账号…', success: '账号已删除' },
    ))
  })

  it('keeps the confirmed saved account visible when refreshing the list fails', async () => {
    const account = { id: 'a1', name: '测试公众号', platform: '微信公众号', adapter: 'browser', entry_url: 'https://mp.weixin.qq.com/', publish_policy: 'manual', daily_slots: [] }
    let saved = false
    mocks.api.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') { saved = true; return Promise.resolve(account) }
      return saved ? Promise.reject(new Error('读取失败')) : Promise.resolve([])
    })
    renderWithQuery(<AccountsPage/>)
    await screen.findByText(/还没有保存账号/)
    fireEvent.change(screen.getByLabelText('账号名称'), { target: { value: '测试公众号' } })
    fireEvent.click(screen.getByRole('button', { name: '保存账号' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('不代表账号丢失')
    expect(screen.getByRole('region', { name: '已保存账号' })).toHaveTextContent('测试公众号')
    expect(screen.getByRole('status')).toHaveTextContent('已保存“测试公众号”')
    expect(screen.getByLabelText('账号名称')).toHaveValue('')
    expect(screen.queryByText(/还没有保存账号/)).not.toBeInTheDocument()
  })

  it('retains account inputs after a failed save and lets the user retry', async () => {
    let attempts = 0
    mocks.api.mockImplementation((_path: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return Promise.resolve([])
      attempts++
      return Promise.reject(new Error('保存失败'))
    })
    renderWithQuery(<AccountsPage/>)
    fireEvent.change(screen.getByLabelText('账号名称'), { target: { value: '未保存账号' } })
    fireEvent.click(screen.getByRole('button', { name: '保存账号' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存账号' })).not.toBeDisabled())
    expect(screen.getByLabelText('账号名称')).toHaveValue('未保存账号')
    expect(screen.queryByText(/已保存“/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存账号' }))
    await waitFor(() => expect(attempts).toBe(2))
  })

  it('retries a failed account list without treating it as an empty list', async () => {
    mocks.api.mockRejectedValueOnce(new Error('读取失败')).mockResolvedValue([])
    renderWithQuery(<AccountsPage/>)
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时不要重复添加')
    expect(screen.queryByText(/还没有保存账号/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新读取账号' }))
    expect(await screen.findByText(/还没有保存账号/)).toBeInTheDocument()
  })

  it('opens the existing WeChat page without resetting navigation or claiming verified login', async () => {
    const openBrowserSession = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('desktop', { openBrowserSession })
    mocks.api.mockResolvedValue([{ id: 'a1', name: '测试', platform: '微信公众号', adapter: 'browser', entry_url: 'https://mp.weixin.qq.com/', publish_policy: 'manual', daily_slots: [] }])
    renderWithQuery(<AccountsPage/>)
    fireEvent.click(await screen.findByRole('button', { name: '打开公众号' }))
    await waitFor(() => expect(openBrowserSession).toHaveBeenCalledWith('a1', 'https://mp.weixin.qq.com/', true))
    expect(screen.getByText('账号配置：已保存')).toBeInTheDocument()
    expect(screen.getByText('登录状态：未自动检测')).toBeInTheDocument()
    expect(screen.queryByText(/^已登录$/)).not.toBeInTheDocument()
  })

  it('notifies when an article is created', async () => {
    class EventSourceStub { addEventListener() {} close() {} }
    vi.stubGlobal('EventSource', EventSourceStub)
    vi.spyOn(window, 'prompt').mockReturnValue('新任务')
    mocks.api.mockResolvedValue([])
    renderWithQuery(<TasksPage/>)

    fireEvent.click(screen.getByRole('button', { name: '新建文章' }))
    await waitFor(() => expect(mocks.promise).toHaveBeenCalledWith(
      expect.any(Promise),
      { loading: '正在创建文章…', success: '文章已创建' },
    ))
  })

  it('imports a SKILL.md file through the install flow', async () => {
    const skill = { id: 'skill-1', skill_key: 'fact-check', name: '新闻核查', description: '核实事实', style_key: null, system_prompt: 'instructions', user_prompt_template: '{content}', is_builtin: false, enabled: true, version: '1.0.0', source: 'file', permissions: ['web_search'], created_at: '', updated_at: '' }
    mocks.api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/rewrite-templates' && !init) return Promise.resolve([])
      if (path === '/api/skills/import/preview') return Promise.resolve({ skill, existing: null, added_permissions: ['web_search'], approval_token: 'review-token' })
      if (path === '/api/skills/import') return Promise.resolve({ action: 'installed', skill })
      return Promise.resolve({})
    })
    renderWithQuery(<SkillsPage/>)

    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [{ name: 'SKILL.md', text: () => Promise.resolve('---\nname: 新闻核查\ndescription: 核实事实\n---\ninstructions') }] } })

    fireEvent.click(await screen.findByRole('button', { name: '确认安装' }))
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith(
      '/api/skills/import',
      expect.objectContaining({ method: 'POST' }),
    ))
  })

  it('notifies when publishing is retried or cancelled', async () => {
    const schedule = { id: 's1', task_id: 't1', account_id: 'a1', policy: 'manual', status: 'failed', scheduled_at: '2026-07-14T10:00:00Z', last_error: '网络错误', attempt_count: 1, latest_attempt_id: 'p1' }
    mocks.api.mockImplementation((path: string, init?: RequestInit) => path === '/api/publishing/schedules' && !init ? Promise.resolve([schedule]) : Promise.resolve({}))
    renderWithQuery(<PublishingPage/>)

    fireEvent.click(await screen.findByRole('button', { name: '重试' }))
    await waitFor(() => expect(mocks.promise).toHaveBeenCalledWith(
      expect.any(Promise),
      { loading: '正在重新提交…', success: '已重新加入发布队列' },
    ))

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(mocks.promise).toHaveBeenCalledWith(
      expect.any(Promise),
      { loading: '正在取消发布…', success: '发布已取消' },
    ))
  })

  it.each(['published', 'not_published'] as const)('requires a platform outcome check before resolving an uncertain publication as %s', async outcome => {
    const prepareBrowserPublish = vi.fn(), confirmBrowserPublish = vi.fn(), openBrowserSession = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('desktop', { prepareBrowserPublish, confirmBrowserPublish, openBrowserSession })
    const schedule = { id: 's1', task_id: 't1', account_id: 'a1', account_adapter: 'browser', status: 'needs_handoff', requires_outcome_review: true, attempt_count: 1 }
    mocks.api.mockImplementation((path: string) => {
      if (path === '/api/publishing/schedules') return Promise.resolve([schedule])
      if (path === '/api/tasks') return Promise.resolve([{ id: 't1', original_title: '待核对文章' }])
      if (path === '/api/publishing/browser/s1/context') return Promise.resolve({ schedule,
        account: { id: 'a1', name: '主公众号', platform: '微信公众号', entry_url: 'https://mp.weixin.qq.com/' },
        article: { title: '待核对文章', html: '<p>原确认正文</p>', image_count: 0 } })
      return Promise.resolve({})
    })
    renderWithQuery(<PublishingPage/>)
    fireEvent.click(await screen.findByRole('button', { name: '核对发布结果' }))
    expect(screen.queryByRole('button', { name: '继续填写' })).not.toBeInTheDocument()
    const unpublished = await screen.findByRole('button', { name: '确认未发布，允许重新填写' })
    const published = screen.getByRole('button', { name: '确认已发布，结束任务' })
    expect(unpublished).toBeDisabled()
    expect(published).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '打开公众号核对' }))
    await waitFor(() => expect(openBrowserSession).toHaveBeenCalledWith('a1', 'https://mp.weixin.qq.com/', true))
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled())
    fireEvent.click(screen.getByRole('checkbox', { name: '我已在公众号平台核对这篇文章的发表记录' }))
    fireEvent.click(outcome === 'published' ? published : unpublished)
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/api/publishing/browser/s1/resolve', { method: 'POST', body: JSON.stringify({ outcome }) }))
    expect(prepareBrowserPublish).not.toHaveBeenCalled()
    expect(confirmBrowserPublish).not.toHaveBeenCalled()
  })

  it('shows the exact WeChat payload before the separate final publish confirmation', async () => {
    const confirmBrowserPublish = vi.fn().mockResolvedValue({ status: 'published', message: '发表成功', scheduleId: 's1' })
    vi.stubGlobal('desktop', { confirmBrowserPublish })
    const schedule = { id: 's1', task_id: 't1', account_id: 'a1', account_adapter: 'browser', account_platform: '微信公众号', policy: 'manual', status: 'awaiting_approval', scheduled_at: '2026-09-03T10:00:00Z', attempt_count: 0 }
    mocks.api.mockImplementation((path: string) => {
      if (path === '/api/publishing/schedules') return Promise.resolve([schedule])
      if (path === '/api/tasks') return Promise.resolve([{ id: 't1', original_title: '公众号文章' }])
      if (path === '/api/publishing/schedules/s1/events') return Promise.resolve([
        { id: 'e1', stage: 'created', status: 'awaiting_browser', message: '等待填写公众号', created_at: '2026-09-03T10:00:00Z' },
        { id: 'e2', stage: 'prepare', status: 'awaiting_approval', message: '标题和正文已填写', created_at: '2026-09-03T10:01:00Z' },
      ])
      if (path === '/api/publishing/browser/s1/context') return Promise.resolve({
        schedule: { id: 's1', status: 'awaiting_approval' },
        account: { name: '主公众号', platform: '微信公众号' },
        article: { title: '公众号文章', html: '<p>已经核对的正文</p>', image_count: 2 },
      })
      return Promise.resolve({})
    })
    renderWithQuery(<PublishingPage/>)

    fireEvent.click(await screen.findByRole('button', { name: '查看步骤' }))
    expect(await screen.findByRole('dialog', { name: '公众号执行步骤' })).toHaveTextContent('标题和正文已填写')
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(await screen.findByRole('button', { name: '核对并发布' }))
    expect(await screen.findByRole('dialog', { name: '确认公众号真实发布' })).toHaveTextContent('主公众号')
    expect(screen.getByRole('dialog', { name: '确认公众号真实发布' })).toHaveTextContent('已经核对的正文')
    expect(screen.getByRole('dialog', { name: '确认公众号真实发布' })).toHaveTextContent('2 张')
    expect(confirmBrowserPublish).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认真实发布' }))
    await waitFor(() => expect(confirmBrowserPublish).toHaveBeenCalledWith('s1'))
  })
})
