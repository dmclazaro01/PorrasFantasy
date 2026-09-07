-- ============================================================
-- Porra Fantasy · 0026 · Reparto equitativo de cartas (sobres)
-- ============================================================
-- Sorteo puro: en 38 jornadas la varianza deja a unos sin ver ciertas
-- cartas. Desde la Jornada 5, cada jugador tiene su SOBRE por sala: una
-- permutación aleatoria de las 10 cartas; cada jornada saca una SIN
-- reposición y al vaciarse se vuelve a barajar. Garantía: en cada bloque
-- de 10 jornadas (contando desde la J5) cada jugador ve cada carta
-- EXACTAMENTE una vez; entre dos cartas cualesquiera la diferencia por
-- jugador nunca pasa de 1. Las J1–J4 siguen con sorteo puro (histórico).
-- A dos jugadores les pueden tocar distintas cartas la misma jornada
-- (sobres independientes); el que falla una jornada simplemente no
-- saca de su sobre esa vez.
-- ============================================================

create table if not exists porra.card_decks (
  pool_id   uuid not null references porra.pools (id) on delete cascade,
  user_id   uuid not null references porra.profiles (id) on delete cascade,
  remaining porra.card_type[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);
-- Sin políticas = denegado para anon/authenticated; solo el owner
-- (y por tanto las funciones security definer) la tocan.
alter table porra.card_decks enable row level security;

create or replace function porra.ensure_my_card(p_pool uuid, p_round bigint)
returns porra.cards
language plpgsql security definer set search_path = porra, public as $$
declare
  c porra.cards;
  rem porra.card_type[];
  picked porra.card_type;
  round_num int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not porra.is_pool_member(p_pool, auth.uid()) then raise exception 'No eres miembro'; end if;

  -- Las no usadas de jornadas anteriores caducan: no se acumulan.
  update porra.cards set status = 'EXPIRED'
  where pool_id = p_pool and owner_id = auth.uid()
    and round_id <> p_round and status = 'GRANTED';

  select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  if found then return c; end if;

  -- Número de jornada ("Jornada N"); si no se puede leer, se usa sobre.
  select (regexp_match(r.name, '(\d+)'))[1]::int into round_num
  from porra.rounds r where r.id = p_round;

  if round_num is null or round_num >= 5 then
    -- Sobre: se crea vacío y se rellena al vaciarse. Bloqueo de fila para
    -- que dos repartos concurrentes no saquen dos veces del mismo sobre.
    insert into porra.card_decks (pool_id, user_id, remaining)
    values (p_pool, auth.uid(), '{}')
    on conflict (pool_id, user_id) do nothing;
    select d.remaining into rem from porra.card_decks d
    where d.pool_id = p_pool and d.user_id = auth.uid() for update;
    if rem is null or cardinality(rem) = 0 then
      select array_agg(x order by random()) into rem
      from unnest(enum_range(null::porra.card_type)) as x;
    end if;
    picked := rem[1];
    update porra.card_decks
    set remaining = rem[2:cardinality(rem)], updated_at = now()
    where pool_id = p_pool and user_id = auth.uid();
  else
    -- J1–J4: sorteo puro histórico.
    select (array['BOMBA','ROJA','LESION','ESPIA','PRENSA','DOBLE','VAR','AUTOBUS','CANCHERO','DUPLA'])[floor(random() * 10) + 1]::porra.card_type
    into picked;
  end if;

  insert into porra.cards (pool_id, round_id, owner_id, type)
  values (p_pool, p_round, auth.uid(), picked)
  on conflict (pool_id, round_id, owner_id) do nothing
  returning * into c;

  if c.id is null then
    select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  end if;
  return c;
end;
$$;
