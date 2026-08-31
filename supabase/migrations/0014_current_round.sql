-- ============================================================
-- Porra Fantasy · 0014 · Jornada en curso
-- ============================================================
-- La jornada "actual" = la del partido no finalizado más próximo. Sirve para
-- que la app abra por defecto en la jornada que se está jugando aunque haya
-- jornadas posteriores ya cargadas.
create or replace function porra.current_round_id(p_comp bigint)
returns bigint
language sql stable security definer set search_path = porra, public as $$
  select m.round_id
  from porra.matches m
  join porra.rounds r on r.id = m.round_id
  where r.competition_id = p_comp and m.status <> 'FINISHED'
  order by m.kickoff asc
  limit 1;
$$;

grant execute on function porra.current_round_id(bigint) to authenticated;
