import { useTheme, type Theme } from '../hooks/useTheme'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  )
}
function BeerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h11v13a4 4 0 01-4 4H10a4 4 0 01-4-4V3z" />
      <path d="M17 6h1.5a2.5 2.5 0 010 5H17" />
      <path d="M6 3c0 2 1.5 2 1.5 4S9 9 9 9M11 3c0 2 1.5 2 1.5 4S14 9 14 9" />
    </svg>
  )
}

/** Control segmentado Oscuro / Claro / Taberna (para la pantalla de Perfil). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const opts: { key: Theme; label: string; icon: React.ReactNode }[] = [
    { key: 'taberna', label: 'Taberna', icon: <BeerIcon /> },
    { key: 'dark', label: 'Oscuro', icon: <MoonIcon /> },
    { key: 'light', label: 'Claro', icon: <SunIcon /> },
  ]
  return (
    <div role="group" aria-label="Tema" className="inline-flex rounded-xl bg-surface-2 p-1">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => setTheme(o.key)}
          aria-pressed={theme === o.key}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            theme === o.key ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint hover:text-ink'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Botón compacto de alternar tema (para la barra lateral de escritorio). */
export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'claro' : theme === 'light' ? 'taberna' : 'oscuro'
  return (
    <button
      onClick={toggle}
      aria-label={`Cambiar a modo ${next}`}
      className={`grid h-9 w-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
