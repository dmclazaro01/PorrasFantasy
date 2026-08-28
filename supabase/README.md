# Backend (Supabase) — estado y puesta en marcha

Todo el backend vive en un **esquema propio `porra`** (aislado del resto del proyecto).
Fuente de datos: **football-data.org** (gratis, cubre LaLiga temporada actual, 10 req/min).

## Qué hay desplegado

- **Esquema `porra`**: 7 tablas + vista `pool_standings` (ver `migrations/`).
- **RLS**: pronósticos ocultos hasta el kickoff; salas privadas por código.
- **Puntuación 3/8** automática (trigger `trg_match_change` al finalizar un partido).
- **Edge Function `sync-fixtures`**: refresca estado + marcador desde football-data.
- **pg_cron**: llama a `sync-fixtures` cada 2 minutos (job `sync-fixtures`).

## Recrear desde cero (en otro proyecto)

1. **Migraciones** — pega `setup.sql` en el SQL Editor (o ejecuta `migrations/0001..0004`),
   luego `grant_service_role.sql`.
2. **Exponer el esquema** — Settings → API → *Exposed schemas* → añade `porra`.
3. **Importar una jornada** — con las variables de entorno puestas:
   ```bash
   node scripts/import-fixtures.mjs        # próxima jornada abierta
   node scripts/import-fixtures.mjs 4      # una jornada concreta
   ```
   Variables: `FOOTBALL_DATA_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Edge Function + cron (refresco automático de resultados)

```bash
# Desplegar la función
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase functions deploy sync-fixtures --project-ref TU_REF

# Secret (el token de football-data). SUPABASE_URL / SERVICE_ROLE_KEY los inyecta Supabase solo.
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase secrets set FOOTBALL_DATA_TOKEN=xxx --project-ref TU_REF
```

Programación con pg_cron (SQL Editor). Usa la **anon key** en la cabecera (la función tiene
`verify_jwt` activo; la anon key es pública y basta para pasar la verificación):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('sync-fixtures', '*/2 * * * *', $job$
  select net.http_post(
    url := 'https://TU_REF.supabase.co/functions/v1/sync-fixtures',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer TU_ANON_KEY'
    )
  );
$job$);
```

- Cambiar la frecuencia: edita el cron (`*/5 * * * *` = cada 5 min, etc.).
- Ver ejecuciones: `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='sync-fixtures') order by start_time desc;`
- Parar: `select cron.unschedule('sync-fixtures');`

## Auth

Authentication → Providers → *Email* activado (magic link). El perfil se crea de forma perezosa
al crear/unirse a una porra (`porra.ensure_profile`), sin trigger sobre `auth.users`.

## Modelo de datos (resumen)

- `profiles` — usuarios (extiende `auth.users`)
- `competitions` → `rounds` (jornadas) → `matches` (partidos)
- `pools` (salas, `points_1x2` / `points_exact` configurables) · `pool_members`
- `predictions` — pronósticos (únicos por sala+usuario+partido), `points` se rellena solo
- `pool_standings` (vista) — clasificación por sala
