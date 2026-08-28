import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { joinPool } from '../lib/api'
import { Button, Field, ScreenHeader } from '../ui'

export default function JoinPool() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setLoading(true)
    try {
      const pool = await joinPool(code.trim())
      nav(`/sala/${pool.id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo unir')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Unirme a una porra" back="/" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-5 py-6">
        <p className="text-[15px] text-ink-soft">
          Pídele el código a quien creó la porra y pégalo aquí.
        </p>
        <Field
          label="Código de la porra"
          placeholder="AB12CD"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="nums text-center text-2xl tracking-[0.3em]"
        />
        {error && <p className="text-sm font-medium text-loss">{error}</p>}
        <Button type="submit" full loading={loading} disabled={!code.trim()}>
          Unirme
        </Button>
      </form>
    </div>
  )
}
