// ============================================================
// Edge Function: sync-fixtures  (fuente: football-data.org)
// ------------------------------------------------------------
// Mantiene TODO el calendario de LaLiga sincronizado: crea jornadas y
// partidos que falten (incluidos adelantados/aplazados de cualquier
// jornada) y refresca su horario, estado y marcador. Los partidos
// corregidos a mano (manual_override) conservan su marcador/estado.
// Al pasar a FINISHED, el trigger de Postgres recalcula los puntos.
//
// Se ejecuta con service_role (ignora RLS). NUNCA exponer esa key.
//
// Despliegue:
//   supabase functions deploy sync-fixtures
//   supabase secrets set FOOTBALL_DATA_TOKEN=xxxxx
//
// Programacion: pg_cron cada ~1-2 min en ventana de partido
// (ver supabase/README.md). Una sola peticion a football-data por ejecucion.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FD_BASE = 'https://api.football-data.org/v4'
const COMPETITION = 'PD' // Primera Division
const COMP_NAME = 'LaLiga'

interface FdTeam {
  name: string
  shortName?: string
  tla?: string
  crest?: string | null
}
interface FdMatch {
  id: number
  matchday: number | null
  utcDate: string
  status: string
  homeTeam: FdTeam
  awayTeam: FdTeam
  score?: {
    fullTime?: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
  }
}

function mapStatus(s: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (['IN_PLAY', 'PAUSED'].includes(s)) return 'LIVE'
  if (s === 'FINISHED') return 'FINISHED'
  if (['POSTPONED', 'SUSPENDED', 'CANCELLED'].includes(s)) return 'POSTPONED'
  return 'SCHEDULED'
}

Deno.serve(async (_req: Request) => {
  try {
    const token = Deno.env.get('FOOTBALL_DATA_TOKEN')
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!token) return new Response('Missing FOOTBALL_DATA_TOKEN', { status: 500 })

    const db = createClient(url, serviceKey, { db: { schema: 'porra' } })

    // Competición interna.
    const { data: comp } = await db
      .from('competitions')
      .select('id')
      .eq('name', COMP_NAME)
      .maybeSingle()
    if (!comp) return new Response(`Competición ${COMP_NAME} no encontrada`, { status: 500 })

    // Calendario completo de la temporada (una sola petición).
    const res = await fetch(`${FD_BASE}/competitions/${COMPETITION}/matches`, {
      headers: { 'X-Auth-Token': token },
    })
    if (!res.ok) return new Response(`football-data ${res.status}`, { status: 502 })
    const json = await res.json()
    const matches: FdMatch[] = (json.matches ?? []).filter(
      (m: FdMatch) => Number.isInteger(m.matchday),
    )

    // Jornadas: upsert (deadline = primer kickoff de la jornada).
    const byMatchday = new Map<number, FdMatch[]>()
    for (const m of matches) {
      const md = m.matchday as number
      if (!byMatchday.has(md)) byMatchday.set(md, [])
      byMatchday.get(md)!.push(m)
    }
    const roundIdByMatchday = new Map<number, number>()
    for (const [md, ms] of [...byMatchday.entries()].sort((a, b) => a[0] - b[0])) {
      const deadline = ms.map((m) => m.utcDate).sort()[0]
      const roundName = `Jornada ${md}`
      const { data: existing } = await db
        .from('rounds')
        .select('id')
        .eq('competition_id', comp.id)
        .eq('name', roundName)
        .maybeSingle()
      if (existing) {
        roundIdByMatchday.set(md, existing.id)
        await db.from('rounds').update({ deadline }).eq('id', existing.id)
      } else {
        const { data: ins, error } = await db
          .from('rounds')
          .insert({ competition_id: comp.id, name: roundName, deadline })
          .select('id')
          .single()
        if (!error && ins) roundIdByMatchday.set(md, ins.id)
      }
    }

    // Estado actual en BD por partido (para no pisar directo/finales).
    const { data: existingRows } = await db
      .from('matches')
      .select('api_fixture_id, status, manual_override')
    const existing = new Map(
      (existingRows ?? []).map((r) => [r.api_fixture_id, r]),
    )

    // Calendario (siempre): crea partidos nuevos y refresca horario/jornada.
    const scheduleRows = matches
      .filter((m) => roundIdByMatchday.has(m.matchday as number))
      .map((m) => ({
        round_id: roundIdByMatchday.get(m.matchday as number),
        api_fixture_id: m.id,
        home_team: m.homeTeam.shortName || m.homeTeam.name,
        away_team: m.awayTeam.shortName || m.awayTeam.name,
        home_short: m.homeTeam.tla,
        away_short: m.awayTeam.tla,
        home_crest: m.homeTeam.crest ?? null,
        away_crest: m.awayTeam.crest ?? null,
        kickoff: m.utcDate,
        is_knockout: false,
      }))
    if (scheduleRows.length) {
      await db.from('matches').upsert(scheduleRows, { onConflict: 'api_fixture_id' })
    }

    // Resultado/estado: football-data NO es la fuente en vivo (la lleva
    // sync-live/API-Football). Aquí solo RELLENAMOS finales que falten, sin
    // pisar nunca datos en directo/finales ya presentes: escribimos únicamente
    // cuando football-data marca FINISHED y en BD el partido sigue SCHEDULED
    // (y no está corregido a mano). Así el cron de calendario nunca revierte un
    // marcador en vivo a SCHEDULED/null.
    const resultRows = matches
      .filter((m) => {
        const ex = existing.get(m.id)
        return (
          mapStatus(m.status) === 'FINISHED' &&
          ex &&
          ex.status === 'SCHEDULED' &&
          !ex.manual_override
        )
      })
      .map((m) => ({
        api_fixture_id: m.id,
        status: 'FINISHED',
        home_goals: m.score?.fullTime?.home ?? null,
        away_goals: m.score?.fullTime?.away ?? null,
        ht_home: m.score?.halfTime?.home ?? null,
        ht_away: m.score?.halfTime?.away ?? null,
        live_status: 'FINISHED',
      }))
    if (resultRows.length) {
      await db.from('matches').upsert(resultRows, { onConflict: 'api_fixture_id' })
    }

    return Response.json({
      rounds: roundIdByMatchday.size,
      matches: matches.length,
      backfilledFinals: resultRows.length,
    })
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
})
