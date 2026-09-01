import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getProfile, listMyPools, type Pool, type Profile } from '../lib/api'
import { Avatar, Button, EmptyState, Spinner } from '../ui'
import { InstallBanner } from '../components/InstallBanner'

const GRADS = [
  'linear-gradient(135deg,#c2ff3d,#38e08a)',
  'linear-gradient(135deg,#35e0ff,#5b8cff)',
  'linear-gradient(135deg,#ff3d9a,#ff9f43)',
  'linear-gradient(135deg,#ffce3a,#ff5470)',
  'linear-gradient(135deg,#8b5cf6,#ff3d9a)',
  'linear-gradient(135deg,#38e08a,#35e0ff)',
]
function gradFor(id: string) {
  let n = 0
  for (const c of id) n = (n + c.charCodeAt(0)) % GRADS.length
  return GRADS[n]
}

export default function Home() {
  const [pools, setPools] = useState<Pool[] | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMyPools()
      .then(setPools)
      .catch((e) => {
        setError(e.message ?? 'Error cargando salas')
        setPools([])
      })
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) getProfile(u.id).then(setProfile).catch(() => {})
    })
  }, [])

  const name = profile?.display_name ?? 'Tú'

  return (
    <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1120px]">
      <header className="safe-top px-5 pb-1 pt-5 lg:px-8 lg:pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">La Porra ⚽</p>
            <h1 className="text-2xl font-bold">Tus porras</h1>
          </div>
          <Link to="/perfil" aria-label="Perfil">
            <Avatar url={profile?.avatar_url} name={name} size={44} />
          </Link>
        </div>
      </header>

      <InstallBanner />

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-3 lg:px-8">
        <Link to="/crear" className="block">
          <Button full>+ Crear porra</Button>
        </Link>
        <Link to="/unirse" className="block">
          <Button full variant="secondary">
            Unirme
          </Button>
        </Link>
      </div>

      <div className="flex-1 px-5 pb-4 pt-3 lg:px-8">
        {pools === null ? (
          <div className="flex justify-center py-16 text-ink-faint">
            <Spinner />
          </div>
        ) : pools.length === 0 ? (
          <div className="ticket mt-2">
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
            {error && <p className="px-6 pb-5 text-center text-xs text-loss">{error}</p>}
          </div>
        ) : (
          <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
            {pools.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/sala/${p.id}`}
                  className="card flex items-center gap-3.5 p-3.5 transition-transform active:scale-[0.99]"
                >
                  <span
                    className="nums grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold text-on-primary"
                    style={{ backgroundImage: gradFor(p.id) }}
                  >
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
