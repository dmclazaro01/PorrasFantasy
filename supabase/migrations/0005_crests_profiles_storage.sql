-- ============================================================
-- Porra Fantasy · 0005 · Escudos + avatar + storage
-- ============================================================

-- Escudos de equipo en los partidos (URL de football-data.org)
alter table porra.matches add column if not exists home_crest text;
alter table porra.matches add column if not exists away_crest text;

-- Foto de perfil
alter table porra.profiles add column if not exists avatar_url text;

-- Bucket público para avatares
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Políticas de storage para el bucket avatars:
--   lectura pública; cada usuario escribe solo en su carpeta (uid/...)
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
