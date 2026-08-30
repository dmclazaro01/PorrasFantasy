import { useState } from 'react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { Button } from '../ui'

const DISMISS_KEY = 'porra-install-dismissed'

export function InstallBanner() {
  const { canInstall, installed, promptInstall, isIOS } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [sheet, setSheet] = useState(false)

  const isMobile =
    typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent)

  if (installed || dismissed || !isMobile) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  async function onInstall() {
    if (canInstall) await promptInstall()
    else setSheet(true)
  }

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-dim p-3">
        <span className="grad-primary grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl">📲</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Instala La Porra</p>
          <p className="text-xs text-ink-soft">Ábrela como app, a pantalla completa.</p>
        </div>
        <button
          onClick={onInstall}
          className="grad-primary shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold text-on-primary"
        >
          Instalar
        </button>
        <button onClick={dismiss} aria-label="Cerrar" className="shrink-0 px-1 text-ink-faint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {sheet && <InstallSheet isIOS={isIOS} onClose={() => setSheet(false)} />}
    </>
  )
}

/** Botón de instalar para usar en Perfil (siempre visible si no está instalada). */
export function InstallButton() {
  const { canInstall, installed, promptInstall, isIOS } = useInstallPrompt()
  const [sheet, setSheet] = useState(false)
  if (installed) return null
  return (
    <>
      <div className="card p-5">
        <p className="font-bold">📲 Instalar como app</p>
        <p className="mt-1 text-sm text-ink-soft">Ábrela a pantalla completa, como una app nativa.</p>
        <div className="mt-3">
          <Button full onClick={() => (canInstall ? promptInstall() : setSheet(true))}>
            Instalar app
          </Button>
        </div>
      </div>
      {sheet && <InstallSheet isIOS={isIOS} onClose={() => setSheet(false)} />}
    </>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grad-primary nums grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-on-primary">
        {n}
      </span>
      <span className="text-sm text-ink-soft">{children}</span>
    </li>
  )
}

function InstallSheet({ isIOS, onClose }: { isIOS: boolean; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="safe-bottom w-full max-w-[480px] rounded-t-3xl border-t border-line bg-surface px-6 pb-6 pt-4"
        style={{ animation: 'slideup 0.3s var(--ease-out)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
        <h3 className="text-xl font-bold">Instalar La Porra 📲</h3>
        <p className="mt-1 text-sm text-ink-faint">
          {isIOS ? 'En iPhone / iPad (Safari):' : 'En tu navegador:'}
        </p>
        <ol className="mt-4 space-y-3">
          {isIOS ? (
            <>
              <Step n={1}>
                Toca el botón <b className="text-ink">Compartir</b> (el cuadrado con la flecha ⬆️) en
                la barra de Safari.
              </Step>
              <Step n={2}>
                Baja y elige <b className="text-ink">«Añadir a pantalla de inicio»</b>.
              </Step>
              <Step n={3}>
                Toca <b className="text-ink">Añadir</b>. ¡Ya tienes el icono de La Porra! ⚽
              </Step>
            </>
          ) : (
            <>
              <Step n={1}>
                Abre el menú del navegador (los <b className="text-ink">⋮</b> arriba a la derecha).
              </Step>
              <Step n={2}>
                Elige <b className="text-ink">«Instalar app»</b> o{' '}
                <b className="text-ink">«Añadir a pantalla de inicio»</b>.
              </Step>
              <Step n={3}>Confirma y listo. ⚽</Step>
            </>
          )}
        </ol>
        <div className="mt-6">
          <Button full onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  )
}
