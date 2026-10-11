-- =============================================================================
-- ReqGen v4.0.0 · STEP 2 — STANDARDISE THE DATABASE
-- Islamic Education Trust · 11 October 2026
--
-- RUN THIS ONLY AFTER THE v4.0.0 CODE IS LIVE ON VERCEL.
-- (v3 still uses the old codes; v4 understands both, so the order is:
--  push v4.0.0 → wait for Vercel "Ready" → run this.)
--
-- WHAT IT DOES
--   1. PO → PD (Program Director) everywhere: route steps, officers, backups,
--      request stages, role catalogue, the departments column (po_id → pd_id),
--      rules (check constraints) and every function that used it.
--   2. HR Boss → HR Coordinator everywhere: roles, active roles, history text,
--      functions and security policies.
--   3. Retires the "POS" item from the IET accounts list (POS is not an
--      account; payments are only Transfer, Cheque or Cash). It is deleted if
--      nothing ever used it, otherwise it is switched off and hidden.
--   4. Adds what v4.0.0 needs: positions in the role catalogue (PD, HR
--      Coordinator, PA to the DG, Registry), the Super Admin / Developer
--      marker on profiles, and two private tables for fingerprint sign-in and
--      trusted-device passcodes.
--
-- SAFETY
--   • Every function is saved in reqgen_function_backups before it changes.
--   • Everything runs in ONE transaction: if any step fails, nothing changes.
--   • Old spellings typed by anyone are still understood (PO, HR Boss, Dean
--     Admin are read as PD, HR Coordinator, DIN Admin).
--
-- HOW TO RUN: Supabase → SQL Editor → paste → Run.
-- The last result is the verification table. Every row must say OK.
-- =============================================================================

begin;
set local lock_timeout = '10s';
set local statement_timeout = '180s';

create table if not exists public.reqgen_function_backups (
  id bigint generated always as identity primary key,
  function_name text not null,
  function_identity text not null,
  release text not null,
  definition text not null,
  saved_at timestamptz not null default now()
);
alter table public.reqgen_function_backups enable row level security;
revoke all on public.reqgen_function_backups from anon, authenticated;

drop table if exists pg_temp.v4_report;
create temporary table v4_report (step text, item text, result text, status text);

-- -----------------------------------------------------------------------------
-- 1. One place that knows the old spellings
-- -----------------------------------------------------------------------------
create or replace function public.reqgen_role_alias(p_key text)
returns text language sql immutable set search_path = public as $$
  select case p_key
    when 'po' then 'pd'
    when 'programofficer' then 'pd'
    when 'programmeofficer' then 'pd'
    when 'programdirector' then 'pd'
    when 'hrboss' then 'hrcoordinator'
    when 'headofhr' then 'hrcoordinator'
    when 'deanadmin' then 'dinadmin'
    else p_key end
$$;

do $$
declare
  f record;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('reqgen_key', 'reqgen_normalized_role', 'reqgen_normalize_role')
  loop
    insert into public.reqgen_function_backups(function_name, function_identity, release, definition)
    values (f.proname, f.args, 'v4.0.0', f.def);
  end loop;
end $$;

create or replace function public.reqgen_key(p_text text)
returns text language sql immutable as $$
  select public.reqgen_role_alias(lower(replace(replace(coalesce(p_text, ''), ' ', ''), '_', '')));
$$;

create or replace function public.reqgen_normalized_role(p_value text)
returns text language sql immutable as $$
  select public.reqgen_role_alias(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9:]+', '', 'g'))
$$;

create or replace function public.reqgen_normalize_role(p_role text)
returns text language sql immutable as $$
  select public.reqgen_role_alias(regexp_replace(lower(coalesce(p_role, '')), '[^a-z0-9:]+', '', 'g'))
$$;

insert into v4_report values ('1 spellings', 'reqgen_key / normalize functions', 'old spellings now read as the new ones', 'OK');

-- -----------------------------------------------------------------------------
-- 2. Rules (check constraints) that list PO: take them off for the update
-- -----------------------------------------------------------------------------
drop table if exists pg_temp.v4_constraints;
create temporary table v4_constraints (tbl regclass, conname text, def text);

insert into v4_constraints
select conrelid::regclass, conname, pg_get_constraintdef(oid)
from pg_constraint
where connamespace = 'public'::regnamespace and contype = 'c'
  and pg_get_constraintdef(oid) ~ '''PO''';

do $$
declare c record;
begin
  for c in select * from v4_constraints loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Data: PO → PD, HR Boss → HR Coordinator
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
  n bigint;
begin
  -- stage columns
  for t in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying')
      and c.column_name in ('stage', 'current_stage', 'from_stage', 'to_stage', 'next_stage', 'previous_stage', 'stage_key', 'step', 'route_stage')
  loop
    execute format('update public.%I set %I = ''PD'' where %I = ''PO''', t.table_name, t.column_name, t.column_name);
    get diagnostics n = row_count;
    if n > 0 then insert into v4_report values ('3 data', t.table_name || '.' || t.column_name, n || ' row(s) PO → PD', 'OK'); end if;
  end loop;

  -- text arrays of stages (route templates may store them)
  for t in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type = 'ARRAY' and c.udt_name in ('_text', '_varchar')
  loop
    execute format('update public.%I set %I = array_replace(%I, ''PO'', ''PD'') where ''PO'' = any(%I)', t.table_name, t.column_name, t.column_name, t.column_name);
    get diagnostics n = row_count;
    if n > 0 then insert into v4_report values ('3 data', t.table_name || '.' || t.column_name, n || ' row(s) PO → PD', 'OK'); end if;
  end loop;
end $$;

-- role catalogue and people's roles
do $$
declare n bigint;
begin
  if to_regclass('public.reqgen_roles') is not null then
    update public.reqgen_roles set role_key = 'pd', role_name = 'PD · Program Director'
     where public.reqgen_key(role_key) = 'pd' and role_key <> 'pd'
       and not exists (select 1 from public.reqgen_roles r2 where r2.role_key = 'pd');
    update public.reqgen_roles set role_name = 'PD · Program Director' where role_key = 'pd';
    update public.reqgen_roles set role_key = 'hrcoordinator', role_name = 'HR Coordinator'
     where lower(replace(replace(role_key, '_', ''), ' ', '')) in ('hrboss', 'headofhr')
       and not exists (select 1 from public.reqgen_roles r2 where r2.role_key = 'hrcoordinator');
    update public.reqgen_roles set role_name = 'HR Coordinator' where role_name ~* 'hr ?boss|head of hr';
  end if;

  update public.profile_roles set role_key = 'pd' where lower(role_key) = 'po';
  update public.profile_roles set role_name = 'PD · Program Director' where role_name in ('PO', 'Program Officer', 'Programme Officer');
  update public.profile_roles set role_key = 'hrcoordinator' where lower(replace(replace(role_key, '_', ''), ' ', '')) in ('hrboss', 'headofhr');
  update public.profile_roles set role_name = 'HR Coordinator' where role_name ~* 'hr ?boss|head of hr';
  get diagnostics n = row_count;

  update public.profiles set role = 'PD' where role in ('PO', 'po');
  update public.profiles set role = 'HR Coordinator' where role ~* '^hr ?boss$|^head of hr$|^hr_boss$';

  if to_regclass('public.user_active_roles') is not null then
    update public.user_active_roles set active_role_key = 'pd' where lower(active_role_key) = 'po';
    update public.user_active_roles set active_role_key = 'hrcoordinator' where lower(replace(replace(active_role_key, '_', ''), ' ', '')) in ('hrboss', 'headofhr');
    update public.user_active_roles set active_role_name = 'HR Coordinator' where active_role_name ~* 'hr ?boss|head of hr';
    update public.user_active_roles set active_role_name = 'PD · Program Director' where active_role_name in ('PO', 'Program Officer');
  end if;
end $$;

-- history text (names of roles written in past records)
do $$
declare t record; n bigint;
begin
  for t in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying')
      and c.column_name ~ 'role_name$|role$'
      and c.table_name in ('request_history', 'user_role_switch_history', 'payment_voucher_history', 'notifications', 'user_active_roles', 'profile_roles')
  loop
    execute format('update public.%I set %I = regexp_replace(%I, ''(?i)hr ?boss|head of hr'', ''HR Coordinator'', ''g'') where %I ~* ''hr ?boss|head of hr''',
                   t.table_name, t.column_name, t.column_name, t.column_name);
    get diagnostics n = row_count;
    if n > 0 then insert into v4_report values ('3 data', t.table_name || '.' || t.column_name, n || ' row(s) HR Boss → HR Coordinator', 'OK'); end if;
    execute format('update public.%I set %I = ''PD'' where %I = ''PO''', t.table_name, t.column_name, t.column_name);
    get diagnostics n = row_count;
    if n > 0 then insert into v4_report values ('3 data', t.table_name || '.' || t.column_name, n || ' row(s) PO → PD', 'OK'); end if;
  end loop;
end $$;

-- departments.po_id → pd_id
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'departments' and column_name = 'po_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'departments' and column_name = 'pd_id') then
    alter table public.departments rename column po_id to pd_id;
    insert into v4_report values ('3 data', 'departments.po_id', 'renamed to pd_id', 'OK');
  else
    insert into v4_report values ('3 data', 'departments.pd_id', 'already renamed', 'OK');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Functions that used PO / po_id / HR Boss: back up, then rewrite
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
  newdef text;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname not in ('reqgen_role_alias')
      and (pg_get_functiondef(p.oid) ~ '''PO''|''po''|\mpo_id\M|''hrboss''|''HR Boss''')
  loop
    insert into public.reqgen_function_backups(function_name, function_identity, release, definition)
    values (f.proname, f.args, 'v4.0.0', f.def);

    newdef := f.def;
    newdef := replace(newdef, '''PO''', '''PD''');
    newdef := replace(newdef, '''po''', '''pd''');
    newdef := regexp_replace(newdef, '\mpo_id\M', 'pd_id', 'g');
    newdef := replace(newdef, '''hrboss''', '''hrcoordinator''');
    newdef := replace(newdef, '''HR Boss''', '''HR Coordinator''');
    execute newdef;
    insert into v4_report values ('4 function', f.proname || '(' || f.args || ')', 'backed up and rewritten', 'OK');
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Security policies that named HR Boss
-- -----------------------------------------------------------------------------
do $$
declare
  p record;
  stmt text;
begin
  for p in
    select pl.*, c.oid as tbl
    from pg_policies pl
    join pg_class c on c.relname = pl.tablename and c.relnamespace = 'public'::regnamespace
    where pl.schemaname = 'public'
      and (coalesce(pl.qual, '') || ' ' || coalesce(pl.with_check, '')) ~* 'hrboss'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    stmt := format('create policy %I on public.%I as %s for %s to %s',
                   replace(replace(p.policyname, 'HR boss', 'HR Coordinator'), 'hr boss', 'HR Coordinator'),
                   p.tablename, p.permissive, p.cmd,
                   (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ') from unnest(p.roles) r));
    if p.qual is not null then stmt := stmt || ' using (' || replace(p.qual, '''hrboss''', '''hrcoordinator''') || ')'; end if;
    if p.with_check is not null then stmt := stmt || ' with check (' || replace(p.with_check, '''hrboss''', '''hrcoordinator''') || ')'; end if;
    execute stmt;
    insert into v4_report values ('5 policy', p.tablename || ' · ' || p.policyname, 'HR Boss → HR Coordinator', 'OK');
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Put the rules back, now listing PD
-- -----------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in select * from v4_constraints loop
    execute format('alter table %s add constraint %I %s', c.tbl, c.conname, replace(c.def, '''PO''::text', '''PD''::text'));
    insert into v4_report values ('6 rule', c.tbl::text || ' · ' || c.conname, 'now lists PD instead of PO', 'OK');
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Retire "POS" from the IET accounts list
-- -----------------------------------------------------------------------------
do $$
declare
  a record;
  k record;
  refs bigint;
  n bigint;
begin
  for a in select id, code, name from public.iet_accounts where upper(trim(name)) in ('POS', 'CASH', 'TRANSFER', 'BANK TRANSFER', 'CHEQUE') loop
    refs := 0;
    for k in
      select con.conrelid::regclass as tbl, att.attname as col
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      where con.contype = 'f' and con.confrelid = 'public.iet_accounts'::regclass
    loop
      execute format('select count(*) from %s where %I = $1', k.tbl, k.col) into n using a.id;
      refs := refs + n;
    end loop;

    if refs = 0 then
      delete from public.iet_accounts where id = a.id;
      insert into v4_report values ('7 accounts', coalesce(a.code, '') || ' ' || a.name, 'deleted (never used)', 'OK');
    else
      update public.iet_accounts set is_active = false where id = a.id;
      insert into v4_report values ('7 accounts', coalesce(a.code, '') || ' ' || a.name, 'switched off and hidden (' || refs || ' old record(s) point to it)', 'OK');
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 8. What v4.0.0 adds
-- -----------------------------------------------------------------------------
-- 8a. positions in the role catalogue
do $$
begin
  if to_regclass('public.reqgen_roles') is not null then
    insert into public.reqgen_roles (role_key, role_name, description, is_system, is_active, requires_signature, sort_order)
    values
      ('pd', 'PD · Program Director', 'First check on ASAP-ALLI requests (formerly PO).', true, true, true, 22),
      ('hrcoordinator', 'HR Coordinator', 'Boss of Human Resources. Every HR request passes through this position.', true, true, true, 72),
      ('padg', 'PA to the DG', 'Personal Assistant to the Director General.', true, true, false, 32),
      ('registry', 'Registry', 'Tracks, files, dispatches and archives. Never sees request contents.', true, true, false, 110)
    on conflict (role_key) do update set role_name = excluded.role_name, description = excluded.description, is_active = true;
  end if;
  insert into v4_report values ('8 positions', 'PD, HR Coordinator, PA to the DG, Registry', 'present in the role catalogue', 'OK');
exception when others then
  insert into v4_report values ('8 positions', 'role catalogue', 'could not add: ' || sqlerrm, 'CHECK');
end $$;

-- 8b. Super Admin / Developer marker (the account keeps the admin key, so all
--     existing security rules keep working; this marker only names it)
alter table public.profiles add column if not exists system_account text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_system_account_check') then
    alter table public.profiles add constraint profiles_system_account_check
      check (system_account is null or system_account in ('superadmin', 'developer'));
  end if;
end $$;
insert into v4_report values ('8 system accounts', 'profiles.system_account', 'ready (Super Admin / Developer)', 'OK');

-- 8c. fingerprint sign-in (WebAuthn) — written only by the server
create table if not exists public.reqgen_webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.reqgen_webauthn_credentials enable row level security;
revoke all on public.reqgen_webauthn_credentials from anon;
drop policy if exists "own fingerprints read" on public.reqgen_webauthn_credentials;
create policy "own fingerprints read" on public.reqgen_webauthn_credentials for select to authenticated using (user_id = auth.uid());
drop policy if exists "own fingerprints remove" on public.reqgen_webauthn_credentials;
create policy "own fingerprints remove" on public.reqgen_webauthn_credentials for delete to authenticated using (user_id = auth.uid());

-- 8d. trusted devices and their passcodes — written only by the server
create table if not exists public.reqgen_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text,
  device_key_hash text not null,
  passcode_hash text not null,
  failed_attempts int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);
create index if not exists reqgen_trusted_devices_user on public.reqgen_trusted_devices(user_id) where revoked_at is null;
alter table public.reqgen_trusted_devices enable row level security;
revoke all on public.reqgen_trusted_devices from anon;
drop policy if exists "own devices read" on public.reqgen_trusted_devices;
create policy "own devices read" on public.reqgen_trusted_devices for select to authenticated using (user_id = auth.uid());
-- (columns with hashes are never needed by the browser; the app selects only names and dates)
insert into v4_report values ('8 sign-in', 'fingerprint + trusted-device tables', 'ready', 'OK');

-- 8e. the browser may read names and dates of its own devices, never the hashes
revoke select on public.reqgen_trusted_devices from authenticated;
grant select (id, user_id, device_name, failed_attempts, created_at, last_used_at, revoked_at, revoked_reason)
  on public.reqgen_trusted_devices to authenticated;
revoke insert, update on public.reqgen_webauthn_credentials from authenticated;
revoke insert, update, delete on public.reqgen_trusted_devices from authenticated;
insert into v4_report values ('8 sign-in', 'passcode hashes', 'hidden from the browser (server only)', 'OK');

-- 8f. name the two system accounts by their email (now, and whenever they sign up)
create or replace function public.reqgen_mark_system_account()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $f$
declare
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = new.id;
  if v_email = 'ietreqgen@gmail.com' then new.system_account := 'superadmin';
  elsif v_email = 'info@barderians.com.ng' then new.system_account := 'developer';
  end if;
  return new;
end
$f$;
drop trigger if exists reqgen_mark_system_account on public.profiles;
create trigger reqgen_mark_system_account before insert or update on public.profiles
  for each row execute function public.reqgen_mark_system_account();
update public.profiles p set system_account = case lower(u.email) when 'ietreqgen@gmail.com' then 'superadmin' else 'developer' end
from auth.users u where u.id = p.id and lower(u.email) in ('ietreqgen@gmail.com', 'info@barderians.com.ng');
insert into v4_report
select '8 system accounts', 'Super Admin · ietreqgen@gmail.com',
       case when exists (select 1 from public.profiles where system_account = 'superadmin') then 'marked' else 'will be marked when the account signs up' end, 'OK';
insert into v4_report
select '8 system accounts', 'Developer · info@barderians.com.ng',
       case when exists (select 1 from public.profiles where system_account = 'developer') then 'marked' else 'will be marked when the account signs up' end, 'OK';

-- -----------------------------------------------------------------------------
-- 9. Verification
-- -----------------------------------------------------------------------------
insert into v4_report
select '9 check', 'no rule still lists PO',
       case when count(*) = 0 then 'none left' else count(*) || ' left' end,
       case when count(*) = 0 then 'OK' else 'CHECK' end
from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and pg_get_constraintdef(oid) ~ '''PO''';

insert into v4_report
select '9 check', 'no function still uses PO / po_id / hrboss',
       case when count(*) = 0 then 'none left' else string_agg(proname, ', ') end,
       case when count(*) = 0 then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname <> 'reqgen_role_alias'
  and pg_get_functiondef(p.oid) ~ '''PO''|''po''|\mpo_id\M|''hrboss''';

insert into v4_report
select '9 check', 'no policy still names hrboss',
       case when count(*) = 0 then 'none left' else count(*) || ' left' end,
       case when count(*) = 0 then 'OK' else 'CHECK' end
from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) ~* 'hrboss';

insert into v4_report
select '9 check', 'route steps using PD', count(*)::text || ' step(s)', 'OK'
from public.reqgen_route_steps where stage = 'PD';

insert into v4_report
select '9 check', 'no route step still PO',
       case when count(*) = 0 then 'none left' else count(*) || ' left' end,
       case when count(*) = 0 then 'OK' else 'CHECK' end
from public.reqgen_route_steps where stage = 'PO';

insert into v4_report
select '9 check', 'POS not offered as an account',
       case when count(*) = 0 then 'gone' else count(*) || ' still active' end,
       case when count(*) = 0 then 'OK' else 'CHECK' end
from public.iet_accounts where upper(trim(name)) = 'POS' and coalesce(is_active, true);

insert into v4_report
select '9 check', 'functions backed up for v4.0.0', count(*)::text || ' saved', 'OK'
from public.reqgen_function_backups where release = 'v4.0.0';

commit;

select step as "step", item as "item", result as "result", status as "status"
from v4_report order by step, item;
