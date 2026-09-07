-- ============================================================
-- Porra Fantasy · 0023 · Throttle anti-fuerza-bruta en join_pool
-- ============================================================
-- Los códigos de sala (6 hex) solo son visibles para miembros, pero
-- join_pool acepta intentos de cualquier autenticado. Sin límite, un
-- script podría probar códigos hasta dar con una sala. Con 20 intentos
-- / 10 min por usuario, barrer el espacio (16,7 M) tardaría siglos, y
-- encontrar 1 sala entre pocas, años. Requiere que "Confirm email"
-- siga activado (si no, el atacante crea cuentas ilimitadas y el
-- límite por usuario no sirve).
-- ============================================================

create table if not exists porra.join_attempts (
  user_id     uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time_idx
  on porra.join_attempts (user_id, attempted_at);

-- Sin políticas = denegado para anon/authenticated; solo el owner
-- (y por tanto las funciones security definer) puede tocarla.
alter table porra.join_attempts enable row level security;

create or replace function porra.join_pool(p_code text)
returns porra.pools
language plpgsql security definer set search_path = porra, public as $$
declare
  target porra.pools;
  attempts int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform porra.ensure_profile();

  -- Limpieza perezosa (evita que la tabla crezca sin control).
  delete from porra.join_attempts where attempted_at < now() - interval '1 hour';

  select count(*) into attempts from porra.join_attempts
  where user_id = auth.uid() and attempted_at > now() - interval '10 minutes';
  if attempts >= 20 then
    raise exception 'Demasiados intentos. Espera unos minutos.';
  end if;

  select * into target from porra.pools where invite_code = upper(trim(p_code));
  if target.id is null then
    insert into porra.join_attempts (user_id) values (auth.uid());
    raise exception 'Código de sala no válido';
  end if;

  insert into porra.pool_members (pool_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (pool_id, user_id) do nothing;

  return target;
end;
$$;
