import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ensureMyCard,
  getMatches,
  getMyPredictions,
  getMembers,
  getCurrentRoundId,
  getPool,
  getProfile,
  getRoundStandings,
  getStandings,
  getVisibleCards,
  listRounds,
  savePrediction,
  type Card,
  type Match,
  type Member,
  type Pool as PoolType,
  type Prediction,
  type Round,
  type Standing,
} from '../lib/api'
import { Avatar, EmptyState, ScreenHeader, Spinner, TeamCrest } from '../ui'
import { CARD_META, CartasSection, MatchDetailSheet } from '../components/Cards'

type Section = 'predicciones' | 'ranking' | 'cartas'

export default function Pool() {
  const { id = '' } = useParams()
  const [pool, setPool] = useState<PoolType | null>(null)
  const [section, setSection] = useState<Section>('predicciones')
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null)
  const [latestRound, setLatestRound] = useState<Round | null>(null)
  const [myCard, setMyCard] = useState<Card | null>(null)
  const [loadedRounds, setLoadedRounds] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getPool(id)
      .then((p) => (p ? setPool(p) : setNotFound(true)))
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(() => {
    if (!pool) return
    if (!pool.competition_id) {
      setLoadedRounds(true)
      return
    }
    listRounds(pool.competition_id).then(async (rs) => {
      setRounds(rs)
      let curId: number | null = null
      try {
        curId = await getCurrentRoundId(pool.competition_id!)
      } catch {
        /* ignore */
      }
      // jornada en curso; si todas acabaron, la última
      const current = rs.find((r) => r.id === curId) ?? rs[rs.length - 1] ?? null
      setLatestRound(current)
      setSelectedRoundId(current?.id ?? null)
      setLoadedRounds(true)
      if (current) ensureMyCard(pool.id, current.id).then(setMyCard).catch(() => {})
    })
  }, [pool])

  function refreshCard() {
    if (pool && latestRound) ensureMyCard(pool.id, latestRound.id).then(setMyCard).catch(() => {})
  }

  async function share() {
    if (!pool) return
    const text = `Únete a mi porra "${pool.name}" con el código ${pool.invite_code} 👉 ${window.location.origin}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'La Porra', text })
      } catch {
        /* cancelado */
      }
    } else {
      await navigator.clipboard.writeText(pool.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
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

  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={pool.name}
        back="/"
        gradient
        action={
          <button
            onClick={share}
            className="nums flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold text-white hover:bg-white/25"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            {copied ? '¡copiado!' : pool.invite_code}
          </button>
        }
      />

      <div className="flex-1 px-4 pb-32 pt-4">
        {section === 'predicciones' &&
          (loadedRounds ? (
            <PrediccionesSection pool={pool} round={selectedRound} />
          ) : (
            <div className="flex justify-center py-12 text-ink-faint"><Spinner /></div>
          ))}
        {section === 'ranking' && <RankingSection pool={pool} round={selectedRound} />}
        {section === 'cartas' && (
          <CartasSection pool={pool} round={latestRound} myCard={myCard} onCardChanged={refreshCard} />
        )}
      </div>

      <div className="app-bottombar safe-bottom border-t border-line bg-surface/95 backdrop-blur">
        {section !== 'cartas' && (
          <JornadaBar rounds={rounds} selectedId={selectedRoundId} onSelect={setSelectedRoundId} />
        )}
        <PoolNav section={section} setSection={setSection} hasCard={myCard?.status === 'GRANTED'} />
      </div>
    </div>
  )
}

function JornadaBar({
  rounds,
  selectedId,
  onSelect,
}: {
  rounds: Round[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  if (rounds.length === 0) return null
  const idx = rounds.findIndex((r) => r.id === selectedId)
  return (
    <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
      <button
        disabled={idx <= 0}
        onClick={() => idx > 0 && onSelect(rounds[idx - 1].id)}
        className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-ink-soft hover:bg-surface-2 disabled:opacity-25"
        aria-label="Jornada anterior"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Ant.
      </button>
      <span className="text-sm font-bold">{rounds[idx]?.name ?? 'Jornada'}</span>
      <button
        disabled={idx >= rounds.length - 1}
        onClick={() => idx < rounds.length - 1 && onSelect(rounds[idx + 1].id)}
        className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-ink-soft hover:bg-surface-2 disabled:opacity-25"
        aria-label="Jornada siguiente"
      >
        Sig.
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  )
}

function PoolNav({
  section,
  setSection,
  hasCard,
}: {
  section: Section
  setSection: (s: Section) => void
  hasCard: boolean
}) {
  const items: { key: Section; label: string; emoji: string; dot?: boolean }[] = [
    { key: 'predicciones', label: 'Predicciones', emoji: '📝' },
    { key: 'ranking', label: 'Ranking', emoji: '🏆' },
    { key: 'cartas', label: 'Cartas', emoji: '🃏', dot: hasCard },
  ]
  return (
    <div className="flex">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => setSection(it.key)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors ${
              section === it.key ? 'text-primary' : 'text-ink-faint'
            }`}
          >
            <span className="text-lg leading-none">{it.emoji}</span>
            {it.label}
            {it.dot && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />}
          </button>
        ))}
    </div>
  )
}

// ---------------- Predicciones ----------------

function fmtKickoff(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function PrediccionesSection({ pool, round }: { pool: PoolType; round: Round | null }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [preds, setPreds] = useState<Record<number, Prediction>>({})
  const [inputs, setInputs] = useState<Record<number, { h: string; a: string }>>({})
  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [detail, setDetail] = useState<{ match: Match; copy: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const inputsRef = useRef(inputs)
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? ''
      if (!round) {
        if (alive) setLoading(false)
        return
      }
      const ms = await getMatches(round.id)
      const [ps, vc, mem, prof] = await Promise.all([
        getMyPredictions(pool.id, uid, ms.map((m) => m.id)),
        getVisibleCards(pool.id, round.id),
        getMembers(pool.id),
        getProfile(uid).catch(() => null),
      ])
      if (!alive) return
      setUserId(uid)
      setIsAdmin(!!prof?.is_admin)
      setMatches(ms)
      setPreds(ps)
      setCards(vc)
      setMembers(mem)
      const seed: Record<number, { h: string; a: string }> = {}
      for (const m of ms) {
        const p = ps[m.id]
        seed[m.id] = { h: p ? String(p.pred_home) : '', a: p ? String(p.pred_away) : '' }
      }
      inputsRef.current = seed
      setInputs(seed)
      setLoading(false)
    }
    load().catch((e) => {
      setError((e as Error).message)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [pool.id, round?.id])

  // Refresco en vivo: marcadores, estado y cartas reveladas (sin tocar lo que estás escribiendo)
  useEffect(() => {
    if (!round) return
    const iv = setInterval(() => {
      getMatches(round.id)
        .then((ms) => {
          setMatches(ms)
          if (userId) getMyPredictions(pool.id, userId, ms.map((m) => m.id)).then(setPreds).catch(() => {})
          getVisibleCards(pool.id, round.id).then(setCards).catch(() => {})
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(iv)
  }, [round?.id, userId, pool.id])

  function isEditable(m: Match) {
    return m.status === 'SCHEDULED' && new Date(m.kickoff).getTime() > Date.now()
  }

  async function autosave(matchId: number) {
    const m = matches.find((x) => x.id === matchId)
    if (!m || !isEditable(m) || !userId) return
    const i = inputsRef.current[matchId]
    if (!i || i.h === '' || i.a === '') return
    setStatus('saving')
    try {
      await savePrediction(pool.id, userId, matchId, Number(i.h), Number(i.a))
      setPreds((p) => ({ ...p, [matchId]: { match_id: matchId, pred_home: Number(i.h), pred_away: Number(i.a), points: null } }))
      setStatus('saved')
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1600)
    } catch {
      setStatus('error')
    }
  }

  function setInput(matchId: number, side: 'h' | 'a', val: string) {
    const clean = val.replace(/\D/g, '').slice(0, 2)
    setInputs((s) => {
      const next = { ...s, [matchId]: { ...s[matchId], [side]: clean } }
      inputsRef.current = next
      return next
    })
    clearTimeout(timers.current[matchId])
    timers.current[matchId] = setTimeout(() => autosave(matchId), 700)
  }

  function copyPred(matchId: number, h: number, a: number) {
    setInputs((s) => {
      const next = { ...s, [matchId]: { h: String(h), a: String(a) } }
      inputsRef.current = next
      return next
    })
    autosave(matchId)
  }

  async function reloadMatches() {
    if (!round) return
    const ms = await getMatches(round.id)
    setMatches(ms)
    if (userId) getMyPredictions(pool.id, userId, ms.map((m) => m.id)).then(setPreds).catch(() => {})
  }

  const cardsByMatch = useMemo(() => {
    const map: Record<number, Card[]> = {}
    for (const c of cards) if (c.status === 'PLAYED' && c.match_id) (map[c.match_id] ||= []).push(c)
    return map
  }, [cards])
  const myEspia = cards.find((c) => c.type === 'ESPIA' && c.status === 'PLAYED' && c.owner_id === userId)

  if (loading) {
    return <div className="flex justify-center py-12 text-ink-faint"><Spinner /></div>
  }
  if (!round) {
    return (
      <div className="ticket mt-2">
        <EmptyState title="Aún no hay jornada cargada">
          En cuanto se cargue la jornada aparecerán aquí los partidos.
        </EmptyState>
      </div>
    )
  }

  const statusText =
    status === 'saving' ? 'Guardando…' : status === 'saved' ? '✓ Guardado' : status === 'error' ? 'Error al guardar' : ''

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs text-ink-faint">Se guarda solo al escribir</span>
        <span className={`text-xs font-bold ${status === 'error' ? 'text-loss' : 'text-primary'}`}>{statusText}</span>
      </div>

      <div className="ticket overflow-hidden">
        <div className="grad-hero flex items-center justify-between px-4 py-3.5 text-white">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{round.name} · LaLiga</div>
            <h2 className="mt-0.5 text-lg text-white">Tus predicciones</h2>
          </div>
          <div className="scoreboard rounded-xl bg-black/25 px-3 py-1.5 text-center">
            <div className="text-lg leading-none">
              {Object.keys(preds).length}
              <span className="text-white/50">/{matches.length}</span>
            </div>
            <div className="text-[10px] font-medium text-white/60">enviados</div>
          </div>
        </div>

        <div className="divide-y divide-line">
          {matches.map((m) => {
            const espiaActive =
              !!myEspia && myEspia.match_id === m.id && Date.now() >= new Date(m.kickoff).getTime() - 3600_000
            return (
              <MatchRow
                key={m.id}
                match={m}
                pred={preds[m.id]}
                input={inputs[m.id]}
                editable={isEditable(m)}
                exactPts={pool.points_exact}
                cardsForMatch={cardsByMatch[m.id] ?? []}
                members={members}
                espiaActive={espiaActive}
                onInput={(side, v) => setInput(m.id, side, v)}
                onOpenDetail={(copy) => setDetail({ match: m, copy })}
              />
            )
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-loss">{error}</p>}

      {detail && (
        <MatchDetailSheet
          poolId={pool.id}
          match={detail.match}
          members={members}
          exactPts={pool.points_exact}
          isAdmin={isAdmin}
          onChanged={reloadMatches}
          onClose={() => setDetail(null)}
          onCopy={
            detail.copy
              ? (h, a) => {
                  copyPred(detail.match.id, h, a)
                  setDetail(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function TeamCol({ crest, short, name }: { crest: string | null; short: string | null; name: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <TeamCrest src={crest} short={short} size={44} />
      <span className="line-clamp-2 w-full text-center text-xs font-semibold leading-tight text-ink">{name}</span>
    </div>
  )
}

function ScoreBox({
  value,
  editable,
  tone,
  onChange,
}: {
  value: string
  editable: boolean
  tone: 'final' | 'live' | 'idle'
  onChange?: (v: string) => void
}) {
  if (editable) {
    return (
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="–"
        className="scoreboard h-12 w-12 rounded-xl border-2 border-line-strong bg-surface-2 text-center text-2xl text-ink focus:border-primary"
      />
    )
  }
  const cls =
    tone === 'live'
      ? 'border-live/50 bg-live-dim text-live'
      : tone === 'final'
        ? 'border-line-strong bg-surface-2 text-ink'
        : 'border-line bg-surface-2 text-ink-faint'
  return (
    <div className={`scoreboard grid h-12 w-12 place-items-center rounded-xl border-2 text-2xl ${cls}`}>
      {value === '' ? '–' : value}
    </div>
  )
}

function CardChip({ card, members }: { card: Card; members: Member[] }) {
  const meta = CARD_META[card.type]
  const target = members.find((m) => m.user_id === card.target_user_id)?.display_name
  let label: string = meta.name
  if (card.type === 'BOMBA') label = 'Mina'
  if (target) label = target
  if (card.type === 'DOBLE') label = `${card.bet_points} pts`
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
      <span>{meta.emoji}</span>
      {label}
    </span>
  )
}

function MatchRow({
  match,
  pred,
  input,
  editable,
  exactPts,
  cardsForMatch,
  members,
  espiaActive,
  onInput,
  onOpenDetail,
}: {
  match: Match
  pred?: Prediction
  input?: { h: string; a: string }
  editable: boolean
  exactPts: number
  cardsForMatch: Card[]
  members: Member[]
  espiaActive: boolean
  onInput: (side: 'h' | 'a', v: string) => void
  onOpenDetail: (copy: boolean) => void
}) {
  const started = new Date(match.kickoff).getTime() <= Date.now()
  const live = match.status === 'LIVE'
  const finished = match.status === 'FINISHED'
  const paused = match.live_status === 'PAUSED'
  // Partido empezado hace >3.5h que la API no da por finalizado (dato "colgado")
  const stale = started && !finished && Date.now() - new Date(match.kickoff).getTime() > 3.5 * 3600_000
  const tone: 'final' | 'live' | 'idle' = live && !stale ? 'live' : finished ? 'final' : 'idle'
  const homeShown = editable ? input?.h ?? '' : match.home_goals != null ? String(match.home_goals) : ''
  const awayShown = editable ? input?.a ?? '' : match.away_goals != null ? String(match.away_goals) : ''

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="nums text-xs font-semibold text-ink-faint">
          {editable ? `Cierra ${fmtTime(match.kickoff)}` : fmtKickoff(match.kickoff)}
        </span>
        <StatusTag status={match.status} started={started} paused={paused} stale={stale} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <TeamCol crest={match.home_crest} short={match.home_short} name={match.home_team} />
        <div className="flex items-center gap-1.5 pt-1">
          <ScoreBox value={homeShown} editable={editable} tone={tone} onChange={(v) => onInput('h', v)} />
          <span className="text-ink-faint">:</span>
          <ScoreBox value={awayShown} editable={editable} tone={tone} onChange={(v) => onInput('a', v)} />
        </div>
        <TeamCol crest={match.away_crest} short={match.away_short} name={match.away_team} />
      </div>

      {(cardsForMatch.length > 0 || espiaActive) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {cardsForMatch.map((c) => (
            <CardChip key={c.id} card={c} members={members} />
          ))}
          {espiaActive && (
            <button
              onClick={() => onOpenDetail(true)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-dim px-2.5 py-0.5 text-[11px] font-bold text-primary"
            >
              🕵️ Ver y copiar
            </button>
          )}
        </div>
      )}

      {!editable && (
        <div className="mt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="text-ink-faint">tu pronóstico</span>
            <span className="nums rounded-md bg-surface-3 px-2 py-0.5 font-bold text-ink">
              {pred ? `${pred.pred_home}–${pred.pred_away}` : '—'}
            </span>
          </span>
          <div className="flex items-center gap-2">
            {finished ? (
              <PointsStamp points={pred?.points ?? 0} exactPts={exactPts} />
            ) : stale ? (
              <span className="text-xs font-bold text-gold">por confirmar</span>
            ) : live ? (
              <span className="text-xs font-bold text-live">en juego</span>
            ) : null}
            <button onClick={() => onOpenDetail(false)} className="text-xs font-bold text-primary">
              Ver porras ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusTag({
  status,
  started,
  paused,
  stale,
}: {
  status: Match['status']
  started: boolean
  paused: boolean
  stale: boolean
}) {
  if (stale) {
    return (
      <span className="inline-flex items-center rounded-full bg-gold-dim px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
        POR CONFIRMAR
      </span>
    )
  }
  const label =
    status === 'LIVE' ? (paused ? 'DESCANSO' : 'EN JUEGO') : status === 'FINISHED' ? 'FINAL' : started ? 'CERRADO' : 'ABIERTO'
  const cls =
    status === 'LIVE'
      ? 'text-live bg-live-dim'
      : status === 'FINISHED'
        ? 'text-ink-soft bg-surface-2'
        : started
          ? 'text-ink-faint bg-surface-2'
          : 'text-primary bg-primary-dim'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {status === 'LIVE' && !paused && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
        </span>
      )}
      {label}
    </span>
  )
}

function PointsStamp({ points, exactPts }: { points: number; exactPts: number }) {
  if (points < 0) {
    return (
      <span className="nums inline-flex -rotate-2 items-center rounded-lg border-2 border-loss/50 bg-loss/15 px-2.5 py-1 text-sm font-bold uppercase text-loss">
        {points} pts
      </span>
    )
  }
  if (points === 0) {
    return (
      <span className="nums inline-flex -rotate-2 items-center rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-sm font-bold uppercase text-ink-faint">
        0 pts
      </span>
    )
  }
  const isExact = points >= exactPts
  return (
    <span
      className={`nums inline-flex -rotate-2 items-center rounded-lg px-2.5 py-1 text-sm font-bold uppercase shadow-sm ${
        isExact ? 'grad-gold text-on-primary' : 'bg-win text-on-primary'
      }`}
    >
      {isExact && '🎯 '}+{points} pts
    </span>
  )
}

// ---------------- Ranking (General / Jornada) ----------------

const MEDAL = ['🥇', '🥈', '🥉']

function RankingSection({ pool, round }: { pool: PoolType; round: Round | null }) {
  const [scope, setScope] = useState<'general' | 'jornada'>('general')
  const [general, setGeneral] = useState<Standing[] | null>(null)
  const [jornada, setJornada] = useState<Standing[] | null>(null)

  useEffect(() => {
    function load() {
      getStandings(pool.id).then(setGeneral).catch(() => setGeneral([]))
      if (round) getRoundStandings(pool.id, round.id).then(setJornada).catch(() => setJornada([]))
      else setJornada([])
    }
    load()
    const iv = setInterval(load, 30000) // refresco en vivo del ranking
    return () => clearInterval(iv)
  }, [pool.id, round?.id])

  const rows = scope === 'general' ? general : jornada

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-2xl bg-surface-2 p-1">
        <button
          onClick={() => setScope('general')}
          className={`min-h-9 flex-1 rounded-xl text-sm font-bold transition-all ${scope === 'general' ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint'}`}
        >
          General
        </button>
        <button
          onClick={() => setScope('jornada')}
          className={`min-h-9 flex-1 rounded-xl text-sm font-bold transition-all ${scope === 'jornada' ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint'}`}
        >
          {round?.name ?? 'Jornada'}
        </button>
      </div>
      <StandingsList rows={rows} />
    </div>
  )
}

function StandingsList({ rows }: { rows: Standing[] | null }) {
  if (rows === null) {
    return <div className="flex justify-center py-12 text-ink-faint"><Spinner /></div>
  }
  if (rows.length === 0) {
    return (
      <div className="ticket mt-2">
        <EmptyState title="Sin puntos por ahora">Sumaréis en cuanto se juegue el primer partido.</EmptyState>
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => {
        const podium = i < 3
        return (
          <li
            key={r.user_id}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${i === 0 ? 'border-gold/40 bg-gold-dim' : 'border-line bg-surface'}`}
          >
            <span className={`grid w-7 shrink-0 place-items-center text-lg ${podium ? '' : 'nums text-sm font-bold text-ink-faint'}`}>
              {podium ? MEDAL[i] : i + 1}
            </span>
            <Avatar url={r.avatar_url} name={r.display_name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{r.display_name}</p>
              <p className="nums text-xs text-ink-faint">{r.exacts} exactos · {r.partials} aciertos</p>
            </div>
            <span className="scoreboard text-2xl text-primary">{r.points}</span>
          </li>
        )
      })}
    </ul>
  )
}
