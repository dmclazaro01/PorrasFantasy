# Porra Fantasy ⚽

Porra de fútbol **privada** entre amigos, autoalojable y barata. Un clon funcional de
[laporra.app](https://laporra.app) pensado para lanzarlo tú mismo y que **nunca se caiga**.

- **Pronósticos por jornada** con resultado exacto, ocultos hasta el pitido inicial.
- **Marcador en vivo** (casi en tiempo real) durante los partidos.
- **Puntuación automática** al finalizar: **3 pts** por acertar 1·X·2, **8 pts** por resultado exacto.
- **Ranking** por sala, en tiempo real.
- Salas privadas con código de invitación. Cero anuncios, cero cuentas de pago.

## Stack

| Capa | Tecnología | Coste |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind v4 (SPA) | 0 € (Cloudflare Pages / Vercel) |
| Backend / BD / Auth / Realtime | Supabase (Postgres + RLS + Realtime) | 0 € (free tier) |
| Calendario + escudos (LaLiga) | football-data.org (1 petición/día basta) | 0 € (10 req/min) |
| Marcador en vivo + goleadores | ESPN scoreboard (API pública) | 0 € (sin key, sin cuota) |
| Cron de sincronización | 2 Edge Functions + pg_cron | incluido |

Diseño guiado por las skills **hallmark** (anti-AI-slop) y **frontend-design**, con una
identidad propia anclada al tema: la estética de **boleto de quiniela** (1·X·2, cifras de
marcador monoespaciadas, sellos de puntos).

## Arquitectura

```
  Navegador (React SPA)
        │  supabase-js (auth + queries + realtime)
        ▼
  ┌──────────────── Supabase ────────────────┐
  │  Postgres  ──  RLS  ──  Realtime          │
  │    ▲                            ▲          │
  │    │ calendario (service_role)   │ vivo (service_role)
  │  sync-fixtures ◄── pg_cron      sync-live ◄── pg_cron
  │    │ (1-2/día)                   │ (cada ~1 min en partido)
  └────┼────────────────────────────┼─────────┘
       │ fetch                      │ fetch
       ▼                            ▼
  football-data.org            ESPN scoreboard
  (jornadas+escudos)           (estado, minuto, goles)
```

El **auto-cálculo** vive en la base de datos: cuando un partido pasa a `FINISHED`
(lo marca `sync-live`, o `sync-fixtures` como respaldo), el trigger `trg_match_change`
recalcula los puntos de todos los pronósticos de ese partido (respetando la config de
puntos de cada sala). Ver `supabase/migrations/0002_scoring.sql`.

## Puesta en marcha (resumen)

1. **Frontend** (funciona ya en modo demo, sin backend):
   ```bash
   npm install
   npm run dev
   ```
2. **Backend**: crea un proyecto en [supabase.com](https://supabase.com), ejecuta las
   migraciones de `supabase/migrations/` y configura la Edge Function.
   👉 Pasos detallados en [`supabase/README.md`](supabase/README.md).
3. Copia `.env.example` → `.env.local` con tu `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Estado del proyecto

- [x] Scaffold Vite + React + Tailwind, sistema de diseño (tokens hallmark)
- [x] Esquema de BD: salas, miembros, jornadas, partidos, pronósticos
- [x] Puntuación automática 3/8 (función + trigger) y vista de clasificación
- [x] RLS: pronósticos ocultos hasta el kickoff; salas privadas por código
- [x] Pantallas conectadas: login (email + contraseña), mis salas, crear/unirse, boleto, ranking
- [x] Crear grupo con selector de competición (LaLiga)
- [x] Importador puntual de calendario desde football-data.org (`scripts/import-fixtures.mjs`)
- [x] Edge Functions desplegadas: `sync-fixtures` (calendario, football-data) + `sync-live`
      (en vivo: minuto, goles y goleadores desde ESPN, sin key) + pg_cron
- [x] Verificado end-to-end (auth, RLS, pronósticos, puntuación, ranking)
- [x] Despliegue del frontend en Vercel para acceso desde el móvil (+ versión escritorio)
- [x] Panel admin (corregir marcador a mano como respaldo ante datos colgados)
- [ ] Realtime en el frontend (hoy se refresca por polling cada 30 s sin recargar)

## Coste estimado

**0 €/mes** para un grupo de amigos: todo cabe en los free tiers de Supabase, Vercel,
football-data.org y ESPN (pública, sin cuota). Sin límites de tráfico realistas para
decenas de usuarios.

## Seguridad y abuso (el dominio es público)

**Público por diseño** (no son fugas): la URL de Supabase, la `anon key` (va embebida
en el JS del frontend) y el proxy `/sb` de `vercel.json`. La defensa real es RLS:
los pronósticos ajenos son invisibles hasta el kickoff, las salas exigen código de
invitación (6 hex ≈ 16,7 M de combinaciones, y cada intento requiere cuenta) y la
`service_role` solo existe en el servidor (Edge Functions) y en tu `.env.local`.

**¿Pueden gastarte dinero o tumbarlo?** Con todo en free tier **sin tarjeta no hay
cargos posibles**: el peor caso es degradación del servicio, no factura. Vectores:

1. **Registro masivo de cuentas** — llena `auth.users` y gasta el cupo de emails/MAU.
   Mitigación: confirmación por correo **siempre ON** + captcha (Turnstile) en
   Supabase Auth. Ver checklist en `supabase/README.md`.
2. **Flood a `/sb`** — cada petición consume CPU/egress del free tier (500 MB BD,
   5 GB egress). Sostenido, pausa el proyecto. Mitigación: Cloudflare delante con
   rate limiting si el repo se hace popular; Vercel *Attack Challenge Mode*.
3. **Invocar `sync-fixtures`/`sync-live`** — blindadas con `CRON_SECRET` en cabecera
   (la anon key sola devuelve 401), secreto en Vault para pg_cron. Sin esto,
   cualquiera quemaría tu cuota de football-data (10 req/min).
4. **Fuerza bruta de códigos** — los códigos (6 hex) solo los leen los miembros
   (RLS) y `join_pool` admite 20 intentos / 10 min por usuario (migración `0023`):
   barrer el espacio llevaría años. Requiere que la confirmación por correo siga ON.

Si algún día metes tarjeta (Pro / pay-as-you-go), activa antes límites de gasto y
alertas en Supabase y Vercel: ahí sí un flood podría facturar.

## Nota legal

Réplica funcional para uso **privado y no comercial**. No usa el código, la marca ni los assets
de laporra.app. Los datos deportivos provienen de una API de terceros bajo su plan gratuito
(uso no comercial). No revender ni monetizar.
