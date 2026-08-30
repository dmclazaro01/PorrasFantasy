-- ============================================================
-- Porra Fantasy · 0007 · Permitir que el usuario cree su propio perfil
-- ============================================================
-- Necesario para editar nombre/avatar antes de crear/unirse a una porra.
drop policy if exists profiles_insert_own on porra.profiles;
create policy profiles_insert_own on porra.profiles
  for insert to authenticated
  with check (id = auth.uid());
