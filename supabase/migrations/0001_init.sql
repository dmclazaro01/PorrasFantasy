-- ============================================================
-- Porra Fantasy · 0001 · Esquema base (aislado en schema "porra")
-- ============================================================
-- Todo vive en el schema `porra` para NO colisionar ni interferir
-- con otras tablas del mismo proyecto Supabase (p.ej. Porra-Infelices
-- en `public`). Requiere Postgres 15+.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists porra;

-- ---------- Tipos ----------
do $$ begin
  create type porra.match_status as enum ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED');
exception when duplicate_object then null; end $$;

-- ---------- Perfiles (extiende auth.users) ----------
create table if not exists porra.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- ---------- Competiciones ----------
create table if not exists porra.competitions (
  id             bigint generated always as identity primary key,
  name           text not null,
  api_league_id  int,                 -- id de liga en API-Football
  season         int,
  created_at     timestamptz not null default now(),
  unique (api_league_id, season)
);

-- ---------- Jornadas ----------
create table if not exists porra.rounds (
  id              bigint generated always as identity primary key,
  competition_id  bigint not null references porra.competitions (id) on delete cascade,
  name            text not null,       -- "Jornada 3"
  deadline        timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists rounds_competition_idx on porra.rounds (competition_id);

-- ---------- Partidos ----------
create table if not exists porra.matches (
  id              bigint generated always as identity primary key,
  round_id        bigint not null references porra.rounds (id) on delete cascade,
  api_fixture_id  bigint unique,
  home_team       text not null,
  away_team       text not null,
  home_short      text,
  away_short      text,
  kickoff         timestamptz not null,
  status          porra.match_status not null default 'SCHEDULED',
  home_goals      int,
  away_goals      int,
  is_knockout     boolean not null default false,
  updated_at      timestamptz not null default now()
);
create index if not exists matches_round_idx on porra.matches (round_id);
create index if not exists matches_kickoff_idx on porra.matches (kickoff);

-- ---------- Salas (porras) ----------
create or replace function porra.gen_invite_code()
returns text language sql volatile as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create table if not exists porra.pools (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  invite_code     text not null unique default porra.gen_invite_code(),
  owner_id        uuid not null references porra.profiles (id) on delete cascade,
  competition_id  bigint references porra.competitions (id) on delete set null,
  points_1x2      int not null default 3,
  points_exact    int not null default 8,
  created_at      timestamptz not null default now()
);
create index if not exists pools_owner_idx on porra.pools (owner_id);

-- ---------- Miembros de sala ----------
create table if not exists porra.pool_members (
  pool_id    uuid not null references porra.pools (id) on delete cascade,
  user_id    uuid not null references porra.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (pool_id, user_id)
);
create index if not exists pool_members_user_idx on porra.pool_members (user_id);

-- ---------- Pronosticos ----------
create table if not exists porra.predictions (
  id          bigint generated always as identity primary key,
  pool_id     uuid not null references porra.pools (id) on delete cascade,
  user_id     uuid not null references porra.profiles (id) on delete cascade,
  match_id    bigint not null references porra.matches (id) on delete cascade,
  pred_home   int not null check (pred_home >= 0 and pred_home <= 99),
  pred_away   int not null check (pred_away >= 0 and pred_away <= 99),
  points      int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (pool_id, user_id, match_id)
);
create index if not exists predictions_pool_user_idx on porra.predictions (pool_id, user_id);
create index if not exists predictions_match_idx on porra.predictions (match_id);

-- ---------- updated_at generico ----------
create or replace function porra.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_matches_touch on porra.matches;
create trigger trg_matches_touch before update on porra.matches
  for each row execute function porra.touch_updated_at();
