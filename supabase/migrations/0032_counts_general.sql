-- ============================================================
-- Porra Fantasy · 0032 · Pronósticos solo de jornada
-- ============================================================
-- Un pronóstico puede contar para la jornada pero NO para la general
-- (counts_general = false): p. ej. un partido jugado antes de existir
-- la app cuyo resultado solo consta como acta de jornada. La general,
-- sus exactos y parciales lo ignoran; la jornada, el bote y el
-- historial lo muestran con normalidad.
-- ============================================================

alter table porra.predictions
  add column if not exists counts_general boolean not null default true;

-- General = arrastre + puntos que cuentan (mismo corte de siempre).
create or replace view porra.pool_standings
with (security_invoker = on) as
select
  pm.pool_id,
  pm.user_id,
  pf.display_name,
  (
    coalesce(max(co.points), 0)
    + coalesce(sum(pr.points) filter (where coalesce(pr.counts_general, true) and (po.carryover_cutoff is null or r.deadline > po.carryover_cutoff)), 0)
  )::numeric as points,
  count(*) filter (where pr.points is not null and coalesce(pr.counts_general, true))        as graded,
  count(*) filter (where pr.points = po.points_exact and coalesce(pr.counts_general, true))  as exacts,
  count(*) filter (where pr.points = po.points_1x2 and coalesce(pr.counts_general, true))    as partials,
  pf.avatar_url
from porra.pool_members pm
join porra.profiles pf on pf.id = pm.user_id
join porra.pools po    on po.id = pm.pool_id
left join porra.predictions pr on pr.pool_id = pm.pool_id and pr.user_id = pm.user_id
left join porra.matches m       on m.id = pr.match_id
left join porra.rounds r        on r.id = m.round_id
left join porra.pool_carryover co on co.pool_id = pm.pool_id and co.user_id = pm.user_id
group by pm.pool_id, pm.user_id, pf.display_name, pf.avatar_url;
grant select on porra.pool_standings to authenticated, service_role;
