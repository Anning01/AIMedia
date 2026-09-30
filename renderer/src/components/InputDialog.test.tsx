import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { InputDialog } from './InputDialog'
import { promptText } from '@/lib/prompt'

afterEach(() => { cleanup(); delete window.desktop })
it('desktop input uses a keyboard-accessible dialog and returns its value', async () => {
  window.desktop = { isDesktop: true, apiBase: '', importData: vi.fn(), openDataDirectory: vi.fn(), openBrowserSession: vi.fn() }
  render(<InputDialog/>)
  let pending!: Promise<string | null>
  act(() => { pending = promptText('文章标题', '默认标题') })
  const input = await screen.findByRole('textbox', { name: '文章标题' })
  expect(input).toHaveValue('默认标题')
  fireEvent.change(input, { target: { value: '新标题' } })
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
  await expect(pending).resolves.toBe('新标题')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  act(() => { pending = promptText('图片地址') })
  fireEvent.click(await screen.findByRole('button', { name: '取消' }))
  await expect(pending).resolves.toBeNull()
})
