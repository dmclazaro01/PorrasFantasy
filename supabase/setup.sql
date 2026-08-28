-- Porra Fantasy · setup completo (schema porra) · 0001+0002+0003+0004
-- Pega en Supabase SQL Editor y Run, o via Management API.

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

-- ============================================================
-- Porra Fantasy · 0002 · Puntuacion automatica (schema "porra")
-- ============================================================
-- Aciertas 1·X·2 -> 3 pts ; resultado exacto -> 8 pts (sustituye).
-- Configurable por sala en porra.pools.points_1x2 / points_exact.
-- ============================================================

create or replace function porra.score_prediction(
  ph int, pa int, gh int, ga int, p_1x2 int, p_exact int
) returns int language sql immutable as $$
  select case
    when ph is null or pa is null or gh is null or ga is null then 0
    when ph = gh and pa = ga then p_exact
    when sign(ph - pa) = sign(gh - ga) then p_1x2
    else 0
  end;
$$;

create or replace function porra.on_match_change()
returns trigger language plpgsql security definer set search_path = porra, public as $$
begin
  if new.status = 'FINISHED'
     and new.home_goals is not null
     and new.away_goals is not null then
    update porra.predictions pr
    set points = porra.score_prediction(
          pr.pred_home, pr.pred_away,
          new.home_goals, new.away_goals,
          po.points_1x2, po.points_exact),
        updated_at = now()
    from porra.pools po
    where pr.match_id = new.id and po.id = pr.pool_id;
  else
    update porra.predictions
    set points = null, updated_at = now()
    where match_id = new.id and points is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_match_change on porra.matches;
create trigger trg_match_change
  after update of status, home_goals, away_goals on porra.matches
  for each row execute function porra.on_match_change();

create or replace function porra.recalc_match(p_match_id bigint)
returns void language plpgsql security definer set search_path = porra, public as $$
declare m porra.matches;
begin
  select * into m from porra.matches where id = p_match_id;
  if m.id is null then return; end if;
  if m.status = 'FINISHED' and m.home_goals is not null and m.away_goals is not null then
    update porra.predictions pr
    set points = porra.score_prediction(
          pr.pred_home, pr.pred_away, m.home_goals, m.away_goals,
          po.points_1x2, po.points_exact),
        updated_at = now()
    from porra.pools po
    where pr.match_id = m.id and po.id = pr.pool_id;
  else
    update porra.predictions set points = null, updated_at = now()
    where match_id = m.id and points is not null;
  end if;
end;
$$;

-- ---------- Clasificacion por sala ----------
create or replace view porra.pool_standings
with (security_invoker = on) as
select
  pr.pool_id,
  pr.user_id,
  pf.display_name,
  coalesce(sum(pr.points), 0)::int                     as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials
from porra.predictions pr
join porra.pools po    on po.id = pr.pool_id
join porra.profiles pf on pf.id = pr.user_id
group by pr.pool_id, pr.user_id, pf.display_name;

-- ============================================================
-- Porra Fantasy · 0003 · RLS + RPCs + grants (schema "porra")
-- ============================================================

-- Helpers security-definer -----------------------------------

create or replace function porra.is_pool_member(p_pool uuid, p_user uuid)
returns boolean language sql security definer stable
set search_path = porra, public as $$
  select exists (
    select 1 from porra.pool_members where pool_id = p_pool and user_id = p_user
  );
$$;

-- Asegura que el usuario actual tiene fila en porra.profiles.
-- (Necesario porque no ponemos trigger en auth.users, para no
--  interferir con otras apps del mismo proyecto.)
create or replace function porra.ensure_profile()
returns void language plpgsql security definer
set search_path = porra, public as $$
begin
  insert into porra.profiles (id, display_name)
  select u.id,
         coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''),
                  split_part(u.email, '@', 1))
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

-- Activar RLS ------------------------------------------------
alter table porra.profiles      enable row level security;
alter table porra.competitions  enable row level security;
alter table porra.rounds        enable row level security;
alter table porra.matches       enable row level security;
alter table porra.pools         enable row level security;
alter table porra.pool_members  enable row level security;
alter table porra.predictions   enable row level security;

-- profiles ---------------------------------------------------
drop policy if exists profiles_select on porra.profiles;
create policy profiles_select on porra.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on porra.profiles;
create policy profiles_update_own on porra.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- competitions / rounds / matches (lectura autenticada) ------
drop policy if exists competitions_select on porra.competitions;
create policy competitions_select on porra.competitions
  for select to authenticated using (true);

drop policy if exists rounds_select on porra.rounds;
create policy rounds_select on porra.rounds
  for select to authenticated using (true);

drop policy if exists matches_select on porra.matches;
create policy matches_select on porra.matches
  for select to authenticated using (true);

-- pools ------------------------------------------------------
drop policy if exists pools_select_member on porra.pools;
create policy pools_select_member on porra.pools
  for select to authenticated using (porra.is_pool_member(id, auth.uid()));

drop policy if exists pools_insert_own on porra.pools;
create policy pools_insert_own on porra.pools
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists pools_update_owner on porra.pools;
create policy pools_update_owner on porra.pools
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists pools_delete_owner on porra.pools;
create policy pools_delete_owner on porra.pools
  for delete to authenticated using (owner_id = auth.uid());

-- pool_members -----------------------------------------------
drop policy if exists pool_members_select on porra.pool_members;
create policy pool_members_select on porra.pool_members
  for select to authenticated
  using (user_id = auth.uid() or porra.is_pool_member(pool_id, auth.uid()));

drop policy if exists pool_members_insert_self on porra.pool_members;
create policy pool_members_insert_self on porra.pool_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists pool_members_delete_self on porra.pool_members;
create policy pool_members_delete_self on porra.pool_members
  for delete to authenticated using (user_id = auth.uid());

-- predictions ------------------------------------------------
-- Ver: propio siempre; ajeno solo tras el kickoff. Siempre miembro.
drop policy if exists predictions_select on porra.predictions;
create policy predictions_select on porra.predictions
  for select to authenticated
  using (
    porra.is_pool_member(pool_id, auth.uid())
    and (
      user_id = auth.uid()
      or exists (select 1 from porra.matches m
                 where m.id = predictions.match_id and m.kickoff <= now())
    )
  );

drop policy if exists predictions_insert on porra.predictions;
create policy predictions_insert on porra.predictions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and porra.is_pool_member(pool_id, auth.uid())
    and exists (select 1 from porra.matches m
                where m.id = match_id and m.kickoff > now())
  );

drop policy if exists predictions_update on porra.predictions;
create policy predictions_update on porra.predictions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from porra.matches m
                where m.id = match_id and m.kickoff > now())
  );

drop policy if exists predictions_delete on porra.predictions;
create policy predictions_delete on porra.predictions
  for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from porra.matches m
                where m.id = match_id and m.kickoff > now())
  );

-- ============================================================
-- RPCs (security definer)
-- ============================================================

create or replace function porra.create_pool(
  p_name text,
  p_competition bigint default null,
  p_points_1x2 int default 3,
  p_points_exact int default 8
) returns porra.pools
language plpgsql security definer set search_path = porra, public as $$
declare newpool porra.pools;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform porra.ensure_profile();

  insert into porra.pools (name, owner_id, competition_id, points_1x2, points_exact)
  values (p_name, auth.uid(), p_competition, p_points_1x2, p_points_exact)
  returning * into newpool;

  insert into porra.pool_members (pool_id, user_id, role)
  values (newpool.id, auth.uid(), 'owner');

  return newpool;
end;
$$;

create or replace function porra.join_pool(p_code text)
returns porra.pools
language plpgsql security definer set search_path = porra, public as $$
declare target porra.pools;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform porra.ensure_profile();

  select * into target from porra.pools where invite_code = upper(trim(p_code));
  if target.id is null then raise exception 'Código de sala no válido'; end if;

  insert into porra.pool_members (pool_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (pool_id, user_id) do nothing;

  return target;
end;
$$;

-- ============================================================
-- Grants para que PostgREST (roles anon/authenticated) vean el schema
-- ============================================================
grant usage on schema porra to anon, authenticated;
grant select, insert, update, delete on all tables in schema porra to authenticated;
grant usage, select on all sequences in schema porra to authenticated;
grant execute on all functions in schema porra to authenticated;

-- service_role (importador / edge function): salta RLS pero necesita GRANTs.
grant usage on schema porra to service_role;
grant all privileges on all tables in schema porra to service_role;
grant all privileges on all sequences in schema porra to service_role;
grant all privileges on all functions in schema porra to service_role;

-- ============================================================
-- Porra Fantasy · 0004 · Semilla: LaLiga (schema "porra")
-- ============================================================
-- Fuente de datos: football-data.org (gratis, temporada actual).
-- Codigo de competicion "PD" (Primera Division), id numerico 2014.
-- season = ano de inicio de temporada (2026 = 2026-27).
insert into porra.competitions (name, api_league_id, season)
values ('LaLiga', 2014, 2026)
on conflict (api_league_id, season) do nothing;
