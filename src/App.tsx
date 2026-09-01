import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useSession } from './hooks/useSession'
import { supabase } from './lib/supabase'
import { getProfile, updateProfile, uploadAvatar } from './lib/api'
import { Avatar, Button, Field, Spinner } from './ui'
import { InstallButton } from './components/InstallBanner'
import { DesktopSidebar } from './components/DesktopSidebar'
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
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="app-shell items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (recovery) return <SetPassword onDone={() => setRecovery(false)} />
  if (!session) return <Auth />

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
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
    </div>
  )
}

function TabLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <div id="main-content" className="flex flex-1 flex-col pb-20 lg:pb-0">
        <Outlet />
      </div>
      <TabBar />
    </div>
  )
}

function TabBar() {
  const items = [
    { to: '/', label: 'Porras', icon: <path d="M4 5h16v14H4zM4 10h16M9 5v14" /> },
    { to: '/perfil', label: 'Perfil', icon: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" /> },
  ]
  return (
    <nav className="app-bottombar safe-bottom border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      <div className="flex">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors ${
                isActive ? 'text-primary' : 'text-ink-faint'
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

function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="min-h-dvh bg-bg bg-[var(--grad-pitch)] bg-no-repeat flex items-center justify-center px-5 py-8 lg:px-8">
      <div className="card w-full max-w-sm overflow-hidden">
          <div className="grad-hero px-6 pb-6 pt-6 text-white">
            <h1 className="text-2xl text-white">Nueva contraseña</h1>
            <p className="mt-1 text-sm text-white/85">Elige una contraseña para tu cuenta.</p>
          </div>
          <form onSubmit={save} className="space-y-4 p-6">
            <Field
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm font-medium text-loss">{error}</p>}
            <Button type="submit" full loading={loading}>
              Guardar contraseña
            </Button>
          </form>
        </div>
    </div>
  )
}

function Profile({ session }: { session: Session }) {
  const uid = session.user.id
  const email = session.user.email ?? ''
  const fallbackName = email.split('@')[0]
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savedName, setSavedName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Cambio de contraseña
  const [newPass, setNewPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passMsg, setPassMsg] = useState<string | null>(null)

  useEffect(() => {
    getProfile(uid)
      .then((p) => {
        setName(p?.display_name ?? fallbackName)
        setAvatarUrl(p?.avatar_url ?? null)
      })
      .finally(() => setLoaded(true))
  }, [uid])

  async function saveName() {
    setSavingName(true)
    setError(null)
    try {
      await updateProfile(uid, { display_name: name.trim() || fallbackName })
      setSavedName(true)
      setTimeout(() => setSavedName(false), 1500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingName(false)
    }
  }

  async function savePassword() {
    if (newPass.length < 6) {
      setPassMsg('Mínimo 6 caracteres.')
      return
    }
    setSavingPass(true)
    setPassMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setSavingPass(false)
    if (error) setPassMsg(error.message)
    else {
      setPassMsg('✓ Contraseña actualizada')
      setNewPass('')
      setTimeout(() => setPassMsg(null), 2000)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadAvatar(uid, file)
      await updateProfile(uid, { avatar_url: url, display_name: name.trim() || fallbackName })
      setAvatarUrl(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1120px]">
      <header className="safe-top px-5 pb-2 pt-5 lg:px-8 lg:pt-8">
        <h1 className="text-2xl font-bold">Perfil</h1>
      </header>

      <div className="flex-1 space-y-5 px-5 py-4 lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:px-8">
        <div className="card flex items-center gap-4 p-5">
          <div className="relative">
            <Avatar url={avatarUrl} name={name || fallbackName} size={72} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grad-primary absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface text-on-primary shadow"
              aria-label="Cambiar foto"
            >
              {uploading ? (
                <Spinner small />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{loaded ? name || fallbackName : '…'}</p>
            <p className="truncate text-sm text-ink-faint">{email}</p>
          </div>
        </div>

        <div className="card p-5">
          <Field
            label="Nombre para el ranking"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="mt-3">
            <Button full loading={savingName} onClick={saveName} variant={savedName ? 'secondary' : 'primary'}>
              {savedName ? '✓ Guardado' : 'Guardar nombre'}
            </Button>
          </div>
        </div>

        <div className="card p-5">
          <Field
            label="Cambiar contraseña"
            type="password"
            autoComplete="new-password"
            minLength={6}
            placeholder="Nueva contraseña"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          {passMsg && (
            <p className={`mt-2 text-sm font-medium ${passMsg.startsWith('✓') ? 'text-primary' : 'text-loss'}`}>
              {passMsg}
            </p>
          )}
          <div className="mt-3">
            <Button full variant="secondary" loading={savingPass} onClick={savePassword} disabled={!newPass}>
              Actualizar contraseña
            </Button>
          </div>
        </div>

        {error && <p className="text-sm font-medium text-loss">{error}</p>}

        <InstallButton />

        <Button variant="secondary" full onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
