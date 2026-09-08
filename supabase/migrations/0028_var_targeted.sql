-- ============================================================
-- Porra Fantasy · 0028 · VAR dirigido (ya no es de sala)
-- ============================================================
-- El VAR afecta SOLO a un jugador: al propio (sin rival, o
-- eligiéndose a uno mismo) o a UN rival. Sobre la FINALISSIMA de un
-- rival NO entra (se rechaza al jugarse).
-- Prioridades en el cálculo: el VAR propio gana al rival; a igualdad,
-- el más antiguo. El AUTOBUS sigue inmunizando de todo. La firma de
-- play_card NO cambia (p_target ya existía).
-- ============================================================

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
      select coalesce(sum(points), 0)::int into my_points
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
  return c;
end;
$$;

-- ---------- Puntuación: VAR solo a su objetivo ----------
create or replace function porra.recalc_match(p_match_id bigint)
returns void
language plpgsql security definer set search_path = porra, public as $$
declare
  m porra.matches; pr record; base int; bet int; is_exact boolean;
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
