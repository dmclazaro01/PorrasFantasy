-- ============================================================
-- Porra Fantasy · 0008 · Cartas (mini-juego semanal)
-- ============================================================
-- Cada jugador recibe 1 carta por jornada. Tipos y efectos:
--   BOMBA  · minas un partido con tu marcador; rival con tu MISMO marcador
--            exacto no puntúa ahí (tú inmune). Oculta hasta el kickoff.
--   ROJA   · expulsas a un rival de un partido: no puntúa ahí. Revela al kickoff.
--   LESION · lesionas a un rival: puntúa la MITAD en ese partido. Revela al kickoff.
--   ESPIA  · desde 1h antes del partido ves las predicciones de todos (y copias).
--   PRENSA · la predicción de un rival en un partido se hace PÚBLICA para la sala.
--   DOBLE  · apuestas X pts a clavar el resultado exacto: aciertas +X, fallas -X/2.
-- ============================================================

do $$ begin
  create type porra.card_type as enum ('BOMBA','ROJA','LESION','ESPIA','PRENSA','DOBLE');
exception when duplicate_object then null; end $$;

create table if not exists porra.cards (
  id             bigint generated always as identity primary key,
  pool_id        uuid not null references porra.pools (id) on delete cascade,
  round_id       bigint not null references porra.rounds (id) on delete cascade,
  owner_id       uuid not null references porra.profiles (id) on delete cascade,
  type           porra.card_type not null,
  status         text not null default 'GRANTED' check (status in ('GRANTED','PLAYED')),
  match_id       bigint references porra.matches (id) on delete cascade,
  target_user_id uuid references porra.profiles (id) on delete set null,
  bet_points     int,
  played_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (pool_id, round_id, owner_id)   -- 1 carta por jugador y jornada
);
create index if not exists cards_pool_round_idx on porra.cards (pool_id, round_id);
create index if not exists cards_match_idx on porra.cards (match_id);

alter table porra.cards enable row level security;

-- Ver cartas: las tuyas siempre; las de otros solo cuando se "destapan".
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
        or (
          type in ('ROJA', 'LESION', 'BOMBA', 'DOBLE')
          and exists (select 1 from porra.matches m where m.id = cards.match_id and m.kickoff <= now())
        )
        -- ESPIA nunca es visible para los demás
      )
    )
  );

grant select on porra.cards to authenticated;
grant all privileges on porra.cards to service_role;
grant usage, select on all sequences in schema porra to authenticated, service_role;

-- ---------- Reparto semanal (perezoso): 1 carta aleatoria por jugador ----------
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
    (array['BOMBA','ROJA','LESION','ESPIA','PRENSA','DOBLE'])[floor(random() * 6) + 1]::porra.card_type
  )
  on conflict (pool_id, round_id, owner_id) do nothing
  returning * into c;

  if c.id is null then
    select * into c from porra.cards where pool_id = p_pool and round_id = p_round and owner_id = auth.uid();
  end if;
  return c;
end;
$$;

-- ---------- Jugar una carta ----------
create or replace function porra.play_card(
  p_card bigint,
  p_match bigint default null,
  p_target uuid default null,
  p_bet int default null
) returns porra.cards
language plpgsql security definer set search_path = porra, public as $$
declare c porra.cards; m porra.matches; my_points int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into c from porra.cards where id = p_card;
  if not found or c.owner_id <> auth.uid() then raise exception 'Carta no encontrada'; end if;
  if c.status <> 'GRANTED' then raise exception 'Esa carta ya se ha jugado'; end if;
  if p_match is null then raise exception 'Elige un partido'; end if;

  select * into m from porra.matches where id = p_match;
  if not found then raise exception 'Partido no válido'; end if;
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

  update porra.cards
  set status = 'PLAYED',
      match_id = p_match,
      target_user_id = case when c.type in ('ROJA','LESION','PRENSA') then p_target else null end,
      bet_points = case when c.type = 'DOBLE' then p_bet else null end,
      played_at = now()
  where id = p_card
  returning * into c;
  return c;
end;
$$;

grant execute on function porra.ensure_my_card(uuid, bigint) to authenticated;
grant execute on function porra.play_card(bigint, bigint, uuid, int) to authenticated;

-- ============================================================
-- Puntuación con efectos de cartas
-- ============================================================
create or replace function porra.recalc_match(p_match_id bigint)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare m porra.matches; pr record; base int; bet int; is_exact boolean;
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
    base := porra.score_prediction(pr.pred_home, pr.pred_away, m.home_goals, m.away_goals, pr.points_1x2, pr.points_exact);
    is_exact := (pr.pred_home = m.home_goals and pr.pred_away = m.away_goals);

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

    -- DOBLE O NADA (carta propia sobre este partido)
    select bet_points into bet from porra.cards c
      where c.pool_id = pr.pool_id and c.type = 'DOBLE' and c.status = 'PLAYED'
        and c.match_id = p_match_id and c.owner_id = pr.user_id;
    if bet is not null then
      if is_exact then base := base + bet; else base := base - (bet / 2); end if;
    end if;

    update porra.predictions set points = base, updated_at = now() where id = pr.id;
  end loop;
end;
$$;

create or replace function porra.on_match_change()
returns trigger language plpgsql security definer set search_path = porra, public as $$
begin
  perform porra.recalc_match(new.id);
  return new;
end;
$$;

drop trigger if exists trg_match_change on porra.matches;
create trigger trg_match_change
  after update of status, home_goals, away_goals on porra.matches
  for each row execute function porra.on_match_change();

-- ============================================================
-- Visibilidad de predicciones: base (propio / tras kickoff) + PRENSA + ESPIA
-- ============================================================
drop policy if exists predictions_select on porra.predictions;
create policy predictions_select on porra.predictions
  for select to authenticated
  using (
    porra.is_pool_member(pool_id, auth.uid())
    and (
      user_id = auth.uid()
      or exists (select 1 from porra.matches m where m.id = predictions.match_id and m.kickoff <= now())
      -- PRENSA: la predicción de ese rival en ese partido es pública
      or exists (
        select 1 from porra.cards c
        where c.pool_id = predictions.pool_id and c.type = 'PRENSA' and c.status = 'PLAYED'
          and c.match_id = predictions.match_id and c.target_user_id = predictions.user_id
      )
      -- ESPIA: el solicitante espió este partido y faltan <= 1h para el kickoff
      or exists (
        select 1 from porra.cards c
        join porra.matches m on m.id = c.match_id
        where c.pool_id = predictions.pool_id and c.type = 'ESPIA' and c.status = 'PLAYED'
          and c.owner_id = auth.uid() and c.match_id = predictions.match_id
          and now() >= m.kickoff - interval '1 hour'
      )
    )
  );
