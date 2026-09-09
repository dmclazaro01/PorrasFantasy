import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  buildSegments,
  currentSegmentKey,
  ensureMyCard,
  getBote,
  getFinalissima,
  getMatches,
  getMyPredictions,
  getMembers,
  getPool,
  getProfile,
  getRoundStandings,
  getStandings,
  getVisibleCards,
  listMatchMeta,
  listRounds,
  savePrediction,
  setFinalissima,
  type BoteStanding,
  type Card,
  type CardType,
  type Finalissima,
  type Match,
  type MatchMeta,
  type Member,
  type Pool as PoolType,
  type Prediction,
  type Round,
  type Segment,
  type Standing,
} from '../lib/api'
import { Avatar, EmptyState, ScreenHeader, Spinner, TeamCrest } from '../ui'
import { CARD_META, CartasSection, MatchDetailSheet, ProfileSheet } from '../components/Cards'
import { PoolAdminSheet } from '../components/PoolAdmin'
import { useTheme } from '../hooks/useTheme'

type Section = 'predicciones' | 'ranking' | 'cartas'

export default function Pool() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [pool, setPool] = useState<PoolType | null>(null)
  const [section, setSection] = useState<Section>('predicciones')
  const [rounds, setRounds] = useState<Round[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegKey, setSelectedSegKey] = useState<string>('')
  const [latestRound, setLatestRound] = useState<Round | null>(null)
  const [myCard, setMyCard] = useState<Card | null>(null)
  const [loadedRounds, setLoadedRounds] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [me, setMe] = useState<{ id: string; isAdmin: boolean } | null>(null)
  const { theme } = useTheme()
  const taberna = theme === 'taberna'

  useEffect(() => {
    getPool(id)
      .then((p) => (p ? setPool(p) : setNotFound(true)))
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      getProfile(uid)
        .then((p) => setMe({ id: uid, isAdmin: !!p?.is_admin }))
        .catch(() => setMe({ id: uid, isAdmin: false }))
    })
  }, [])

  useEffect(() => {
    if (!pool) return
    if (!pool.competition_id) {
      setLoadedRounds(true)
      return
    }
    listRounds(pool.competition_id).then(async (rs) => {
      setRounds(rs)
      let metas: MatchMeta[] = []
      try {
        metas = await listMatchMeta(rs.map((r) => r.id))
      } catch {
        /* ignore */
      }
      const segs = buildSegments(rs, metas)
      setSegments(segs)
      const curKey = currentSegmentKey(segs, metas)
      setSelectedSegKey(curKey)
      const curSeg = segs.find((s) => s.key === curKey) ?? null
      const curRound = curSeg ? rs.find((r) => r.id === curSeg.roundId) ?? null : null
      setLatestRound(curRound)
      setLoadedRounds(true)
      if (curRound) ensureMyCard(pool.id, curRound.id).then(setMyCard).catch(() => {})
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

  const selectedSegment = segments.find((s) => s.key === selectedSegKey) ?? null
  const selectedRound = selectedSegment
    ? rounds.find((r) => r.id === selectedSegment.roundId) ?? null
    : null

  return (
    <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1280px]">
      <ScreenHeader
        title={pool.name}
        back="/"
        gradient
        action={
          <span className="flex items-center gap-1.5">
            {me && (me.isAdmin || pool.owner_id === me.id) && (
              <button
                onClick={() => setAdminOpen(true)}
                aria-label="Administrar porra"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white hover:bg-white/25"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
            )}
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
          </span>
        }
      />
      {adminOpen && (
        <PoolAdminSheet
          pool={pool}
          onChanged={() => getPool(id).then((p) => p && setPool(p)).catch(() => {})}
          onDeleted={() => nav('/', { replace: true })}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {/* Desktop: selector de sección + tira de jornadas (el PoolNav móvil está oculto en lg) */}
      <div className="hidden lg:block lg:space-y-3 lg:px-6 lg:pt-4">
        <SectionTabs section={section} setSection={setSection} hasCard={myCard?.status === 'GRANTED'} />
        {section !== 'cartas' && (
          <JornadaBar segments={segments} selectedKey={selectedSegKey} onSelect={setSelectedSegKey} />
        )}
      </div>

      <div
        className={
          taberna
            ? 'mx-auto w-full max-w-[880px] flex-1 px-4 pb-32 pt-4 lg:max-w-[1100px] lg:px-6 lg:pb-6'
            : 'flex-1 px-4 pb-32 pt-4 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:px-6 lg:pb-6'
        }
      >
        <div className="min-w-0">
          {section === 'predicciones' &&
            (loadedRounds ? (
              <PrediccionesSection pool={pool} round={selectedRound} matchIds={selectedSegment?.matchIds ?? null} />
            ) : (
              <div className="flex justify-center py-12 text-ink-faint"><Spinner /></div>
            ))}
          {section === 'ranking' && <RankingSection pool={pool} round={selectedRound} />}
          {section === 'cartas' && (
            <CartasSection pool={pool} round={latestRound} myCard={myCard} onCardChanged={refreshCard} />
          )}
        </div>
        {section === 'predicciones' && !taberna && (
          <aside className="hidden min-w-0 lg:block lg:sticky lg:top-4 lg:h-fit lg:space-y-4">
            <div className="card p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-faint">Clasificación rápida</p>
              <RankingSection pool={pool} round={selectedRound} />
            </div>
          </aside>
        )}
      </div>

      <div className="app-bottombar safe-bottom border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        {section !== 'cartas' && (
          <JornadaBar segments={segments} selectedKey={selectedSegKey} onSelect={setSelectedSegKey} />
        )}
        <PoolNav section={section} setSection={setSection} hasCard={myCard?.status === 'GRANTED'} />
      </div>
    </div>
  )
}

function JornadaBar({
  segments,
  selectedKey,
  onSelect,
}: {
  segments: Segment[]
  selectedKey: string
  onSelect: (key: string) => void
}) {
  const selRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [selectedKey])
  if (segments.length === 0) return null
  const idx = segments.findIndex((s) => s.key === selectedKey)
  const seg = segments[idx]
  const sameRound = seg ? segments.filter((s) => s.roundId === seg.roundId) : []
  const partLabel =
    seg && sameRound.length > 1
      ? ` · parte ${sameRound.findIndex((s) => s.key === seg.key) + 1}/${sameRound.length}`
      : ''

  // Etiqueta corta para la tira de escritorio: "J6" (y "·2" si la jornada está partida).
  const shortLabel = (s: Segment) => {
    const n = (s.name.match(/\d+/) ?? ['?'])[0]
    const parts = segments.filter((x) => x.roundId === s.roundId)
    const pi = parts.length > 1 ? `·${parts.findIndex((x) => x.key === s.key) + 1}` : ''
    return `J${n}${pi}`
  }
  const go = (delta: number) => {
    const n = Math.min(Math.max(idx + delta, 0), segments.length - 1)
    if (n !== idx) onSelect(segments[n].key)
  }

  return (
    <>
      {/* Mobile */}
      <div className="flex items-center justify-between border-b border-line px-2 py-1.5 lg:hidden">
        <button
          disabled={idx <= 0}
          onClick={() => idx > 0 && onSelect(segments[idx - 1].key)}
          className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-ink-soft hover:bg-surface-2 disabled:opacity-25"
          aria-label="Jornada anterior"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Ant.
        </button>
        <span className="text-sm font-bold">
          {seg?.name ?? 'Jornada'}
          {partLabel && <span className="text-ink-faint">{partLabel}</span>}
        </span>
        <button
          disabled={idx >= segments.length - 1}
          onClick={() => idx < segments.length - 1 && onSelect(segments[idx + 1].key)}
          className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-ink-soft hover:bg-surface-2 disabled:opacity-25"
          aria-label="Jornada siguiente"
        >
          Sig.
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      {/* Desktop: tira horizontal de una fila con scroll + flechas */}
      <div className="hidden lg:flex lg:items-center lg:gap-2">
        <button
          onClick={() => go(-1)}
          disabled={idx <= 0}
          aria-label="Jornada anterior"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div
          role="tablist"
          aria-label="Jornadas"
          className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5"
        >
          {segments.map((s) => {
            const sel = s.key === selectedKey
            return (
              <button
                key={s.key}
                ref={sel ? selRef : undefined}
                role="tab"
                aria-selected={sel}
                aria-label={s.name}
                onClick={() => onSelect(s.key)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    go(1)
                  }
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    go(-1)
                  }
                }}
                className={`nums shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  sel ? 'grad-primary text-on-primary' : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {shortLabel(s)}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => go(1)}
          disabled={idx >= segments.length - 1}
          aria-label="Jornada siguiente"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </>
  )
}

const SECTION_ITEMS: { key: Section; label: string; emoji: string }[] = [
  { key: 'predicciones', label: 'Predicciones', emoji: '📝' },
  { key: 'ranking', label: 'Ranking', emoji: '🏆' },
  { key: 'cartas', label: 'Cartas', emoji: '🃏' },
]

/** Equivalente de escritorio del PoolNav móvil (oculto en lg): tabs con teclado. */
function SectionTabs({
  section,
  setSection,
  hasCard,
}: {
  section: Section
  setSection: (s: Section) => void
  hasCard: boolean
}) {
  const idx = SECTION_ITEMS.findIndex((it) => it.key === section)
  const go = (delta: number) => {
    const n = Math.min(Math.max(idx + delta, 0), SECTION_ITEMS.length - 1)
    if (n !== idx) setSection(SECTION_ITEMS[n].key)
  }
  return (
    <div role="tablist" aria-label="Secciones de la porra" className="flex gap-1 rounded-2xl bg-surface-2 p-1">
      {SECTION_ITEMS.map((it) => {
        const active = section === it.key
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            onClick={() => setSection(it.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault()
                go(1)
              }
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                go(-1)
              }
            }}
            className={`relative flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              active ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint hover:text-ink'
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">{it.emoji}</span>
            {it.label}
            {it.key === 'cartas' && hasCard && (
              <span className="h-2 w-2 rounded-full bg-primary" aria-label="Tienes carta disponible" />
            )}
          </button>
        )
      })}
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
    <div className="flex lg:hidden">
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
function fmtScorerMin(s: { m: number | null; x?: number | null }) {
  if (s.m == null) return ''
  return `${s.m}${s.x ? `+${s.x}` : ''}'`
}
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function PrediccionesSection({
  pool,
  round,
  matchIds,
}: {
  pool: PoolType
  round: Round | null
  matchIds: number[] | null
}) {
  const [matches, setMatches] = useState<Match[]>([])
  const [preds, setPreds] = useState<Record<number, Prediction>>({})
  const [inputs, setInputs] = useState<Record<number, { h: string; a: string }>>({})
  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [fin, setFin] = useState<Finalissima[]>([])
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [detail, setDetail] = useState<{ match: Match; copy: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()

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
      const [ps, vc, mem, prof, ff] = await Promise.all([
        getMyPredictions(pool.id, uid, ms.map((m) => m.id)),
        getVisibleCards(pool.id, round.id),
        getMembers(pool.id),
        getProfile(uid).catch(() => null),
        getFinalissima(pool.id, round.id).catch(() => [] as Finalissima[]),
      ])
      if (!alive) return
      setUserId(uid)
      setIsAdmin(!!prof?.is_admin)
      setMatches(ms)
      setPreds(ps)
      setCards(vc)
      setMembers(mem)
      setFin(ff)
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
          getFinalissima(pool.id, round.id).then(setFin).catch(() => {})
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

  async function toggleFinalissima(matchId: number) {
    if (!round || !userId) return
    const mine = fin.find((f) => f.user_id === userId)
    setStatus('saving')
    try {
      await setFinalissima(pool.id, round.id, mine?.match_id === matchId ? null : matchId)
      const rows = await getFinalissima(pool.id, round.id)
      setFin(rows)
      setStatus('saved')
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1600)
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  const cardsByMatch = useMemo(() => {
    const map: Record<number, Card[]> = {}
    for (const c of cards) if (c.status === 'PLAYED' && c.match_id) (map[c.match_id] ||= []).push(c)
    return map
  }, [cards])
  const myEspia = cards.find((c) => c.type === 'ESPIA' && c.status === 'PLAYED' && c.owner_id === userId)

  // FINALISSIMA visible por partido (RLS ya oculta las ajenas pre-pitido).
  const finByMatch = useMemo(() => {
    const map: Record<number, Finalissima[]> = {}
    for (const f of fin) (map[f.match_id] ||= []).push(f)
    return map
  }, [fin])
  const myFinMatchId = fin.find((f) => f.user_id === userId)?.match_id ?? null
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? '—'

  // Solo los partidos del segmento (jornada partida): el resto de la jornada
  // aparece en su propio segmento, en su fecha.
  const visibleMatches = useMemo(
    () => (matchIds ? matches.filter((m) => matchIds.includes(m.id)) : matches),
    [matches, matchIds],
  )
  const sentCount = useMemo(
    () => visibleMatches.filter((m) => preds[m.id]).length,
    [visibleMatches, preds],
  )

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
              {sentCount}
              <span className="text-white/50">/{visibleMatches.length}</span>
            </div>
            <div className="text-[10px] font-medium text-white/60">enviados</div>
          </div>
        </div>

        <div className={`divide-y divide-line ${theme === 'taberna' ? '' : 'xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3'}`}>
          {visibleMatches.map((m) => {
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
                isFinalissima={myFinMatchId === m.id}
                finalissimaNames={(finByMatch[m.id] ?? []).map((f) => nameOf(f.user_id))}
                onToggleFinalissima={() => toggleFinalissima(m.id)}
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
  const { theme } = useTheme()
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <TeamCrest src={crest} short={short} size={44} />
      <span className={`line-clamp-2 w-full text-center text-xs font-semibold leading-tight text-ink ${theme === 'taberna' ? 'uppercase tracking-wide' : ''}`}>{name}</span>
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
  const owner = members.find((m) => m.user_id === card.owner_id)?.display_name
  let label: string = meta.name
  if (card.type === 'BOMBA') label = 'Mina'
  if (target) label = target
  if (card.type === 'DOBLE') label = `${card.bet_points} pts`
  if (card.type === 'VAR' && card.var_home != null && card.var_away != null) {
    const score = `${card.var_home}–${card.var_away}`
    label = target && target !== owner ? `${score} a ${target}` : `${score} propio`
  }
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
  isFinalissima,
  finalissimaNames,
  onToggleFinalissima,
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
  isFinalissima: boolean
  finalissimaNames: string[]
  onToggleFinalissima: () => void
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
    <div className="px-4 py-4 xl:rounded-2xl xl:border xl:border-line xl:bg-surface/40">
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

      {editable ? (
        <div className="mt-2.5 flex justify-center">
          <button
            onClick={onToggleFinalissima}
            aria-pressed={isFinalissima}
            title="Designa este partido como FINALISSIMA: puntúa doble"
            className={`scoreboard inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              isFinalissima
                ? 'grad-gold border-transparent text-on-primary'
                : 'border-dashed border-line-strong text-ink-faint hover:border-primary hover:text-primary'
            }`}
          >
            ×2 Finalissima
          </button>
        </div>
      ) : (
        finalissimaNames.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {finalissimaNames.map((n) => (
              <span
                key={n}
                className="scoreboard inline-flex items-center gap-1 rounded-full bg-gold-dim px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gold"
              >
                ×2 {n}
              </span>
            ))}
          </div>
        )
      )}

      {match.scorers && match.scorers.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-3 text-[11px] leading-snug text-ink-soft">
          <div className="space-y-0.5">
            {match.scorers.filter((s) => s.t === 'home').map((s, i) => (
              <div key={i} className="truncate">
                <span className="text-ink-faint">⚽ {fmtScorerMin(s)}</span> {s.p}
              </div>
            ))}
          </div>
          <div className="space-y-0.5 text-right">
            {match.scorers.filter((s) => s.t === 'away').map((s, i) => (
              <div key={i} className="truncate">
                {s.p} <span className="text-ink-faint">{fmtScorerMin(s)} ⚽</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <span className="text-xs font-bold text-live">
                {paused ? 'descanso' : match.minute != null ? `min ${match.minute}'` : 'en juego'}
              </span>
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
  const [scope, setScope] = useState<'general' | 'jornada' | 'bote'>('general')
  const [general, setGeneral] = useState<Standing[] | null>(null)
  const [jornada, setJornada] = useState<Standing[] | null>(null)
  const [bote, setBote] = useState<BoteStanding[] | null>(null)
  const [profile, setProfile] = useState<{ userId: string; name: string; avatar: string | null } | null>(null)

  useEffect(() => {
    function load() {
      getStandings(pool.id).then(setGeneral).catch(() => setGeneral([]))
      getBote(pool.id).then(setBote).catch(() => setBote([]))
      if (round) getRoundStandings(pool.id, round.id).then(setJornada).catch(() => setJornada([]))
      else setJornada([])
    }
    load()
    const iv = setInterval(load, 30000) // refresco en vivo del ranking
    return () => clearInterval(iv)
  }, [pool.id, round?.id])

  const tab = (key: typeof scope, label: string) => (
    <button
      onClick={() => setScope(key)}
      className={`min-h-9 flex-1 rounded-xl px-1 text-sm font-bold transition-all ${scope === key ? 'bg-surface text-primary shadow-sm' : 'text-ink-faint'}`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-2xl bg-surface-2 p-1">
        {tab('general', 'General')}
        {tab('jornada', round?.name ?? 'Jornada')}
        {tab('bote', 'Bote')}
      </div>
      {scope === 'bote' ? (
        <BoteList rows={bote} onSelect={(r) => setProfile({ userId: r.user_id, name: r.display_name, avatar: r.avatar_url })} />
      ) : (
        <StandingsList
          rows={scope === 'general' ? general : jornada}
          showCards={scope === 'jornada'}
          onSelect={(r) => setProfile({ userId: r.user_id, name: r.display_name, avatar: r.avatar_url })}
        />
      )}

      {profile &&
        (() => {
          const idx = (general ?? []).findIndex((s) => s.user_id === profile.userId)
          return (
            <ProfileSheet
              poolId={pool.id}
              userId={profile.userId}
              displayName={profile.name}
              avatarUrl={profile.avatar}
              points={idx >= 0 ? general![idx].points : 0}
              rank={idx >= 0 ? idx + 1 : 0}
              exactPts={pool.points_exact}
              currentRoundId={round?.id ?? null}
              onClose={() => setProfile(null)}
            />
          )
        })()}
    </div>
  )
}

function fmtEuro(n: number) {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} €`
}

function BoteList({ rows, onSelect }: { rows: BoteStanding[] | null; onSelect?: (r: BoteStanding) => void }) {
  if (rows === null) {
    return <div className="flex justify-center py-12 text-ink-faint"><Spinner /></div>
  }
  const total = rows.reduce((s, r) => s + r.owed, 0)
  const debtors = rows.filter((r) => r.owed > 0)

  return (
    <div>
      <div className="ticket mb-3 overflow-hidden">
        <div className="grad-hero flex items-center justify-between px-4 py-3.5 text-white">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Bote acumulado</div>
            <h2 className="mt-0.5 text-lg text-white">El pozo de la porra</h2>
          </div>
          <div className="scoreboard rounded-xl bg-black/25 px-3 py-1.5 text-center">
            <div className="text-2xl leading-none">{fmtEuro(total)}</div>
            <div className="text-[10px] font-medium text-white/60">en juego</div>
          </div>
        </div>
        <p className="px-4 py-2.5 text-[11px] text-ink-faint">
          Al terminar cada jornada, el último paga 2 € y el penúltimo 1 €. En caso de empate se reparte el castigo.
        </p>
      </div>

      {debtors.length === 0 ? (
        <div className="ticket">
          <EmptyState title="El bote está a cero">
            Aún no ha terminado ninguna jornada con castigo. Cuando acabe, aquí verás quién paga.
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-2 lg:hidden">
            {rows.map((r) => {
              const owes = r.owed > 0
              return (
                <li
                  key={r.user_id}
                  onClick={() => onSelect?.(r)}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors active:brightness-110 hover:border-primary/40 ${owes ? 'border-loss/30 bg-loss/5' : 'border-line bg-surface'}`}
                >
                  <Avatar url={r.avatar_url} name={r.display_name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{r.display_name}</p>
                    <p className="nums text-xs text-ink-faint">
                      {owes ? `castigado en ${r.rounds_paid} jornada${r.rounds_paid === 1 ? '' : 's'}` : 'sin castigos'}
                    </p>
                  </div>
                  <span className={`scoreboard text-2xl ${owes ? 'text-loss' : 'text-ink-faint'}`}>{fmtEuro(r.owed)}</span>
                </li>
              )
            })}
          </ul>
          <table className="hidden lg:table w-full text-sm">
            <caption className="sr-only">Bote por jugador</caption>
            <thead>
              <tr className="text-xs text-ink-faint">
                <th className="text-left p-2 font-semibold">Jugador</th>
                <th className="text-right p-2 font-semibold">Debe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} onClick={() => onSelect?.(r)} className={`cursor-pointer border-t border-line hover:bg-surface-2 ${r.owed > 0 ? 'bg-loss/5' : ''}`}>
                  <td className="p-2">
                    <span className="flex items-center gap-2">
                      <Avatar url={r.avatar_url} name={r.display_name} size={26} />
                      <span className="truncate font-semibold">{r.display_name}</span>
                    </span>
                  </td>
                  <td className={`p-2 text-right scoreboard ${r.owed > 0 ? 'text-loss' : 'text-ink-faint'}`}>{fmtEuro(r.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

/** Chip con la carta de la jornada (null mientras está oculta o sin carta). */
function RoundCardChip({ type, played }: { type: string | null | undefined; played: boolean }) {
  if (!type) return null
  const meta = CARD_META[type as CardType]
  if (!meta) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
      <span>{meta.emoji}</span>
      {meta.name}
      {played && <span className="text-ink-faint">· jugada</span>}
    </span>
  )
}

function StandingsList({
  rows,
  showCards,
  onSelect,
}: {
  rows: Standing[] | null
  showCards?: boolean
  onSelect?: (r: Standing) => void
}) {
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
    <>
      <ul className="space-y-2 lg:hidden">
        {rows.map((r, i) => {
          const podium = i < 3
          return (
            <li
              key={r.user_id}
              onClick={() => onSelect?.(r)}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors active:brightness-110 hover:border-primary/40 ${i === 0 ? 'border-gold/40 bg-gold-dim' : 'border-line bg-surface'}`}
            >
              <span className={`grid w-7 shrink-0 place-items-center text-lg ${podium ? '' : 'nums text-sm font-bold text-ink-faint'}`}>
                {podium ? MEDAL[i] : i + 1}
              </span>
              <Avatar url={r.avatar_url} name={r.display_name} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.display_name}</p>
                <p className="nums text-xs text-ink-faint">{r.exacts} exactos · {r.partials} aciertos</p>
                {showCards && (
                  <p className="mt-1">
                    <RoundCardChip type={r.card_type} played={r.card_status === 'PLAYED'} />
                  </p>
                )}
              </div>
              <span className="scoreboard text-2xl text-primary">{r.points}</span>
            </li>
          )
        })}
      </ul>
      <table className="hidden lg:table w-full text-sm">
        <caption className="sr-only">Clasificación</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th className="text-left p-2 font-semibold">#</th>
            <th className="text-left p-2 font-semibold">Jugador</th>
            <th className="text-right p-2 font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} onClick={() => onSelect?.(r)} className={`cursor-pointer border-t border-line hover:bg-surface-2 ${i === 0 ? 'bg-gold-dim' : ''}`}>
              <td className="p-2 text-center">
                <span className={i < 3 ? 'text-base' : 'nums text-sm font-bold text-ink-faint'}>{i < 3 ? MEDAL[i] : i + 1}</span>
              </td>
              <td className="p-2">
                <span className="flex items-center gap-2">
                  <Avatar url={r.avatar_url} name={r.display_name} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold leading-none">{r.display_name}</span>
                    <span className="nums text-xs text-ink-faint">{r.exacts}E · {r.partials}A</span>
                    {showCards && r.card_type && (
                      <span className="mt-1 block">
                        <RoundCardChip type={r.card_type} played={r.card_status === 'PLAYED'} />
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td className="p-2 text-right scoreboard text-primary">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
