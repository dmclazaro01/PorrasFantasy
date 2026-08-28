import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field } from '../ui'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="app-shell safe-bottom">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <span className="nums mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-lg font-bold text-paper">
            LP
          </span>
          <h1 className="text-balance text-4xl leading-tight">
            La porra de siempre.
            <br />
            <span className="text-accent">Que no se cae.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-pretty text-[15px] text-ink-soft">
            Pronostica, mira el marcador en vivo y pelea el ranking con tus colegas.
          </p>
        </div>

        {sent ? (
          <div className="ticket rise p-6 text-center">
            <p className="text-lg font-bold">Revisa tu correo 📬</p>
            <p className="mt-2 text-sm text-ink-soft">
              Te enviamos un enlace mágico a <span className="font-semibold text-ink">{email}</span>.
              Ábrelo en este móvil para entrar.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm font-semibold text-accent"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Tu correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm font-medium text-loss">{error}</p>}
            <Button type="submit" full loading={loading}>
              Enviar enlace de acceso
            </Button>
            <p className="text-center text-xs text-ink-faint">
              Sin contraseñas. Te llega un enlace y entras.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
