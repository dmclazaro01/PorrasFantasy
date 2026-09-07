-- ============================================================
-- Porra Fantasy · 0024 · Cuatro cartas nuevas
-- ============================================================
--   VAR      · en un partido FINISHED de la jornada, cambias UN gol del
--              resultado. Vale para toda la sala menos para ti. Solo un
--              VAR por (sala, partido). Recalcula al jugarse. Pública.
--   AUTOBUS  · en un partido tuyo sin empezar: ninguna carta te toca ahí
--              (tampoco el VAR) y acabas con mínimo 1 punto. Oculta
--              hasta el pitido inicial.
--   CANCHERO · eliges quién ganará la jornada (puedes ser tú). Si tu
--              elegido empata o gana por puntos de partidos, +5 para ti.
--              Solo antes de empezar la jornada. Pública.
--   DUPLA    · eliges un rival y esa jornada vais a medias: se suman los
--              puntos de partidos de ambos y se reparten (bonus = mitad
--              menos lo tuyo; puede ser negativo). Solo antes de empezar
--              la jornada; un solo dúo por jugador y jornada. Pública.
--
-- Reglas comunes de resolución (resolve_round_cards, idempotente: borra y
-- recalcula los bonus de la jornada cada vez que acaba un partido):
--   · Solo resuelve cuando la jornada está completa (sin SCHEDULED/LIVE).
--   · "Puntos de jornada" = suma de predictions.points (efectos por
--     partido incluidos). Los bonus NO cuentan para determinar al ganador
--     (evita circularidad) pero SÍ en general/jornada/bote.
--   · DUPLA se resuelve por orden de juego; el primer dúo que implique a
--     un jugador anula los posteriores (play_card además lo impide).
-- NOTA: los valores del enum se añaden con llamadas separadas
-- (ALTER TYPE ... ADD VALUE no admite bloque de transacción).
-- ============================================================

alter table porra.cards
  add column if not exists var_home int,
  add column if not exists var_away int;

-- Bonus de jornada (CANCHERO +5, ajustes DUPLA que pueden ser negativos
-- y con decimales). Sin políticas = denegado por defecto; las vistas
-- (security_invoker) lo leen con GRANT + política de miembros.
create table if not exists porra.card_bonus (
  id         bigint generated always as identity primary key,
  card_id    bigint not null references porra.cards (id) on delete cascade,
  pool_id    uuid not null references porra.pools (id) on delete cascade,
  user_id    uuid not null references porra.profiles (id) on delete cascade,
  round_id   bigint not null references porra.rounds (id) on delete cascade,
  points     numeric not null,
  created_at timestamptz not null default now(),
  unique (card_id, user_id)
);
create index if not exists card_bonus_pool_round_idx
  on porra.card_bonus (pool_id, round_id);
alter table porra.card_bonus enable row level security;
grant select on porra.card_bonus to authenticated, service_role;
drop policy if exists card_bonus_read on porra.card_bonus;
create policy card_bonus_read on porra.card_bonus
  for select to authenticated using (porra.is_pool_member(pool_id, auth.uid()));

-- ---------- Jugar una carta (reemplazo completo: 10 tipos) ----------
-- OJO: cambia la firma (nuevos p_var_home/p_var_away); hay que borrar el
-- overload viejo o PostgREST no sabría a cuál llamar.
drop function if exists porra.play_card(bigint, bigint, uuid, int);
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
  c porra.cards; m porra.matches; my_points int; round_started boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into c from porra.cards where id = p_card;
  if not found or c.owner_id <> auth.uid() then raise exception 'Carta no encontrada'; end if;
  if c.status <> 'GRANTED' then raise exception 'Esa carta ya se ha jugado'; end if;

  select exists (
    select 1 from porra.matches where round_id = c.round_id and kickoff <= now()
  ) into round_started;

  if c.type in ('CANCHERO', 'DUPLA') then
    -- Cartas de jornada: sin partido, con protagonista, antes del inicio.
    if c.type = 'DUPLA' and (p_target is null or p_target = auth.uid()) then
      raise exception 'Elige un rival';
    end if;
    if c.type = 'CANCHERO' and p_target is null then
      raise exception 'Elige a quién animas';
    end if;
    if not porra.is_pool_member(c.pool_id, p_target) then
      raise exception 'No está en la sala';
    end if;
    if round_started then raise exception 'La jornada ya ha empezado'; end if;
    if c.type = 'DUPLA' and exists (
      select 1 from porra.cards d
      where d.pool_id = c.pool_id and d.round_id = c.round_id and d.type = 'DUPLA'
        and d.status = 'PLAYED'
        and (d.owner_id in (auth.uid(), p_target) or d.target_user_id in (auth.uid(), p_target))
    ) then raise exception 'Ya hay una dupla con alguno de los dos en esta jornada'; end if;
  elsif c.type = 'VAR' then
    if p_match is null then raise exception 'Elige un partido'; end if;
    select * into m from porra.matches where id = p_match;
    if not found then raise exception 'Partido no válido'; end if;
    if m.round_id <> c.round_id then raise exception 'Tiene que ser de esta jornada'; end if;
    if m.status <> 'FINISHED' or m.home_goals is null or m.away_goals is null then
      raise exception 'El VAR solo vale en partidos ya jugados';
    end if;
    if p_var_home is null or p_var_away is null then raise exception 'Elige el gol a cambiar'; end if;
    if p_var_home < 0 or p_var_away < 0 then raise exception 'Marcador no válido'; end if;
    if abs(p_var_home - m.home_goals) + abs(p_var_away - m.away_goals) <> 1 then
      raise exception 'El VAR solo cambia UN gol';
    end if;
    if exists (
      select 1 from porra.cards v
      where v.pool_id = c.pool_id and v.type = 'VAR' and v.status = 'PLAYED' and v.match_id = p_match
    ) then raise exception 'Ya hay un VAR en ese partido'; end if;
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
      select coalesce(sum(points), 0)::int into my_points
        from porra.predictions where pool_id = c.pool_id and user_id = auth.uid();
      if p_bet > my_points then raise exception 'No tienes tantos puntos para apostar'; end if;
    end if;
  end if;

  update porra.cards
  set status = 'PLAYED',
      match_id = case when c.type in ('CANCHERO','DUPLA') then null else p_match end,
      target_user_id = case when c.type in ('ROJA','LESION','PRENSA','CANCHERO','DUPLA') then p_target else null end,
      bet_points = case when c.type = 'DOBLE' then p_bet else null end,
      var_home = case when c.type = 'VAR' then p_var_home else null end,
      var_away = case when c.type = 'VAR' then p_var_away else null end,
      played_at = now()
  where id = p_card
  returning * into c;

  -- El VAR se juega sobre un partido ya finalizado: recalcula al momento.
  if c.type = 'VAR' then perform porra.recalc_match(p_match); end if;
  return c;
end;
$$;

-- ---------- Resolución de bonus de jornada (idempotente) ----------
create or replace function porra.resolve_round_cards(p_round bigint)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  r record; d record; ch record;
  s_o int; s_t int; mx int; t_sum int;
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
      select coalesce(sum(pr.points), 0)::int into s_o
      from porra.predictions pr join porra.matches m on m.id = pr.match_id
      where pr.pool_id = r.pool_id and pr.user_id = d.owner_id and m.round_id = p_round;
      select coalesce(sum(pr.points), 0)::int into s_t
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
      select coalesce(max(x.s), 0)::int into mx from (
        select coalesce(sum(pr.points), 0) as s
        from porra.predictions pr join porra.matches m on m.id = pr.match_id
        where pr.pool_id = r.pool_id and m.round_id = p_round
        group by pr.user_id
      ) x;
      select coalesce(sum(pr.points), 0)::int into t_sum
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

-- ---------- Puntuación con efectos de cartas (reemplazo: VAR + AUTOBUS) ----------
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

    update porra.predictions set points = base, updated_at = now() where id = pr.id;
  end loop;

  -- Bonus de jornada (DUPLA/CANCHERO) si la jornada está completa.
  perform porra.resolve_round_cards(m.round_id);
end;
$$;

-- ---------- Visibilidad de cartas (reemplazo: revela las 4 nuevas) ----------
-- Propias siempre; VAR/CANCHERO/DUPLA públicas al jugarse; el resto de
-- ataque (incluido AUTOBUS) al pitido inicial; ESPIA nunca para los demás.
drop policy if exists cards_select on porra.cards;
create policy cards_select on porra.cards
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      porra.is_pool_member(pool_id, auth.uid())
      and status = 'PLAYED'
      and (
        type = 'PRENSA'  -- efecto público inmediato
        or type in ('VAR', 'CANCHERO', 'DUPLA')  -- apuestas públicas al jugarse
        or (
          type in ('ROJA', 'LESION', 'BOMBA', 'DOBLE', 'AUTOBUS')
          and exists (select 1 from porra.matches m where m.id = cards.match_id and m.kickoff <= now())
        )
        -- ESPIA nunca es visible para los demás
      )
    )
  );

-- La baraja semanal incluye las 4 nuevas.
create or replace function porra.ensure_my_card(p_pool uuid, p_round bigint)
returns porra.cards
language plpgsql security definer set search_path = porra, public as $$
declare c porra.cards;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not porra.is_pool_member(p_pool, auth.uid()) then raise exception 'No eres miembro'; end if;

  select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  if found then return c; end if;

  insert into porra.cards (pool_id, round_id, owner_id, type)
  values (
    p_pool, p_round, auth.uid(),
    (array['BOMBA','ROJA','LESION','ESPIA','PRENSA','DOBLE','VAR','AUTOBUS','CANCHERO','DUPLA'])[floor(random() * 10) + 1]::porra.card_type
  )
  on conflict (pool_id, round_id, owner_id) do nothing
  returning * into c;

  if c.id is null then
    select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  end if;
  return c;
end;
$$;

-- ---------- Clasificaciones con bonus de cartas ----------
-- OJO: points pasa de int a numeric (medios puntos de la DUPLA), y
-- CREATE OR REPLACE no permite cambiar el tipo: hay que dropear y recrear.
-- Se recrean también las vistas dependientes (bote) con su definición
-- vigente (0022) sin cambios.
drop view if exists porra.pool_bote;
drop view if exists porra.pool_bote_round;
drop view if exists porra.pool_standings;
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
  pf.avatar_url
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
group by pm.pool_id, r.id, pm.user_id, pf.display_name, pf.avatar_url, bb.b;

create view porra.pool_standings
with (security_invoker = on) as
select
  pm.pool_id,
  pm.user_id,
  pf.display_name,
  (
    coalesce(max(co.points), 0)
    + coalesce(sum(pr.points) filter (where po.carryover_cutoff is null or r.deadline > po.carryover_cutoff), 0)
    + coalesce(bb.b, 0)
  )::numeric as points,
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
left join (
  select cb.pool_id, cb.user_id, sum(cb.points) as b
  from porra.card_bonus cb
  join porra.rounds rb on rb.id = cb.round_id
  join porra.pools po2 on po2.id = cb.pool_id
  where po2.carryover_cutoff is null or rb.deadline > po2.carryover_cutoff
  group by cb.pool_id, cb.user_id
) bb on bb.pool_id = pm.pool_id and bb.user_id = pm.user_id
group by pm.pool_id, pm.user_id, pf.display_name, pf.avatar_url, bb.b;

grant select on porra.pool_standings to authenticated, service_role;
grant select on porra.pool_round_standings to authenticated, service_role;
grant select on porra.card_bonus to authenticated, service_role;

-- Vistas dependientes (definición vigente de 0022, sin cambios).
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
grant execute on function porra.play_card(bigint, bigint, uuid, int, int, int) to authenticated;
grant execute on function porra.resolve_round_cards(bigint) to authenticated;
