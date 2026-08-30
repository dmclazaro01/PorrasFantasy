-- ============================================================
-- Porra Fantasy · 0012 · Detalle en vivo del partido
-- ============================================================
-- football-data.org (gratis) da marcador en vivo, marcador al descanso y
-- estado (incl. PAUSED = descanso). No da minuto ni goleadores (feed de pago).
alter table porra.matches add column if not exists ht_home int;
alter table porra.matches add column if not exists ht_away int;
alter table porra.matches add column if not exists live_status text; -- crudo: TIMED/IN_PLAY/PAUSED/FINISHED...
