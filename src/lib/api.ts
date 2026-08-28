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

export interface Match {
  id: number
  round_id: number
  home_team: string
  away_team: string
  home_short: string | null
  away_short: string | null
  kickoff: string
  status: MatchStatus
  home_goals: number | null
  away_goals: number | null
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

export async function getMatches(roundId: number): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('round_id', roundId)
    .order('kickoff')
  if (error) throw error
  return (data ?? []) as Match[]
}

export async function getMyPredictions(
  poolId: string,
  matchIds: number[],
): Promise<Record<number, Prediction>> {
  if (matchIds.length === 0) return {}
  const { data, error } = await supabase
    .from('predictions')
    .select('id, match_id, pred_home, pred_away, points')
    .eq('pool_id', poolId)
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
