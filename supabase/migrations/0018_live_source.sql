-- ============================================================
-- Porra Fantasy · 0018 · Fuente en vivo (API-Football)
-- ============================================================
-- football-data.org (gratis) no da marcadores en directo. Añadimos API-Football
-- como fuente EN VIVO. Necesitamos guardar su id de fixture (distinto al de
-- football-data) para poder consultar el resultado final por id cuando el
-- partido sale de la lista de "en vivo", y el minuto de juego.
alter table porra.matches add column if not exists af_fixture_id bigint;
alter table porra.matches add column if not exists minute int;
create index if not exists matches_af_fixture_idx on porra.matches (af_fixture_id);
