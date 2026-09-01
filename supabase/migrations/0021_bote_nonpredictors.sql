-- ============================================================
-- Porra Fantasy · 0021 · Bote: el que no pronostica también cuenta (0 pts)
-- ============================================================
-- Corrige el criterio de participantes: si un miembro estaba en la sala durante
-- la jornada pero se olvidó de pronosticar, cuenta con 0 puntos y, si eso le
-- deja último o penúltimo, paga igual ("no es problema de los demás").
--
-- Participante de una jornada = miembro que ya estaba en la sala antes del
-- ÚLTIMO partido de esa jornada (tuvo ocasión de pronosticar al menos uno),
-- haya pronosticado o no. Así:
--   - entra quien se une a mitad de jornada (nuestros miembros se unieron tras
--     el primer partido de la J3, pero jugaron el resto);
--   - NO entra un recién llegado en una jornada ya terminada antes de unirse;
--   - siguen fuera J1/J2 y cualquier jornada que la sala no jugó (0 predicciones).
create or replace view porra.pool_bote_round
with (security_invoker = on) as
with fr as ( -- jornadas COMPLETAMENTE terminadas; last_ko = último kickoff
  select r.id as round_id, max(m.kickoff) as last_ko
  from porra.rounds r
  join porra.matches m on m.round_id = r.id
  group by r.id
  having bool_and(m.status = 'FINISHED')
),
parts as ( -- miembros presentes durante la jornada (predijeran o no)
  select s.pool_id, s.round_id, s.user_id, s.display_name, s.avatar_url, s.points, s.graded
  from porra.pool_round_standings s
  join fr on fr.round_id = s.round_id
  join porra.pool_members pm on pm.pool_id = s.pool_id and pm.user_id = s.user_id
  where pm.joined_at <= fr.last_ko
),
played as ( -- jornadas que la sala jugó (>=1 predicción) y con >=2 participantes
  select pool_id, round_id
  from parts
  group by pool_id, round_id
  having count(*) >= 2 and sum(graded) >= 1
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
