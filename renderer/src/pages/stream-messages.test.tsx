import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskDetailPage } from './TaskDetailPage'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  promise: vi.fn(),
}))

vi.mock('@/lib/api', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api')>()
  return { ...original, api: mocks.api }
})
vi.mock('@/lib/messages', () => ({
  messages: { loading: mocks.loading, success: mocks.success, error: mocks.error, info: mocks.info, promise: mocks.promise },
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试',
}))
vi.mock('@tanstack/react-router', () => ({ useParams: () => ({ articleId: 't1' }), Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/RichEditor', () => ({
  RichEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => <><textarea aria-label="测试正文" value={value} onChange={event => onChange(event.target.value)}/><div data-testid="rich-editor" dangerouslySetInnerHTML={{ __html: value }}/></>,
}))

type StreamListener = (event: { data: string }) => void
class EventSourceStub {
  static instances: EventSourceStub[] = []
  listeners = new Map<string, StreamListener[]>()
  closed = false

  constructor(public url: string) { EventSourceStub.instances.push(this) }
  addEventListener(name: string, listener: StreamListener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener])
  }
  emit(name: string, data = '') {
    this.listeners.get(name)?.forEach(listener => listener({ data }))
  }
  close() { this.closed = true }
}

const task = {
  id: 't1', platform: 'manual', original_title: '测试文章', original_content: '原文', style: 'default',
  generation_status: 'completed', publish_status: 'draft', html: '<p>草稿</p>', created_at: '2026-07-14T10:00:00Z', updated_at: '2026-07-14T10:00:00Z',
  media: [{
    id: 'source-1', media_type: 'image' as const, status: 'failed', url: null,
    preview_url: 'https://cdn.example/source.jpg?x=1&y=2', poster_url: null,
    alt_text: '来源图', origin: 'aimaster', error: 'blocked', paragraph_index: 0, source_order: 0,
  }],
}
const template = {
  id: 'tpl-1', name: '专业', style_key: 'professional', description: '专业改写',
  system_prompt: '系统词', user_prompt_template: '{title}\n{content}', is_builtin: true,
  enabled: true, version: '1.0.0', source: 'builtin', permissions: ['web_search'],
  created_at: '2026-07-14T10:00:00Z', updated_at: '2026-07-14T10:00:00Z',
}

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  // These tests exercise the wide-screen workflow; responsive transitions have
  // separate component and real-browser coverage.
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  EventSourceStub.instances = []
  vi.stubGlobal('EventSource', EventSourceStub)
  mocks.api.mockReset()
  mocks.loading.mockReset().mockReturnValue(17)
  mocks.success.mockReset()
  mocks.error.mockReset()
  mocks.info.mockReset()
  mocks.promise.mockReset().mockImplementation((operation: Promise<unknown>) => operation)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('stream action messages', () => {
  it.each([false, true])('restores decisions and shows Skills only for the latest request (image=%s)', async imageLast => {
    const history = [
      { id: 1, run_id: 'past-run', event_type: 'agent_message', payload: { role: 'user', content: '上一轮改稿要求' } },
      { id: 2, run_id: 'past-run', event_type: 'status', payload: { status: 'skills_selected', skills: [{ id: 'tpl-1', skill_key: 'professional', name: '专业', permissions: [], reason: '手动指定', references: [], version: '1.0.0' }] } },
      { id: 3, run_id: 'past-run', event_type: 'agent_message', payload: { role: 'assistant', content: '候选稿已生成', status: 'awaiting_approval', proposal_html: '<p>不能恢复为正文的旧稿</p>' } },
      { id: 4, run_id: 'past-run', event_type: 'agent_proposal', payload: { status: 'rejected' } },
      ...(imageLast ? [
        { id: 5, run_id: null, event_type: 'agent_message', payload: { role: 'user', content: '帮这篇文章配图' } },
        { id: 6, run_id: null, event_type: 'agent_message', payload: { role: 'assistant', content: '图片提示词记录（只供查看，不代表已生成图片或已获得生图授权）：冷色调', skills: [{ id: 'image-skill', skill_key: 'image-skill', name: '配图 Skill', version: '1.0.0', source: 'file', permissions: ['image_generation'], reason: '关键词匹配：配图', references: ['references/style.md'] }] } },
      ] : []),
    ]
    mocks.api.mockImplementation((path: string) => {
      if (path === '/api/tasks/t1') return Promise.resolve(task)
      if (path === '/api/tasks/t1/agent-history') return Promise.resolve(history)
      if (path === '/api/rewrite-templates') return Promise.resolve([template])
      return Promise.resolve([])
    })
    renderWithQuery(<TaskDetailPage/>)
    expect(await screen.findByText('这轮候选稿已拒绝，没有应用到文章。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '接受修改' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认生成' })).not.toBeInTheDocument()
    expect(screen.getByTestId('rich-editor')).toHaveTextContent('草稿')
    if (imageLast) {
      expect(screen.getByText(/^图片提示词记录/)).toBeInTheDocument()
      expect(screen.getByText('本轮 Skills：配图 Skill')).toBeInTheDocument()
    } else expect(screen.getByText('本轮 Skills：专业')).toBeInTheDocument()
    expect(mocks.api.mock.calls.every(([, init]) => !init)).toBe(true)
  })

  it('loads failed Aimaster source media into the editor preview', async () => {
    mocks.api.mockImplementation((path: string) => {
      if (path === '/api/tasks/t1') return Promise.resolve(task)
      if (path === '/api/tasks/t1/versions') return Promise.resolve([])
      if (path === '/api/admin/accounts') return Promise.resolve([])
      if (path === '/api/rewrite-templates') return Promise.resolve([template])
      return Promise.resolve({})
    })

    renderWithQuery(<TaskDetailPage/>)

    const editor = await screen.findByTestId('rich-editor')
    await waitFor(() => expect(editor.querySelectorAll('img')).toHaveLength(1))
    expect(editor.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/source.jpg?x=1&y=2')
  })

  it('keeps an agent rewrite as a reviewable proposal until accepted', async () => {
    mocks.api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/tasks/t1') return Promise.resolve(task)
      if (path === '/api/tasks/t1/versions') return Promise.resolve([])
      if (path === '/api/admin/accounts') return Promise.resolve([])
      if (path === '/api/rewrite-templates') return Promise.resolve([template])
      if (path === '/api/tasks/t1/agent-plan') return Promise.resolve({ action: 'article_edit', message: '' })
      if (path === '/api/tasks/t1/agent-runs' && init) return Promise.resolve({ id: 'run-1', base_html: '<p>草稿</p>', base_version_id: null })
      if (path === '/api/tasks/t1/agent-runs/run-1/accept' && init) return Promise.resolve({ ...task, html: '<p>完成</p>' })
      return Promise.resolve({})
    })
    renderWithQuery(<TaskDetailPage/>)

    fireEvent.change(await screen.findByRole('textbox', { name: '向文章 Agent 提出修改要求' }), { target: { value: '核实并改写' } })
    fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
    await waitFor(() => expect(EventSourceStub.instances).toHaveLength(1))

    const stream = EventSourceStub.instances[0]
    stream.emit('tool_call', JSON.stringify({ name: 'web_search', arguments: { query: '测试文章' } }))
    stream.emit('status', JSON.stringify({ status: 'search_completed', has_context: true, sources: [{ title: '权威来源', url: 'https://example.com/source', summary: '核实摘要' }] }))
    expect(await screen.findByRole('link', { name: /权威来源/ })).toHaveAttribute('href', 'https://example.com/source')
    expect(screen.getByText('已取得检索资料，尚待核查结论')).toBeInTheDocument()
    expect(screen.queryByText('网络求实已完成')).not.toBeInTheDocument()
    stream.emit('status', JSON.stringify({ status: 'fact_check_completed', report: {
      schema_version: 1, run_id: 'run-1', base_version_id: null, checked_at: '2026-09-03T08:00:00Z', status: 'completed', note: '本轮仅核查一条说法。',
      scope: { max_claims: 6, input_chars: 2, article_truncated: false },
      claims: [{ id: 'C1', excerpt: '原文的一条说法', query: '核查词', verdict: 'uncertain', reason: '没有足够证据。', evidence: [], search_status: 'completed' }],
      sources: [{ id: 'S1', title: '权威来源', url: 'https://example.com/source', summary: '核实摘要', content_kind: 'snippet' }],
    } }))
    expect(await screen.findByText('无法确认')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '事实核查结论' })).toHaveTextContent('本轮仅核查一条说法')
    stream.emit('text_delta', JSON.stringify({ delta: '<p>完成</p>' }))
    stream.emit('completed', JSON.stringify({
      html: '<p>完成</p><img data-asset-id="another" src="https://cdn.example/source.jpg?x=1&amp;y=2">',
    }))
    expect(await screen.findByRole('region', { name: '修改对比' })).toBeInTheDocument()
    expect(screen.getByTestId('rich-editor').querySelectorAll('img')).toHaveLength(1)
    expect(stream.closed).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '接受修改' }))
    await waitFor(() => expect(mocks.promise).toHaveBeenCalledWith(expect.any(Promise), { loading: '正在接受修改…', success: '修改已应用' }))
  })

  it('preserves the article when an agent run fails', async () => {
    mocks.api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/tasks/t1') return Promise.resolve(task)
      if (path === '/api/tasks/t1/versions') return Promise.resolve([])
      if (path === '/api/admin/accounts') return Promise.resolve([])
      if (path === '/api/rewrite-templates') return Promise.resolve([template])
      if (path === '/api/tasks/t1/agent-plan') return Promise.resolve({ action: 'article_edit', message: '' })
      if (path === '/api/tasks/t1/agent-runs' && init) return Promise.resolve({ id: 'run-2' })
      return Promise.resolve({})
    })
    renderWithQuery(<TaskDetailPage/>)

    fireEvent.change(await screen.findByRole('textbox', { name: '向文章 Agent 提出修改要求' }), { target: { value: '优化标题' } })
    fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
    await waitFor(() => expect(EventSourceStub.instances).toHaveLength(1))
    const stream = EventSourceStub.instances[0]
    stream.emit('error')

    expect(await screen.findByText('这次处理失败了，原文没有被覆盖。你可以稍后重试。')).toBeInTheDocument()
    expect(screen.getByTestId('rich-editor')).toHaveTextContent('草稿')
    expect(stream.closed).toBe(true)
  })

  it('revises a pending candidate and restores it when the revision fails', async () => {
    let runNumber = 0
    mocks.api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/tasks/t1') return Promise.resolve(task)
      if (path === '/api/tasks/t1/versions' || path === '/api/admin/accounts' || path === '/api/tasks/t1/agent-history') return Promise.resolve([])
      if (path === '/api/rewrite-templates') return Promise.resolve([template])
      if (path === '/api/tasks/t1/agent-plan') return Promise.resolve({ action: 'article_edit', message: '' })
      if (path === '/api/tasks/t1/agent-runs' && init) {
        runNumber++
        const body = JSON.parse(String(init.body))
        if (runNumber > 1) expect(body).toEqual({ instruction: runNumber === 2 ? '再精简一些' : '换个简短开头', template_id: null, revise_run_id: 'run-1', base_version_id: null })
        return Promise.resolve({ id: `run-${runNumber}`, base_html: '<p>草稿</p>', base_version_id: null })
      }
      if (path === '/api/tasks/t1/agent-runs/run-3/accept') return Promise.resolve({ ...task, html: '<p>第三版候选</p>' })
      return Promise.resolve({})
    })
    renderWithQuery(<TaskDetailPage/>)
    const input = await screen.findByRole('textbox', { name: '向文章 Agent 提出修改要求' })
    fireEvent.change(input, { target: { value: '先优化一版' } })
    fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
    await waitFor(() => expect(EventSourceStub.instances).toHaveLength(1))
    EventSourceStub.instances[0].emit('completed', JSON.stringify({ html: '<p>第一版候选</p>' }))
    expect(await screen.findByText(/基于候选稿迭代/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '再精简一些' } })
    fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
    await waitFor(() => expect(EventSourceStub.instances).toHaveLength(2))
    EventSourceStub.instances[1].emit('error')
    expect(await screen.findByText(/上一版候选稿仍保留/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '接受修改' })).toBeEnabled()
    fireEvent.change(input, { target: { value: '换个简短开头' } })
    fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
    await waitFor(() => expect(EventSourceStub.instances).toHaveLength(3))
    EventSourceStub.instances[2].emit('completed', JSON.stringify({ html: '<p>第三版候选</p>' }))
    expect(await screen.findByText('第三版候选')).toBeInTheDocument()
    expect(screen.getByTestId('rich-editor')).toHaveTextContent('草稿')
    fireEvent.click(screen.getByRole('button', { name: '接受修改' }))
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/api/tasks/t1/agent-runs/run-3/accept', expect.anything()))
  })

  it.each([
    ['image_prompt', '帮这篇文章配图', '确认图片提示词'],
    ['publish_preview', '准备发布到公众号', '核对发布内容'],
    ['clarify', '改稿后配图再发布', '你希望先改稿还是配图？'],
    ['invalid', '无法识别', '无法确认要执行的动作，请明确要求后重试'],
  ])('routes %s without rewriting, generating or publishing', async (action, instruction, expected) => {
    let resolvePlan!: (value: unknown) => void
    mocks.api.mockImplementation((path: string) => {
      if (path === '/api/tasks/t1') return Promise.resolve(task)
      if (path === '/api/tasks/t1/versions' || path === '/api/admin/accounts' || path === '/api/tasks/t1/agent-history') return Promise.resolve([])
      if (path === '/api/rewrite-templates') return Promise.resolve([template])
      if (path === '/api/tasks/t1/agent-plan') return new Promise(resolve => { resolvePlan = resolve })
      if (path === '/api/tasks/t1/image-skills') return Promise.resolve({ invocations: action === 'image_prompt' ? [{ id: 'image-skill', skill_key: 'image-skill', name: '配图 Skill', version: '1.0.0', source: 'file', permissions: ['image_generation'], reason: '关键词匹配：配图', references: ['references/style.md'] }] : [] })
      if (path === '/api/tasks/t1/image-prompt') return Promise.resolve({ prompt: '待审批的图片提示词', aspect_ratio: '16:9', alt_text: instruction, skills: action === 'image_prompt' ? [{ id: 'image-skill', skill_key: 'image-skill', name: '配图 Skill', version: '1.0.0', source: 'file', permissions: ['image_generation'], reason: '关键词匹配：配图', references: ['references/style.md'] }] : [] })
      throw new Error(`unexpected action: ${path}`)
    })
    renderWithQuery(<TaskDetailPage/>)
    fireEvent.change(await screen.findByRole('textbox', { name: '测试正文' }), { target: { value: '<p>发送时尚未保存的正文</p>' } })
    fireEvent.change(screen.getByRole('textbox', { name: '向文章 Agent 提出修改要求' }), { target: { value: instruction } })
    fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
    expect(await screen.findByText('文字模型正在识别本轮要求')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布' })).toBeDisabled()
    // Later typing must remain in the editor, but cannot change the sent snapshot.
    fireEvent.change(screen.getByRole('textbox', { name: '测试正文' }), { target: { value: '<p>识别期间的新编辑</p>' } })
    resolvePlan({ action, message: '你希望先改稿还是配图？' })
    expect(await screen.findByText(expected)).toBeInTheDocument()
    expect(screen.getByTestId('rich-editor')).toHaveTextContent('识别期间的新编辑')
    expect(EventSourceStub.instances).toHaveLength(0)
    expect(mocks.api.mock.calls.filter(([path]) => /agent-runs|\/publish$|\/image-approval$|\/api\/media\//.test(path))).toHaveLength(0)
    if (action === 'image_prompt') {
      expect(screen.getByText('本轮 Skills：配图 Skill')).toBeInTheDocument()
      const [, init] = mocks.api.mock.calls.find(([path]) => path.endsWith('/image-prompt'))!
      expect(JSON.parse(init.body)).toEqual({ instruction, current_html: '<p>发送时尚未保存的正文</p>', base_version_id: null })
      fireEvent.click(screen.getByRole('button', { name: '取消' }))
      expect(screen.queryByText('确认图片提示词')).not.toBeInTheDocument()
    }
  })
})
