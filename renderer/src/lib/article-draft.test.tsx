import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { Task } from './api'
import { useArticleDraft } from './article-draft'

afterEach(cleanup)
const task = (id: string, html = '<p>已保存</p>', version = 'v1'): Task => ({ id, html, active_version_id: version, platform: 'manual', original_title: '原文', original_content: '原文', style: 'professional', generation_status: 'completed', publish_status: 'draft', created_at: '', updated_at: '' })

it('does not overwrite dirty content on status or remote-version refetch', () => {
  const original = task('refetch')
  const { result, rerender } = renderHook(({ data }) => useArticleDraft(data.id, data), { initialProps: { data: original } })
  act(() => result.current.setHtml('<p>尚未保存</p>'))
  rerender({ data: { ...original, generation_status: 'running' } })
  expect(result.current.html).toBe('<p>尚未保存</p>')
  rerender({ data: task('refetch', '<p>另一个版本</p>', 'v2') })
  expect(result.current.conflict).toBe(true)
  expect(result.current.versionId).toBe('v1')
  expect(result.current.html).toBe('<p>尚未保存</p>')
  act(() => result.current.useSavedVersion())
  expect(result.current.html).toBe('<p>另一个版本</p>')
  expect(result.current.dirty).toBe(false)
})

it('preserves edits made while save or accept is in flight', () => {
  const { result } = renderHook(() => useArticleDraft('flight', taskData))
  act(() => result.current.setHtml('<p>提交时</p>'))
  const submitted = result.current.currentHtml()
  act(() => result.current.setHtml('<p>等待期间又改了</p>'))
  act(() => result.current.saved(task('flight', '<p>提交时</p>', 'v2'), submitted))
  expect(result.current.html).toBe('<p>等待期间又改了</p>')
  expect(result.current.versionId).toBe('v2')
  expect(result.current.dirty).toBe(true)
  act(() => result.current.useSavedVersion())
})
const taskData = task('flight')

it('retains dirty content across in-app remounts but follows the server when clean', () => {
  const original = task('navigation')
  const first = renderHook(() => useArticleDraft(original.id, original))
  act(() => first.result.current.setHtml('<p>离开前的编辑</p>'))
  first.unmount()
  const second = renderHook(({ data }) => useArticleDraft(data.id, data), { initialProps: { data: original } })
  expect(second.result.current.html).toBe('<p>离开前的编辑</p>')
  act(() => second.result.current.useSavedVersion())
  second.rerender({ data: task(original.id, '<p>最新</p>', 'v3') })
  expect(second.result.current.html).toBe('<p>最新</p>')
})
