import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceLayout, type WorkspacePanel } from './WorkspaceLayout'

let width = 800
const listeners = new Set<() => void>()
function resize(next: number) { act(() => { width = next; [...listeners].forEach(listener => listener()) }) }

beforeEach(() => {
  width = 800
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return width >= Number(query.match(/\d+/)?.[0]) },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
})
afterEach(() => { cleanup(); listeners.clear(); vi.unstubAllGlobals() })

function Workspace({ approvalCount = 0 }: { approvalCount?: number }) {
  const [panel, setPanel] = useState<WorkspacePanel>('article')
  return <WorkspaceLayout activePanel={panel} onPanelChange={setPanel} approvalCount={approvalCount}
    article={<textarea aria-label="草稿正文" defaultValue="草稿"/>}
    agent={<textarea aria-label="未发送的要求"/>}
    evidence={<button>一条来源</button>}/>
}

describe('article workspace layout', () => {
  it('keeps mounted inputs and accessible tabs when switching panels', () => {
    render(<Workspace approvalCount={1}/>)
    const article = screen.getByRole('textbox', { name: '草稿正文' })
    fireEvent.change(article, { target: { value: '尚未保存的新正文' } })
    const articleTab = screen.getByRole('tab', { name: '正文' })
    fireEvent.keyDown(articleTab, { key: 'ArrowRight' })
    const agentTab = screen.getByRole('tab', { name: '对话 1 待确认' })
    expect(agentTab).toHaveFocus()
    expect(agentTab).toHaveAttribute('aria-selected', 'true')
    expect(article).not.toBeVisible()
    const instruction = screen.getByRole('textbox', { name: '未发送的要求' })
    fireEvent.change(instruction, { target: { value: '还没发送的修改要求' } })
    fireEvent.keyDown(agentTab, { key: 'Home' })
    expect(articleTab).toHaveFocus()
    expect(screen.getByRole('textbox', { name: '草稿正文' })).toBe(article)
    expect(article).toHaveValue('尚未保存的新正文')
    fireEvent.keyDown(articleTab, { key: 'End' })
    expect(screen.getByRole('textbox', { name: '未发送的要求' })).toBe(instruction)
    expect(instruction).toHaveValue('还没发送的修改要求')
  })

  it('opens one evidence drawer and restores focus on Escape', async () => {
    render(<Workspace/>)
    const trigger = screen.getByRole('button', { name: '资料' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '文章资料' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: '一条来源' })).toHaveLength(1)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('moves evidence inline on wide screens without duplicating inputs or trapping focus', async () => {
    render(<Workspace/>)
    fireEvent.click(screen.getByRole('button', { name: '资料' }))
    resize(1440)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '一条来源' })).toHaveLength(1)
    expect(screen.getByRole('region', { name: '文章正文' })).toBeVisible()
    const instruction = screen.getByRole('textbox', { name: '未发送的要求' })
    act(() => instruction.focus())
    fireEvent.change(instruction, { target: { value: '跨尺寸保留' } })
    resize(1200)
    expect(screen.getByRole('button', { name: '资料' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '一条来源' })).not.toBeInTheDocument()
    resize(800)
    await waitFor(() => expect(screen.getByRole('tab', { name: '对话' })).toHaveAttribute('aria-selected', 'true'))
    expect(instruction).toBeVisible()
    expect(instruction).toHaveValue('跨尺寸保留')
    expect(document.body).not.toHaveStyle({ pointerEvents: 'none' })
  })

  it('only shows the wide-screen confirmation notice when something needs review', () => {
    resize(1440)
    const { rerender } = render(<Workspace/>)
    expect(screen.queryByText('正文与 Agent 对话同步保留')).not.toBeInTheDocument()
    expect(document.querySelector('.workspace-controls')).not.toBeInTheDocument()
    const article = screen.getByRole('textbox', { name: '草稿正文' })
    rerender(<Workspace approvalCount={1}/>)
    expect(screen.getByText('1 项内容待确认，请在对话区审阅')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '草稿正文' })).toBe(article)
  })
})
