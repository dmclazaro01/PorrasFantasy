-- ============================================================
-- Porra Fantasy · 0025 · Las cartas no se acumulan
-- ============================================================
-- Cada jornada toca 1 carta aleatoria por jugador (a dos jugadores les
-- puede tocar la misma); la no usada NO pasa a la siguiente jornada:
-- al repartir la de una jornada, las GRANTED de jornadas anteriores del
-- mismo jugador en la sala pasan a EXPIRED y ya no se pueden jugar
-- (play_card solo acepta GRANTED).
-- ============================================================

alter table porra.cards drop constraint if exists cards_status_check;
alter table porra.cards
  add constraint cards_status_check
  check (status in ('GRANTED', 'PLAYED', 'EXPIRED'));

create or replace function porra.ensure_my_card(p_pool uuid, p_round bigint)
returns porra.cards
language plpgsql security definer set search_path = porra, public as $$
declare c porra.cards;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not porra.is_pool_member(p_pool, auth.uid()) then raise exception 'No eres miembro'; end if;

  -- Las no usadas de jornadas anteriores caducan: no se acumulan.
  update porra.cards set status = 'EXPIRED'
  where pool_id = p_pool and owner_id = auth.uid()
    and round_id <> p_round and status = 'GRANTED';

  select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  if found then return c; end if;

  insert into porra.cards (pool_id, round_id, owner_id, type)
  values (
    p_pool, p_round, auth.uid(),
    (array['BOMBA','ROJA','LESION','ESPIA','PRENSA','DOBLE','VAR','AUTOBUS','CANCHERO','DUPLA'])[floor(random() * 10) + 1]::porra.card_type
  )
  on conflict (pool_id, round_id, owner_id) do nothing
  returning * into c;

  if c.id is null then
    select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  end if;
  return c;
end;
$$;
