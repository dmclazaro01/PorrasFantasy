// ============================================================
// Importador de partidos: football-data.org -> Supabase (schema porra)
// ------------------------------------------------------------
// Importa una jornada de LaLiga (calendario + resultados) y la deja
// lista para pronosticar. Re-ejecutarlo REFRESCA resultados (upsert),
// y el trigger de Postgres recalcula los puntos al finalizar.
//
// Uso (PowerShell):
//   $env:FOOTBALL_DATA_TOKEN="xxx"
//   $env:SUPABASE_URL="https://xxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="xxx"
//   node scripts/import-fixtures.mjs [matchday]
//
// Sin [matchday]: importa la próxima jornada abierta (min matchday SCHEDULED).
// ============================================================

import { createClient } from '@supabase/supabase-js'

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FD_COMPETITION = process.env.FD_COMPETITION || 'PD' // Primera Division
const COMP_NAME = process.env.COMP_NAME || 'LaLiga'

if (!FD_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan variables: FOOTBALL_DATA_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'porra' } })

async function fd(path) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { 'X-Auth-Token': FD_TOKEN },
  })
  if (!res.ok) throw new Error(`football-data ${res.status}: ${await res.text()}`)
  return res.json()
}

// football-data status -> nuestro enum
function mapStatus(s) {
  if (['IN_PLAY', 'PAUSED'].includes(s)) return 'LIVE'
  if (s === 'FINISHED') return 'FINISHED'
  if (['POSTPONED', 'SUSPENDED', 'CANCELLED'].includes(s)) return 'POSTPONED'
  return 'SCHEDULED'
}

async function main() {
  // 1) Competición en nuestra BD
  const { data: comp, error: cErr } = await db
    .from('competitions')
    .select('id, name')
    .eq('name', COMP_NAME)
    .maybeSingle()
  if (cErr) throw cErr
  if (!comp) throw new Error(`No existe la competición "${COMP_NAME}" en porra.competitions`)

  // 2) Jornada objetivo
  let matchday = Number(process.argv[2])
  if (!matchday) {
    const sched = await fd(`/competitions/${FD_COMPETITION}/matches?status=SCHEDULED`)
    const mds = (sched.matches || []).map((m) => m.matchday).filter(Boolean)
    if (mds.length === 0) throw new Error('No hay partidos SCHEDULED')
    matchday = Math.min(...mds)
  }
  console.log(`Importando ${COMP_NAME} · Jornada ${matchday} ...`)

  // 3) Partidos de esa jornada
  const data = await fd(`/competitions/${FD_COMPETITION}/matches?matchday=${matchday}`)
  const matches = data.matches || []
  if (matches.length === 0) throw new Error(`La jornada ${matchday} no tiene partidos`)

  // 4) Upsert de la jornada (round)
  const deadline = matches
    .map((m) => m.utcDate)
    .sort()[0] // primer kickoff
  const roundName = `Jornada ${matchday}`
  let roundId
  const { data: existing } = await db
    .from('rounds')
    .select('id')
    .eq('competition_id', comp.id)
    .eq('name', roundName)
    .maybeSingle()
  if (existing) {
    roundId = existing.id
    await db.from('rounds').update({ deadline }).eq('id', roundId)
  } else {
    const { data: ins, error } = await db
      .from('rounds')
      .insert({ competition_id: comp.id, name: roundName, deadline })
      .select('id')
      .single()
    if (error) throw error
    roundId = ins.id
  }

  // 5) Upsert de partidos
  const rows = matches.map((m) => ({
    round_id: roundId,
    api_fixture_id: m.id,
    home_team: m.homeTeam.shortName || m.homeTeam.name,
    away_team: m.awayTeam.shortName || m.awayTeam.name,
    home_short: m.homeTeam.tla,
    away_short: m.awayTeam.tla,
    home_crest: m.homeTeam.crest ?? null,
    away_crest: m.awayTeam.crest ?? null,
    kickoff: m.utcDate,
    status: mapStatus(m.status),
    home_goals: m.score?.fullTime?.home ?? null,
    away_goals: m.score?.fullTime?.away ?? null,
    ht_home: m.score?.halfTime?.home ?? null,
    ht_away: m.score?.halfTime?.away ?? null,
    live_status: m.status,
    is_knockout: false,
  }))
  const { error: upErr } = await db
    .from('matches')
    .upsert(rows, { onConflict: 'api_fixture_id' })
  if (upErr) throw upErr

  console.log(`OK · jornada ${matchday}: ${rows.length} partidos importados/actualizados.`)
  const fin = rows.filter((r) => r.status === 'FINISHED').length
  console.log(`   (${fin} finalizados, ${rows.length - fin} pendientes)`)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
