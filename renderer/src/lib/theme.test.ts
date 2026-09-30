import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeTheme, nextTheme, resolveTheme, useTheme } from './theme'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); document.documentElement.classList.remove('dark') })

describe('theme preference', () => {
  it('uses a stored explicit theme before the system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('falls back to the system preference when storage is empty or invalid', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme('unknown', false)).toBe('light')
  })

  it('toggles between light and dark', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })

  it('persists immediate toggles and restores the preference without a full-screen transition', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    const { result } = renderHook(useTheme)
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('ai-media-theme')).toBe('dark')
    expect(initializeTheme()).toBe('dark')
    act(() => { result.current.toggle(); result.current.toggle() })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement).not.toHaveClass('theme-fade')
  })

  it('still changes theme when preference storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable') })
    const { result } = renderHook(useTheme)
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})
