import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyPools, type Pool } from '../lib/api'
import { Button, EmptyState, Spinner } from '../ui'

export default function Home() {
  const [pools, setPools] = useState<Pool[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMyPools()
      .then(setPools)
      .catch((e) => {
        setError(e.message ?? 'Error cargando salas')
        setPools([])
      })
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-5 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              La Porra
            </p>
            <h1 className="text-2xl font-bold">Tus porras</h1>
          </div>
          <Link
            to="/perfil"
            className="nums grid h-10 w-10 place-items-center rounded-xl bg-ink text-sm font-bold text-paper"
            aria-label="Perfil"
          >
            LP
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-2">
        <Link to="/crear" className="block">
          <Button full>Crear porra</Button>
        </Link>
        <Link to="/unirse" className="block">
          <Button full variant="secondary">
            Unirme
          </Button>
        </Link>
      </div>

      <div className="flex-1 px-5 pb-4">
        {pools === null ? (
          <div className="flex justify-center py-16 text-ink-faint">
            <Spinner />
          </div>
        ) : pools.length === 0 ? (
          <div className="ticket mt-4">
            <EmptyState
              title="Aún no tienes ninguna porra"
              icon={
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M3 10h18M8 5v14" strokeDasharray="2 2" />
                </svg>
              }
            >
              Crea una nueva o únete con el código que te pase un amigo.
            </EmptyState>
            {error && (
              <p className="px-6 pb-5 text-center text-xs text-loss">
                {error} — ¿está la base de datos configurada?
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {pools.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/sala/${p.id}`}
                  className="ticket flex items-center gap-4 p-4 transition-transform active:scale-[0.99]"
                >
                  <span className="nums grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-wash text-lg font-bold text-accent-strong">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="nums text-xs text-ink-faint">
                      Código {p.invite_code} · {p.points_1x2}/{p.points_exact} pts
                    </p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
