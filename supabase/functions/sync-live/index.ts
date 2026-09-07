// ============================================================
// Edge Function: sync-live  (fuente EN VIVO: ESPN, API pública)
// ------------------------------------------------------------
// ESPN sirve GRATIS, sin API key y sin límite conocido, todo lo necesario en
// UNA sola llamada por fecha:
//   GET .../soccer/esp.1/scoreboard?dates=YYYYMMDD
// -> todos los partidos de LaLiga de ese día con estado, minuto, marcador y
//    goleadores (details con scoringPlay). El team.id de cada gol es el equipo
//    BENEFICIADO (los goles en propia ya quedan bien atribuidos).
//
// Como el scoreboard de la fecha incluye también los partidos ya terminados
// (state 'post'), capturamos el resultado FINAL sin llamadas extra.
//
// Solo consultamos si hay algún partido en ventana de juego (comprobado en la
// BD, gratis). Escribe status/goals/ht/minute/live_status/scorers. Respeta
// manual_override. live_status se normaliza al vocabulario de la UI.
//
// Despliegue:  supabase functions deploy sync-live
// Secretos:    CRON_SECRET (el mismo que sync-fixtures; sin él responde 401).
// ESPN no requiere key.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// site.api.espn.com bloquea IPs de datacenter (403); site.web.api.espn.com no,
// y devuelve el mismo formato de scoreboard.
const ESPN = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}
function teamsMatch(oh: string, oa: string, eh: string, ea: string): boolean {
  const hit = (a: string, b: string) => a.includes(b) || b.includes(a) || a.slice(0, 4) === b.slice(0, 4)
  return hit(norm(oh), norm(eh)) && hit(norm(oa), norm(ea))
}
// "12'" -> {m:12}; "45'+2'" -> {m:45,x:2}; "90+3" -> {m:90,x:3}
function parseClock(v: string | undefined): { m: number | null; x: number | null } {
  if (!v) return { m: null, x: null }
  const mm = v.match(/(\d+)(?:['’]?\s*\+\s*(\d+))?/)
  if (!mm) return { m: null, x: null }
  return { m: Number(mm[1]), x: mm[2] ? Number(mm[2]) : null }
}
function ymd(t: number): string {
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, '')
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score: string
  team: { id: string; displayName: string }
}
interface EspnDetail {
  scoringPlay?: boolean
  clock?: { displayValue?: string }
  team?: { id: string }
  athletesInvolved?: { displayName: string }[]
  type?: { text?: string }
  ownGoal?: boolean
  penaltyKick?: boolean
}
interface EspnEvent {
  id: string
  date: string
  status: { type: { state: string; description?: string; shortDetail?: string }; displayClock?: string }
  competitions: { competitors: EspnCompetitor[]; details?: EspnDetail[] }[]
}

Deno.serve(async (req: Request) => {
  try {
    // Puerta anti-abuso: la anon key es pública, así que NO basta como
    // autenticación. Solo pg_cron (con el secreto en Vault) puede llamar.
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
      return new Response('Unauthorized', { status: 401 })
    }
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(url, serviceKey, { db: { schema: 'porra' } })
    const now = Date.now()

    // Candidatos: partidos en ventana de juego, no finalizados, sin override.
    const { data: cand } = await db
      .from('matches')
      .select('id, kickoff, home_team, away_team')
      .gte('kickoff', new Date(now - 180 * 60_000).toISOString())
      .lte('kickoff', new Date(now + 10 * 60_000).toISOString())
      .neq('status', 'FINISHED')
      .eq('manual_override', false)
    if (!cand || cand.length === 0) {
      return Response.json({ note: 'sin ventana de juego' })
    }

    // Fechas (UTC) a consultar (normalmente una sola).
    const dates = [...new Set(cand.map((c) => ymd(new Date(c.kickoff).getTime())))]
    const events: EspnEvent[] = []
    for (const d of dates) {
      const r = await fetch(`${ESPN}?dates=${d}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (!r.ok) continue
      const j = await r.json()
      for (const e of j.events ?? []) events.push(e)
    }

    const findEvent = (m: { kickoff: string; home_team: string; away_team: string }) => {
      const t = new Date(m.kickoff).getTime()
      const near = events.filter((e) => Math.abs(new Date(e.date).getTime() - t) < 90_000)
      if (near.length === 1) return near[0]
      return near.find((e) => {
        const c = e.competitions[0]
        const h = c.competitors.find((x) => x.homeAway === 'home')!
        const a = c.competitors.find((x) => x.homeAway === 'away')!
        return teamsMatch(m.home_team, m.away_team, h.team.displayName, a.team.displayName)
      })
    }

    let updated = 0
    for (const m of cand) {
      const e = findEvent(m)
      if (!e) continue
      const c = e.competitions[0]
      const home = c.competitors.find((x) => x.homeAway === 'home')!
      const away = c.competitors.find((x) => x.homeAway === 'away')!
      const state = e.status.type.state // pre | in | post
      const desc = (e.status.type.description ?? '').toLowerCase()
      const short = e.status.type.shortDetail ?? ''
      // OJO: "Second Half" también contiene "half"; el descanso es exactamente
      // "Halftime" / "HT".
      const paused = desc === 'halftime' || /^ht$/i.test(short.trim())

      let status: 'SCHEDULED' | 'LIVE' | 'FINISHED' = 'SCHEDULED'
      let live_status = 'TIMED'
      if (state === 'post') {
        status = 'FINISHED'
        live_status = 'FINISHED'
      } else if (state === 'in') {
        status = 'LIVE'
        live_status = paused ? 'PAUSED' : 'IN_PLAY'
      }

      const clk = parseClock(e.status.displayClock || short)
      const minute = state === 'in' && !paused ? clk.m : state === 'in' && paused ? 45 : null

      // Goleadores (details.scoringPlay). team.id = equipo beneficiado.
      const scorers = (c.details ?? [])
        .filter((d) => d.scoringPlay)
        .map((d) => {
          const mm = parseClock(d.clock?.displayValue)
          return {
            t: String(d.team?.id) === String(home.team.id) ? 'home' : 'away',
            p: d.athletesInvolved?.[0]?.displayName ?? '—',
            m: mm.m,
            x: mm.x,
            d: d.type?.text ?? (d.ownGoal ? 'Own Goal' : d.penaltyKick ? 'Penalty' : undefined),
          }
        })
      // Marcador al descanso = goles hasta el minuto 45 (incl. añadido de 1ª parte).
      let htHome: number | null = null
      let htAway: number | null = null
      if (scorers.length > 0 && (state === 'in' || state === 'post')) {
        htHome = scorers.filter((s) => s.t === 'home' && (s.m ?? 99) <= 45).length
        htAway = scorers.filter((s) => s.t === 'away' && (s.m ?? 99) <= 45).length
      }

      const homeGoals = home.score !== '' ? Number(home.score) : null
      const awayGoals = away.score !== '' ? Number(away.score) : null

      const { error } = await db
        .from('matches')
        .update({
          status,
          home_goals: homeGoals,
          away_goals: awayGoals,
          ht_home: htHome,
          ht_away: htAway,
          minute,
          live_status,
          scorers: scorers.length ? scorers : null,
        })
        .eq('id', m.id)
        .eq('manual_override', false)
      if (!error) updated++
    }

    return Response.json({ candidates: cand.length, events: events.length, updated })
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
})
