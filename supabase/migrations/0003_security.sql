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
