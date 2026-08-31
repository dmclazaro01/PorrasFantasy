// ============================================================
// Edge Function: sync-live  (fuente EN VIVO: API-Football / api-sports.io)
// ------------------------------------------------------------
// El plan gratuito de football-data.org no da marcadores en directo, así que
// para el DIRECTO usamos API-Football:
//   - GET /fixtures?live=all  -> partidos en juego (marcador + minuto).
//   - GET /fixtures?id=<id>   -> estado/resultado de un partido concreto
//                                (para capturar el FINAL al salir de "en vivo").
// El plan gratis solo permite estos dos endpoints para la temporada actual
// (100 req/día), así que SOLO gastamos petición si hay algún partido en ventana
// de juego. El mapeo con nuestros partidos es por timestamp de kickoff (ambas
// fuentes coinciden al minuto) y, si hay empate, por nombre de equipo.
//
// Escribe status/goals/ht/minute/live_status. Respeta manual_override.
// live_status se NORMALIZA al vocabulario de la UI (IN_PLAY/PAUSED/FINISHED).
//
// Despliegue:
//   supabase functions deploy sync-live
//   supabase secrets set API_FOOTBALL_KEY=xxxxx
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AF_BASE = 'https://v3.football.api-sports.io'
const LALIGA = 140 // id de LaLiga en API-Football

// Estado corto de API-Football -> enum de partido de la app.
function mapStatus(short: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'HT', 'INT', 'SUSP'].includes(short)) return 'LIVE'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED'
  if (['PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'POSTPONED'
  return 'SCHEDULED' // NS, TBD
}
// live_status normalizado a lo que ya entiende la UI (DESCANSO = PAUSED).
function liveStatus(short: string): string {
  if (['HT', 'BT', 'INT', 'SUSP'].includes(short)) return 'PAUSED'
  if (['1H', '2H', 'ET', 'P', 'LIVE'].includes(short)) return 'IN_PLAY'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED'
  return short
}

// Normaliza nombre de equipo para desempatar mapeos (Barça/Barcelona, etc.).
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos
    .replace(/[^a-z0-9]/g, '')
}
function teamsMatch(ourHome: string, ourAway: string, afHome: string, afAway: string): boolean {
  const oh = norm(ourHome), oa = norm(ourAway), ah = norm(afHome), aa = norm(afAway)
  const hit = (a: string, b: string) => a.includes(b) || b.includes(a) || a.slice(0, 4) === b.slice(0, 4)
  return hit(oh, ah) && hit(oa, aa)
}

interface AfFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } }
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
  score: { halftime: { home: number | null; away: number | null } }
}

Deno.serve(async (_req: Request) => {
  try {
    const key = Deno.env.get('API_FOOTBALL_KEY')
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!key) return new Response('Missing API_FOOTBALL_KEY', { status: 500 })
    const db = createClient(url, serviceKey, { db: { schema: 'porra' } })
    const headers = { 'x-apisports-key': key }

    // 1) ¿Hay partidos en ventana de juego? (kickoff-10min .. kickoff+180min)
    const now = Date.now()
    const { data: cand } = await db
      .from('matches')
      .select('id, kickoff, status, af_fixture_id, home_team, away_team')
      .gte('kickoff', new Date(now - 180 * 60_000).toISOString())
      .lte('kickoff', new Date(now + 10 * 60_000).toISOString())
      .neq('status', 'FINISHED')
      .eq('manual_override', false)
    if (!cand || cand.length === 0) {
      return Response.json({ note: 'sin ventana de juego', updated: 0 })
    }

    // 2) Partidos en vivo (una sola petición).
    const liveRes = await fetch(`${AF_BASE}/fixtures?live=all`, { headers })
    if (!liveRes.ok) return new Response(`API-Football ${liveRes.status}`, { status: 502 })
    const liveJson = await liveRes.json()
    const live: AfFixture[] = (liveJson.response ?? []).filter(
      (f: { league?: { id: number } }) => f.league?.id === LALIGA,
    )

    const findOur = (f: AfFixture) => {
      // por af_fixture_id ya guardado
      let m = cand.find((c) => c.af_fixture_id === f.fixture.id)
      if (m) return m
      // por timestamp de kickoff (al minuto)
      const t = new Date(f.fixture.date).getTime()
      const same = cand.filter((c) => Math.abs(new Date(c.kickoff).getTime() - t) < 90_000)
      if (same.length === 1) return same[0]
      return same.find((c) => teamsMatch(c.home_team, c.away_team, f.teams.home.name, f.teams.away.name))
    }

    let updated = 0
    const seen = new Set<number>()
    for (const f of live) {
      const m = findOur(f)
      if (!m) continue
      seen.add(m.id)
      const { error } = await db
        .from('matches')
        .update({
          af_fixture_id: f.fixture.id,
          status: mapStatus(f.fixture.status.short),
          home_goals: f.goals.home,
          away_goals: f.goals.away,
          ht_home: f.score.halftime.home,
          ht_away: f.score.halftime.away,
          minute: f.fixture.status.elapsed,
          live_status: liveStatus(f.fixture.status.short),
        })
        .eq('id', m.id)
        .eq('manual_override', false)
      if (!error) updated++
    }

    // 3) Candidatos que ya NO están en vivo pero cuyo kickoff es antiguo (~han
    //    terminado): consultamos su resultado final por id (si lo conocemos).
    let finalized = 0
    for (const m of cand) {
      if (seen.has(m.id)) continue
      if (!m.af_fixture_id) continue // nunca lo vimos en vivo: no tenemos su id
      if (now - new Date(m.kickoff).getTime() < 100 * 60_000) continue // aún no puede haber acabado
      const r = await fetch(`${AF_BASE}/fixtures?id=${m.af_fixture_id}`, { headers })
      if (!r.ok) continue
      const f: AfFixture | undefined = (await r.json()).response?.[0]
      if (!f) continue
      const { error } = await db
        .from('matches')
        .update({
          status: mapStatus(f.fixture.status.short),
          home_goals: f.goals.home,
          away_goals: f.goals.away,
          ht_home: f.score.halftime.home,
          ht_away: f.score.halftime.away,
          minute: f.fixture.status.elapsed,
          live_status: liveStatus(f.fixture.status.short),
        })
        .eq('id', m.id)
        .eq('manual_override', false)
      if (!error && mapStatus(f.fixture.status.short) === 'FINISHED') finalized++
    }

    return Response.json({ candidates: cand.length, liveLaLiga: live.length, updated, finalized })
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
})
