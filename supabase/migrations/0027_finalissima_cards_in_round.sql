-- ============================================================
-- Porra Fantasy · 0027 · FINALISSIMA + cartas en la jornada
-- ============================================================
-- A) Constancia de cartas en la clasificación de jornada:
--    pool_round_standings suma card_type/card_status de la carta de cada
--    jugador en la jornada. Revelado: la propia siempre; las ajenas solo
--    cuando la jornada HA EMPEZADO (primer pitido). OJO, decisión de
--    diseño: esto levanta el secreto a inicio de jornada (antes que el
--    pitido de cada partido). Objetivos, partidos y pronósticos siguen
--    con sus reglas propias.
--
-- B) FINALISSIMA (fuera de las cartas): una vez por jornada y jugador,
--    designa UN partido para puntuar DOBLE (×2 sobre los puntos finales
--    del partido, solo si puntúas; tras cartas y suelo del bus).
--    Reglas:
--      · se designa/cambia solo a partidos futuros de la jornada;
--      · una vez que TU partido designado empieza, queda bloqueado
--        (no se puede cambiar ni quitar: evita esquivar el resultado);
--      · la designación ajena se revela al empezar el partido, como las
--        porras (RLS por kickoff);
--      · el partido admite cartas con normalidad mientras no empiece.
-- ============================================================

-- ---------- A) cartas en pool_round_standings (DROP+CREATE: +2 columnas) ----------
drop view if exists porra.pool_bote;
drop view if exists porra.pool_bote_round;
drop view if exists porra.pool_round_standings;

create view porra.pool_round_standings
with (security_invoker = on) as
select
  pm.pool_id,
  r.id                                                 as round_id,
  pm.user_id,
  pf.display_name,
  (coalesce(sum(pr.points), 0)
   + coalesce(bb.b, 0)
  )::numeric                                           as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials,
  pf.avatar_url,
  max(case
    when cd.id is null then null
    when cd.owner_id = auth.uid() then cd.type::text
    when exists (select 1 from porra.matches m2
                 where m2.round_id = r.id and m2.kickoff <= now()) then cd.type::text
    else null
  end)                                                 as card_type,
  max(case
    when cd.id is null then null
    when cd.owner_id = auth.uid() then cd.status
    when exists (select 1 from porra.matches m2
                 where m2.round_id = r.id and m2.kickoff <= now()) then cd.status
    else null
  end)                                                 as card_status
from porra.pool_members pm
join porra.pools po      on po.id = pm.pool_id
join porra.rounds r      on r.competition_id = po.competition_id
join porra.profiles pf   on pf.id = pm.user_id
left join porra.matches m      on m.round_id = r.id
left join porra.predictions pr on pr.pool_id = pm.pool_id
                              and pr.user_id = pm.user_id
                              and pr.match_id = m.id
left join (
  select pool_id, round_id, user_id, sum(points) as b
  from porra.card_bonus
  group by pool_id, round_id, user_id
) bb on bb.pool_id = pm.pool_id and bb.round_id = r.id and bb.user_id = pm.user_id
left join porra.cards cd on cd.pool_id = pm.pool_id
                        and cd.round_id = r.id
                        and cd.owner_id = pm.user_id
group by pm.pool_id, r.id, pm.user_id, pf.display_name, pf.avatar_url, bb.b;
grant select on porra.pool_round_standings to authenticated, service_role;

-- Dependientes (definición vigente de 0022, sin cambios).
create view porra.pool_bote_round
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

create view porra.pool_bote
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

-- ---------- B) FINALISSIMA ----------
create table if not exists porra.finalissima (
  pool_id    uuid not null references porra.pools (id) on delete cascade,
  user_id    uuid not null references porra.profiles (id) on delete cascade,
  round_id   bigint not null references porra.rounds (id) on delete cascade,
  match_id   bigint not null references porra.matches (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pool_id, user_id, round_id)   -- una por jugador y jornada
);
alter table porra.finalissima enable row level security;
grant select on porra.finalissima to authenticated, service_role;
drop policy if exists finalissima_read on porra.finalissima;
-- La propia siempre; la ajena solo cuando el partido ya empezó (como las porras).
create policy finalissima_read on porra.finalissima
  for select to authenticated
  using (
    porra.is_pool_member(pool_id, auth.uid())
    and (
      user_id = auth.uid()
      or exists (select 1 from porra.matches m
                 where m.id = finalissima.match_id and m.kickoff <= now())
    )
  );

-- Designar (o cambiar a otro futuro) / quitar (p_match null) la FINALISSIMA.
create or replace function porra.set_finalissima(p_pool uuid, p_round bigint, p_match bigint default null)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  cur porra.finalissima; m porra.matches; cur_started boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not porra.is_pool_member(p_pool, auth.uid()) then raise exception 'No eres miembro'; end if;

  select * into cur from porra.finalissima
  where pool_id = p_pool and user_id = auth.uid() and round_id = p_round;
  if found then
    select (m2.kickoff <= now()) into cur_started
    from porra.matches m2 where m2.id = cur.match_id;
    if coalesce(cur_started, true) then
      raise exception 'Tu FINALISSIMA ya empezó: queda bloqueada';
    end if;
  end if;

  if p_match is null then
    delete from porra.finalissima
    where pool_id = p_pool and user_id = auth.uid() and round_id = p_round;
    return;
  end if;

  select * into m from porra.matches where id = p_match;
  if not found then raise exception 'Partido no válido'; end if;
  if m.round_id <> p_round then raise exception 'Tiene que ser de esta jornada'; end if;
  if m.kickoff <= now() then raise exception 'Ese partido ya ha empezado'; end if;

  insert into porra.finalissima (pool_id, user_id, round_id, match_id)
  values (p_pool, auth.uid(), p_round, p_match)
  on conflict (pool_id, user_id, round_id)
  do update set match_id = excluded.match_id, created_at = now();
end;
$$;
grant execute on function porra.set_finalissima(uuid, bigint, bigint) to authenticated;

-- ---------- Puntuación: la FINALISSIMA duplica al final ----------
create or replace function porra.recalc_match(p_match_id bigint)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  m porra.matches; pr record; base int; bet int; is_exact boolean;
  eff_h int; eff_a int; vh int; va int; v_owner uuid; has_bus boolean;
begin
  select * into m from porra.matches where id = p_match_id;
  if not found then return; end if;

  if not (m.status = 'FINISHED' and m.home_goals is not null and m.away_goals is not null) then
    update porra.predictions set points = null, updated_at = now()
    where match_id = p_match_id and points is not null;
    return;
  end if;

  -- VAR vigente de la sala en este partido (solo puede haber uno).
  select v.var_home, v.var_away, v.owner_id into vh, va, v_owner
  from porra.cards v
  where v.type = 'VAR' and v.status = 'PLAYED' and v.match_id = p_match_id
  order by v.played_at, v.id limit 1;

  for pr in
    select p.*, po.points_1x2, po.points_exact
    from porra.predictions p join porra.pools po on po.id = p.pool_id
    where p.match_id = p_match_id
  loop
    -- AUTOBUS: ninguna carta te toca en ese partido.
    select exists (
      select 1 from porra.cards b
      where b.pool_id = pr.pool_id and b.type = 'AUTOBUS' and b.status = 'PLAYED'
        and b.match_id = p_match_id and b.owner_id = pr.user_id
    ) into has_bus;

    -- Resultado efectivo: el VAR cambia el marcador para toda la sala
    -- menos para quien lo jugó y para quien aparcó el autobús.
    eff_h := m.home_goals; eff_a := m.away_goals;
    if vh is not null and v_owner <> pr.user_id and not has_bus then
      eff_h := vh; eff_a := va;
    end if;

    base := porra.score_prediction(pr.pred_home, pr.pred_away, eff_h, eff_a, pr.points_1x2, pr.points_exact);
    is_exact := (pr.pred_home = eff_h and pr.pred_away = eff_a);

    if not has_bus then
      -- ROJA (0) tiene prioridad sobre LESION (mitad)
      if exists (
        select 1 from porra.cards c where c.pool_id = pr.pool_id and c.type = 'ROJA'
          and c.status = 'PLAYED' and c.match_id = p_match_id and c.target_user_id = pr.user_id
      ) then
        base := 0;
      elsif exists (
        select 1 from porra.cards c where c.pool_id = pr.pool_id and c.type = 'LESION'
          and c.status = 'PLAYED' and c.match_id = p_match_id and c.target_user_id = pr.user_id
      ) then
        base := base / 2;
      end if;

      -- BOMBA: otro jugador minó con el MISMO marcador exacto
      if exists (
        select 1 from porra.cards c
        join porra.predictions op
          on op.pool_id = c.pool_id and op.match_id = c.match_id and op.user_id = c.owner_id
        where c.pool_id = pr.pool_id and c.type = 'BOMBA' and c.status = 'PLAYED'
          and c.match_id = p_match_id and c.owner_id <> pr.user_id
          and op.pred_home = pr.pred_home and op.pred_away = pr.pred_away
      ) then
        base := 0;
      end if;
    end if;

    -- DOBLE O NADA (carta propia sobre este partido)
    select bet_points into bet from porra.cards c
      where c.pool_id = pr.pool_id and c.type = 'DOBLE' and c.status = 'PLAYED'
        and c.match_id = p_match_id and c.owner_id = pr.user_id;
    if bet is not null then
      if is_exact then base := base + bet; else base := base - (bet / 2); end if;
    end if;

    -- AUTOBUS: el bus garantiza acabar el partido con mínimo 1 punto.
    if has_bus then base := greatest(base, 1); end if;

    -- FINALISSIMA: designada en este partido y puntuando → doble.
    if base > 0 and exists (
      select 1 from porra.finalissima f
      where f.pool_id = pr.pool_id and f.user_id = pr.user_id
        and f.round_id = m.round_id and f.match_id = p_match_id
    ) then
      base := base * 2;
    end if;

    update porra.predictions set points = base, updated_at = now() where id = pr.id;
  end loop;

  -- Bonus de jornada (DUPLA/CANCHERO) si la jornada está completa.
  perform porra.resolve_round_cards(m.round_id);
end;
$$;
