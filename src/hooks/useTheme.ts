import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
export const THEME_KEY = 'porra-theme'

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Tema oscuro por defecto; el claro es opt-in y se recuerda en localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'light') el.dataset.theme = 'light'
    else delete el.dataset.theme // sin atributo = oscuro (predeterminado)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }
}
