import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useSession } from './hooks/useSession'
import { supabase } from './lib/supabase'
import { Button, Spinner } from './ui'
import Auth from './screens/Auth'
import Home from './screens/Home'
import CreatePool from './screens/CreatePool'
import JoinPool from './screens/JoinPool'
import Pool from './screens/Pool'

export default function App() {
  return (
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  )
}

function Root() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="app-shell items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <div className="app-shell">
      <Routes>
        <Route element={<TabLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/perfil" element={<Profile session={session} />} />
        </Route>
        <Route path="/crear" element={<CreatePool />} />
        <Route path="/unirse" element={<JoinPool />} />
        <Route path="/sala/:id" element={<Pool />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function TabLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col pb-20">
        <Outlet />
      </div>
      <TabBar />
    </div>
  )
}

function TabBar() {
  const items = [
    {
      to: '/',
      label: 'Porras',
      icon: (
        <path d="M4 5h16v14H4zM4 10h16M9 5v14" strokeDasharray="0" />
      ),
    },
    {
      to: '/perfil',
      label: 'Perfil',
      icon: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" />,
    },
  ]
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[480px]">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                isActive ? 'text-accent' : 'text-ink-faint'
              }`
            }
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {it.icon}
            </svg>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Profile({ session }: { session: Session }) {
  const email = session.user.email ?? ''
  const name =
    (session.user.user_metadata?.display_name as string | undefined) ||
    email.split('@')[0]

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-5 pb-2 pt-4">
        <h1 className="text-2xl font-bold">Perfil</h1>
      </header>
      <div className="flex-1 px-5 py-4">
        <div className="ticket flex items-center gap-4 p-5">
          <span className="nums grid h-14 w-14 place-items-center rounded-2xl bg-accent-wash text-xl font-bold text-accent-strong">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{name}</p>
            <p className="truncate text-sm text-ink-faint">{email}</p>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="secondary" full onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
