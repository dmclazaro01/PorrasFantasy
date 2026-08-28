import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ink' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-paper hover:bg-accent-strong active:brightness-95',
  secondary: 'border border-line-strong bg-paper text-ink hover:bg-paper-2 active:bg-paper-3',
  ink: 'bg-ink text-paper hover:opacity-90 active:opacity-80',
  ghost: 'text-ink-soft hover:bg-paper-2 active:bg-paper-3',
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition-all duration-150 disabled:opacity-50 ${
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
        className={`min-h-12 w-full rounded-2xl border border-line-strong bg-paper px-4 text-[16px] text-ink placeholder:text-ink-faint focus:border-accent ${className}`}
      />
      {hint && <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

export function ScreenHeader({
  title,
  back,
  action,
}: {
  title: string
  back?: boolean | string
  action?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3">
        {back && (
          <button
            onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-paper-2"
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
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <p className="mt-1.5 max-w-xs text-sm text-ink-soft">{children}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ticket ${className}`}>{children}</div>
}
