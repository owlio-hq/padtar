import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} className="toggle-btn" title="Toggle light/dark theme">
      {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  )
}
