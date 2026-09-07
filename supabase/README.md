# Backend (Supabase) — estado y puesta en marcha

Todo el backend vive en un **esquema propio `porra`** (aislado del resto del proyecto).

Fuentes de datos (ambas gratis):
- **Calendario + escudos**: football-data.org (temporada actual de LaLiga, 10 req/min,
  requiere token). Se usa de forma puntual: basta 1 petición al día.
- **En vivo (minuto, marcador, goleadores)**: ESPN scoreboard (API pública, sin key
  y sin cuota conocida). Es la única fuente en directo.

## Qué hay desplegado

- **Esquema `porra`**: tablas + vistas (`pool_standings`, `pool_round_standings`,
  `pool_bote`…) — ver `migrations/` (`0001`..`0022`, aplicar en orden).
- **RLS**: pronósticos ocultos hasta el kickoff; salas privadas por código.
- **Puntuación 3/8** automática (trigger `trg_match_change` al finalizar un partido).
- **Edge Function `sync-fixtures`**: sincroniza el calendario completo desde
  football-data (crea jornadas/partidos que falten, rellena finales pendientes).
- **Edge Function `sync-live`**: escribe estado en directo desde ESPN (solo actúa
  en ventana de partido; respeta `manual_override`).
- **pg_cron**: `sync-fixtures` 1-2 veces al día, `sync-live` cada ~1 min en partido.

## Recrear desde cero (en otro proyecto)

1. **Migraciones** — ejecuta `migrations/0001`..`0022` en orden en el SQL Editor
   (o `supabase db push`). `setup.sql` es una foto antigua (solo hasta `0004`).
2. **Exponer el esquema** — Settings → API → *Exposed schemas* → añade `porra`.
3. **Importar el calendario** — con las variables de entorno puestas:
   ```bash
   node scripts/import-fixtures.mjs        # temporada entera (una sola petición)
   ```
   Variables: `FOOTBALL_DATA_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Edge Functions + cron (refresco automático)

```bash
# Desplegar las funciones
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase functions deploy sync-fixtures --project-ref TU_REF
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase functions deploy sync-live --project-ref TU_REF

# Secret (solo lo necesita sync-fixtures). SUPABASE_URL / SERVICE_ROLE_KEY
# los inyecta Supabase solo; sync-live no requiere ningún secreto.
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase secrets set FOOTBALL_DATA_TOKEN=xxx --project-ref TU_REF
```

Programación con pg_cron (SQL Editor). Usa la **anon key** en la cabecera (las funciones
tienen `verify_jwt` activo; la anon key es pública y basta para pasar la verificación):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Calendario: 1-2 veces al día basta (football-data tiene cuota).
select cron.schedule('sync-fixtures', '0 6,18 * * *', $job$
  select net.http_post(
    url := 'https://TU_REF.supabase.co/functions/v1/sync-fixtures',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer TU_ANON_KEY'
    )
  );
$job$);

-- En vivo: cada minuto (ESPN no tiene cuota; la función se auto-salта
-- si no hay ningún partido en ventana de juego).
select cron.schedule('sync-live', '* * * * *', $job$
  select net.http_post(
    url := 'https://TU_REF.supabase.co/functions/v1/sync-live',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer TU_ANON_KEY'
    )
  );
$job$);
```

- Cambiar la frecuencia: edita el cron (`*/5 * * * *` = cada 5 min, etc.).
- Ver ejecuciones: `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='sync-live') order by start_time desc;`
- Parar: `select cron.unschedule('sync-live');`

> ⚠️ **Endurecer (recomendado)**: con `verify_jwt` + anon key, cualquiera que lea la
> anon del JS puede invocar estas funciones y quemar tu cuota de football-data.
> Protege ambas con un secreto propio (`CRON_SECRET` comprobado en la función y
> guardado en Vault para pg_cron). Ver "Seguridad y abuso" en el README principal.

## Auth

Authentication → Providers → *Email* activado (email + contraseña, con confirmación
por correo). El perfil se crea de forma perezosa al crear/unirse a una porra
(`porra.ensure_profile`), sin trigger sobre `auth.users`.

## Modelo de datos (resumen)

- `profiles` — usuarios (extiende `auth.users`)
- `competitions` → `rounds` (jornadas) → `matches` (partidos)
- `pools` (salas, `points_1x2` / `points_exact` configurables) · `pool_members`
- `predictions` — pronósticos (únicos por sala+usuario+partido), `points` se rellena solo
- `pool_standings` (vista) — clasificación por sala
