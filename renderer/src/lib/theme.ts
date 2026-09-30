import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'ai-media-theme'

export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return systemDark ? 'dark' : 'light'
}

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function initializeTheme(): Theme {
  let stored: string | null = null
  try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* storage can be unavailable in privacy modes */ }
  const theme = resolveTheme(stored, window.matchMedia('(prefers-color-scheme: dark)').matches)
  applyTheme(theme)
  return theme
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const toggle = useCallback(() => {
    const target = nextTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    applyTheme(target)
    try { localStorage.setItem(STORAGE_KEY, target) } catch { /* keep the in-memory theme */ }
    setTheme(target)
  }, [])
  return { theme, toggle }
}
