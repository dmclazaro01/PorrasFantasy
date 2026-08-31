-- ============================================================
-- Porra Fantasy · 0015 · Jornada en curso robusta (aplazados)
-- ============================================================
-- La jornada "en curso" = la del próximo partido JUGABLE (SCHEDULED o LIVE),
-- no la de un partido aplazado (POSTPONED) que arrastre una fecha antigua.
-- Si ya no quedan partidos jugables, cae a la última jornada con partidos.
create or replace function porra.current_round_id(p_comp bigint)
returns bigint
language sql stable security definer set search_path = porra, public as $$
  with playable as (
    select m.round_id
    from porra.matches m
    join porra.rounds r on r.id = m.round_id
    where r.competition_id = p_comp
      and m.status in ('SCHEDULED', 'LIVE')
    order by m.kickoff asc
    limit 1
  ),
  fallback as (
    select r.id as round_id
    from porra.rounds r
    where r.competition_id = p_comp
    order by r.deadline desc nulls last
    limit 1
  )
  select coalesce(
    (select round_id from playable),
    (select round_id from fallback)
  );
$$;

grant execute on function porra.current_round_id(bigint) to authenticated;
