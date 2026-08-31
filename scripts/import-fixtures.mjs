// ============================================================
// Importador de partidos: football-data.org -> Supabase (schema porra)
// ------------------------------------------------------------
// Importa el calendario de LaLiga (jornadas + partidos + resultados) y lo
// deja listo para pronosticar. Re-ejecutarlo REFRESCA resultados (upsert),
// y el trigger de Postgres recalcula los puntos al finalizar.
//
// Uso (PowerShell):
//   $env:FOOTBALL_DATA_TOKEN="xxx"
//   $env:SUPABASE_URL="https://xxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="xxx"
//   node scripts/import-fixtures.mjs            # TODA la temporada (recomendado)
//   node scripts/import-fixtures.mjs 6          # solo la jornada 6
//
// Importar la temporada entera es UNA sola petición a football-data y crea
// todas las jornadas, de modo que los partidos adelantados/aplazados de
// cualquier jornada quedan disponibles para pronosticar en su jornada real.
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

  // 2) Partidos a importar: una jornada concreta (arg) o TODA la temporada.
  const onlyMatchday = Number(process.argv[2]) || null
  const query = onlyMatchday ? `?matchday=${onlyMatchday}` : ''
  const data = await fd(`/competitions/${FD_COMPETITION}/matches${query}`)
  // Solo liga regular con jornada numerada (descarta amistosos/otras fases).
  const matches = (data.matches || []).filter((m) => Number.isInteger(m.matchday))
  if (matches.length === 0) throw new Error('No hay partidos para importar')

  // 3) Agrupar por jornada y hacer upsert de cada round (deadline = 1er kickoff).
  const byMatchday = new Map()
  for (const m of matches) {
    if (!byMatchday.has(m.matchday)) byMatchday.set(m.matchday, [])
    byMatchday.get(m.matchday).push(m)
  }
  const roundIdByMatchday = new Map()
  for (const [md, ms] of [...byMatchday.entries()].sort((a, b) => a[0] - b[0])) {
    const deadline = ms.map((m) => m.utcDate).sort()[0]
    const roundName = `Jornada ${md}`
    const { data: existing } = await db
      .from('rounds')
      .select('id')
      .eq('competition_id', comp.id)
      .eq('name', roundName)
      .maybeSingle()
    let roundId
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
    roundIdByMatchday.set(md, roundId)
  }

  // 4) Partidos ya corregidos a mano: no pisar su marcador/estado.
  const { data: overriddenRows } = await db
    .from('matches')
    .select('api_fixture_id')
    .eq('manual_override', true)
  const overridden = new Set((overriddenRows ?? []).map((r) => r.api_fixture_id))

  // 5a) Upsert de datos de CALENDARIO (siempre): crea partidos nuevos y
  //     refresca horario/round por si un partido se adelanta o aplaza.
  const scheduleRows = matches.map((m) => ({
    round_id: roundIdByMatchday.get(m.matchday),
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
  const { error: schErr } = await db
    .from('matches')
    .upsert(scheduleRows, { onConflict: 'api_fixture_id' })
  if (schErr) throw schErr

  // 5b) Upsert de RESULTADO/ESTADO solo para los NO corregidos a mano.
  const resultRows = matches
    .filter((m) => !overridden.has(m.id))
    .map((m) => ({
      api_fixture_id: m.id,
      status: mapStatus(m.status),
      home_goals: m.score?.fullTime?.home ?? null,
      away_goals: m.score?.fullTime?.away ?? null,
      ht_home: m.score?.halfTime?.home ?? null,
      ht_away: m.score?.halfTime?.away ?? null,
      live_status: m.status,
    }))
  if (resultRows.length > 0) {
    const { error: resErr } = await db
      .from('matches')
      .upsert(resultRows, { onConflict: 'api_fixture_id' })
    if (resErr) throw resErr
  }

  const scope = onlyMatchday ? `jornada ${onlyMatchday}` : `temporada completa (${byMatchday.size} jornadas)`
  const fin = matches.filter((m) => mapStatus(m.status) === 'FINISHED').length
  console.log(`OK · ${scope}: ${matches.length} partidos (${fin} finalizados, ${matches.length - fin} pendientes).`)
  if (overridden.size) console.log(`   (${overridden.size} con override manual: no se tocó su marcador)`)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
