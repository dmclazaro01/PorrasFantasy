-- ============================================================
-- Porra Fantasy · 0013 · Override manual de resultados (admin)
-- ============================================================
-- football-data.org (gratis) a veces deja partidos "colgados" (no actualiza
-- el resultado final). Un admin puede corregir el marcador/estado a mano.
-- El partido corregido queda marcado (manual_override) para que el sync
-- automático NO lo vuelva a pisar.

alter table porra.profiles add column if not exists is_admin boolean not null default false;
alter table porra.matches  add column if not exists manual_override boolean not null default false;

create or replace function porra.admin_set_match(
  p_match bigint, p_home int, p_away int, p_status text
) returns void
language plpgsql security definer set search_path = porra, public as $$
begin
  if not exists (select 1 from porra.profiles where id = auth.uid() and is_admin) then
    raise exception 'Solo un administrador puede editar resultados';
  end if;
  if p_status not in ('SCHEDULED', 'LIVE', 'FINISHED') then
    raise exception 'Estado no válido';
  end if;
  update porra.matches
  set status = p_status::porra.match_status,
      home_goals = p_home,
      away_goals = p_away,
      live_status = case p_status when 'FINISHED' then 'FINISHED' when 'LIVE' then 'IN_PLAY' else 'TIMED' end,
      manual_override = true
  where id = p_match;
end;
$$;

grant execute on function porra.admin_set_match(bigint, int, int, text) to authenticated;

-- Hacer admin al dueño de la porra
update porra.profiles set is_admin = true
where id = (select id from auth.users where email = 'daniellazaro2001@gmail.com');
