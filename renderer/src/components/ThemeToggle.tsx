import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { Button } from './ui/button'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return <Button
    variant="ghost"
    size="icon"
    className="theme-toggle relative overflow-hidden"
    aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}
    title={dark ? '浅色模式' : '深色模式'}
    onClick={toggle}
  >
    <Sun aria-hidden="true" className={`theme-icon absolute ${dark ? 'opacity-0' : 'opacity-100'}`} size={17}/>
    <Moon aria-hidden="true" className={`theme-icon absolute ${dark ? 'opacity-100' : 'opacity-0'}`} size={17}/>
  </Button>
}
