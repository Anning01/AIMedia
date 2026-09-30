import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, type Account } from '@/lib/api'
import { messages } from '@/lib/messages'
import { AccountsPage } from './AccountsPage'

vi.mock('@/lib/api', () => ({ api: vi.fn() }))
vi.mock('@/lib/messages', () => ({
  messages: { promise: vi.fn(<T,>(operation: Promise<T>) => operation) },
}))

const mockedApi = vi.mocked(api)

beforeEach(() => {
  mockedApi.mockReset()
  vi.mocked(messages.promise).mockClear()
})

afterEach(cleanup)

it('presents account management as a multi-platform page with WeChat available first', async () => {
  mockedApi.mockResolvedValue([])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={client}><AccountsPage/></QueryClientProvider>)

  expect(screen.getByRole('heading', { name: '账号管理' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '已接入平台' })).toHaveTextContent('微信公众号')
  expect(screen.getByRole('region', { name: '已接入平台' })).toHaveTextContent('已支持')
  expect(screen.getByLabelText('发布平台')).toHaveValue('微信公众号')
  expect(await screen.findByText('还没有保存账号。填写账号名称并保存后，再打开平台登录。')).toBeInTheDocument()
})

it('creates a WeChat browser account through the shared account API', async () => {
  const saved: Account = {
    id: 'wechat-1', platform: '微信公众号', name: '品牌公众号', adapter: 'browser',
    entry_url: 'https://mp.weixin.qq.com/', credentials: {}, status: 'active', publish_policy: 'manual',
    daily_slots: [], delay_min: 10, delay_max: 30, branding_enabled: true,
  }
  mockedApi.mockImplementation((path, init) => {
    if (path === '/api/admin/accounts' && init?.method === 'POST') return Promise.resolve(saved)
    return Promise.resolve([])
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><AccountsPage/></QueryClientProvider>)

  fireEvent.change(screen.getByLabelText('账号名称'), { target: { value: '品牌公众号' } })
  fireEvent.click(screen.getByRole('button', { name: '保存账号' }))

  await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/api/admin/accounts', expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('"platform":"微信公众号"'),
  })))
  expect(messages.promise).toHaveBeenCalledWith(expect.any(Promise), { loading: '正在保存账号…', success: '账号已保存' })
})
