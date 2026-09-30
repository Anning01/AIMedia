import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { messages } from '@/lib/messages'
import { SettingsPage } from './SettingsPage'

vi.mock('@/lib/api', () => ({ api: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ to, children, ...props }: React.ComponentProps<'a'> & { to: string }) => <a href={to} {...props}>{children}</a> }))
vi.mock('@/lib/messages', () => ({
  messages: { promise: vi.fn(<T,>(operation: Promise<T>) => operation) },
}))

const mockedApi = vi.mocked(api)
const mockedPromise = vi.mocked(messages.promise)

beforeEach(() => {
  mockedApi.mockReset()
  mockedPromise.mockClear()
})

afterEach(cleanup)

it('shows the global save lifecycle and prevents duplicate settings saves', async () => {
  let resolvePatch!: (value: unknown) => void
  const patchRequest = new Promise(resolve => { resolvePatch = resolve })
  mockedApi.mockImplementation((_path, init) => init ? patchRequest : Promise.resolve({ timezone: 'Asia/Shanghai' }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <SettingsPage/>
    </QueryClientProvider>,
  )

  expect(screen.queryByRole('button', { name: '保存全部设置' })).not.toBeInTheDocument()
  const button = await screen.findByRole('button', { name: '保存全部设置' })
  fireEvent.click(button)

  await waitFor(() => expect(mockedPromise).toHaveBeenCalledWith(
    expect.any(Promise),
    { loading: '正在保存设置…', success: '设置已保存' },
  ))
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')

  resolvePatch({})
  await waitFor(() => expect(button).toBeEnabled())
})

it('preserves settings edited during refresh and an in-flight save', async () => {
  let resolvePatch!: (value: unknown) => void
  const patch = new Promise(resolve => { resolvePatch = resolve })
  mockedApi.mockImplementation((_path, init) => init ? patch : Promise.resolve({ llm_model: 'server-model' }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SettingsPage/></QueryClientProvider>)
  const model = await screen.findByDisplayValue('server-model')
  fireEvent.change(model, { target: { value: 'my-draft' } })
  act(() => client.setQueryData(['config'], { llm_model: 'background-update' }))
  expect(model).toHaveValue('my-draft')
  const save = screen.getByRole('button', { name: '保存全部设置' })
  fireEvent.click(save)
  fireEvent.change(model, { target: { value: 'edited-after-save-started' } })
  await act(async () => { resolvePatch({}) })
  await waitFor(() => expect(save).toBeEnabled())
  expect(model).toHaveValue('edited-after-save-started')
  expect(mockedApi).toHaveBeenCalledWith('/api/admin/config', expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ values: { llm_model: 'my-draft' } }),
  }))
})

it('does not offer editable defaults when settings fail to load, and can retry', async () => {
  mockedApi.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ llm_model: 'restored-model' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SettingsPage/></QueryClientProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('设置读取失败')
  expect(screen.queryByRole('button', { name: '保存全部设置' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新读取设置' }))
  expect(await screen.findByDisplayValue('restored-model')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('shows independent GPT Image 2 endpoint and credential settings', async () => {
  mockedApi.mockResolvedValue({
    image_provider: 'gpt-image-2',
    image_model: 'gpt-image-2',
    image_base_url: 'https://images.example.test/v1',
    image_api_key_configured: true,
    image_quality: 'high',
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={client}><SettingsPage/></QueryClientProvider>)

  expect(await screen.findByDisplayValue('https://images.example.test/v1')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { name: 'GPT Image 2' }).length).toBeGreaterThan(0)
  expect(screen.getAllByText('图片 API Key（已配置）').length).toBeGreaterThan(0)
  expect(screen.getByDisplayValue('高')).toBeInTheDocument()
})

it('keeps Firecrawl configured, reveals it on demand, and links to the key dashboard', async () => {
  mockedApi.mockImplementation(path => {
    if (path === '/api/admin/config/secrets/firecrawl_api_key') {
      return Promise.resolve({ value: 'fc-visible-secret' })
    }
    return Promise.resolve({
      firecrawl_api_key_configured: true,
      search_enabled: true,
      max_search_results: 3,
    })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={client}><SettingsPage/></QueryClientProvider>)

  const secretInput = await screen.findByPlaceholderText('••••••••••••••••')
  expect(secretInput).toHaveAttribute('type', 'password')
  expect(screen.getByRole('link', { name: /获取 \/ 查看 Key/ })).toHaveAttribute('href', 'https://firecrawl.dev/app/api-keys')

  fireEvent.click(screen.getByRole('button', { name: '显示 Firecrawl API Key' }))
  await waitFor(() => expect(secretInput).toHaveValue('fc-visible-secret'))
  expect(secretInput).toHaveAttribute('type', 'text')

  fireEvent.click(screen.getByRole('button', { name: '隐藏 Firecrawl API Key' }))
  expect(secretInput).toHaveAttribute('type', 'password')
})
