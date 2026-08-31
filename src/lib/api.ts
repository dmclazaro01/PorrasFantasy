import { supabase } from './supabase'

export interface Competition {
  id: number
  name: string
  api_league_id: number | null
  season: number | null
}

export interface Pool {
  id: string
  name: string
  invite_code: string
  owner_id: string
  competition_id: number | null
  points_1x2: number
  points_exact: number
  created_at: string
}

export interface Standing {
  pool_id: string
  user_id: string
  display_name: string
  avatar_url: string | null
  points: number
  graded: number
  exacts: number
  partials: number
}

export async function listCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listMyPools(): Promise<Pool[]> {
  // RLS ya limita a las salas donde soy miembro.
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPool(id: string): Promise<Pool | null> {
  const { data, error } = await supabase.from('pools').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createPool(input: {
  name: string
  competition_id: number | null
  points_1x2?: number
  points_exact?: number
}): Promise<Pool> {
  const { data, error } = await supabase.rpc('create_pool', {
    p_name: input.name,
    p_competition: input.competition_id,
    p_points_1x2: input.points_1x2 ?? 3,
    p_points_exact: input.points_exact ?? 8,
  })
  if (error) throw error
  return data as Pool
}

export async function joinPool(code: string): Promise<Pool> {
  const { data, error } = await supabase.rpc('join_pool', { p_code: code })
  if (error) throw error
  return data as Pool
}

export async function getStandings(poolId: string): Promise<Standing[]> {
  const { data, error } = await supabase
    .from('pool_standings')
    .select('*')
    .eq('pool_id', poolId)
    .order('points', { ascending: false })
  if (error) throw error
  return (data ?? []) as Standing[]
}

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED'

export interface Round {
  id: number
  competition_id: number
  name: string
  deadline: string | null
}

export interface Scorer {
  t: 'home' | 'away'
  p: string
  m: number | null
  x?: number | null
  d?: string
}

export interface Match {
  id: number
  round_id: number
  home_team: string
  away_team: string
  home_short: string | null
  away_short: string | null
  home_crest: string | null
  away_crest: string | null
  kickoff: string
  status: MatchStatus
  home_goals: number | null
  away_goals: number | null
  ht_home: number | null
  ht_away: number | null
  live_status: string | null
  minute: number | null
  scorers: Scorer[] | null
  is_knockout: boolean
}

export interface Prediction {
  id?: number
  match_id: number
  pred_home: number
  pred_away: number
  points: number | null
}

export async function getLatestRound(competitionId: number): Promise<Round | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('competition_id', competitionId)
    .order('deadline', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Jornada en curso (la del partido no finalizado más próximo). null si todas acabaron. */
export async function getCurrentRoundId(competitionId: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('current_round_id', { p_comp: competitionId })
  if (error) throw error
  return (data as number | null) ?? null
}

export async function listRounds(competitionId: number): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('competition_id', competitionId)
    .order('deadline', { ascending: true, nullsFirst: true })
  if (error) throw error
  // Orden CRONOLÓGICO (por deadline = primer kickoff de la jornada), no por
  // número: si un partido de la J6 se adelanta al jueves antes de la J4, la
  // barra avanza J3 → J6 → J4, igual que el orden real en que se juegan.
  return (data ?? []) as Round[]
}

export async function getMatches(roundId: number): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('round_id', roundId)
    .order('kickoff')
  if (error) throw error
  return (data ?? []) as Match[]
}

// ---------------- Segmentos (jornadas partidas por fecha) ----------------
// Una jornada puede tener partidos muy separados en el tiempo (p. ej. un
// adelantado un jueves y el resto dos semanas después). Para la navegación y la
// vista partimos cada jornada en "segmentos" por cercanía de fechas: así solo
// se ven los partidos inminentes, y el resto de esa jornada aparece luego en su
// fecha normal. La puntuación NO cambia: cada partido sigue en su jornada real.

export interface MatchMeta {
  id: number
  round_id: number
  kickoff: string
  status: MatchStatus
}

export interface Segment {
  key: string
  roundId: number
  name: string
  deadline: string
  matchIds: number[]
}

export async function listMatchMeta(roundIds: number[]): Promise<MatchMeta[]> {
  if (roundIds.length === 0) return []
  const { data, error } = await supabase
    .from('matches')
    .select('id, round_id, kickoff, status')
    .in('round_id', roundIds)
    .order('kickoff', { ascending: true })
  if (error) throw error
  return (data ?? []) as MatchMeta[]
}

const SEGMENT_GAP_MS = 4 * 24 * 3600_000 // >4 días entre partidos parte la jornada

export function buildSegments(rounds: Round[], metas: MatchMeta[]): Segment[] {
  const byRound = new Map<number, MatchMeta[]>()
  for (const m of metas) {
    if (!byRound.has(m.round_id)) byRound.set(m.round_id, [])
    byRound.get(m.round_id)!.push(m)
  }
  const segs: Segment[] = []
  for (const r of rounds) {
    const ms = (byRound.get(r.id) ?? []).slice().sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
    )
    if (ms.length === 0) {
      segs.push({ key: `${r.id}:0`, roundId: r.id, name: r.name, deadline: r.deadline ?? '', matchIds: [] })
      continue
    }
    let cluster: MatchMeta[] = [ms[0]]
    let ci = 0
    const flush = () =>
      segs.push({
        key: `${r.id}:${ci}`,
        roundId: r.id,
        name: r.name,
        deadline: cluster[0].kickoff,
        matchIds: cluster.map((x) => x.id),
      })
    for (let i = 1; i < ms.length; i++) {
      if (new Date(ms[i].kickoff).getTime() - new Date(ms[i - 1].kickoff).getTime() > SEGMENT_GAP_MS) {
        flush()
        ci++
        cluster = [ms[i]]
      } else {
        cluster.push(ms[i])
      }
    }
    flush()
  }
  // Orden cronológico por primer partido del segmento (deadline vacío al final).
  return segs.sort((a, b) => (a.deadline || '￿').localeCompare(b.deadline || '￿'))
}

/** Segmento "en curso": el que contiene el próximo partido por jugarse. */
export function currentSegmentKey(segments: Segment[], metas: MatchMeta[]): string {
  const now = Date.now()
  const upcoming = metas
    .filter((m) => m.status !== 'FINISHED' && new Date(m.kickoff).getTime() >= now - 3 * 3600_000)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0]
  if (upcoming) {
    const seg = segments.find((s) => s.matchIds.includes(upcoming.id))
    if (seg) return seg.key
  }
  return segments[segments.length - 1]?.key ?? ''
}

export async function getMyPredictions(
  poolId: string,
  userId: string,
  matchIds: number[],
): Promise<Record<number, Prediction>> {
  if (matchIds.length === 0 || !userId) return {}
  // IMPORTANTE: filtrar por user_id. El RLS revela predicciones ajenas tras el
  // kickoff, así que SIN este filtro se mezclarían con las del propio usuario.
  const { data, error } = await supabase
    .from('predictions')
    .select('id, match_id, pred_home, pred_away, points')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .in('match_id', matchIds)
  if (error) throw error
  const map: Record<number, Prediction> = {}
  for (const p of data ?? []) map[(p as Prediction).match_id] = p as Prediction
  return map
}

export async function savePrediction(
  poolId: string,
  userId: string,
  matchId: number,
  home: number,
  away: number,
): Promise<void> {
  const { error } = await supabase.from('predictions').upsert(
    {
      pool_id: poolId,
      user_id: userId,
      match_id: matchId,
      pred_home: home,
      pred_away: away,
    },
    { onConflict: 'pool_id,user_id,match_id' },
  )
  if (error) throw error
}

export async function countMembers(poolId: string): Promise<number> {
  const { count, error } = await supabase
    .from('pool_members')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', poolId)
  if (error) throw error
  return count ?? 0
}

// ---------------- Perfil ----------------

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function adminSetMatch(
  matchId: number,
  home: number,
  away: number,
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED',
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_match', {
    p_match: matchId,
    p_home: home,
    p_away: away,
    p_status: status,
  })
  if (error) throw error
}

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; avatar_url?: string | null },
): Promise<void> {
  // upsert por si el perfil aún no existe (usuario que no ha creado/unido porra)
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' })
  if (error) throw error
}

// ---------------- Clasificación por jornada ----------------

export async function getRoundStandings(poolId: string, roundId: number): Promise<Standing[]> {
  const { data, error } = await supabase
    .from('pool_round_standings')
    .select('*')
    .eq('pool_id', poolId)
    .eq('round_id', roundId)
    .order('points', { ascending: false })
  if (error) throw error
  return (data ?? []) as Standing[]
}

// ---------------- Cartas ----------------

export type CardType = 'BOMBA' | 'ROJA' | 'LESION' | 'ESPIA' | 'PRENSA' | 'DOBLE'

export interface Card {
  id: number
  pool_id: string
  round_id: number
  owner_id: string
  type: CardType
  status: 'GRANTED' | 'PLAYED'
  match_id: number | null
  target_user_id: string | null
  bet_points: number | null
}

export interface Member {
  user_id: string
  display_name: string
  avatar_url: string | null
}

export async function ensureMyCard(poolId: string, roundId: number): Promise<Card | null> {
  const { data, error } = await supabase.rpc('ensure_my_card', { p_pool: poolId, p_round: roundId })
  if (error) throw error
  return (data ?? null) as Card | null
}

export async function playCard(input: {
  cardId: number
  matchId: number
  targetUserId?: string | null
  bet?: number | null
}): Promise<Card> {
  const { data, error } = await supabase.rpc('play_card', {
    p_card: input.cardId,
    p_match: input.matchId,
    p_target: input.targetUserId ?? null,
    p_bet: input.bet ?? null,
  })
  if (error) throw error
  return data as Card
}

/** Cartas visibles para el usuario en la jornada (propias + destapadas). */
export async function getVisibleCards(poolId: string, roundId: number): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('pool_id', poolId)
    .eq('round_id', roundId)
  if (error) throw error
  return (data ?? []) as Card[]
}

export interface MatchPrediction {
  user_id: string
  pred_home: number
  pred_away: number
  points: number | null
}

/** Predicciones de un partido visibles para el usuario (RLS: propio / tras kickoff / prensa / espía). */
export async function getMatchPredictions(poolId: string, matchId: number): Promise<MatchPrediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, pred_home, pred_away, points')
    .eq('pool_id', poolId)
    .eq('match_id', matchId)
  if (error) throw error
  return (data ?? []) as MatchPrediction[]
}

export async function getMembers(poolId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('pool_members')
    .select('user_id, profiles(display_name, avatar_url)')
    .eq('pool_id', poolId)
  if (error) throw error
  return (data ?? []).map((r) => {
    const prof = (r as { profiles: { display_name?: string; avatar_url?: string | null } | null }).profiles
    return {
      user_id: (r as { user_id: string }).user_id,
      display_name: prof?.display_name ?? '—',
      avatar_url: prof?.avatar_url ?? null,
    }
  })
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/avatar_${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
