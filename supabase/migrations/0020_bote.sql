-- ============================================================
-- Porra Fantasy · 0020 · Bote (castigo a los dos últimos de cada jornada)
-- ============================================================
-- Cuando una jornada termina POR COMPLETO (todos sus partidos FINISHED), los
-- dos últimos de esa jornada pagan: el último 2 €, el penúltimo 1 €. En caso de
-- empate se reparte el castigo entre los empatados: cada grupo empatado divide
-- la suma de los castigos de las posiciones que ocupa entre sus integrantes.
--   below = nº de jugadores con MENOS puntos; equal = nº de empatados (incl. él)
--   castigo = (2 si below=0)  +  (1 si el grupo cubre la 2ª posición)  / equal
--
-- Participantes de una jornada = miembros que ya estaban en la sala al empezarla
-- (joined_at <= deadline). Una jornada cuenta solo si la sala la jugó de verdad
-- (alguien pronosticó) y hay al menos 2 participantes.

-- Reparto por jornada terminada.
create or replace view porra.pool_bote_round
with (security_invoker = on) as
with fr as ( -- jornadas COMPLETAMENTE terminadas y con partidos
  select r.id as round_id, r.deadline
  from porra.rounds r
  where r.deadline is not null
    and exists (select 1 from porra.matches m where m.round_id = r.id)
    and not exists (select 1 from porra.matches m where m.round_id = r.id and m.status <> 'FINISHED')
),
parts as ( -- participantes: miembros que pronosticaron ALGÚN partido de la jornada
  -- (graded>0). Así entra quien se une a mitad de jornada y juega los partidos
  -- que aún no habían empezado, y quedan fuera J1/J2 (nadie jugó) y los que no
  -- pronosticaron nada esa jornada.
  select s.pool_id, s.round_id, s.user_id, s.display_name, s.avatar_url, s.points, s.graded
  from porra.pool_round_standings s
  join fr on fr.round_id = s.round_id
  where s.graded > 0
),
played as ( -- jornadas con al menos 2 participantes (para que haya "dos últimos")
  select pool_id, round_id
  from parts
  group by pool_id, round_id
  having count(*) >= 2
),
ranked as (
  select p.pool_id, p.round_id, p.user_id, p.display_name, p.avatar_url, p.points,
         rank() over (partition by p.pool_id, p.round_id order by p.points asc) - 1 as below,
         count(*) over (partition by p.pool_id, p.round_id, p.points) as equal
  from parts p
  join played pl on pl.pool_id = p.pool_id and pl.round_id = p.round_id
)
select
  pool_id, round_id, user_id, display_name, avatar_url, points,
  (
    (case when below = 0 then 2 else 0 end)
    + (case when below <= 1 and below + equal >= 2 then 1 else 0 end)
  )::numeric / equal as owed
from ranked;

-- Acumulado por jugador (todas las jornadas). Incluye a todos los miembros (0 €).
create or replace view porra.pool_bote
with (security_invoker = on) as
select
  pm.pool_id,
  pm.user_id,
  pf.display_name,
  pf.avatar_url,
  coalesce(b.owed, 0)::numeric(10, 2) as owed,
  coalesce(b.rounds_paid, 0)::int      as rounds_paid
from porra.pool_members pm
join porra.profiles pf on pf.id = pm.user_id
left join (
  select pool_id, user_id,
         sum(owed) as owed,
         count(*) filter (where owed > 0) as rounds_paid
  from porra.pool_bote_round
  group by pool_id, user_id
) b on b.pool_id = pm.pool_id and b.user_id = pm.user_id;

grant select on porra.pool_bote_round to authenticated, service_role;
grant select on porra.pool_bote to authenticated, service_role;
