-- =============================================================================
-- ReqGen 6.0.0, app 4.0.0 step 1: the app works with the database only.
--
--   1. App devices and fingerprint confirmation
--      After signing in with password and authenticator (2FA), the app registers this phone once.
--      A random device key stays in the phone's secure keystore, opened only by the fingerprint or
--      the app PIN. The database keeps only its SHA-256 fingerprint. When an action needs
--      confirmation (send, approve, sign, pay), the app proves the key and the database writes the
--      same one-action pass that an SMS or e-mail code writes. Every existing rule is unchanged.
--      Five wrong proofs switch the device off. The Super Admin can switch off any device.
--   2. App error reports: what failed, on which screen, in which version. Read only by the Super
--      Admin and the Developer. No outside tracker.
--   3. App releases: the newest APK is announced from the database, not from the website.
--   4. Help contact: the name of the person holding the Auditor position, shown to staff when a
--      subhead cannot cover an amount. Balances are never shown to staff.
--
-- Nothing is dropped. Safe to run twice. Ends with a report where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v600_report (step text, item text, result text, status text);
truncate v600_report;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 1. App devices -----------------------------------------------------------------------------
create table if not exists public.reqgen_app_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  secret_hash text not null,
  label text,
  platform text,
  app_version text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failed_attempts int not null default 0,
  revoked_at timestamptz,
  revoked_reason text
);
create index if not exists reqgen_app_devices_user_idx on public.reqgen_app_devices (user_id, created_at desc);
alter table public.reqgen_app_devices enable row level security;
revoke all on public.reqgen_app_devices from anon, authenticated;
grant select (id, user_id, label, platform, app_version, created_at, last_used_at, revoked_at, revoked_reason) on public.reqgen_app_devices to authenticated;
drop policy if exists reqgen_app_devices_read on public.reqgen_app_devices;
create policy reqgen_app_devices_read on public.reqgen_app_devices for select to authenticated
  using (user_id = auth.uid() or public.reqgen_is_admin());
insert into v600_report values ('1 devices', 'reqgen_app_devices', 'table ready (people read their own; only the functions below write)', 'OK');

-- 2FA level of the current session (aal2 = signed in with password and authenticator)
create or replace function public.reqgen_session_aal()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '');
$$;

create or replace function public.reqgen_app_device_register(p_secret text, p_label text default null, p_platform text default null, p_version text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then raise exception 'REQGEN_SIGNED_OUT: Please sign in again.' using errcode = 'P0001'; end if;
  if public.reqgen_session_aal() <> 'aal2' then
    raise exception 'REQGEN_2FA_NEEDED: Sign in with your authenticator code first.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.id = me and p.is_active = false) then
    raise exception 'REQGEN_DEACTIVATED: This account is deactivated.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_secret, '')) < 43 then
    raise exception 'The device key is too short.' using errcode = 'P0001';
  end if;
  insert into public.reqgen_app_devices (user_id, secret_hash, label, platform, app_version)
  values (me, encode(extensions.digest(p_secret, 'sha256'), 'hex'), left(p_label, 80), left(p_platform, 20), left(p_version, 20))
  returning id into v_id;
  -- keep the three newest phones of a person; older ones are switched off
  update public.reqgen_app_devices set revoked_at = now(), revoked_reason = 'A newer phone was set up'
   where user_id = me and revoked_at is null
     and id not in (select id from public.reqgen_app_devices where user_id = me and revoked_at is null order by created_at desc limit 3);
  return v_id;
end;
$$;
revoke all on function public.reqgen_app_device_register(text, text, text, text) from public, anon;
grant execute on function public.reqgen_app_device_register(text, text, text, text) to authenticated;

create or replace function public.reqgen_app_action_pass(p_device uuid, p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  d public.reqgen_app_devices;
  recent int;
begin
  if me is null then raise exception 'REQGEN_SIGNED_OUT: Please sign in again.' using errcode = 'P0001'; end if;
  select * into d from public.reqgen_app_devices where id = p_device and user_id = me for update;
  if d.id is null or d.revoked_at is not null then
    raise exception 'REQGEN_DEVICE_OFF: This phone is no longer set up for ReqGen. Sign in again.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.id = me and p.is_active = false) then
    raise exception 'REQGEN_DEACTIVATED: This account is deactivated.' using errcode = 'P0001';
  end if;
  if d.secret_hash <> encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') then
    update public.reqgen_app_devices
       set failed_attempts = failed_attempts + 1,
           revoked_at = case when failed_attempts + 1 >= 5 then now() else null end,
           revoked_reason = case when failed_attempts + 1 >= 5 then '5 wrong device proofs' else null end
     where id = d.id;
    return false;
  end if;
  select count(*) into recent from public.reqgen_action_passes where user_id = me and created_at > now() - interval '10 minutes';
  if recent >= 40 then
    raise exception 'Too many actions in a short time. Wait a few minutes and try again.' using errcode = 'P0001';
  end if;
  insert into public.reqgen_action_passes (user_id, purpose, channel) values (me, 'action', 'app');
  update public.reqgen_app_devices set failed_attempts = 0, last_used_at = now() where id = d.id;
  return true;
end;
$$;
revoke all on function public.reqgen_app_action_pass(uuid, text) from public, anon;
grant execute on function public.reqgen_app_action_pass(uuid, text) to authenticated;

-- switch a phone off: the owner (their own phones) or the Super Admin (anyone's)
create or replace function public.reqgen_app_device_revoke(p_device uuid default null, p_user uuid default null, p_reason text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  n int;
  admin boolean := public.reqgen_is_admin();
begin
  if me is null then raise exception 'REQGEN_SIGNED_OUT: Please sign in again.' using errcode = 'P0001'; end if;
  update public.reqgen_app_devices
     set revoked_at = now(), revoked_reason = coalesce(nullif(trim(p_reason), ''), case when user_id = me then 'Removed by the owner' else 'Removed by the Super Admin' end)
   where revoked_at is null
     and ((p_device is not null and id = p_device) or (p_device is null and p_user is not null and user_id = p_user))
     and (user_id = me or admin);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.reqgen_app_device_revoke(uuid, uuid, text) from public, anon;
grant execute on function public.reqgen_app_device_revoke(uuid, uuid, text) to authenticated;

-- a deactivated account loses its phones at once
create or replace function public.reqgen_app_devices_follow_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = false and coalesce(old.is_active, true) = true then
    update public.reqgen_app_devices set revoked_at = now(), revoked_reason = 'Account deactivated'
     where user_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists reqgen_app_devices_follow_profile on public.profiles;
create trigger reqgen_app_devices_follow_profile after update of is_active on public.profiles
  for each row execute function public.reqgen_app_devices_follow_profile();
insert into v600_report values ('1 devices', 'register, action pass, revoke, deactivation', 'fingerprint gives the same one-action pass as a code', 'OK');

-- 2. App error reports ------------------------------------------------------------------------
create table if not exists public.reqgen_app_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid(),
  at timestamptz not null default now(),
  app_version text,
  screen text,
  code text,
  message text,
  detail jsonb
);
create index if not exists reqgen_app_errors_at_idx on public.reqgen_app_errors (at desc);
alter table public.reqgen_app_errors enable row level security;
revoke all on public.reqgen_app_errors from anon, authenticated;
grant select on public.reqgen_app_errors to authenticated;
drop policy if exists reqgen_app_errors_admin_read on public.reqgen_app_errors;
create policy reqgen_app_errors_admin_read on public.reqgen_app_errors for select to authenticated using (public.reqgen_is_admin());

create or replace function public.reqgen_app_log_error(p_version text, p_screen text, p_code text, p_message text, p_detail jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.reqgen_app_errors where user_id = auth.uid() and at > now() - interval '1 day') >= 200 then return; end if;
  insert into public.reqgen_app_errors (user_id, app_version, screen, code, message, detail)
  values (auth.uid(), left(p_version, 20), left(p_screen, 120), left(p_code, 60), left(p_message, 600),
          case when p_detail is null or length(p_detail::text) > 4000 then null else p_detail end);
end;
$$;
revoke all on function public.reqgen_app_log_error(text, text, text, text, jsonb) from public, anon;
grant execute on function public.reqgen_app_log_error(text, text, text, text, jsonb) to authenticated;
insert into v600_report values ('2 error reports', 'reqgen_app_errors', 'written by the app, read only by the Super Admin and Developer', 'OK');

-- 3. App releases -----------------------------------------------------------------------------
create table if not exists public.reqgen_app_releases (
  version text primary key,
  build int not null,
  apk_url text not null,
  notes jsonb,
  published_at timestamptz not null default now()
);
alter table public.reqgen_app_releases enable row level security;
revoke all on public.reqgen_app_releases from anon, authenticated;
grant select on public.reqgen_app_releases to anon, authenticated;
drop policy if exists reqgen_app_releases_read on public.reqgen_app_releases;
create policy reqgen_app_releases_read on public.reqgen_app_releases for select to anon, authenticated using (true);
grant insert, update, delete on public.reqgen_app_releases to authenticated;
drop policy if exists reqgen_app_releases_admin_write on public.reqgen_app_releases;
create policy reqgen_app_releases_admin_write on public.reqgen_app_releases for all to authenticated
  using (public.reqgen_is_admin()) with check (public.reqgen_is_admin());
insert into v600_report values ('3 releases', 'reqgen_app_releases', 'anyone reads the newest version; only the Super Admin publishes', 'OK');

-- the APK files themselves: a public storage folder "app-releases" (uploads only from the Supabase dashboard
-- or by the Super Admin), so updates come from the database platform, not from the website
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('app-releases', 'app-releases', true) on conflict (id) do nothing;
    insert into v600_report values ('3 releases', 'storage app-releases', 'public folder for the APK files', 'OK');
  end if;
end $$;

-- 4. Help contact for staff ------------------------------------------------------------------
create or replace function public.reqgen_help_contact()
returns table (full_name text, position_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name::text, coalesce(r.role_name, 'Auditor')::text
  from public.profile_roles r
  join public.profiles p on p.id = r.profile_id
  where lower(regexp_replace(coalesce(r.role_key, ''), '[^a-zA-Z]', '', 'g')) in ('auditor', 'externalauditor')
    and coalesce(r.is_active, true) and coalesce(p.is_active, true)
  order by coalesce(r.is_primary, false) desc
  limit 1;
$$;
revoke all on function public.reqgen_help_contact() from public, anon;
grant execute on function public.reqgen_help_contact() to authenticated;
insert into v600_report values ('4 help contact', 'reqgen_help_contact', 'name of the Auditor (no balances)', 'OK');

commit;

select * from v600_report order by step, item;
