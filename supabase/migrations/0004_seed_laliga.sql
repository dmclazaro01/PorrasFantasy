-- ============================================================
-- Porra Fantasy · 0004 · Semilla: LaLiga (schema "porra")
-- ============================================================
-- Fuente de datos: football-data.org (gratis, temporada actual).
-- Codigo de competicion "PD" (Primera Division), id numerico 2014.
-- season = ano de inicio de temporada (2026 = 2026-27).
insert into porra.competitions (name, api_league_id, season)
values ('LaLiga', 2014, 2026)
on conflict (api_league_id, season) do nothing;
