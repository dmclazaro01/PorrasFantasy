-- ============================================================
-- Porra Fantasy · 0040 · Medios puntos (LESION y DOBLE)
-- ============================================================
-- Bug: predictions.points era int y recalc_match hacía
--   base int; base := base / 2;  /  base - (bet / 2)
-- En Postgres, int / int es división entera con truncado:
--   3 / 2 = 1  (debería ser 1,5). Por eso a Pablo, con 3 pts y
--   LESION, le cayó 1 en vez de 1,5. Lo mismo pasaba con la
--   penalización del DOBLE con apuesta impar (3/2=1 en vez de 1,5).
--
-- Fix:
--   · predictions.points pasa a numeric (acepta 1,5 / -1,5 / etc).
--   · recalc_match usa base/bet numeric y divide por 2.0.
--   · resolve_round_cards y play_card dejan de truncar sumas con
--     ::int (una LESION a mitad también afectaba al cálculo de la
--     DUPLA/CANCHERO y al saldo disponible para el DOBLE).
--   · Se recalculan los partidos FINISHED para corregir el histórico.
-- Las vistas (pool_standings, pool_round_standings, bote) ya sumaban
-- como numeric por la DUPLA: se recrean con su definición vigente.
-- ============================================================

-- 1) La columna debe aceptar medios puntos. Postgres no deja cambiar
-- el tipo de una columna usada por vistas: se dropean y se recrean con
-- su definición vigente (standings = 0032, jornada/bote = 0027).
drop view if exists porra.pool_bote;
drop view if exists porra.pool_bote_round;
drop view if exists porra.pool_standings;
drop view if exists porra.pool_round_standings;

alter table porra.predictions
  alter column points type numeric using points::numeric;

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

create view porra.pool_standings
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

-- 2) Resolución de bonus de jornada sin truncar (copia de 0024 con numeric).
create or replace function porra.resolve_round_cards(p_round bigint)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  r record; d record; ch record;
  s_o numeric; s_t numeric; mx numeric; t_sum numeric;
  paired uuid[] := '{}';
begin
  -- Solo cuando no queden partidos por jugar o en juego.
  if exists (
    select 1 from porra.matches where round_id = p_round and status in ('SCHEDULED','LIVE')
  ) then return; end if;

  for r in
    select distinct pool_id from porra.cards
    where round_id = p_round and type in ('DUPLA','CANCHERO') and status = 'PLAYED'
  loop
    delete from porra.card_bonus where pool_id = r.pool_id and round_id = p_round;

    -- DUPLA por orden de juego; un jugador solo entra en un dúo.
    for d in
      select * from porra.cards
      where pool_id = r.pool_id and round_id = p_round and type = 'DUPLA' and status = 'PLAYED'
      order by played_at, id
    loop
      if d.owner_id = any (paired) or d.target_user_id = any (paired) then continue; end if;
      select coalesce(sum(pr.points), 0) into s_o
      from porra.predictions pr join porra.matches m on m.id = pr.match_id
      where pr.pool_id = r.pool_id and pr.user_id = d.owner_id and m.round_id = p_round;
      select coalesce(sum(pr.points), 0) into s_t
      from porra.predictions pr join porra.matches m on m.id = pr.match_id
      where pr.pool_id = r.pool_id and pr.user_id = d.target_user_id and m.round_id = p_round;
      insert into porra.card_bonus (card_id, pool_id, user_id, round_id, points)
      values (d.id, r.pool_id, d.owner_id, p_round, (s_o + s_t) / 2.0 - s_o),
             (d.id, r.pool_id, d.target_user_id, p_round, (s_o + s_t) / 2.0 - s_t);
      paired := paired || d.owner_id || d.target_user_id;
    end loop;

    -- CANCHERO: gana si el elegido empata o lidera por puntos de partidos.
    for ch in
      select * from porra.cards
      where pool_id = r.pool_id and round_id = p_round and type = 'CANCHERO' and status = 'PLAYED'
      order by played_at, id
    loop
      select coalesce(max(x.s), 0) into mx from (
        select coalesce(sum(pr.points), 0) as s
        from porra.predictions pr join porra.matches m on m.id = pr.match_id
        where pr.pool_id = r.pool_id and m.round_id = p_round
        group by pr.user_id
      ) x;
      select coalesce(sum(pr.points), 0) into t_sum
      from porra.predictions pr join porra.matches m on m.id = pr.match_id
      where pr.pool_id = r.pool_id and pr.user_id = ch.target_user_id and m.round_id = p_round;
      if mx > 0 and t_sum = mx then
        insert into porra.card_bonus (card_id, pool_id, user_id, round_id, points)
        values (ch.id, r.pool_id, ch.owner_id, p_round, 5);
      end if;
    end loop;
  end loop;
end;
$$;

-- 3) Puntuación por partido con mitad exacta (reemplaza a la 0028).
create or replace function porra.recalc_match(p_match_id bigint)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  m porra.matches; pr record; base numeric; bet numeric; is_exact boolean;
  eff_h int; eff_a int; vh int; va int; has_bus boolean;
begin
  select * into m from porra.matches where id = p_match_id;
  if not found then return; end if;

  if not (m.status = 'FINISHED' and m.home_goals is not null and m.away_goals is not null) then
    update porra.predictions set points = null, updated_at = now()
    where match_id = p_match_id and points is not null;
    return;
  end if;

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

    -- VAR dirigido: solo cambia el resultado de su objetivo (el propio si
    -- no hay rival). El propio tiene prioridad sobre el rival; a igualdad,
    -- el más antiguo. El bus inmuniza.
    vh := null; va := null;
    if not has_bus then
      select v.var_home, v.var_away into vh, va
      from porra.cards v
      where v.pool_id = pr.pool_id and v.type = 'VAR' and v.status = 'PLAYED'
        and v.match_id = p_match_id
        and ((v.owner_id = pr.user_id and (v.target_user_id is null or v.target_user_id = pr.user_id))
          or (v.target_user_id = pr.user_id and v.owner_id <> pr.user_id))
      order by case when v.owner_id = pr.user_id then 0 else 1 end, v.played_at, v.id
      limit 1;
    end if;
    eff_h := m.home_goals; eff_a := m.away_goals;
    if vh is not null then
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
        base := base / 2.0;
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
      if is_exact then base := base + bet; else base := base - (bet / 2.0); end if;
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

-- 4) Saldo para el DOBLE sin truncar (misma lógica que la 0036).
create or replace function porra.play_card(
  p_card bigint,
  p_match bigint default null,
  p_target uuid default null,
  p_bet int default null,
  p_var_home int default null,
  p_var_away int default null
) returns porra.cards
language plpgsql security definer set search_path = porra, public as $$
declare
  c porra.cards; m porra.matches; my_points numeric; started_count int; played_count int; last_fin timestamptz;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into c from porra.cards where id = p_card;
  if not found or c.owner_id <> auth.uid() then raise exception 'Carta no encontrada'; end if;
  if c.status <> 'GRANTED' then raise exception 'Esa carta ya se ha jugado'; end if;

  if c.type = 'CANCHERO' then
    -- Con protagonista. Regla general: antes de empezar la jornada.
    -- Excepción SOLO jornada 11 (J6, arrancó antes de existir la app):
    -- vale hasta el comienzo del segundo partido.
    if p_target is null then
      raise exception 'Elige a quién animas';
    end if;
    if not porra.is_pool_member(c.pool_id, p_target) then
      raise exception 'No está en la sala';
    end if;
    select count(*) into started_count
    from porra.matches where round_id = c.round_id and kickoff <= now();
    if c.round_id = 11 then
      if started_count >= 2 then
        raise exception 'Solo se puede jugar antes del segundo partido';
      end if;
    elsif started_count > 0 then
      raise exception 'La jornada ya ha empezado';
    end if;
  elsif c.type = 'DUPLA' then
    -- Un rival, un solo dúo por jugador y jornada, con 5 jugados o menos.
    if p_target is null or p_target = auth.uid() then
      raise exception 'Elige un rival';
    end if;
    if not porra.is_pool_member(c.pool_id, p_target) then
      raise exception 'No está en la sala';
    end if;
    if exists (
      select 1 from porra.cards d
      where d.pool_id = c.pool_id and d.round_id = c.round_id and d.type = 'DUPLA'
        and d.status = 'PLAYED'
        and (d.owner_id in (auth.uid(), p_target) or d.target_user_id in (auth.uid(), p_target))
    ) then raise exception 'Ya hay una dupla con alguno de los dos en esta jornada'; end if;
    select count(*) into played_count
    from porra.matches where round_id = c.round_id and status = 'FINISHED';
    if played_count > 5 then
      raise exception 'La dupla solo se puede jugar con 5 partidos jugados o menos';
    end if;
  elsif c.type = 'VAR' then
    if p_match is null then raise exception 'Elige un partido'; end if;
    select * into m from porra.matches where id = p_match;
    if not found then raise exception 'Partido no válido'; end if;
    -- La carta puede ser de otra jornada: basta que el partido sea de la
    -- misma competición de la sala.
    if exists (select 1 from porra.pools p where p.id = c.pool_id and p.competition_id is not null)
       and not exists (
      select 1 from porra.pools p
      join porra.rounds r on r.competition_id = p.competition_id
      where p.id = c.pool_id and r.id = m.round_id
    ) then raise exception 'Ese partido no es de tu competición'; end if;
    if m.status <> 'FINISHED' or m.home_goals is null or m.away_goals is null then
      raise exception 'El VAR solo vale en partidos ya jugados';
    end if;
    -- Ventana: hasta 24 h después del comienzo del último finalizado de SU jornada.
    select max(m2.kickoff) into last_fin
    from porra.matches m2
    where m2.round_id = m.round_id and m2.status = 'FINISHED';
    if last_fin is null or now() > last_fin + interval '24 hours' then
      raise exception 'El plazo del VAR terminó (24 h tras el último finalizado)';
    end if;
    if p_var_home is null or p_var_away is null then raise exception 'Elige el gol a cambiar'; end if;
    if p_var_home < 0 or p_var_away < 0 then raise exception 'Marcador no válido'; end if;
    if abs(p_var_home - m.home_goals) + abs(p_var_away - m.away_goals) <> 1 then
      raise exception 'El VAR solo cambia UN gol';
    end if;
    -- Objetivo: nadie (= para mí) o un rival. Sobre su FINALISSIMA no entra.
    if p_target is not null and p_target <> auth.uid() then
      if not porra.is_pool_member(c.pool_id, p_target) then
        raise exception 'No está en la sala';
      end if;
      if exists (
        select 1 from porra.finalissima f
        where f.pool_id = c.pool_id and f.user_id = p_target and f.match_id = p_match
      ) then raise exception 'Ese rival tiene FINALISSIMA en ese partido: el VAR no entra'; end if;
    end if;
  else
    -- BOMBA, ROJA, LESION, ESPIA, PRENSA, DOBLE, AUTOBUS: partido futuro de la jornada.
    if p_match is null then raise exception 'Elige un partido'; end if;
    select * into m from porra.matches where id = p_match;
    if not found then raise exception 'Partido no válido'; end if;
    if m.round_id <> c.round_id then raise exception 'Tiene que ser de esta jornada'; end if;
    if m.kickoff <= now() then raise exception 'Ese partido ya ha empezado'; end if;

    -- objetivo rival requerido para ROJA/LESION/PRENSA
    if c.type in ('ROJA','LESION','PRENSA') then
      if p_target is null or p_target = auth.uid() then raise exception 'Elige un rival'; end if;
      if not porra.is_pool_member(c.pool_id, p_target) then raise exception 'Ese rival no está en la sala'; end if;
    end if;

    -- DOBLE: apuesta válida y con puntos suficientes
    if c.type = 'DOBLE' then
      if coalesce(p_bet, 0) <= 0 then raise exception 'Indica cuántos puntos apuestas'; end if;
      select coalesce(sum(points), 0) into my_points
        from porra.predictions where pool_id = c.pool_id and user_id = auth.uid();
      if p_bet > my_points then raise exception 'No tienes tantos puntos para apostar'; end if;
    end if;
  end if;

  update porra.cards
  set status = 'PLAYED',
      match_id = case when c.type in ('CANCHERO','DUPLA') then null else p_match end,
      target_user_id = case when c.type in ('ROJA','LESION','PRENSA','CANCHERO','DUPLA','VAR') then p_target else null end,
      bet_points = case when c.type = 'DOBLE' then p_bet else null end,
      var_home = case when c.type = 'VAR' then p_var_home else null end,
      var_away = case when c.type = 'VAR' then p_var_away else null end,
      played_at = now()
  where id = p_card
  returning * into c;

  -- El VAR se juega sobre un partido ya finalizado: recalcula al momento.
  if c.type = 'VAR' then perform porra.recalc_match(p_match); end if;
  -- DUPLA/CANCHERO de jornada: resuelve por si la jornada ya está completa.
  if c.type in ('DUPLA', 'CANCHERO') then perform porra.resolve_round_cards(c.round_id); end if;
  return c;
end;
$$;

-- 5) Corrige el histórico: recalcula todo lo ya finalizado con la
-- mitad exacta (3 → 1,5). Idempotente.
do $$
declare r record;
begin
  for r in select id from porra.matches where status = 'FINISHED' loop
    perform porra.recalc_match(r.id);
  end loop;
end $$;
