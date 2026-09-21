-- ============================================================
-- Porra Fantasy · 0041 · Doble o nada: solo apuestas lo de la jornada
-- ============================================================
-- El DOBLE permitía apostar contra el saldo GENERAL (suma de todos los
-- puntos del jugador en la sala). Se cambia a que el saldo apostable sean
-- solo los puntos conseguidos EN LA JORNADA DE LA CARTA (los que llevas
-- en esa jornada: partidos ya finalizados de esa misma jornada).
-- Consecuencia natural: si en esa jornada aún no has sumado nada, no hay
-- nada que apostar. La apuesta sigue siendo 1 por partido y se resuelve
-- igual (acierta +X, falla -X/2), pero ya no puedes jugarte la general.
-- Se recrea play_card (base: 0040) y se cambia solo el cálculo del saldo.
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

    -- DOBLE: la apuesta se limita a los puntos YA CONSEGUIDOS EN ESTA
    -- JORNADA (partidos finalizados de la jornada de la carta), no al
    -- saldo general de la porra.
    if c.type = 'DOBLE' then
      if coalesce(p_bet, 0) <= 0 then raise exception 'Indica cuántos puntos apuestas'; end if;
      select coalesce(sum(pr.points), 0) into my_points
        from porra.predictions pr
        join porra.matches mm on mm.id = pr.match_id
        where pr.pool_id = c.pool_id and pr.user_id = auth.uid()
          and mm.round_id = c.round_id;
      if p_bet > my_points then
        raise exception 'Solo puedes apostar los puntos de esta jornada';
      end if;
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
