-- ============================================================
-- Porra Fantasy · 0002 · Puntuacion automatica (schema "porra")
-- ============================================================
-- Aciertas 1·X·2 -> 3 pts ; resultado exacto -> 8 pts (sustituye).
-- Configurable por sala en porra.pools.points_1x2 / points_exact.
-- ============================================================

create or replace function porra.score_prediction(
  ph int, pa int, gh int, ga int, p_1x2 int, p_exact int
) returns int language sql immutable as $$
  select case
    when ph is null or pa is null or gh is null or ga is null then 0
    when ph = gh and pa = ga then p_exact
    when sign(ph - pa) = sign(gh - ga) then p_1x2
    else 0
  end;
$$;

create or replace function porra.on_match_change()
returns trigger language plpgsql security definer set search_path = porra, public as $$
begin
  if new.status = 'FINISHED'
     and new.home_goals is not null
     and new.away_goals is not null then
    update porra.predictions pr
    set points = porra.score_prediction(
          pr.pred_home, pr.pred_away,
          new.home_goals, new.away_goals,
          po.points_1x2, po.points_exact),
        updated_at = now()
    from porra.pools po
    where pr.match_id = new.id and po.id = pr.pool_id;
  else
    update porra.predictions
    set points = null, updated_at = now()
    where match_id = new.id and points is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_match_change on porra.matches;
create trigger trg_match_change
  after update of status, home_goals, away_goals on porra.matches
  for each row execute function porra.on_match_change();

create or replace function porra.recalc_match(p_match_id bigint)
returns void language plpgsql security definer set search_path = porra, public as $$
declare m porra.matches;
begin
  select * into m from porra.matches where id = p_match_id;
  if m.id is null then return; end if;
  if m.status = 'FINISHED' and m.home_goals is not null and m.away_goals is not null then
    update porra.predictions pr
    set points = porra.score_prediction(
          pr.pred_home, pr.pred_away, m.home_goals, m.away_goals,
          po.points_1x2, po.points_exact),
        updated_at = now()
    from porra.pools po
    where pr.match_id = m.id and po.id = pr.pool_id;
  else
    update porra.predictions set points = null, updated_at = now()
    where match_id = m.id and points is not null;
  end if;
end;
$$;

-- ---------- Clasificacion por sala ----------
create or replace view porra.pool_standings
with (security_invoker = on) as
select
  pr.pool_id,
  pr.user_id,
  pf.display_name,
  coalesce(sum(pr.points), 0)::int                     as points,
  count(*) filter (where pr.points is not null)        as graded,
  count(*) filter (where pr.points = po.points_exact)  as exacts,
  count(*) filter (where pr.points = po.points_1x2)    as partials
from porra.predictions pr
join porra.pools po    on po.id = pr.pool_id
join porra.profiles pf on pf.id = pr.user_id
group by pr.pool_id, pr.user_id, pf.display_name;
