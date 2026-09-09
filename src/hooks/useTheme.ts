import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'taberna'
export const THEME_KEY = 'porra-theme'

const THEMES: Theme[] = ['dark', 'light', 'taberna']

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'taberna'
  const t = document.documentElement.dataset.theme
  return t === 'light' || t === 'dark' ? t : 'taberna'
}

/** Taberna por defecto; oscuro y claro son opt-out y se recuerdan en localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'dark') delete el.dataset.theme // sin atributo = oscuro (predeterminado)
    else el.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]),
  }
}
