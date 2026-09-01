-- ============================================================
-- Porra Fantasy · 0022 · Arrastre manual (migración desde laporra)
-- ============================================================
-- Al migrar desde laporra.app arrastramos el estado hasta la J3 como una BASE
-- por jugador (puntos + bote), sin cargar predicción a predicción. Un "corte"
-- por sala (carryover_cutoff) marca hasta dónde llega ese arrastre: las
-- jornadas cuyo primer partido (deadline) es anterior o igual al corte NO se
-- recalculan (ya están en el arrastre); las posteriores se calculan en vivo y
-- se SUMAN al arrastre. Así la general y el bote muestran los totales reales y
-- la porra sigue acumulando desde la J4 en adelante.

alter table porra.pools add column if not exists carryover_cutoff timestamptz;

create table if not exists porra.pool_carryover (
  pool_id      uuid not null references porra.pools (id) on delete cascade,
  user_id      uuid not null references porra.profiles (id) on delete cascade,
  points       int not null default 0,
  bote         numeric(10, 2) not null default 0,
  bote_rounds  int not null default 0,
  primary key (pool_id, user_id)
);
grant select on porra.pool_carryover to authenticated, service_role;
alter table porra.pool_carryover enable row level security;
drop policy if exists pool_carryover_read on porra.pool_carryover;
create policy pool_carryover_read on porra.pool_carryover
  for select to authenticated using (porra.is_pool_member(pool_id));

-- General = arrastre + puntos de jornadas posteriores al corte.
create or replace view porra.pool_standings
with (security_invoker = on) as
select
  pm.pool_id,
  pm.user_id,
  pf.display_name,
  (
    coalesce(max(co.points), 0)
    + coalesce(sum(pr.points) filter (where po.carryover_cutoff is null or r.deadline > po.carryover_cutoff), 0)
  )::int as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials,
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

-- Bote por jornada: excluye las jornadas anteriores al corte (ya arrastradas).
create or replace view porra.pool_bote_round
with (security_invoker = on) as
with fr as (
  select r.id as round_id, r.deadline, max(m.kickoff) as last_ko
  from porra.rounds r
  join porra.matches m on m.round_id = r.id
  group by r.id, r.deadline
  having bool_and(m.status = 'FINISHED')
),
parts as (
  select s.pool_id, s.round_id, s.user_id, s.display_name, s.avatar_url, s.points, s.graded
  from porra.pool_round_standings s
  join fr on fr.round_id = s.round_id
  join porra.pool_members pm on pm.pool_id = s.pool_id and pm.user_id = s.user_id
  join porra.pools po on po.id = s.pool_id
  where pm.joined_at <= fr.last_ko
    and (po.carryover_cutoff is null or fr.deadline > po.carryover_cutoff)
),
played as (
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
grant select on porra.pool_bote_round to authenticated, service_role;

-- Bote acumulado = arrastre + bote de jornadas posteriores al corte.
create or replace view porra.pool_bote
with (security_invoker = on) as
select
  pm.pool_id,
  pm.user_id,
  pf.display_name,
  pf.avatar_url,
  (coalesce(co.bote, 0) + coalesce(b.owed, 0))::numeric(10, 2) as owed,
  (coalesce(co.bote_rounds, 0) + coalesce(b.rounds_paid, 0))::int as rounds_paid
from porra.pool_members pm
join porra.profiles pf on pf.id = pm.user_id
left join (
  select pool_id, user_id,
         sum(owed) as owed,
         count(*) filter (where owed > 0) as rounds_paid
  from porra.pool_bote_round
  group by pool_id, user_id
) b on b.pool_id = pm.pool_id and b.user_id = pm.user_id
left join porra.pool_carryover co on co.pool_id = pm.pool_id and co.user_id = pm.user_id;
grant select on porra.pool_bote to authenticated, service_role;
