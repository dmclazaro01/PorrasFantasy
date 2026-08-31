// ============================================================
// Edge Function: sync-live  (fuente EN VIVO: API-Football / api-sports.io)
// ------------------------------------------------------------
// El plan gratuito de football-data.org no da marcadores en directo. Para el
// DIRECTO usamos API-Football:
//   - GET /fixtures?live=all          -> marcador + minuto de los que se juegan
//   - GET /fixtures/events?fixture=id -> goleadores (solo cuando cambia el marcador)
//   - GET /fixtures?id=id             -> resultado FINAL al salir de "en vivo"
//
// PRESUPUESTO (≈100 req/día en el plan gratis): la función corre cada minuto
// (cron) pero SOLO gasta peticiones si hay algún partido en ventana de juego, y
// reparte el gasto del día:
//   - Cuenta los partidos de hoy (N) para fijar un intervalo adaptativo entre
//     sondeos (pocos partidos -> casi en tiempo real; muchos -> más espaciado).
//   - Los goleadores solo se piden cuando cambia el marcador (≈1 llamada/gol).
//   - Tope duro diario (DAILY_CAP) por seguridad; si se alcanza, degrada a
//     football-data/override manual el resto del día.
//
// Escribe status/goals/ht/minute/live_status/scorers. Respeta manual_override.
// live_status se normaliza al vocabulario de la UI (IN_PLAY/PAUSED/FINISHED).
//
// Despliegue:
//   supabase functions deploy sync-live
//   supabase secrets set API_FOOTBALL_KEY=xxxxx
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AF_BASE = 'https://v3.football.api-sports.io'
const LALIGA = 140
const DAILY_CAP = 90 // margen bajo el límite de 100/día

function mapStatus(short: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'HT', 'INT', 'SUSP'].includes(short)) return 'LIVE'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED'
  if (['PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'POSTPONED'
  return 'SCHEDULED'
}
function liveStatus(short: string): string {
  if (['HT', 'BT', 'INT', 'SUSP'].includes(short)) return 'PAUSED'
  if (['1H', '2H', 'ET', 'P', 'LIVE'].includes(short)) return 'IN_PLAY'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED'
  return short
}
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}
function teamsMatch(oh: string, oa: string, ah: string, aa: string): boolean {
  const hit = (a: string, b: string) => a.includes(b) || b.includes(a) || a.slice(0, 4) === b.slice(0, 4)
  return hit(norm(oh), norm(ah)) && hit(norm(oa), norm(aa))
}

interface AfFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } }
  teams: { home: { id: number; name: string }; away: { id: number; name: string } }
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
    const now = Date.now()

    // ---- Presupuesto diario ----
    const today = new Date(now).toISOString().slice(0, 10)
    const { data: st } = await db.from('sync_state').select('*').eq('id', 1).maybeSingle()
    let calls = st && st.day === today ? (st.calls ?? 0) : 0
    const lastLive = st?.last_live_ts ? new Date(st.last_live_ts).getTime() : 0

    const save = (patch: Record<string, unknown>) =>
      db.from('sync_state').update({ day: today, calls, ...patch }).eq('id', 1)

    if (calls >= DAILY_CAP) {
      await save({})
      return Response.json({ note: 'tope diario alcanzado', calls })
    }

    // ---- Partidos de HOY (para calcular el intervalo adaptativo) ----
    const dayStart = `${today}T00:00:00Z`
    const dayEnd = `${today}T23:59:59Z`
    const { data: todays } = await db
      .from('matches')
      .select('id, kickoff, status, manual_override')
      .gte('kickoff', dayStart)
      .lte('kickoff', dayEnd)
    const N = (todays ?? []).length
    if (N === 0) {
      await save({})
      return Response.json({ note: 'sin partidos hoy' })
    }
    const kos = (todays ?? []).map((m) => new Date(m.kickoff).getTime())
    const minKO = Math.min(...kos)
    const maxEnd = Math.max(...kos) + 130 * 60_000
    const anyPending = (todays ?? []).some((m) => m.status !== 'FINISHED' && !m.manual_override)
    // ¿Estamos en ventana con posibilidad de juego?
    if (now < minKO - 2 * 60_000 || now > maxEnd || !anyPending) {
      await save({})
      return Response.json({ note: 'fuera de ventana de juego', N })
    }

    // Intervalo adaptativo entre sondeos en vivo (minutos).
    const liveBudget = Math.max(8, 70 - 5 * N)
    const windowMin = (maxEnd - minKO) / 60_000
    const interval = Math.min(15, Math.max(2, Math.round(windowMin / liveBudget)))
    if (now - lastLive < interval * 60_000) {
      await save({})
      return Response.json({ note: 'throttle', interval, N })
    }

    // ---- Candidatos: partidos en ventana de juego, no finalizados ----
    const { data: cand } = await db
      .from('matches')
      .select('id, kickoff, status, af_fixture_id, home_team, away_team, home_goals, away_goals, scorers')
      .gte('kickoff', new Date(now - 180 * 60_000).toISOString())
      .lte('kickoff', new Date(now + 10 * 60_000).toISOString())
      .neq('status', 'FINISHED')
      .eq('manual_override', false)
    if (!cand || cand.length === 0) {
      await save({ last_live_ts: new Date(now).toISOString() })
      return Response.json({ note: 'sin candidatos' })
    }

    // ---- Sondeo en vivo (1 petición) ----
    const liveRes = await fetch(`${AF_BASE}/fixtures?live=all`, { headers })
    calls++
    if (!liveRes.ok) {
      await save({ last_live_ts: new Date(now).toISOString() })
      return new Response(`API-Football ${liveRes.status}`, { status: 502 })
    }
    const live: AfFixture[] = ((await liveRes.json()).response ?? []).filter(
      (f: { league?: { id: number } }) => f.league?.id === LALIGA,
    )

    const findOur = (f: AfFixture) => {
      let m = cand.find((c) => c.af_fixture_id === f.fixture.id)
      if (m) return m
      const t = new Date(f.fixture.date).getTime()
      const same = cand.filter((c) => Math.abs(new Date(c.kickoff).getTime() - t) < 90_000)
      if (same.length === 1) return same[0]
      return same.find((c) => teamsMatch(c.home_team, c.away_team, f.teams.home.name, f.teams.away.name))
    }

    // Goleadores: /fixtures/events (solo si cambió el marcador o faltan).
    const fetchScorers = async (f: AfFixture, matchDbId: number) => {
      if (calls >= DAILY_CAP) return
      const r = await fetch(`${AF_BASE}/fixtures/events?fixture=${f.fixture.id}`, { headers })
      calls++
      if (!r.ok) return
      const evs = (await r.json()).response ?? []
      const scorers = evs
        .filter((e: { type: string }) => e.type === 'Goal')
        .map((e: { team: { id: number }; player: { name: string }; time: { elapsed: number | null; extra: number | null }; detail: string }) => ({
          t: e.team.id === f.teams.home.id ? 'home' : 'away',
          p: e.player?.name ?? '—',
          m: e.time?.elapsed ?? null,
          x: e.time?.extra ?? null,
          d: e.detail,
        }))
      await db.from('matches').update({ scorers }).eq('id', matchDbId).eq('manual_override', false)
    }

    let updated = 0
    let goalsFetched = 0
    const seen = new Set<number>()
    for (const f of live) {
      const m = findOur(f)
      if (!m) continue
      seen.add(m.id)
      await db
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
      updated++
      const oldTotal = (m.home_goals ?? 0) + (m.away_goals ?? 0)
      const newTotal = (f.goals.home ?? 0) + (f.goals.away ?? 0)
      if (newTotal > 0 && (newTotal !== oldTotal || m.scorers == null)) {
        await fetchScorers(f, m.id)
        goalsFetched++
      }
    }

    // ---- Partidos empezados que NO están en la lista de "en vivo" (por id) ----
    // El feed gratuito ?live=all es intermitente, así que para un partido ya
    // empezado que no aparezca lo consultamos por id: sirve para refrescar el
    // marcador y para capturar el FINAL cuando termina.
    let finalized = 0
    for (const m of cand) {
      if (seen.has(m.id)) continue
      if (!m.af_fixture_id) continue
      if (new Date(m.kickoff).getTime() > now) continue // aún no ha empezado
      if (calls >= DAILY_CAP) break
      const r = await fetch(`${AF_BASE}/fixtures?id=${m.af_fixture_id}`, { headers })
      calls++
      if (!r.ok) continue
      const f: AfFixture | undefined = (await r.json()).response?.[0]
      if (!f) continue
      await db
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
      const newTotal = (f.goals.home ?? 0) + (f.goals.away ?? 0)
      const oldTotal = (m.home_goals ?? 0) + (m.away_goals ?? 0)
      if (newTotal > 0 && (newTotal !== oldTotal || m.scorers == null)) await fetchScorers(f, m.id)
      if (mapStatus(f.fixture.status.short) === 'FINISHED') finalized++
    }

    await save({ last_live_ts: new Date(now).toISOString() })
    return Response.json({ N, interval, liveLaLiga: live.length, updated, goalsFetched, finalized, calls })
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
})
