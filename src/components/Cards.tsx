import { useEffect, useState } from 'react'
import {
  ensureMyCard,
  getMatches,
  getMatchPredictions,
  getMembers,
  getStandings,
  playCard,
  type Card,
  type CardType,
  type Match,
  type Member,
  type MatchPrediction,
  type Pool,
  type Round,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { Button, Field, Spinner, TeamCrest } from '../ui'

export const CARD_META: Record<
  CardType,
  { emoji: string; name: string; desc: string; reveal: string; needsRival: boolean; needsBet: boolean }
> = {
  BOMBA: {
    emoji: '💣',
    name: 'Bomba',
    desc: 'Minas un partido con tu marcador. Quien ponga tu MISMO marcador exacto no puntúa ahí. Tú eres inmune.',
    reveal: 'Oculta hasta el pitido inicial.',
    needsRival: false,
    needsBet: false,
  },
  ROJA: {
    emoji: '🟥',
    name: 'Roja',
    desc: 'Expulsas a un rival de un partido: no puntúa ahí.',
    reveal: 'Se destapa al pitido inicial.',
    needsRival: true,
    needsBet: false,
  },
  LESION: {
    emoji: '🤕',
    name: 'Lesión',
    desc: 'Lesionas a un rival: se lleva la mitad de puntos en ese partido.',
    reveal: 'La víctima se entera al empezar el partido.',
    needsRival: true,
    needsBet: false,
  },
  ESPIA: {
    emoji: '🕵️',
    name: 'Espía',
    desc: 'Desde 1 hora antes del partido ves las predicciones de todos y puedes copiar la que quieras.',
    reveal: 'Solo para ti.',
    needsRival: false,
    needsBet: false,
  },
  PRENSA: {
    emoji: '📣',
    name: 'Rueda de prensa',
    desc: 'La predicción de un rival en ese partido se hace pública para toda la sala (aunque la cambie).',
    reveal: 'Pública al instante.',
    needsRival: true,
    needsBet: false,
  },
  DOBLE: {
    emoji: '🎲',
    name: 'Doble o nada',
    desc: 'Apuestas puntos a clavar el marcador exacto. Si lo clavas, ganas lo apostado. Si no, pierdes la mitad.',
    reveal: 'Se resuelve al acabar el partido.',
    needsRival: false,
    needsBet: true,
  },
}

const ORDER: CardType[] = ['BOMBA', 'ROJA', 'LESION', 'ESPIA', 'PRENSA', 'DOBLE']

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="safe-bottom max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-6 pt-4"
        style={{ animation: 'slideup 0.3s var(--ease-out)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
        <h3 className="text-xl font-bold">{title}</h3>
        {children}
      </div>
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
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface text-3xl">
              {CARD_META[myCard.type].emoji}
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
      <div className="grid grid-cols-2 gap-2.5">
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
              <span className="text-3xl">{meta.emoji}</span>
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
    <Sheet title={`${meta.emoji} ${meta.name}`} onClose={onClose}>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openMatches = matches.filter((m) => new Date(m.kickoff).getTime() > Date.now())
  const rivals = members.filter((m) => m.user_id !== myUserId)

  async function play() {
    if (!matchId) return setError('Elige un partido')
    if (meta.needsRival && !targetId) return setError('Elige un rival')
    if (meta.needsBet && (!bet || Number(bet) <= 0)) return setError('Indica los puntos a apostar')
    setLoading(true)
    setError(null)
    try {
      await playCard({
        cardId: card.id,
        matchId,
        targetUserId: meta.needsRival ? targetId : null,
        bet: meta.needsBet ? Number(bet) : null,
      })
      onPlayed()
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <Sheet title={`${meta.emoji} ${meta.name}`} onClose={onClose}>
      <p className="mt-1 text-sm text-ink-soft">{meta.desc}</p>

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Elige partido</p>
      <div className="space-y-2">
        {openMatches.map((m) => {
          const sel = m.id === matchId
          return (
            <button
              key={m.id}
              onClick={() => setMatchId(m.id)}
              className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left ${
                sel ? 'border-primary bg-primary-dim' : 'border-line-strong bg-surface-2'
              }`}
            >
              <TeamCrest src={m.home_crest} short={m.home_short} size={24} />
              <span className="flex-1 truncate text-sm font-semibold">
                {m.home_team} <span className="text-ink-faint">–</span> {m.away_team}
              </span>
              <TeamCrest src={m.away_crest} short={m.away_short} size={24} />
              <span className="nums shrink-0 text-[11px] text-ink-faint">{fmtShort(m.kickoff)}</span>
            </button>
          )
        })}
        {openMatches.length === 0 && (
          <p className="text-sm text-ink-faint">No quedan partidos por empezar en esta jornada.</p>
        )}
      </div>

      {meta.needsRival && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Elige rival</p>
          <div className="flex flex-wrap gap-2">
            {rivals.map((r) => {
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
                </button>
              )
            })}
            {rivals.length === 0 && <p className="text-sm text-ink-faint">Aún no hay rivales en la sala.</p>}
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

// ---------------- Espía ----------------

export function SpySheet({
  poolId,
  match,
  members,
  onClose,
  onCopy,
}: {
  poolId: string
  match: Match
  members: Member[]
  onClose: () => void
  onCopy: (home: number, away: number) => void
}) {
  const [rows, setRows] = useState<MatchPrediction[] | null>(null)
  useEffect(() => {
    getMatchPredictions(poolId, match.id)
      .then(setRows)
      .catch(() => setRows([]))
  }, [poolId, match.id])
  function nameOf(id: string) {
    return members.find((m) => m.user_id === id)?.display_name ?? '—'
  }
  return (
    <Sheet title={`🕵️ ${match.home_team} – ${match.away_team}`} onClose={onClose}>
      <p className="mt-1 text-sm text-ink-soft">Predicciones de todos. Toca una para copiarla.</p>
      {rows === null ? (
        <div className="flex justify-center py-8 text-ink-faint">
          <Spinner />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.user_id}>
              <button
                onClick={() => onCopy(r.pred_home, r.pred_away)}
                className="flex w-full items-center justify-between rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-left"
              >
                <span className="font-semibold">{nameOf(r.user_id)}</span>
                <span className="nums text-lg font-bold text-primary">
                  {r.pred_home}–{r.pred_away}
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 && <p className="text-sm text-ink-faint">Nadie ha pronosticado aún.</p>}
        </ul>
      )}
    </Sheet>
  )
}
