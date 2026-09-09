import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'

type Variant = 'primary' | 'secondary' | 'magenta' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'grad-primary text-on-primary glow-primary active:brightness-95',
  secondary: 'border border-line-strong bg-surface-2 text-ink hover:bg-surface-3 active:brightness-110',
  magenta: 'grad-magenta text-white active:brightness-95',
  ghost: 'text-ink-soft hover:bg-surface-2 active:bg-surface-3',
  danger: 'border border-loss/40 bg-loss/10 text-loss hover:bg-loss/15',
}

export function Button({
  variant = 'primary',
  full,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: {
  variant?: Variant
  full?: boolean
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold transition-all duration-150 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
        VARIANTS[variant]
      } ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  )
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${
        small ? 'h-4 w-4' : 'h-6 w-6'
      }`}
      role="status"
      aria-label="Cargando"
    />
  )
}

export function Field({
  label,
  hint,
  className = '',
  ...rest
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      <input
        {...rest}
        className={`min-h-12 w-full rounded-2xl border border-line-strong bg-surface-2 px-4 text-[16px] text-ink placeholder:text-ink-faint focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}
      />
      {hint && <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

export function ScreenHeader({
  title,
  back,
  action,
  gradient,
}: {
  title: string
  back?: boolean | string
  action?: ReactNode
  gradient?: boolean
}) {
  const nav = useNavigate()
  const { theme } = useTheme()
  if (theme === 'taberna') {
    return (
      <header className="safe-top sticky top-0 z-20 border-b-[3px] border-double border-line-strong bg-bg">
        <div className="relative flex h-14 items-center justify-center px-3">
          {back && (
            <button
              onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
              className="absolute left-3 grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-surface-2"
              aria-label="Volver"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h1 className="truncate px-14 text-center text-lg font-bold uppercase tracking-wide">{title}</h1>
          {action && <div className="absolute right-3">{action}</div>}
        </div>
      </header>
    )
  }
  return (
    <header
      className={`safe-top sticky top-0 z-20 ${
        gradient ? 'grad-hero text-white' : 'border-b border-line bg-bg/80 backdrop-blur'
      }`}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        {back && (
          <button
            onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
            className={`grid h-10 w-10 place-items-center rounded-xl ${
              gradient ? 'text-white/90 hover:bg-white/15' : 'text-ink-soft hover:bg-surface-2'
            }`}
            aria-label="Volver"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
        {action}
      </div>
    </header>
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="text-base font-bold text-ink">{title}</p>
      {children && <p className="mt-1.5 max-w-xs text-sm text-ink-soft">{children}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

/** Escudo del equipo: imagen si hay URL, si no las siglas. */
export function TeamCrest({
  src,
  short,
  size = 40,
}: {
  src?: string | null
  short?: string | null
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const px = { width: size, height: size }
  if (src && !failed) {
    return (
      <span style={px} className="grid shrink-0 place-items-center">
        <img src={src} alt={short ?? ''} onError={() => setFailed(true)} className="crest" />
      </span>
    )
  }
  return (
    <span
      style={px}
      className="nums grid shrink-0 place-items-center rounded-xl bg-surface-3 text-[11px] font-bold text-ink-soft"
    >
      {short ?? '—'}
    </span>
  )
}

/** Avatar de usuario: foto o iniciales sobre lima. */
export function Avatar({
  url,
  name,
  size = 44,
}: {
  url?: string | null
  name: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const px = { width: size, height: size }
  const initials = name.slice(0, 2).toUpperCase()
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        style={px}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      style={{ ...px, fontSize: size * 0.36 }}
      className="grad-primary nums grid shrink-0 place-items-center rounded-full font-bold text-on-primary"
    >
      {initials}
    </span>
  )
}
