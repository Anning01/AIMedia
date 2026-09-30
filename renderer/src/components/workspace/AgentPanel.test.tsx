import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentPanel } from './AgentPanel'

afterEach(cleanup)

it('retains the next instruction while an approval prevents submitting another run', () => {
  const onSubmit = vi.fn()
  const props = { messages: [], activities: [], skills: [], skillId: '', busy: false, onSubmit, onSkillChange: vi.fn(), onRequestImage: vi.fn() }
  const { rerender } = render(<AgentPanel {...props} awaitingReview approval={<div>等待确认</div>}/>)
  const input = screen.getByRole('textbox', { name: '向文章 Agent 提出修改要求' })
  fireEvent.change(input, { target: { value: '下一轮优化标题' } })
  expect(screen.getByRole('button', { name: '发送修改要求' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '核实关键事实' })).toBeDisabled()
  fireEvent.submit(input.closest('form')!)
  expect(onSubmit).not.toHaveBeenCalled()
  expect(input).toHaveValue('下一轮优化标题')
  rerender(<AgentPanel {...props}/>)
  fireEvent.click(screen.getByRole('button', { name: '发送修改要求' }))
  expect(onSubmit).toHaveBeenCalledWith('下一轮优化标题')
  expect(input).toHaveValue('')
})

it('allows a free-form candidate revision while keeping unrelated approval actions disabled', () => {
  const onSubmit = vi.fn()
  render(<AgentPanel messages={[]} activities={[]} skills={[]} skillId="" busy={false} onSubmit={onSubmit} onSkillChange={vi.fn()} onRequestImage={vi.fn()} awaitingReview canRevise approval={<div>候选稿待确认</div>}/>)
  const input = screen.getByRole('textbox', { name: '向文章 Agent 提出修改要求' })
  fireEvent.change(input, { target: { value: '把候选稿再缩短一些' } })
  expect(screen.getByRole('button', { name: '发送修改要求' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '添加配图' })).toBeDisabled()
  fireEvent.submit(input.closest('form')!)
  expect(onSubmit).toHaveBeenCalledWith('把候选稿再缩短一些')
  expect(screen.getByText(/基于候选稿迭代/)).toBeInTheDocument()
})

it('reveals the pending approval when returning from the article tab', () => {
  const props = { messages: [], activities: [], skills: [], skillId: '', busy: false, onSubmit: vi.fn(), onSkillChange: vi.fn(), onRequestImage: vi.fn(), approval: <div>确认卡</div> }
  const { container, rerender } = render(<AgentPanel {...props} active={false}/>)
  const conversation = container.querySelector('[aria-live="polite"]')!
  Object.defineProperty(conversation, 'scrollHeight', { configurable: true, value: 900 })
  Object.defineProperty(conversation, 'clientHeight', { configurable: true, value: 300 })
  rerender(<AgentPanel {...props} active/>)
  expect(conversation.scrollTop).toBe(900)
  conversation.scrollTop = 250
  rerender(<AgentPanel {...props} active={false}/>)
  expect(conversation.scrollTop).toBe(250)
})

it('shows automatic routing, explicit invocation help and the immutable Skill execution record', () => {
  render(<AgentPanel messages={[]} activities={[]} skills={[]} skillId="" busy={false} onSubmit={vi.fn()} onSkillChange={vi.fn()} onRequestImage={vi.fn()} invocations={[{
    id: 'fact', skill_key: 'news-fact', name: '新闻求实', version: '2.0.0', source: 'file', permissions: ['web_search'],
    reason: '关键词匹配：核实、来源', references: ['references/check.md'],
  }]}/>)
  expect(screen.getByRole('option', { name: '自动匹配' })).toBeInTheDocument()
  expect(screen.getByText(/\$标识/)).toBeInTheDocument()
  fireEvent.click(screen.getByText(/本轮 Skills/))
  expect(screen.getByText(/关键词匹配：核实、来源/)).toBeVisible()
  expect(screen.getByText(/网络搜索/)).toBeVisible()
  expect(screen.getByText(/references\/check.md/)).toBeVisible()
})

it('keeps the Skill picker next to the retained composer and exposes confirmation rules on demand', () => {
  const onSkillChange = vi.fn()
  const props = { messages: [], activities: [], skills: [], skillId: '', busy: false, onSubmit: vi.fn(), onSkillChange, onRequestImage: vi.fn() }
  const { rerender } = render(<AgentPanel {...props}/>)
  const picker = screen.getByRole('combobox', { name: '本轮 Skill' })
  const input = screen.getByRole('textbox', { name: '向文章 Agent 提出修改要求' })
  expect(picker.closest('.agent-composer')).toContainElement(input)
  fireEvent.change(input, { target: { value: '保留我的下一步要求' } })
  const help = screen.getByText('使用说明与确认规则').closest('details')!
  expect(help).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('使用说明与确认规则'))
  expect(help).toHaveAttribute('open')
  expect(help).toHaveTextContent('核查最多 6 条事实')
  expect(help).toHaveTextContent('模型与检索额度')
  expect(help).toHaveTextContent('生图、发布仍需另行确认')
  rerender(<AgentPanel {...props} busy/>)
  expect(picker).toBeDisabled()
  expect(input).toHaveValue('保留我的下一步要求')
  expect(screen.getByText('正在处理')).toBeInTheDocument()
})
