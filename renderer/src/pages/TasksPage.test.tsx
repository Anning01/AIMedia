import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Task } from '@/lib/api'
import { TasksPage } from './TasksPage'

const mocks = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), api: mocks.api }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ params, children, className }: { params: { articleId: string }; children: ReactNode; className?: string }) => <a href={'/articles/' + params.articleId} className={className}>{children}</a> }))

const articles: Task[] = [
  { id: 'published', platform: 'toutiao', original_title: '已经发布的文章', original_content: '讨论内容创作的方法。', style: 'professional', generation_status: 'completed', publish_status: 'published', html: '', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-02T10:00:00Z' },
  { id: 'draft', platform: 'manual', original_title: '最近修改的草稿', original_content: '探索城市里的日常生活。', style: 'professional', generation_status: 'completed', publish_status: 'draft', html: '', created_at: '2026-08-01T10:00:00Z', updated_at: '2026-09-09T10:00:00Z' },
]

beforeEach(() => {
  mocks.api.mockReset().mockResolvedValue(articles)
  vi.stubGlobal('EventSource', class { addEventListener() {} close() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function renderArticles() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TasksPage/></QueryClientProvider>)
}

describe('article library', () => {
  it('orders articles by their latest edit and keeps editing separate from publication', async () => {
    renderArticles()
    await screen.findByText('最近修改的草稿')
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/articles/draft')
    expect(within(links[0]).getByText('已完成')).toBeInTheDocument()
    expect(within(links[0]).getByText('未发布')).toBeInTheDocument()
    expect(within(links[0]).getByText('手动创建')).toBeInTheDocument()
    expect(within(links[1]).getByText('已发布')).toBeInTheDocument()
  })

  it('filters by publication rather than treating finished editing as published', async () => {
    renderArticles()
    await screen.findByText('最近修改的草稿')
    fireEvent.click(screen.getByRole('button', { name: '已发布' }))
    expect(screen.getByText('已经发布的文章')).toBeInTheDocument()
    expect(screen.queryByText('最近修改的草稿')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '未发布' }))
    expect(screen.getByText('最近修改的草稿')).toBeInTheDocument()
    expect(screen.queryByText('已经发布的文章')).not.toBeInTheDocument()
  })

  it('searches readable sources and lets an empty search reset both filters', async () => {
    renderArticles()
    await screen.findByText('最近修改的草稿')
    fireEvent.change(screen.getByRole('textbox', { name: '搜索文章' }), { target: { value: ' 手动创建 ' } })
    expect(screen.getByText('最近修改的草稿')).toBeInTheDocument()
    expect(screen.queryByText('已经发布的文章')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '已发布' }))
    expect(screen.getByText('没有匹配的文章')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看全部文章' }))
    expect(screen.getByRole('textbox', { name: '搜索文章' })).toHaveValue('')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /^全部文章/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
