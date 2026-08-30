-- ============================================================
-- Porra Fantasy · 0010 · La clasificación general incluye a TODOS los miembros
-- ============================================================
-- Antes solo aparecían quienes ya tenían predicciones puntuadas. Ahora todo
-- miembro de la sala aparece (con 0 si aún no ha sumado). Mantiene el orden de
-- columnas (create or replace view no permite reordenar).
create or replace view porra.pool_standings
with (security_invoker = on) as
select
  pm.pool_id,
  pm.user_id,
  pf.display_name,
  coalesce(sum(pr.points), 0)::int                     as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials,
  pf.avatar_url
from porra.pool_members pm
join porra.profiles pf on pf.id = pm.user_id
join porra.pools po    on po.id = pm.pool_id
left join porra.predictions pr on pr.pool_id = pm.pool_id and pr.user_id = pm.user_id
group by pm.pool_id, pm.user_id, pf.display_name, pf.avatar_url;

grant select on porra.pool_standings to authenticated, service_role;
