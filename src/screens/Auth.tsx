import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field } from '../ui'

type Mode = 'in' | 'up'

export default function Auth() {
  const [mode, setMode] = useState<Mode>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
          setMode('in')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (e) {
      setError(translate((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setError('Escribe tu correo primero.')
      return
    }
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) setError(translate(error.message))
    else setInfo('Te enviamos un correo para restablecer la contraseña.')
  }

  return (
    <div className="app-shell">
      <div className="flex flex-1 items-center justify-center px-5 py-8 lg:px-8">
        <div className="card w-full max-w-sm overflow-hidden lg:max-w-5xl lg:grid lg:grid-cols-2">
          {/* Cabecera con gradiente */}
          <div className="grad-hero relative overflow-hidden px-6 pb-7 pt-7 text-white lg:flex lg:flex-col lg:justify-center lg:px-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
            <div className="relative">
              <span className="grad-primary nums grid h-12 w-12 place-items-center rounded-2xl text-base font-bold text-on-primary glow-primary">
                LP
              </span>
              <h1 className="mt-4 text-balance text-[28px] leading-[1.1] text-white">
                La porra de siempre.
                <br />
                Que no se cae.
              </h1>
              <p className="mt-2 text-sm text-white/85">Pronostica y pelea el ranking con tus colegas. ⚽</p>
            </div>
          </div>

          {/* Formulario */}
          <div className="p-6 lg:p-8">
            <div className="mb-5 flex gap-1 rounded-2xl bg-surface-2 p-1">
              {(['in', 'up'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setError(null)
                    setInfo(null)
                  }}
                  className={`min-h-10 flex-1 rounded-xl text-sm font-bold transition-all ${
                    mode === m ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint'
                  }`}
                >
                  {m === 'in' ? 'Entrar' : 'Crear cuenta'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'up' && (
                <Field
                  label="Tu nombre"
                  autoComplete="name"
                  required
                  maxLength={24}
                  placeholder="Dani"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <Field
                label="Correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Contraseña"
                type="password"
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p className="text-sm font-medium text-loss">{error}</p>}
              {info && <p className="text-sm font-medium text-primary">{info}</p>}

              <Button type="submit" full loading={loading}>
                {mode === 'up' ? 'Crear cuenta y entrar' : 'Entrar'}
              </Button>

              {mode === 'in' && (
                <button type="button" onClick={forgot} className="w-full text-center text-xs text-ink-faint">
                  ¿Olvidaste la contraseña?
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function translate(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Ese correo ya tiene cuenta. Entra con tu contraseña.'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar (revisa tu bandeja).'
  return msg
}
