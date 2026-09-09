-- ============================================================
-- Porra Fantasy · 0030 · RLS en sync_state (aviso de Supabase)
-- ============================================================
-- sync_state (contadores de sincronización de las Edge Functions) era
-- la única tabla propia sin RLS y con SELECT para anon/authenticated.
-- El frontend no la lee nunca; solo la escribe service_role (que no
-- pasa por RLS). Se revocan los grants y se activa RLS sin políticas:
-- denegado para todos menos service_role/postgres.
-- ============================================================

revoke all on porra.sync_state from anon, authenticated;
alter table porra.sync_state enable row level security;
