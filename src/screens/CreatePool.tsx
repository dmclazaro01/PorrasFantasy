import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPool, listCompetitions, type Competition } from '../lib/api'
import { Button, Field, ScreenHeader, Spinner } from '../ui'

export default function CreatePool() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [comps, setComps] = useState<Competition[] | null>(null)
  const [compId, setCompId] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [p1x2, setP1x2] = useState(3)
  const [pExact, setPExact] = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCompetitions()
      .then((c) => {
        setComps(c)
        if (c.length > 0) setCompId(c[0].id)
      })
      .catch((e) => {
        setError(e.message ?? 'Error cargando competiciones')
        setComps([])
      })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || compId === null) return
    setError(null)
    setLoading(true)
    try {
      const pool = await createPool({
        name: name.trim(),
        competition_id: compId,
        points_1x2: p1x2,
        points_exact: pExact,
      })
      nav(`/sala/${pool.id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo crear la porra')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[900px]">
      <ScreenHeader title="Crear porra" back="/" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-6 px-5 py-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:px-8">
        <div className="space-y-6">
          <Field
            label="Nombre de la porra"
            placeholder="Los Cracks del Bar"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="card overflow-hidden lg:hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">Puntuación</span>
                <span className="nums text-xs text-ink-faint">
                  {p1x2} pts acierto · {pExact} pts exacto
                </span>
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-ink-faint transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
                <Field label="Acertar 1·X·2" type="number" min={0} max={50} value={p1x2} onChange={(e) => setP1x2(Number(e.target.value))} />
                <Field label="Resultado exacto" type="number" min={0} max={50} value={pExact} onChange={(e) => setPExact(Number(e.target.value))} />
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-semibold text-ink-soft">Competición</span>
          {comps === null ? (
            <div className="flex justify-center py-6 text-ink-faint">
              <Spinner small />
            </div>
          ) : comps.length === 0 ? (
            <div className="card p-4 text-sm text-ink-soft">
              No hay competiciones disponibles.
              <span className="block text-xs text-ink-faint">Configura la semilla de LaLiga.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {comps.map((c) => {
                const selected = c.id === compId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompId(c.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                      selected ? 'border-primary bg-primary-dim' : 'border-line-strong bg-surface-2 hover:bg-surface-3'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-3 text-lg">
                      🇪🇸
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="nums block text-xs text-ink-faint">Temporada {c.season}</span>
                    </span>
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border-2 ${
                        selected ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'
                      }`}
                    >
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
              <p className="px-1 text-xs text-ink-faint">Por ahora solo LaLiga. Pronto más.</p>
            </div>
          )}
        </div>

        <div className="hidden lg:block lg:space-y-6">
          <div className="card p-5">
            <p className="mb-3 block text-sm font-semibold">Puntuación</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Acertar 1·X·2" type="number" min={0} max={50} value={p1x2} onChange={(e) => setP1x2(Number(e.target.value))} />
              <Field label="Resultado exacto" type="number" min={0} max={50} value={pExact} onChange={(e) => setPExact(Number(e.target.value))} />
            </div>
            <p className="mt-2 text-xs text-ink-faint">Se aplica a toda la sala. Luego no se puede cambiar.</p>
          </div>
          {error && <p className="text-sm font-medium text-loss">{error}</p>}
          <Button type="submit" full loading={loading} disabled={!name.trim() || compId === null}>
            Crear porra
          </Button>
        </div>

        <div className="lg:hidden">
          {error && <p className="text-sm font-medium text-loss">{error}</p>}
          <div className="mt-4">
            <Button type="submit" full loading={loading} disabled={!name.trim() || compId === null}>
              Crear porra
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
