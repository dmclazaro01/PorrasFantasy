-- ============================================================
-- Porra Fantasy · 0006 · Avatar en la clasificación
-- ============================================================
-- avatar_url se añade AL FINAL (create or replace view solo permite
-- añadir columnas al final, no reordenar).
create or replace view porra.pool_standings
with (security_invoker = on) as
select
  pr.pool_id,
  pr.user_id,
  pf.display_name,
  coalesce(sum(pr.points), 0)::int                     as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials,
  pf.avatar_url
from porra.predictions pr
join porra.pools po    on po.id = pr.pool_id
join porra.profiles pf on pf.id = pr.user_id
group by pr.pool_id, pr.user_id, pf.display_name, pf.avatar_url;

grant select on porra.pool_standings to authenticated, service_role;
