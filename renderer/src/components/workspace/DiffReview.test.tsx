import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DiffReview, reviewText } from './DiffReview'

afterEach(cleanup)
it('marks Chinese additions and deletions and keeps links, media and formatting reviewable', () => {
  const { container } = render(<DiffReview before={'<p>截至昨日有 10 人。</p><img src="/old.png" alt="旧图">'} after={'<p>截至今日有 <strong>12</strong> 人。</p><img src="/new.png" alt="新图">'}/>)
  expect(container.querySelector('ins')).toBeInTheDocument()
  expect(container.querySelector('del')).toBeInTheDocument()
  expect(container.textContent).toContain('图片')
  expect(reviewText('<a href="https://example.com">来源</a>')).toContain('https://example.com')
  expect(reviewText('<strong>加粗</strong>')).toBe('**加粗**')
  expect(container.querySelector('img')).toBeNull()
})
it('never mounts streamed HTML or active elements', () => {
  const html = '<script>bad()</script><img src="https://example.com/a" onerror="bad()"><iframe src="https://example.com"></iframe><p>正文</p>'
  const { container, rerender } = render(<DiffReview before="" after={html} busy/>)
  expect(container.querySelector('script,img,iframe')).toBeNull()
  expect(screen.getByText(/正在生成候选稿/)).toBeInTheDocument()
  rerender(<DiffReview before="" after={html}/>)
  expect(container.querySelector('script,img,iframe')).toBeNull()
  expect(container.textContent).not.toContain('bad()')
  expect(container.textContent).toContain('正文')
})
it('bounds large diffs and handles deeply nested input without losing the text', () => {
  const before = '旧'.repeat(12_000), after = '新'.repeat(12_000)
  render(<DiffReview before={before} after={after}/>)
  expect(screen.getByText(/改动较多/)).toBeInTheDocument()
  expect(reviewText('<div>'.repeat(500) + '保留正文' + '</div>'.repeat(500))).toBe('保留正文')
})
