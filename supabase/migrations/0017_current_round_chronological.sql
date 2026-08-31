-- ============================================================
-- Porra Fantasy · 0017 · Jornada en curso = próximo partido por FECHA
-- ============================================================
-- La jornada "en curso" (la que se abre por defecto) es la del PRÓXIMO partido
-- por jugarse cronológicamente, no la de menor número. Así, si un partido de la
-- J6 se adelanta al jueves antes de la J4, al terminar la J3 se muestra la J6
-- (por ese adelantado) y luego la J4.
--
-- Filtro por fecha (kickoff >= ahora - 3 h) porque la API gratuita de
-- football-data deja jornadas pasadas (J1/J2) como SCHEDULED: sin este filtro
-- se elegiría una jornada ya jugada.
-- Si no queda nada por jugar (temporada terminada), cae a la última jornada.
create or replace function porra.current_round_id(p_comp bigint)
returns bigint
language sql stable security definer set search_path = porra, public as $$
  with nextm as (
    select m.round_id
    from porra.matches m
    join porra.rounds r on r.id = m.round_id
    where r.competition_id = p_comp
      and m.status <> 'FINISHED'
      and m.kickoff >= now() - interval '3 hours'
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
    (select round_id from nextm),
    (select round_id from fallback)
  );
$$;

grant execute on function porra.current_round_id(bigint) to authenticated;
