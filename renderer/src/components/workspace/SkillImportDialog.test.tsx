import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SkillImportDialog } from './SkillImportDialog'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ api }))
const skill = { id: 'skill-1', name: '核查', version: '2.0.0', description: '检查来源', permissions: ['web_search', 'browser'], system_prompt: '不要捏造来源' }
const preview = { skill, existing: { name: '核查', version: '1.0.0', enabled: false }, added_permissions: ['browser'], approval_token: 'review-token' }
const select = () => fireEvent.change(screen.getByLabelText('选择 SKILL.md'), {
  target: { files: [{ name: 'SKILL.md', size: 32, text: () => Promise.resolve('file contents') }] },
})
beforeEach(() => api.mockReset())
afterEach(cleanup)

it('shows version, permissions and preserved disabled state; cancellation never installs', async () => {
  api.mockResolvedValue(preview)
  const installed = vi.fn()
  render(<SkillImportDialog onInstalled={installed}/> )
  select()
  await screen.findByRole('button', { name: '确认更新' })
  expect(screen.getByText(/1.0.0 → 2.0.0/)).toBeInTheDocument()
  expect(screen.getByText('浏览器（新增权限）')).toBeInTheDocument()
  expect(screen.getByText(/保留当前停用状态/)).toBeInTheDocument()
  expect(api).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(api).toHaveBeenCalledTimes(1)
  expect(installed).not.toHaveBeenCalled()
})

it('surfaces stale-review failure and requires a fresh preview before retry', async () => {
  api.mockResolvedValueOnce(preview).mockRejectedValueOnce(new Error('预览已失效'))
    .mockResolvedValueOnce({ ...preview, approval_token: 'fresh-token' }).mockResolvedValueOnce({ skill })
  const installed = vi.fn()
  render(<SkillImportDialog onInstalled={installed}/> )
  select()
  fireEvent.click(await screen.findByRole('button', { name: '确认更新' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('预览已失效')
  expect(installed).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '确认更新' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新预览' }))
  fireEvent.click(await screen.findByRole('button', { name: '确认更新' }))
  await waitFor(() => expect(installed).toHaveBeenCalledWith(skill))
  expect(JSON.parse(api.mock.calls[3][1].body).approval_token).toBe('fresh-token')
})

it('reports file-read errors and never silently installs an oversized file', async () => {
  render(<SkillImportDialog onInstalled={vi.fn()}/> )
  fireEvent.change(screen.getByLabelText('选择 SKILL.md'), { target: { files: [{ name: 'SKILL.md', size: 129 * 1024 }] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('128 KB')
  expect(api).not.toHaveBeenCalled()
})

it('previews a Skill folder with references as one confirmed package', async () => {
  api.mockResolvedValue({ ...preview, skill: { ...skill, skill_files: [
    { path: 'SKILL.md', content: 'instructions' }, { path: 'references/facts.md', content: 'verified facts' },
  ] } })
  render(<SkillImportDialog onInstalled={vi.fn()}/> )
  fireEvent.click(screen.getByRole('button', { name: '导入' }))
  const entry = { name: 'SKILL.md', size: 12, webkitRelativePath: 'fact-check/SKILL.md', text: () => Promise.resolve('instructions') }
  const reference = { name: 'facts.md', size: 14, webkitRelativePath: 'fact-check/references/facts.md', text: () => Promise.resolve('verified facts') }
  fireEvent.change(screen.getByLabelText('选择 Skill 文件夹'), { target: { files: [entry, reference] } })
  await screen.findByText('references/facts.md')
  expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ files: [
    { path: 'SKILL.md', content: 'instructions' }, { path: 'references/facts.md', content: 'verified facts' },
  ] })
  expect(screen.getByText(/不支持脚本或压缩包/)).toBeInTheDocument()
})
