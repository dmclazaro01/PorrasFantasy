-- ============================================================
-- Porra Fantasy · 0038 · Jornadas duplicadas: limpiar y blindar
-- ============================================================
-- El sync de calendario hacía SELECT-then-INSERT sin restricción única:
-- dos ejecuciones solapadas creaban la misma jornada dos veces, y desde
-- entonces cada ejecución sumaba +1 (el SELECT con varias filas falla y
-- el código inserta de nuevo). Resultado: cientos de "Jornada 12/19"
-- vacías que inundan la tira de jornadas (parece que "tras la J12 todo
-- está vacío").
-- Esta migración reapunta los dependientes (partidos, cartas,
-- finalissimas) de las perdedoras a la ganadora (más partidos; empate:
-- id menor), borra las perdedoras y añade UNIQUE (competition_id, name)
-- para que no vuelva a pasar.
-- ============================================================

-- Partidos de filas perdedoras -> ganadora.
update porra.matches m set round_id = k.keeper_id
from (
  select competition_id, name, (array_agg(id order by mc desc, id))[1] as keeper_id
  from (
    select r.id, r.competition_id, r.name, count(mm.id) as mc
    from porra.rounds r
    left join porra.matches mm on mm.round_id = r.id
    group by r.id
  ) s
  group by competition_id, name
  having count(*) > 1
) k
join porra.rounds r on r.competition_id = k.competition_id and r.name = k.name
where m.round_id = r.id and r.id <> k.keeper_id;

-- Cartas de filas perdedoras -> ganadora.
update porra.cards c set round_id = k.keeper_id
from (
  select competition_id, name, (array_agg(id order by mc desc, id))[1] as keeper_id
  from (
    select r.id, r.competition_id, r.name, count(mm.id) as mc
    from porra.rounds r
    left join porra.matches mm on mm.round_id = r.id
    group by r.id
  ) s
  group by competition_id, name
  having count(*) > 1
) k
join porra.rounds r on r.competition_id = k.competition_id and r.name = k.name
where c.round_id = r.id and r.id <> k.keeper_id;

-- Finalissimas de filas perdedoras -> ganadora.
update porra.finalissima f set round_id = k.keeper_id
from (
  select competition_id, name, (array_agg(id order by mc desc, id))[1] as keeper_id
  from (
    select r.id, r.competition_id, r.name, count(mm.id) as mc
    from porra.rounds r
    left join porra.matches mm on mm.round_id = r.id
    group by r.id
  ) s
  group by competition_id, name
  having count(*) > 1
) k
join porra.rounds r on r.competition_id = k.competition_id and r.name = k.name
where f.round_id = r.id and r.id <> k.keeper_id;

-- Borrar las perdedoras (ya sin dependientes).
delete from porra.rounds r
using (
  select competition_id, name, (array_agg(id order by mc desc, id))[1] as keeper_id
  from (
    select r2.id, r2.competition_id, r2.name, count(mm.id) as mc
    from porra.rounds r2
    left join porra.matches mm on mm.round_id = r2.id
    group by r2.id
  ) s
  group by competition_id, name
  having count(*) > 1
) k
where r.competition_id = k.competition_id and r.name = k.name and r.id <> k.keeper_id;

-- Blindaje: una fila por (competición, nombre).
alter table porra.rounds
  add constraint rounds_competition_name_key unique (competition_id, name);
