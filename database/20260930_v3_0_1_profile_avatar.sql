-- ============================================================================
-- ReqGen v3.0.1 — Profile photo support
-- ADDITIVE ONLY. Safe to run more than once.
--   * Adds ONE nullable column: public.profiles.avatar_url
--   * Creates ONE storage bucket: avatars (public read, 1 MB, images only)
--   * Adds storage policies so each user can only add/replace/remove files
--     inside their OWN folder (avatars/<their user id>/...)
-- It does NOT alter, move or delete any existing table, row, policy or file.
-- ============================================================================

-- 1) Column (nullable, no default => existing rows are untouched)
alter table public.profiles
  add column if not exists avatar_url text;

-- 2) Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- 3) Policies (dropped-if-exists by their own new names only, then created)
drop policy if exists "reqgen_avatars_public_read" on storage.objects;
create policy "reqgen_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "reqgen_avatars_owner_insert" on storage.objects;
create policy "reqgen_avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reqgen_avatars_owner_update" on storage.objects;
create policy "reqgen_avatars_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reqgen_avatars_owner_delete" on storage.objects;
create policy "reqgen_avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Verification — one result table; every row should read OK
select 'profiles.avatar_url column' as check_item,
       case when exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='profiles' and column_name='avatar_url')
            then 'OK' else 'MISSING' end as status
union all
select 'avatars bucket',
       case when exists (select 1 from storage.buckets where id='avatars') then 'OK' else 'MISSING' end
union all
select 'avatar storage policies (expect 4)',
       case when (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
                  and policyname like 'reqgen_avatars_%') = 4 then 'OK' else 'CHECK' end;
