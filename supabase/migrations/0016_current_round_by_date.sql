-- ============================================================
-- Porra Fantasy · 0016 · Jornada en curso por FECHA (no por estado)
-- ============================================================
-- La API gratuita de football-data deja jornadas pasadas como SCHEDULED
-- (datos obsoletos), así que no podemos fiarnos del estado para decidir la
-- jornada "en curso". La definimos por fecha:
--   la jornada de MENOR número que aún tenga algún partido por jugarse
--   (kickoff en el futuro, con 3 h de gracia para partidos recién empezados).
-- Así los partidos adelantados de una jornada superior (p. ej. un J6 el
-- jueves) NO cambian la jornada por defecto, pero siguen siendo accesibles y
-- predecibles navegando con la barra de jornadas.
-- Si ya no queda nada por jugar (temporada terminada), cae a la última jornada.
create or replace function porra.current_round_id(p_comp bigint)
returns bigint
language sql stable security definer set search_path = porra, public as $$
  with fut as (
    select r.id,
           nullif(regexp_replace(r.name, '[^0-9]', '', 'g'), '')::int as md
    from porra.matches m
    join porra.rounds r on r.id = m.round_id
    where r.competition_id = p_comp
      and m.status <> 'FINISHED'
      and m.kickoff >= now() - interval '3 hours'
    group by r.id, r.name
  ),
  fallback as (
    select r.id
    from porra.rounds r
    where r.competition_id = p_comp
    order by r.deadline desc nulls last
    limit 1
  )
  select coalesce(
    (select id from fut order by md asc nulls last limit 1),
    (select id from fallback)
  );
$$;

grant execute on function porra.current_round_id(bigint) to authenticated;
