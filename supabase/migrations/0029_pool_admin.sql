-- ============================================================
-- Porra Fantasy · 0029 · Administración de la porra
-- ============================================================
-- El dueño de la sala O un admin de la app (profiles.is_admin) puede:
--   · editar nombre y puntuación, regenerar el código, borrar la sala
--     (vía RLS directa sobre porra.pools);
--   · expulsar miembros y recalcular toda la puntuación (RPCs).
-- Cambiar la puntuación NO recalcula solo: hay que llamar a
-- admin_rescore_pool para reescribir el historial con los nuevos valores.
-- ============================================================

create or replace function porra.is_pool_admin(p_pool uuid, p_user uuid)
returns boolean language sql security definer stable
set search_path = porra, public as $$
  select exists (select 1 from porra.pools where id = p_pool and owner_id = p_user)
      or exists (select 1 from porra.profiles where id = p_user and is_admin);
$$;

drop policy if exists pools_update_owner on porra.pools;
create policy pools_update_owner on porra.pools
  for update to authenticated
  using (porra.is_pool_admin(id, auth.uid()))
  with check (porra.is_pool_admin(id, auth.uid()));

drop policy if exists pools_delete_owner on porra.pools;
create policy pools_delete_owner on porra.pools
  for delete to authenticated
  using (porra.is_pool_admin(id, auth.uid()));

-- Nuevo código de invitación (reintentar si colisiona: es unique).
create or replace function porra.admin_regen_code(p_pool uuid)
returns text
language plpgsql security definer set search_path = porra, public as $$
declare code text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not porra.is_pool_admin(p_pool, auth.uid()) then raise exception 'Sin permiso'; end if;
  update porra.pools set invite_code = porra.gen_invite_code()
  where id = p_pool returning invite_code into code;
  return code;
end;
$$;

-- Recalcula TODOS los partidos de la competición (tras cambiar puntos).
create or replace function porra.admin_rescore_pool(p_pool uuid)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  po porra.pools; r record;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into po from porra.pools where id = p_pool;
  if not found then raise exception 'Sala no encontrada'; end if;
  if not porra.is_pool_admin(p_pool, auth.uid()) then raise exception 'Sin permiso'; end if;
  for r in
    select m.id from porra.matches m
    join porra.rounds rd on rd.id = m.round_id
    where rd.competition_id = po.competition_id
  loop
    perform porra.recalc_match(r.id);
  end loop;
end;
$$;

-- Expulsar a un miembro (nunca al dueño).
create or replace function porra.admin_remove_member(p_pool uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not porra.is_pool_admin(p_pool, auth.uid()) then raise exception 'Sin permiso'; end if;
  select owner_id into owner from porra.pools where id = p_pool;
  if p_user = owner then raise exception 'No puedes expulsar al dueño'; end if;
  delete from porra.pool_members where pool_id = p_pool and user_id = p_user;
end;
$$;

grant execute on function porra.is_pool_admin(uuid, uuid) to authenticated;
grant execute on function porra.admin_regen_code(uuid) to authenticated;
grant execute on function porra.admin_rescore_pool(uuid) to authenticated;
grant execute on function porra.admin_remove_member(uuid, uuid) to authenticated;
