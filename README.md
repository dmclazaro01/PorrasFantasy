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
| Datos de partidos + marcador vivo | football-data.org (LaLiga actual) | 0 € (10 req/min) |
| Cron de sincronización | Edge Function + pg_cron | incluido |

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
  │    ▲                                       │
  │    │ upsert (service_role)                 │
  │  Edge Function: sync-fixtures              │◄── pg_cron (cada ~1 min en partido)
  │    │                                       │
  └────┼───────────────────────────────────────┘
       │ fetch
       ▼
  API-Football (estado + goles en vivo)
```

El **auto-cálculo** vive en la base de datos: cuando `sync-fixtures` marca un partido como
`FINISHED`, el trigger `trg_match_change` recalcula los puntos de todos los pronósticos de ese
partido (respetando la config de puntos de cada sala). Ver `supabase/migrations/0002_scoring.sql`.

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
- [x] Pantallas conectadas: login (magic link), mis salas, crear/unirse, boleto, ranking
- [x] Crear grupo con selector de competición (LaLiga)
- [x] Importador de jornadas desde football-data.org (`scripts/import-fixtures.mjs`)
- [x] Edge Function `sync-fixtures` desplegada + pg_cron cada 2 min (resultados automáticos)
- [x] Verificado end-to-end (auth, RLS, pronósticos, puntuación, ranking)
- [ ] Realtime en el frontend (que el marcador/ranking se refresquen solos sin recargar)
- [ ] Despliegue del frontend (Cloudflare Pages / Vercel) para acceso desde el móvil
- [ ] Panel admin opcional (editar marcador a mano como respaldo)

## Coste estimado

**0 €/mes** para un grupo de amigos: todo cabe en los free tiers de Supabase, Cloudflare/Vercel
y API-Football. Sin límites de tráfico realistas para decenas de usuarios.

## Nota legal

Réplica funcional para uso **privado y no comercial**. No usa el código, la marca ni los assets
de laporra.app. Los datos deportivos provienen de una API de terceros bajo su plan gratuito
(uso no comercial). No revender ni monetizar.
