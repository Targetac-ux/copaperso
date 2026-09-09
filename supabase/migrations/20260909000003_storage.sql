-- ============================================================================
-- CopaPerso · Storage
--   players → fotos de jugadores y del Tier List. Lectura pública.
--   brand   → material de marca. Lectura pública.
-- La escritura pasa siempre por server/api/* con la service_role key.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('players','players', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('brand',  'brand',   true, 10485760, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "public_read_players" on storage.objects
  for select to anon, authenticated using (bucket_id = 'players');

create policy "public_read_brand" on storage.objects
  for select to anon, authenticated using (bucket_id = 'brand');
