import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { QueryFeedback } from './query-feedback'
import { Button } from './button'

it('distinguishes initial loading, retained-data refresh, failure and successful emptiness', () => {
  const refetch = vi.fn()
  const idle = { isLoading: false, isFetching: false, isError: false, refetch }
  const view = render(<QueryFeedback label="文章" query={{ ...idle, isLoading: true, isFetching: true }}/>)
  expect(screen.getByRole('status')).toHaveTextContent('正在读取文章')
  expect(view.container.querySelectorAll('.ui-skeleton')).toHaveLength(3)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  view.rerender(<QueryFeedback label="文章" query={{ ...idle, data: [], isFetching: true }}/>)
  expect(screen.getByRole('status')).toHaveTextContent('正在刷新文章，当前内容仍可查看')
  expect(view.container.querySelector('.ui-skeleton')).toBeNull()
  view.rerender(<QueryFeedback label="文章" query={{ ...idle, data: [], isError: true }}/>)
  expect(screen.getByRole('alert')).toHaveTextContent('已保留上次读取的内容')
  fireEvent.click(screen.getByRole('button', { name: '重新读取文章' }))
  expect(refetch).toHaveBeenCalledOnce()
  view.rerender(<QueryFeedback label="文章" query={{ ...idle, data: [] }}/>)
  expect(view.container).toBeEmptyDOMElement()
})

it('retains native content and blocks repeated retry while the request is pending', () => {
  const refetch = vi.fn()
  const query = { data: ['cached'], isLoading: false, isFetching: false, isError: false, refetch }
  const content = <input aria-label="未保存编辑" defaultValue="旧内容"/>
  const view = render(<><QueryFeedback label="文章" query={query}/>{content}</>)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: '新内容' } })
  view.rerender(<><QueryFeedback label="文章" query={{ ...query, isError: true, isFetching: true }}/>{content}</>)
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input).toHaveValue('新内容')
  const retry = screen.getByRole('button', { name: '重新读取文章' })
  expect(retry).toBeDisabled()
  expect(retry).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(retry)
  expect(refetch).not.toHaveBeenCalled()
})

it('preserves button name and children while busy and restores interaction afterward', () => {
  const click = vi.fn()
  const view = render(<Button busy onClick={click}><span>保存</span></Button>)
  const button = screen.getByRole('button', { name: '保存' })
  const label = button.firstChild
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(button)
  expect(click).not.toHaveBeenCalled()
  view.rerender(<Button onClick={click}><span>保存</span></Button>)
  expect(button.firstChild).toBe(label)
  expect(button).toBeEnabled()
  expect(button).not.toHaveAttribute('data-busy')
  fireEvent.click(button)
  expect(click).toHaveBeenCalledOnce()
})
