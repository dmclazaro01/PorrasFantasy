import type { CardType } from '../lib/api'

/**
 * Set de iconos de cartas dibujado a mano: misma rejilla 24px, mismo trazo
 * (2px, round caps) y misma voz que el resto de iconos de la app.
 * Usan currentColor: funcionan en oscuro, claro y taberna sin cambios.
 */
const PATHS: Record<CardType, React.ReactNode> = {
  BOMBA: (
    <>
      <circle cx="10.5" cy="14" r="6.5" />
      <path d="M15.2 9.3c1-2.3 2.3-3.6 4-4.3" />
      <path d="M19.7 2.6v.01M21.8 5.4v.01M17.2 4.9v.01" strokeWidth={2.6} />
    </>
  ),
  ROJA: <rect x="8" y="3.5" width="8.5" height="17" rx="1.5" transform="rotate(9 12 12)" />,
  LESION: (
    <>
      <rect x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-18 12 12)" />
      <path d="M10.4 12.6v.01M13.7 11.6v.01" strokeWidth={2.6} />
    </>
  ),
  ESPIA: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  PRENSA: (
    <>
      <rect x="9" y="2.5" width="6" height="10.5" rx="3" />
      <path d="M5.8 10.5a6.2 6.2 0 0012.4 0" />
      <path d="M12 16.7V21M8.5 21h7" />
    </>
  ),
  DOBLE: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M9.2 9.2v.01M14.8 14.8v.01" strokeWidth={2.8} />
    </>
  ),
  VAR: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M10.3 8.3l4.7 2.7-4.7 2.7z" />
      <path d="M12 16.5V20M8.5 20h7" />
    </>
  ),
  AUTOBUS: (
    <>
      <rect x="4" y="3.5" width="16" height="13.5" rx="2.5" />
      <path d="M4 10.5h16" />
      <path d="M7.5 20.5v.01M16.5 20.5v.01" strokeWidth={2.8} />
    </>
  ),
  CANCHERO: (
    <>
      <path d="M3 10.5v3L17 18V6L3 10.5z" />
      <path d="M7 13.7l-1.2 5.3" />
      <path d="M17 9.5h.01M17 14.5h.01" strokeWidth={2.4} />
    </>
  ),
  DUPLA: (
    <>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </>
  ),
}

export function CardIcon({
  type,
  size = 24,
  className = '',
}: {
  type: CardType
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[type]}
    </svg>
  )
}
