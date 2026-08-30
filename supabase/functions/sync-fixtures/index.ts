// ============================================================
// Edge Function: sync-fixtures  (fuente: football-data.org)
// ------------------------------------------------------------
// Refresca estado + marcador de los partidos de LaLiga YA importados
// (no crea partidos nuevos: eso lo hace scripts/import-fixtures.mjs,
//  que fija el round_id). Al pasar a FINISHED, el trigger de Postgres
// recalcula los puntos.
//
// Se ejecuta con service_role (ignora RLS). NUNCA exponer esa key.
//
// Despliegue:
//   supabase functions deploy sync-fixtures
//   supabase secrets set FOOTBALL_DATA_TOKEN=xxxxx
//
// Programacion: pg_cron cada ~1-2 min en ventana de partido
// (ver supabase/README.md).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FD_BASE = 'https://api.football-data.org/v4'
const COMPETITION = 'PD' // Primera Division

interface FdMatch {
  id: number
  status: string
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

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (_req: Request) => {
  try {
    const token = Deno.env.get('FOOTBALL_DATA_TOKEN')
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!token) return new Response('Missing FOOTBALL_DATA_TOKEN', { status: 500 })

    const db = createClient(url, serviceKey, { db: { schema: 'porra' } })

    // Ventana: ayer y hoy (captura partidos en juego y los que acaban de terminar).
    const now = new Date()
    const from = ymd(new Date(now.getTime() - 24 * 3600_000))
    const to = ymd(now)

    const res = await fetch(
      `${FD_BASE}/competitions/${COMPETITION}/matches?dateFrom=${from}&dateTo=${to}`,
      { headers: { 'X-Auth-Token': token } },
    )
    if (!res.ok) return new Response(`football-data ${res.status}`, { status: 502 })
    const json = await res.json()
    const matches: FdMatch[] = json.matches ?? []

    let updated = 0
    for (const m of matches) {
      // UPDATE only: no insertamos partidos sin round_id.
      const { error } = await db
        .from('matches')
        .update({
          status: mapStatus(m.status),
          home_goals: m.score?.fullTime?.home ?? null,
          away_goals: m.score?.fullTime?.away ?? null,
          ht_home: m.score?.halfTime?.home ?? null,
          ht_away: m.score?.halfTime?.away ?? null,
          live_status: m.status,
        })
        .eq('api_fixture_id', m.id)
      if (!error) updated++
    }

    return Response.json({ checked: matches.length, updated })
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
})
