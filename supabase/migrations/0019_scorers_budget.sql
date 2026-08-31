-- ============================================================
-- Porra Fantasy · 0019 · Goleadores + estado de sincronización (presupuesto)
-- ============================================================
-- Goleadores del partido (de API-Football /fixtures/events, solo tipo Goal).
-- Formato: [{ "t":"home"|"away", "p":"Nombre", "m":45, "d":"Penalty" }]
alter table porra.matches add column if not exists scorers jsonb;

-- Estado del sincronizador en vivo: para repartir las ~100 peticiones/día de
-- API-Football (contador diario) y respetar un intervalo adaptativo entre
-- sondeos (marca de tiempo del último sondeo en vivo).
create table if not exists porra.sync_state (
  id           int primary key default 1,
  last_live_ts timestamptz,
  day          date,
  calls        int not null default 0
);
insert into porra.sync_state (id) values (1) on conflict (id) do nothing;

-- La Edge Function (service_role) escribe aquí; el frontend no lo necesita.
grant all on porra.sync_state to service_role;
grant select on porra.sync_state to authenticated, anon;
