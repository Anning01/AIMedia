import { describe, expect, it } from 'vitest'
import { createMessages, getErrorMessage, type MessageAdapter } from './messages'

function recordingAdapter() {
  const calls: Array<{ type: string; text: string; id?: string | number }> = []
  const adapter: MessageAdapter = {
    loading: (text) => {
      calls.push({ type: 'loading', text, id: 7 })
      return 7
    },
    success: (text, id) => { calls.push({ type: 'success', text, id }) },
    error: (text, id) => { calls.push({ type: 'error', text, id }) },
    info: (text) => { calls.push({ type: 'info', text }) },
  }
  return { adapter, calls }
}

describe('messages', () => {
  it('updates one message from loading to success', async () => {
    const { adapter, calls } = recordingAdapter()
    const result = await createMessages(adapter).promise(Promise.resolve('saved'), {
      loading: '正在保存设置…',
      success: '设置已保存',
    })

    expect(result).toBe('saved')
    expect(calls).toEqual([
      { type: 'loading', text: '正在保存设置…', id: 7 },
      { type: 'success', text: '设置已保存', id: 7 },
    ])
  })

  it('shows the backend error on the same message and rethrows it', async () => {
    const { adapter, calls } = recordingAdapter()
    const failure = new Error('时区格式无效')

    await expect(createMessages(adapter).promise(Promise.reject(failure), {
      loading: '正在保存设置…',
      success: '设置已保存',
    })).rejects.toBe(failure)

    expect(calls.at(-1)).toEqual({ type: 'error', text: '时区格式无效', id: 7 })
  })

  it('provides a safe fallback for unknown errors', () => {
    expect(getErrorMessage(null)).toBe('操作失败，请稍后重试')
    expect(getErrorMessage(new Error('请求失败'))).toBe('请求失败')
  })
})
