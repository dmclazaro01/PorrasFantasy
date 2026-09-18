-- ============================================================
-- Porra Fantasy · 0039 · Alias ambiguo en ensure_my_card
-- ============================================================
-- La 0037 usaba `update porra.cards c ...`, pero `c` ya es la variable
-- registro declarada en la función: en PL/pgSQL el alias colisiona con
-- la variable y la sentencia falla en ejecución ("table reference c is
-- ambiguous"). Resultado: ensure_my_card devolvía error siempre y la app
-- mostraba "Aún no hay carta" aun con la carta repartida.
-- Se renombra el alias a `pc`; lógica idéntica a la 0037.
-- ============================================================

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

  -- Las no usadas de jornadas anteriores caducan (no se acumulan),
  -- salvo el VAR que siga dentro de su ventana de 24 h.
  update porra.cards pc set status = 'EXPIRED'
  where pc.pool_id = p_pool and pc.owner_id = auth.uid()
    and pc.round_id <> p_round and pc.status = 'GRANTED'
    and not (
      pc.type = 'VAR'
      and exists (
        select 1 from porra.matches m2
        where m2.round_id = pc.round_id and m2.status = 'FINISHED'
        group by m2.round_id
        having max(m2.kickoff) + interval '24 hours' > now()
      )
    );

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
