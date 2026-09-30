import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { FactCheckReport } from '../../../../shared/research'
import { FactCheckPanel } from './FactCheckPanel'

afterEach(cleanup)
const report: FactCheckReport = {
  schema_version: 1, run_id: 'run-1', base_version_id: 'version-1', checked_at: '2026-09-03T08:00:00Z', status: 'partial',
  note: '仅核查选出的关键说法，不代表全文已证实。', scope: { max_claims: 6, input_chars: 30000, article_truncated: true },
  sources: [{ id: 'S1', title: '官方公告', url: 'https://example.com/facts', summary: '摘要', content_kind: 'page' }, { id: 'S2', title: '错误链接', url: 'javascript:alert(1)', summary: '摘要', content_kind: 'snippet' }],
  claims: [
    { id: 'C1', excerpt: '原文说 100 元。', query: '查询门票价格', verdict: 'contradicted', reason: '票价应为 80 元。', search_status: 'completed', evidence: [{ source_id: 'S1', quote: '门票为 80 元。', stance: 'contradicts' }] },
    { id: 'C2', excerpt: '预计有一百万人。', query: '预计人数', verdict: 'uncertain', reason: '仅有搜索摘要。', search_status: 'completed', evidence: [{ source_id: 'S2', quote: '<script>unsafe()</script>', stance: 'supports' }] },
  ],
}

it('shows claim-specific verdicts, scope, time and verifiable source excerpts without asserting full accuracy', () => {
  render(<FactCheckPanel report={report}/>)
  expect(screen.getByRole('region', { name: '事实核查结论' })).toHaveTextContent('部分核查未完成')
  expect(screen.getByText(/后续编辑未重新核查/)).toBeInTheDocument()
  expect(screen.getByText(/长文仅从前 30,000 字符/)).toBeInTheDocument()
  const claim = screen.getByText('原文说 100 元。').closest('details')!
  fireEvent.click(claim.querySelector('summary')!)
  expect(claim).toHaveAttribute('open')
  expect(claim).toHaveTextContent('证据反驳')
  expect(claim).toHaveTextContent('门票为 80 元。')
  expect(screen.getByRole('link', { name: /官方公告/ })).toHaveAttribute('href', 'https://example.com/facts')
  expect(document.querySelector('time')).toHaveAttribute('dateTime', report.checked_at)
  expect(screen.queryByText(/准确率/)).not.toBeInTheDocument()
})

it('renders unsafe external content as text and never opens unsafe source URLs', () => {
  const { container } = render(<FactCheckPanel report={report}/>)
  const claim = screen.getByText('预计有一百万人。').closest('details')!
  fireEvent.click(claim.querySelector('summary')!)
  expect(claim).toHaveTextContent('仅搜索摘要，不足以确认')
  expect(claim).toHaveTextContent('<script>unsafe()</script>')
  expect(container.querySelector('script')).toBeNull()
  expect(screen.queryByRole('link', { name: /错误链接/ })).not.toBeInTheDocument()
  expect(claim).toHaveTextContent('来源链接无效')
})

it('distinguishes absent, failed and skipped research from successful verification', () => {
  const { rerender } = render(<FactCheckPanel report={null}/>)
  expect(screen.getByText(/检索到来源不等于核实完成/)).toBeInTheDocument()
  for (const status of ['failed', 'skipped'] as const) {
    rerender(<FactCheckPanel report={{ ...report, status, claims: [], sources: [], note: '搜索不可用' }}/>)
    expect(screen.getByText(status === 'failed' ? '本轮核查失败' : '本轮未核查')).toBeInTheDocument()
    expect(screen.queryByText('来源支持')).not.toBeInTheDocument()
  }
})
