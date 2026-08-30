-- ============================================================
-- Porra Fantasy · 0011 · La clasificación por jornada incluye a TODOS los miembros
-- ============================================================
-- Igual que la general (0010) pero por jornada: cada miembro aparece en cada
-- jornada de la competición de la sala (con 0 si aún no ha sumado), de modo que
-- quien se une a mitad de jornada ya sale en el ranking y va sumando al predecir
-- los partidos que todavía no han empezado.
-- Mantiene el orden de columnas (create or replace view no permite reordenar).
create or replace view porra.pool_round_standings
with (security_invoker = on) as
select
  pm.pool_id,
  r.id                                                 as round_id,
  pm.user_id,
  pf.display_name,
  coalesce(sum(pr.points), 0)::int                     as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials,
  pf.avatar_url
from porra.pool_members pm
join porra.pools po      on po.id = pm.pool_id
join porra.rounds r      on r.competition_id = po.competition_id
join porra.profiles pf   on pf.id = pm.user_id
left join porra.matches m      on m.round_id = r.id
left join porra.predictions pr on pr.pool_id = pm.pool_id
                              and pr.user_id = pm.user_id
                              and pr.match_id = m.id
group by pm.pool_id, r.id, pm.user_id, pf.display_name, pf.avatar_url;

grant select on porra.pool_round_standings to authenticated, service_role;
