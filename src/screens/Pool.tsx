import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  getLatestRound,
  getMatches,
  getMyPredictions,
  getPool,
  getStandings,
  savePrediction,
  type Match,
  type Pool as PoolType,
  type Prediction,
  type Round,
  type Standing,
} from '../lib/api'
import { Button, EmptyState, ScreenHeader, Spinner } from '../ui'

type Tab = 'boleto' | 'ranking'

export default function Pool() {
  const { id = '' } = useParams()
  const [pool, setPool] = useState<PoolType | null>(null)
  const [tab, setTab] = useState<Tab>('boleto')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getPool(id)
      .then((p) => (p ? setPool(p) : setNotFound(true)))
      .catch(() => setNotFound(true))
  }, [id])

  async function share() {
    if (!pool) return
    const text = `Únete a mi porra "${pool.name}" con el código ${pool.invite_code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'La Porra', text })
      } catch {
        /* cancelado */
      }
    } else {
      await navigator.clipboard.writeText(pool.invite_code)
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Porra" back="/" />
        <EmptyState title="No encontramos esta porra">
          Puede que ya no seas miembro o que el enlace no sea válido.
        </EmptyState>
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-faint">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={pool.name}
        back="/"
        action={
          <button
            onClick={share}
            className="nums flex items-center gap-1.5 rounded-xl bg-paper-2 px-3 py-2 text-sm font-bold text-ink-soft hover:bg-paper-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            {pool.invite_code}
          </button>
        }
      />

      <div className="px-5 pt-4">
        <div className="flex gap-1 rounded-2xl bg-paper-2 p-1">
          {(['boleto', 'ranking'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-10 flex-1 rounded-xl text-sm font-semibold capitalize transition-colors ${
                tab === t ? 'bg-paper text-ink shadow-sm' : 'text-ink-faint'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 py-4">
        {tab === 'boleto' ? <BoletoTab pool={pool} /> : <RankingTab poolId={pool.id} />}
      </div>
    </div>
  )
}

// ---------------- Boleto ----------------

function fmtKickoff(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BoletoTab({ pool }: { pool: PoolType }) {
  const [round, setRound] = useState<Round | null | undefined>(undefined)
  const [matches, setMatches] = useState<Match[]>([])
  const [preds, setPreds] = useState<Record<number, Prediction>>({})
  const [inputs, setInputs] = useState<Record<number, { h: string; a: string }>>({})
  const [userId, setUserId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (alive) setUserId(data.user?.id ?? '')
      if (!pool.competition_id) {
        setRound(null)
        return
      }
      const r = await getLatestRound(pool.competition_id)
      if (!alive) return
      setRound(r)
      if (!r) return
      const ms = await getMatches(r.id)
      const ps = await getMyPredictions(pool.id, ms.map((m) => m.id))
      if (!alive) return
      setMatches(ms)
      setPreds(ps)
      const seed: Record<number, { h: string; a: string }> = {}
      for (const m of ms) {
        const p = ps[m.id]
        seed[m.id] = {
          h: p ? String(p.pred_home) : '',
          a: p ? String(p.pred_away) : '',
        }
      }
      setInputs(seed)
    }
    load().catch((e) => setError((e as Error).message))
    return () => {
      alive = false
    }
  }, [pool.id, pool.competition_id])

  const now = Date.now()
  const editable = useMemo(
    () => matches.filter((m) => m.status === 'SCHEDULED' && new Date(m.kickoff).getTime() > now),
    [matches, now],
  )

  function setInput(matchId: number, side: 'h' | 'a', val: string) {
    const clean = val.replace(/\D/g, '').slice(0, 2)
    setInputs((s) => ({ ...s, [matchId]: { ...s[matchId], [side]: clean } }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      for (const m of editable) {
        const i = inputs[m.id]
        if (i && i.h !== '' && i.a !== '') {
          await savePrediction(pool.id, userId, m.id, Number(i.h), Number(i.a))
        }
      }
      // recarga pronósticos guardados
      const ps = await getMyPredictions(pool.id, matches.map((m) => m.id))
      setPreds(ps)
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (round === undefined) {
    return (
      <div className="flex justify-center py-12 text-ink-faint">
        <Spinner />
      </div>
    )
  }

  if (!round) {
    return (
      <div className="ticket mt-2">
        <EmptyState title="Aún no hay jornada cargada">
          En cuanto se cargue la próxima jornada aparecerán aquí los partidos para tu boleto.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="pb-4">
      <div className="ticket overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
              {round.name}
            </div>
            <h2 className="mt-0.5 text-lg">Tu boleto</h2>
          </div>
          {round.deadline && (
            <div className="text-right">
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                Cierra
              </div>
              <div className="nums text-xs font-semibold">{fmtKickoff(round.deadline)}</div>
            </div>
          )}
        </div>
        <div className="perf mx-4" />
        <div className="divide-y divide-line">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              pred={preds[m.id]}
              input={inputs[m.id]}
              onInput={(side, v) => setInput(m.id, side, v)}
            />
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-loss">{error}</p>}

      {editable.length > 0 && (
        <div className="sticky bottom-20 mt-4">
          <Button full loading={saving} onClick={save} variant={saved ? 'secondary' : 'primary'}>
            {saved ? '✓ Boleto guardado' : 'Guardar boleto'}
          </Button>
        </div>
      )}
    </div>
  )
}

function TeamChip({ short }: { short: string | null }) {
  return (
    <span className="nums grid h-8 w-9 shrink-0 place-items-center rounded-lg bg-paper-3 text-[11px] font-bold text-ink-soft">
      {short ?? '—'}
    </span>
  )
}

function ScoreBox({
  value,
  editable,
  onChange,
}: {
  value: string
  editable: boolean
  onChange?: (v: string) => void
}) {
  if (editable) {
    return (
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="·"
        className="nums h-11 w-11 rounded-xl border border-line-strong bg-paper text-center text-xl font-semibold text-ink placeholder:text-ink-faint focus:border-accent"
      />
    )
  }
  return (
    <div className="nums grid h-11 w-11 place-items-center rounded-xl border border-line bg-paper-2 text-xl font-semibold text-ink">
      {value === '' ? '·' : value}
    </div>
  )
}

function MatchRow({
  match,
  pred,
  input,
  onInput,
}: {
  match: Match
  pred?: Prediction
  input?: { h: string; a: string }
  onInput: (side: 'h' | 'a', v: string) => void
}) {
  const started = new Date(match.kickoff).getTime() <= Date.now()
  const editable = match.status === 'SCHEDULED' && !started
  const live = match.status === 'LIVE'
  const finished = match.status === 'FINISHED'

  // Qué marcador enseñar en las cajas
  const homeShown = editable ? (input?.h ?? '') : match.home_goals != null ? String(match.home_goals) : ''
  const awayShown = editable ? (input?.a ?? '') : match.away_goals != null ? String(match.away_goals) : ''

  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="nums text-xs font-medium text-ink-faint">{fmtKickoff(match.kickoff)}</span>
        <StatusTag status={match.status} started={started} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2 justify-self-start">
          <TeamChip short={match.home_short} />
          <span className="truncate text-sm font-semibold">{match.home_team}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ScoreBox value={homeShown} editable={editable} onChange={(v) => onInput('h', v)} />
          <span className="text-ink-faint">:</span>
          <ScoreBox value={awayShown} editable={editable} onChange={(v) => onInput('a', v)} />
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <span className="truncate text-right text-sm font-semibold">{match.away_team}</span>
          <TeamChip short={match.away_short} />
        </div>
      </div>

      {/* pie: pronóstico propio + puntos */}
      {!editable && (
        <div className="mt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="text-ink-faint">tu pronóstico</span>
            <span className="nums rounded-md bg-paper-2 px-2 py-0.5 font-semibold text-ink">
              {pred ? `${pred.pred_home}–${pred.pred_away}` : '—'}
            </span>
          </span>
          {finished ? (
            <PointsStamp points={pred?.points ?? 0} />
          ) : live ? (
            <span className="text-xs font-medium text-ink-faint">puntos al pitido final</span>
          ) : (
            <span className="text-xs font-medium text-ink-faint">cerrado</span>
          )}
        </div>
      )}
    </div>
  )
}

function StatusTag({ status, started }: { status: Match['status']; started: boolean }) {
  const label =
    status === 'LIVE' ? 'EN JUEGO' : status === 'FINISHED' ? 'FINALIZADO' : started ? 'CERRADO' : 'ABIERTO'
  const cls =
    status === 'LIVE'
      ? 'text-win bg-win-wash border-win/30'
      : 'text-ink-soft bg-paper-2 border-line'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {status === 'LIVE' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-win opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-win" />
        </span>
      )}
      {label}
    </span>
  )
}

function PointsStamp({ points }: { points: number }) {
  const good = points > 0
  return (
    <span
      className={`nums inline-flex -rotate-3 items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-sm font-bold uppercase ${
        good ? 'border-win/50 bg-win-wash text-win' : 'border-line-strong bg-paper-2 text-ink-faint'
      }`}
    >
      {good ? `+${points}` : '0'} pts
    </span>
  )
}

// ---------------- Ranking ----------------

function RankingTab({ poolId }: { poolId: string }) {
  const [rows, setRows] = useState<Standing[] | null>(null)

  useEffect(() => {
    getStandings(poolId)
      .then(setRows)
      .catch(() => setRows([]))
  }, [poolId])

  if (rows === null) {
    return (
      <div className="flex justify-center py-12 text-ink-faint">
        <Spinner />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="ticket mt-2">
        <EmptyState title="Ranking vacío por ahora">
          Sumaréis puntos en cuanto se juegue la primera jornada.
        </EmptyState>
      </div>
    )
  }

  return (
    <ul className="mt-2 space-y-1">
      {rows.map((r, i) => (
        <li
          key={r.user_id}
          className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${i === 0 ? 'bg-gold-wash' : 'bg-paper'}`}
        >
          <span
            className={`nums grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${
              i === 0 ? 'bg-gold text-ink' : 'bg-paper-3 text-ink-soft'
            }`}
          >
            {i + 1}
          </span>
          <span className="flex-1 truncate font-semibold">{r.display_name}</span>
          <span className="nums text-xs text-ink-faint">{r.exacts}★</span>
          <span className="nums w-12 text-right text-lg font-bold">{r.points}</span>
        </li>
      ))}
    </ul>
  )
}
