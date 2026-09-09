import { useEffect, useState } from 'react'
import {
  adminSetMatch,
  ensureMyCard,
  getMatch,
  getMatches,
  getMatchPredictions,
  getMembers,
  getStandings,
  getUserHistory,
  playCard,
  type Card,
  type CardType,
  type HistoryEntry,
  type Match,
  type Member,
  type MatchPrediction,
  type Pool,
  type Round,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { Avatar, Button, Field, Spinner, TeamCrest } from '../ui'
import { CardIcon } from './CardIcon'

export const CARD_META: Record<
  CardType,
  {
    name: string
    desc: string
    reveal: string
    needsRival: boolean
    needsBet: boolean
    /** false en cartas de jornada (sin partido): CANCHERO, DUPLA */
    needsMatch?: boolean
    /** picker de miembro no-rival (CANCHERO: cualquiera, DUPLA: rival) */
    memberPick?: { label: string; includeSelf: boolean }
    /** selector de gol a cambiar (VAR) */
    varPick?: boolean
  }
> = {
  BOMBA: {
    name: 'Bomba',
    desc: 'Minas un partido con tu marcador. Quien ponga tu MISMO marcador exacto no puntúa ahí. Tú eres inmune.',
    reveal: 'Oculta hasta el pitido inicial.',
    needsRival: false,
    needsBet: false,
  },
  ROJA: {
    name: 'Roja',
    desc: 'Expulsas a un rival de un partido: no puntúa ahí.',
    reveal: 'Se destapa al pitido inicial.',
    needsRival: true,
    needsBet: false,
  },
  LESION: {
    name: 'Lesión',
    desc: 'Lesionas a un rival: se lleva la mitad de puntos en ese partido.',
    reveal: 'La víctima se entera al empezar el partido.',
    needsRival: true,
    needsBet: false,
  },
  ESPIA: {
    name: 'Espía',
    desc: 'Desde 1 hora antes del partido ves las predicciones de todos y puedes copiar la que quieras.',
    reveal: 'Solo para ti.',
    needsRival: false,
    needsBet: false,
  },
  PRENSA: {
    name: 'Rueda de prensa',
    desc: 'La predicción de un rival en ese partido se hace pública para toda la sala (aunque la cambie).',
    reveal: 'Pública al instante.',
    needsRival: true,
    needsBet: false,
  },
  DOBLE: {
    name: 'Doble o nada',
    desc: 'Apuestas puntos a clavar el marcador exacto. Si lo clavas, ganas lo apostado. Si no, pierdes la mitad.',
    reveal: 'Se resuelve al acabar el partido.',
    needsRival: false,
    needsBet: true,
  },
  VAR: {
    name: 'VAR',
    desc: 'En un partido ya jugado de esta jornada, cambias UN gol del resultado solo para ti o para un rival (el resto ni se entera). Tu propio VAR manda sobre el ajeno. No entra sobre su FINALISSIMA ni contra el Autobús.',
    reveal: 'Pública al instante.',
    needsRival: false,
    needsBet: false,
    varPick: true,
    memberPick: { label: '¿A quién afecta?', includeSelf: true },
  },
  AUTOBUS: {
    name: 'Autobús',
    desc: 'Aparcas el bus en un partido: ninguna carta te toca ahí (ni el VAR) y te garantizas mínimo 1 punto.',
    reveal: 'Oculta hasta el pitido inicial.',
    needsRival: false,
    needsBet: false,
  },
  CANCHERO: {
    name: 'El canchero',
    desc: 'Elige quién ganará la jornada (puedes ser tú). Si empata o lidera por puntos de partidos, te llevas 5 puntos. Solo antes de empezar la jornada.',
    reveal: 'Pública al instante.',
    needsRival: false,
    needsBet: false,
    needsMatch: false,
    memberPick: { label: '¿Quién gana la jornada?', includeSelf: true },
  },
  DUPLA: {
    name: 'La dupla',
    desc: 'Eliges un rival y esa jornada vais a medias: se suman vuestros puntos y se reparten (7,5 y 7,5 si hacéis 5 y 10). Solo antes de empezar; un dúo por jugador.',
    reveal: 'Pública al instante.',
    needsRival: false,
    needsBet: false,
    needsMatch: false,
    memberPick: { label: 'Elige rival', includeSelf: false },
  },
}

const ORDER: CardType[] = ['BOMBA', 'ROJA', 'LESION', 'ESPIA', 'PRENSA', 'DOBLE', 'VAR', 'AUTOBUS', 'CANCHERO', 'DUPLA']

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export function Sheet({ title, children, onClose }: { title: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center lg:p-6"
      onClick={onClose}
    >
      <div
        className="safe-bottom max-h-[85dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-6 pt-3 lg:max-h-[85vh] lg:max-w-[560px] lg:rounded-2xl lg:border"
        style={{ animation: 'slideup 0.3s var(--ease-out)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong lg:hidden" />
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft hover:bg-surface-3 active:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------- Perfil de jugador (historial de porras) ----------------

export function ProfileSheet({
  poolId,
  userId,
  displayName,
  avatarUrl,
  points,
  rank,
  exactPts,
  currentRoundId,
  onClose,
}: {
  poolId: string
  userId: string
  displayName: string
  avatarUrl: string | null
  points: number
  rank: number
  exactPts: number
  currentRoundId: number | null
  onClose: () => void
}) {
  const [hist, setHist] = useState<HistoryEntry[] | null>(null)
  const [scope, setScope] = useState<'semanal' | 'general'>('general')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    getUserHistory(poolId, userId).then(setHist).catch(() => setHist([]))
  }, [poolId, userId])

  const rows =
    scope === 'semanal' && currentRoundId != null
      ? (hist ?? []).filter((h) => h.round_id === currentRoundId)
      : hist ?? []
  const porras = rows.length
  const acertadas = rows.filter((r) => (r.points ?? 0) > 0).length
  const clavadas = rows.filter((r) => (r.points ?? 0) >= exactPts).length
  const pct = (n: number) => (porras ? Math.round((n / porras) * 100) : 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center lg:p-6"
      onClick={onClose}
    >
      <div
        className="safe-bottom max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-8 pt-3 lg:max-h-[85vh] lg:max-w-[560px] lg:rounded-2xl lg:border"
        style={{ animation: 'slideup 0.3s var(--ease-out)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong lg:hidden" />

        <div className="flex items-center gap-3">
          <Avatar url={avatarUrl} name={displayName} size={52} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-2xl font-extrabold leading-tight">{displayName}</h3>
            <p className="nums text-sm font-bold text-ink-faint">#{rank}</p>
          </div>
          <div className="text-right">
            <div className="scoreboard text-3xl leading-none text-primary">{points}</div>
            <div className="text-[10px] font-bold tracking-wide text-ink-faint">PTS</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft hover:bg-surface-3 active:brightness-110"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
          <button
            onClick={() => setScope('semanal')}
            className={`min-h-9 flex-1 rounded-xl text-sm font-bold transition-all ${scope === 'semanal' ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint'}`}
          >
            Semanal
          </button>
          <button
            onClick={() => setScope('general')}
            className={`min-h-9 flex-1 rounded-xl text-sm font-bold transition-all ${scope === 'general' ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint'}`}
          >
            General
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface-2">
          <ProfileStat big={String(porras)} label="PORRAS" />
          <ProfileStat big={`${pct(acertadas)}%`} label={`${acertadas} ACERTADAS`} />
          <ProfileStat big={`${pct(clavadas)}%`} label={`${clavadas} CLAVADAS`} />
        </div>

        {hist === null ? (
          <div className="flex justify-center py-10 text-ink-faint"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            {scope === 'semanal' ? 'Sin porras en esta jornada.' : 'Todavía no ha jugado ninguna porra.'}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {rows.map((r) => (
              <HistoryCard key={r.match_id} r={r} exactPts={exactPts} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileStat({ big, label }: { big: string; label: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="scoreboard text-2xl leading-none text-ink">{big}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
    </div>
  )
}

function HistoryCard({ r, exactPts }: { r: HistoryEntry; exactPts: number }) {
  const pts = r.points
  const exact = (pts ?? 0) >= exactPts
  const win = (pts ?? 0) > 0 && !exact
  const loss = (pts ?? 0) < 0
  const cardCls = exact
    ? 'border-primary bg-primary text-on-primary shadow-[0_0_18px_-4px_var(--primary)]'
    : win
      ? 'border-win/40 bg-win/10'
      : loss
        ? 'border-loss/40 bg-loss/10'
        : 'border-line bg-surface-2'
  const ptsCls = exact ? 'text-on-primary' : win ? 'text-win' : loss ? 'text-loss' : 'text-ink-faint'
  const ptsLabel = pts == null ? '·' : pts > 0 ? `+${pts}` : String(pts)
  const g = (v: number | null) => (v == null ? '–' : v)

  return (
    <div className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border ${cardCls}`}>
      {r.home_crest && (
        <img src={r.home_crest} alt="" className="pointer-events-none absolute -left-1 top-1/2 h-16 w-16 -translate-y-1/2 object-contain opacity-40" />
      )}
      {r.away_crest && (
        <img src={r.away_crest} alt="" className="pointer-events-none absolute -right-1 top-1/2 h-16 w-16 -translate-y-1/2 object-contain opacity-40" />
      )}
      <div className="nums relative text-2xl font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
        {g(r.home_goals)} <span className="opacity-50">:</span> {g(r.away_goals)}
      </div>
      <span className="relative rounded-md border border-dashed border-current/40 px-1.5 py-0.5 text-[10px] font-semibold leading-none opacity-70">
        {r.pred_home}-{r.pred_away}
      </span>
      <span className={`relative text-2xl font-black leading-none ${ptsCls}`}>{ptsLabel}</span>
    </div>
  )
}

// ---------------- Sección Cartas ----------------

export function CartasSection({
  pool,
  round,
  myCard,
  onCardChanged,
}: {
  pool: Pool
  round: Round | null
  myCard: Card | null
  onCardChanged: () => void
}) {
  const [matches, setMatches] = useState<Match[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [myPoints, setMyPoints] = useState(0)
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [playThis, setPlayThis] = useState<Card | null>(null)
  const [explain, setExplain] = useState<CardType | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? ''
      const [ms, mem, st] = await Promise.all([
        round ? getMatches(round.id) : Promise.resolve([]),
        getMembers(pool.id),
        getStandings(pool.id),
      ])
      if (!alive) return
      setUserId(uid)
      setMatches(ms)
      setMembers(mem)
      setMyPoints(st.find((s) => s.user_id === uid)?.points ?? 0)
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [pool.id, round])

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-ink-faint">
        <Spinner />
      </div>
    )
  }

  const playedMatch = matches.find((m) => m.id === myCard?.match_id)
  const playedTarget = members.find((m) => m.user_id === myCard?.target_user_id)

  return (
    <div className="pb-4">
      <div className="mb-4 rounded-2xl border border-primary/25 bg-primary-dim p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Tu carta · {round?.name}</p>
        {myCard ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-line-strong bg-surface-2 text-ink">
              <CardIcon type={myCard.type} size={32} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{CARD_META[myCard.type].name}</p>
              {myCard.status === 'PLAYED' ? (
                <p className="truncate text-xs text-ink-soft">
                  Jugada{playedMatch ? ` · ${playedMatch.home_team}–${playedMatch.away_team}` : ''}
                  {playedTarget ? ` · ${playedTarget.display_name}` : ''}
                  {myCard.bet_points ? ` · ${myCard.bet_points} pts` : ''}
                </p>
              ) : (
                <p className="text-xs text-ink-soft">Lista para usar esta jornada.</p>
              )}
            </div>
            {myCard.status === 'GRANTED' && (
              <button
                onClick={() => setPlayThis(myCard)}
                className="grad-primary shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-on-primary"
              >
                Usar
              </button>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Aún no hay carta para esta jornada.</p>
        )}
      </div>

      <p className="mb-2 px-1 text-sm font-semibold text-ink-soft">La baraja</p>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {ORDER.map((type) => {
          const meta = CARD_META[type]
          const mine = myCard?.type === type
          return (
            <button
              key={type}
              onClick={() => setExplain(type)}
              className={`flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors ${
                mine ? 'border-primary bg-surface' : 'border-line bg-surface/60 opacity-80 hover:opacity-100'
              }`}
            >
              <span className="grid h-14 w-14 place-items-center rounded-xl border-2 border-line-strong bg-surface-2 text-ink">
                <CardIcon type={type} size={30} />
              </span>
              <span className="text-sm font-bold">{meta.name}</span>
              <span className="line-clamp-2 text-[11px] leading-tight text-ink-faint">{meta.desc}</span>
              {mine && (
                <span className="mt-0.5 rounded-full bg-primary-dim px-2 py-0.5 text-[10px] font-bold text-primary">
                  {myCard?.status === 'PLAYED' ? 'Jugada' : 'La tienes'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3 px-1 text-xs text-ink-faint">
        Cada jornada recibes una carta al azar. Toca cualquiera para ver cómo funciona.
      </p>

      {playThis && (
        <PlayCardSheet
          card={playThis}
          matches={matches}
          members={members}
          myUserId={userId}
          myPoints={myPoints}
          onClose={() => setPlayThis(null)}
          onPlayed={() => {
            setPlayThis(null)
            onCardChanged()
            ensureMyCard(pool.id, round!.id).catch(() => {})
          }}
        />
      )}
      {explain && <ExplainSheet type={explain} onClose={() => setExplain(null)} />}
    </div>
  )
}

function ExplainSheet({ type, onClose }: { type: CardType; onClose: () => void }) {
  const meta = CARD_META[type]
  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <CardIcon type={type} size={24} />
          {meta.name}
        </span>
      }
      onClose={onClose}
    >
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{meta.desc}</p>
      <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Cuándo se ve: </span>
        {meta.reveal}
      </div>
      <div className="mt-5">
        <Button full variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Sheet>
  )
}

// ---------------- Jugar carta ----------------

function PlayCardSheet({
  card,
  matches,
  members,
  myUserId,
  myPoints,
  onClose,
  onPlayed,
}: {
  card: Card
  matches: Match[]
  members: Member[]
  myUserId: string
  myPoints: number
  onClose: () => void
  onPlayed: () => void
}) {
  const meta = CARD_META[card.type]
  const [matchId, setMatchId] = useState<number | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [bet, setBet] = useState('')
  const [varChoice, setVarChoice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openMatches = matches.filter((m) => new Date(m.kickoff).getTime() > Date.now())
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED')
  const matchList = meta.varPick ? finishedMatches : openMatches
  const rivals = members.filter((m) => m.user_id !== myUserId)
  const candidates = meta.memberPick
    ? meta.memberPick.includeSelf
      ? members
      : rivals
    : rivals
  const selMatch = matches.find((m) => m.id === matchId) ?? null

  // Opciones del VAR: +1/-1 a un equipo sin bajar de 0.
  const varOptions =
    meta.varPick && selMatch?.home_goals != null && selMatch?.away_goals != null
      ? ([
          { key: 'h+1', h: selMatch.home_goals + 1, a: selMatch.away_goals, label: `+1 local (${selMatch.home_goals + 1}–${selMatch.away_goals})` },
          { key: 'h-1', h: selMatch.home_goals - 1, a: selMatch.away_goals, label: `−1 local (${selMatch.home_goals - 1}–${selMatch.away_goals})` },
          { key: 'a+1', h: selMatch.home_goals, a: selMatch.away_goals + 1, label: `+1 visita (${selMatch.home_goals}–${selMatch.away_goals + 1})` },
          { key: 'a-1', h: selMatch.home_goals, a: selMatch.away_goals - 1, label: `−1 visita (${selMatch.home_goals}–${selMatch.away_goals - 1})` },
        ] as const).filter((o) => o.h >= 0 && o.a >= 0)
      : []

  async function play() {
    if (meta.needsMatch !== false && !matchId) return setError('Elige un partido')
    if ((meta.needsRival || meta.memberPick) && !targetId)
      return setError(meta.memberPick ? 'Elige a quién' : 'Elige un rival')
    if (meta.needsBet && (!bet || Number(bet) <= 0)) return setError('Indica los puntos a apostar')
    const varOpt = meta.varPick ? varOptions.find((o) => o.key === varChoice) ?? null : null
    if (meta.varPick && !varOpt) return setError('Elige el gol a cambiar')
    setLoading(true)
    setError(null)
    try {
      await playCard({
        cardId: card.id,
        matchId: meta.needsMatch === false ? null : matchId,
        targetUserId: meta.needsRival || meta.memberPick ? targetId : null,
        bet: meta.needsBet ? Number(bet) : null,
        varHome: varOpt ? varOpt.h : null,
        varAway: varOpt ? varOpt.a : null,
      })
      onPlayed()
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <CardIcon type={card.type} size={24} />
          {meta.name}
        </span>
      }
      onClose={onClose}
    >
      <p className="mt-1 text-sm text-ink-soft">{meta.desc}</p>

      {meta.needsMatch !== false && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">
            {meta.varPick ? 'Elige partido ya jugado' : 'Elige partido'}
          </p>
          <div className="space-y-2">
            {matchList.map((m) => {
              const sel = m.id === matchId
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setMatchId(m.id)
                    setVarChoice(null)
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left ${
                    sel ? 'border-primary bg-primary-dim' : 'border-line-strong bg-surface-2'
                  }`}
                >
                  <TeamCrest src={m.home_crest} short={m.home_short} size={24} />
                  <span className="flex-1 truncate text-sm font-semibold">
                    {m.home_team} <span className="text-ink-faint">–</span> {m.away_team}
                  </span>
                  {m.status === 'FINISHED' && m.home_goals != null && (
                    <span className="nums shrink-0 text-sm font-bold">{m.home_goals}–{m.away_goals}</span>
                  )}
                  <TeamCrest src={m.away_crest} short={m.away_short} size={24} />
                  <span className="nums shrink-0 text-[11px] text-ink-faint">{fmtShort(m.kickoff)}</span>
                </button>
              )
            })}
            {matchList.length === 0 && (
              <p className="text-sm text-ink-faint">
                {meta.varPick
                  ? 'Aún no hay partidos jugados en esta jornada.'
                  : 'No quedan partidos por empezar en esta jornada.'}
              </p>
            )}
          </div>

          {meta.varPick && selMatch && (
            <>
              <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">¿Qué gol cambias?</p>
              <div className="grid grid-cols-2 gap-2">
                {varOptions.map((o) => {
                  const sel = o.key === varChoice
                  return (
                    <button
                      key={o.key}
                      onClick={() => setVarChoice(o.key)}
                      className={`scoreboard rounded-xl border-2 px-3 py-2.5 text-center text-lg ${
                        sel ? 'border-primary bg-primary-dim text-primary' : 'border-line-strong bg-surface-2'
                      }`}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {(meta.needsRival || meta.memberPick) && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">
            {meta.memberPick?.label ?? 'Elige rival'}
          </p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((r) => {
              const sel = r.user_id === targetId
              return (
                <button
                  key={r.user_id}
                  onClick={() => setTargetId(r.user_id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    sel ? 'border-primary bg-primary-dim text-primary' : 'border-line-strong bg-surface-2'
                  }`}
                >
                  {r.display_name}
                  {meta.memberPick?.includeSelf && r.user_id === myUserId ? ' (tú)' : ''}
                </button>
              )
            })}
            {candidates.length === 0 && <p className="text-sm text-ink-faint">Aún no hay rivales en la sala.</p>}
          </div>
        </>
      )}

      {meta.needsBet && (
        <div className="mt-5">
          <Field
            label={`Puntos a apostar (tienes ${myPoints})`}
            type="number"
            min={1}
            max={myPoints}
            inputMode="numeric"
            value={bet}
            onChange={(e) => setBet(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-loss">{error}</p>}

      <div className="mt-6">
        <Button full loading={loading} onClick={play}>
          Jugar carta
        </Button>
      </div>
    </Sheet>
  )
}

// ---------------- Detalle del partido (marcador en vivo + porras públicas) ----------------

export function MatchDetailSheet({
  poolId,
  match,
  members,
  exactPts,
  isAdmin,
  onClose,
  onCopy,
  onChanged,
}: {
  poolId: string
  match: Match
  members: Member[]
  exactPts: number
  isAdmin?: boolean
  onClose: () => void
  onCopy?: (home: number, away: number) => void
  onChanged?: () => void
}) {
  const [rows, setRows] = useState<MatchPrediction[] | null>(null)
  const [cur, setCur] = useState<Match>(match)
  const [ah, setAh] = useState(match.home_goals != null ? String(match.home_goals) : '')
  const [aa, setAa] = useState(match.away_goals != null ? String(match.away_goals) : '')
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminMsg, setAdminMsg] = useState<string | null>(null)

  // Autorefresco en vivo mientras la ficha está abierta: marcador, minuto,
  // goleadores y puntos de las porras. Se detiene al finalizar el partido.
  useEffect(() => {
    let alive = true
    let iv: ReturnType<typeof setInterval> | undefined
    setCur(match)
    const tick = () => {
      getMatchPredictions(poolId, match.id)
        .then((r) => alive && setRows(r))
        .catch(() => alive && setRows((prev) => prev ?? []))
      getMatch(match.id)
        .then((mm) => {
          if (!alive || !mm) return
          setCur(mm)
          if (mm.status === 'FINISHED' && iv) {
            clearInterval(iv)
            iv = undefined
          }
        })
        .catch(() => {})
    }
    tick()
    if (match.status !== 'FINISHED') iv = setInterval(tick, 15000)
    return () => {
      alive = false
      if (iv) clearInterval(iv)
    }
  }, [poolId, match.id, match.status])

  async function adminSave(st: 'FINISHED' | 'LIVE' | 'SCHEDULED') {
    if (st !== 'SCHEDULED' && (ah === '' || aa === '')) {
      setAdminMsg('Pon el marcador')
      return
    }
    setAdminBusy(true)
    setAdminMsg(null)
    try {
      await adminSetMatch(match.id, Number(ah || 0), Number(aa || 0), st)
      setAdminMsg('✓ Guardado')
      onChanged?.()
      getMatch(match.id).then((mm) => mm && setCur(mm)).catch(() => {})
      getMatchPredictions(poolId, match.id).then(setRows).catch(() => {})
      setTimeout(() => setAdminMsg(null), 1500)
    } catch (e) {
      setAdminMsg((e as Error).message)
    } finally {
      setAdminBusy(false)
    }
  }

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? '—'
  const avatarOf = (id: string) => members.find((m) => m.user_id === id)?.avatar_url ?? null
  const started = new Date(cur.kickoff).getTime() <= Date.now()
  const finished = cur.status === 'FINISHED'
  const live = cur.status === 'LIVE'
  const paused = cur.live_status === 'PAUSED'
  const statusLabel = finished
    ? 'FINAL'
    : paused
      ? 'DESCANSO'
      : live
        ? cur.minute != null
          ? `EN JUEGO ${cur.minute}'`
          : 'EN JUEGO'
        : fmtShort(cur.kickoff)
  const score =
    started && cur.home_goals != null ? `${cur.home_goals} – ${cur.away_goals}` : '– : –'

  return (
    <Sheet title="Detalle del partido" onClose={onClose}>
      {/* Cabecera con marcador */}
      <div className="mt-2 rounded-2xl border border-line bg-surface-2 p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <TeamCrest src={cur.home_crest} short={cur.home_short} size={40} />
            <span className="line-clamp-2 text-center text-xs font-semibold">{cur.home_team}</span>
          </div>
          <div className="text-center">
            <div className="scoreboard text-3xl leading-none">{score}</div>
            <div
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                live ? 'bg-live-dim text-live' : finished ? 'bg-surface-3 text-ink-soft' : 'bg-surface-3 text-ink-faint'
              }`}
            >
              {live && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
                </span>
              )}
              {statusLabel}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <TeamCrest src={cur.away_crest} short={cur.away_short} size={40} />
            <span className="line-clamp-2 text-center text-xs font-semibold">{cur.away_team}</span>
          </div>
        </div>
        {cur.ht_home != null && (
          <p className="nums mt-2 text-center text-[11px] text-ink-faint">
            Descanso: {cur.ht_home}–{cur.ht_away}
          </p>
        )}
      </div>

      {cur.scorers && cur.scorers.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Goleadores</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              {(cur.scorers ?? []).filter((s) => s.t === 'home').map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-ink-faint">⚽</span>
                  <span className="truncate font-semibold">{s.p}</span>
                  <span className="nums text-ink-faint">{s.m != null ? `${s.m}${s.x ? `+${s.x}` : ''}'` : ''}</span>
                  {s.d === 'Penalty' && <span className="text-[10px] text-ink-faint">(pen)</span>}
                  {s.d === 'Own Goal' && <span className="text-[10px] text-ink-faint">(p.p.)</span>}
                </div>
              ))}
            </div>
            <div className="space-y-1 text-right">
              {(cur.scorers ?? []).filter((s) => s.t === 'away').map((s, i) => (
                <div key={i} className="flex items-center justify-end gap-1.5">
                  {s.d === 'Penalty' && <span className="text-[10px] text-ink-faint">(pen)</span>}
                  {s.d === 'Own Goal' && <span className="text-[10px] text-ink-faint">(p.p.)</span>}
                  <span className="nums text-ink-faint">{s.m != null ? `${s.m}${s.x ? `+${s.x}` : ''}'` : ''}</span>
                  <span className="truncate font-semibold">{s.p}</span>
                  <span className="text-ink-faint">⚽</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-4 rounded-2xl border border-gold/30 bg-gold-dim p-3">
          <p className="mb-2 text-sm font-bold text-gold">🛠️ Admin · corregir resultado</p>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={ah}
              onChange={(e) => setAh(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="–"
              className="scoreboard h-11 w-14 rounded-xl border-2 border-line-strong bg-surface-2 text-center text-xl text-ink focus:border-primary"
            />
            <span className="text-ink-faint">:</span>
            <input
              inputMode="numeric"
              value={aa}
              onChange={(e) => setAa(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="–"
              className="scoreboard h-11 w-14 rounded-xl border-2 border-line-strong bg-surface-2 text-center text-xl text-ink focus:border-primary"
            />
            <button
              disabled={adminBusy}
              onClick={() => adminSave('FINISHED')}
              className="grad-primary ml-auto rounded-xl px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
            >
              Finalizar
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <button disabled={adminBusy} onClick={() => adminSave('LIVE')} className="flex-1 rounded-xl border border-line-strong bg-surface-2 py-1.5 text-xs font-bold disabled:opacity-50">
              En juego
            </button>
            <button disabled={adminBusy} onClick={() => adminSave('SCHEDULED')} className="flex-1 rounded-xl border border-line-strong bg-surface-2 py-1.5 text-xs font-bold disabled:opacity-50">
              Reabrir
            </button>
          </div>
          {adminMsg && (
            <p className={`mt-2 text-xs font-bold ${adminMsg.startsWith('✓') ? 'text-primary' : 'text-loss'}`}>{adminMsg}</p>
          )}
        </div>
      )}

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">
        {onCopy ? 'Predicciones (toca para copiar)' : started ? 'Porras de la sala' : 'Predicciones'}
      </p>
      {rows === null ? (
        <div className="flex justify-center py-8 text-ink-faint">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-faint">Nadie ha pronosticado este partido.</p>
      ) : (
        <ul className="space-y-2">
          {rows
            .slice()
            .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
            .map((r) => {
              const pts = r.points ?? 0
              const isExact = pts >= exactPts
              return (
                <li
                  key={r.user_id}
                  className="flex items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5"
                >
                  <Avatar url={avatarOf(r.user_id)} name={nameOf(r.user_id)} size={30} />
                  <span className="flex-1 truncate text-sm font-semibold">{nameOf(r.user_id)}</span>
                  <span className="nums text-base font-bold text-ink">
                    {r.pred_home}–{r.pred_away}
                  </span>
                  {finished && (
                    <span
                      className={`nums rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                        pts > 0
                          ? isExact
                            ? 'grad-gold text-on-primary'
                            : 'bg-win text-on-primary'
                          : pts < 0
                            ? 'bg-loss/15 text-loss'
                            : 'bg-surface-3 text-ink-faint'
                      }`}
                    >
                      {pts > 0 ? `+${pts}` : pts}
                    </span>
                  )}
                  {onCopy && (
                    <button
                      onClick={() => onCopy(r.pred_home, r.pred_away)}
                      className="rounded-lg bg-primary-dim px-2 py-1 text-[11px] font-bold text-primary"
                    >
                      copiar
                    </button>
                  )}
                </li>
              )
            })}
        </ul>
      )}
    </Sheet>
  )
}
