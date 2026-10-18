-- =============================================================================
-- ReqGen v4.6.6 — the two system accounts: Super Admin and Developer
-- Run in the Supabase SQL Editor AFTER the v4.6.6 code shows "Ready" on Vercel,
-- and after v4_6_5_super_admin_finance.sql and v4_6_5a_hotfix_account_recalc.sql.
--
-- What it does
--   1. Repairs the two system accounts so they can sign in and open their pages:
--        ietreqgen@gmail.com      → the Trust's Super Admin
--        info@barderians.com.ng   → the Developer (Barderian Enterprises)
--      Each gets its staff record (profile) if it is missing, is marked, active, belongs to
--      NO department, holds only its own position, and acts as it. Neither needs a signature.
--   2. Takes the Super Admin position away from every personal account, so ietreqgen@gmail.com
--      is the ONLY Super Admin. Done only once the Super Admin account is confirmed working.
--      Every change is written to reqgen_role_changes (before and after), so it can be undone.
--   3. Finance powers: correcting totals, removing amounts with no record, recalculating
--      accounts and opening balances = the Super Admin, the Developer and the Auditor;
--      Financial Reset and restore = the Super Admin and the Developer.
--   4. Developer tools: module switches (turn a module off for maintenance), release notes
--      ("What's new") that the Super Admin is told about, and a live status of both accounts.
--      Developer actions stay in the Audit Log (under their own "Developer" tab); the Super
--      Admin is no longer sent an alert for each one.
--
-- The routing engine is NOT changed. Nothing is deleted. Safe to run more than once.
-- Ends with a table where every row says OK (or explains what to do).
-- =============================================================================
begin;

create temp table if not exists v466_report (step text, item text, result text, status text);
truncate v466_report;

do $$ begin
  if to_regprocedure('public.reqgen_finance_powers()') is null then
    raise exception 'Run database/v4_6_5_super_admin_finance.sql first, then this file.';
  end if;
end $$;

-- 0. Back up every function this file replaces -----------------------------------------------------
insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
select p.proname, pg_get_function_identity_arguments(p.oid), 'v4.6.6', pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_is_super_admin', 'reqgen_finance_powers', 'reqgen_tell_superadmin_of_developer')
  and not exists (select 1 from public.reqgen_function_backups b where b.function_name = p.proname and b.release = 'v4.6.6');
insert into v466_report values ('00 backup', 'reqgen_function_backups', 'the three functions this file replaces are saved first', 'OK');

-- 1. A record of every position change this file makes (for undo) -------------------------------------
create table if not exists public.reqgen_role_changes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  email text,
  full_name text,
  change text not null,
  before jsonb,
  after jsonb,
  release text not null default 'v4.6.6',
  created_at timestamptz not null default now()
);
alter table public.reqgen_role_changes enable row level security;
drop policy if exists reqgen_role_changes_read on public.reqgen_role_changes;
create policy reqgen_role_changes_read on public.reqgen_role_changes for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_account in ('superadmin', 'developer')));
grant select on public.reqgen_role_changes to authenticated;

-- The Super Admin position must exist (profile_roles refers to it)
insert into public.reqgen_roles (role_key, role_name, description, is_system, is_active, requires_signature, sort_order, created_at, updated_at)
select 'admin', 'Super Admin', 'The Trust''s system account', true, true, false, 0, now(), now()
where not exists (select 1 from public.reqgen_roles where role_key = 'admin');
update public.reqgen_roles set requires_signature = false where role_key = 'admin' and requires_signature;

-- 2. Repair the two system accounts ----------------------------------------------------------------
do $$
declare
  a record;
  u record;
  p record;
  v_before jsonb;
begin
  for a in select * from (values
      ('superadmin', 'ietreqgen@gmail.com', 'IET Super Admin', 'Super Admin'),
      ('developer', 'info@barderians.com.ng', 'Barderian Developer', 'Developer')) as t(kind, email, default_name, position_name)
  loop
    select * into u from auth.users where lower(email) = a.email limit 1;
    if u.id is null then
      insert into v466_report values ('01 ' || a.kind, a.email,
        'NO sign-in exists for this email yet. Create it (see the deployment guide), then run this file again.', 'TO DO');
      continue;
    end if;

    select * into p from public.profiles where id = u.id;
    v_before := case when p.id is null then null else jsonb_build_object('role', p.role, 'dept_id', p.dept_id, 'is_active', p.is_active, 'is_admin', p.is_admin, 'system_account', p.system_account,
      'positions', (select jsonb_agg(jsonb_build_object('role_key', pr.role_key, 'is_active', pr.is_active)) from public.profile_roles pr where pr.profile_id = u.id),
      'acting', (select active_role_key from public.user_active_roles where user_id = u.id)) end;

    if p.id is null then
      insert into public.profiles (id, full_name, email, role, dept_id, is_active, is_admin, system_account, created_at, updated_at)
      values (u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), a.default_name), a.email, 'admin', null, true, true, a.kind, now(), now());
    else
      update public.profiles
         set system_account = a.kind, role = 'admin', dept_id = null, is_active = true, is_admin = true,
             email = coalesce(email, a.email), deactivated_at = null, deactivated_reason = null
       where id = u.id;
    end if;

    -- holds only its own position
    update public.profile_roles set is_active = false, updated_at = now()
     where profile_id = u.id and public.pv_role_key(role_key) <> 'admin' and is_active;
    if exists (select 1 from public.profile_roles where profile_id = u.id and public.pv_role_key(role_key) = 'admin') then
      update public.profile_roles set is_active = true, is_primary = true, role_name = a.position_name, updated_at = now()
       where profile_id = u.id and public.pv_role_key(role_key) = 'admin';
    else
      insert into public.profile_roles (profile_id, role_key, role_name, is_primary, is_active, assigned_at, created_at, updated_at)
      values (u.id, 'admin', a.position_name, true, true, now(), now(), now());
    end if;

    -- acts as it
    update public.user_active_roles set active_role_key = 'admin', active_role_name = a.position_name, updated_at = now() where user_id = u.id;
    if not found then
      begin
        insert into public.user_active_roles (user_id, active_role_key, active_role_name, authorization_source, selected_at, updated_at)
        values (u.id, 'admin', a.position_name, 'profile_role', now(), now());
      exception when others then
        null; -- ReqGen creates it at the first sign-in from the profile (role = admin)
      end;
    end if;

    if p.id is null or v_before is distinct from jsonb_build_object('role', 'admin', 'dept_id', null, 'is_active', true, 'is_admin', true, 'system_account', a.kind,
         'positions', (select jsonb_agg(jsonb_build_object('role_key', pr.role_key, 'is_active', pr.is_active)) from public.profile_roles pr where pr.profile_id = u.id),
         'acting', 'admin') then
    insert into public.reqgen_role_changes (profile_id, email, full_name, change, before, after)
    values (u.id, a.email, (select full_name from public.profiles where id = u.id),
            case when p.id is null then 'system account created: ' else 'system account repaired: ' end || a.position_name,
            v_before, jsonb_build_object('role', 'admin', 'dept_id', null, 'system_account', a.kind, 'positions', a.position_name, 'acting', 'admin'));
    end if;

    insert into v466_report values ('01 ' || a.kind, a.email,
      case when p.id is null then 'staff record created; ' else 'staff record repaired; ' end
      || 'marked ' || a.position_name || ', active, no department, acting as ' || a.position_name
      || case when exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified') then '; 2FA set' else '; 2FA will be set at the next sign-in' end, 'OK');
  end loop;
end $$;

-- 3. ietreqgen@gmail.com is the only Super Admin --------------------------------------------------------
do $$
declare
  v_sa uuid;
  p record;
  v_next_key text;
  v_next_name text;
  v_names text := '';
begin
  select pr.id into v_sa from public.profiles pr where pr.system_account = 'superadmin' and coalesce(pr.is_active, true) limit 1;
  if v_sa is null then
    insert into v466_report values ('02 only one Super Admin', 'personal accounts', 'NOT changed yet: the Super Admin account must exist first. Run this file again after creating it.', 'TO DO');
    return;
  end if;

  for p in
    select pr.* from public.profiles pr
    where coalesce(pr.system_account, '') not in ('superadmin', 'developer')
      and (public.pv_role_key(pr.role) in ('admin', 'superadmin') or coalesce(pr.is_admin, false)
           or exists (select 1 from public.profile_roles x where x.profile_id = pr.id and x.is_active and public.pv_role_key(x.role_key) in ('admin', 'superadmin')))
    order by pr.full_name
  loop
    insert into public.reqgen_role_changes (profile_id, email, full_name, change, before)
    values (p.id, p.email, p.full_name, 'Super Admin position removed (only ietreqgen@gmail.com is the Super Admin)',
            jsonb_build_object('role', p.role, 'is_admin', p.is_admin,
              'positions', (select jsonb_agg(jsonb_build_object('role_key', x.role_key, 'role_name', x.role_name, 'is_active', x.is_active)) from public.profile_roles x where x.profile_id = p.id),
              'acting', (select active_role_key from public.user_active_roles where user_id = p.id)));

    update public.profile_roles set is_active = false, is_primary = false, updated_at = now()
     where profile_id = p.id and public.pv_role_key(role_key) in ('admin', 'superadmin') and is_active;

    select x.role_key, x.role_name into v_next_key, v_next_name
      from public.profile_roles x where x.profile_id = p.id and x.is_active
      order by x.is_primary desc, x.created_at limit 1;
    if v_next_key is null then
      v_next_key := 'staff'; v_next_name := 'Staff';
      if exists (select 1 from public.reqgen_roles where role_key = 'staff') then
        insert into public.profile_roles (profile_id, role_key, role_name, is_primary, is_active, assigned_at, created_at, updated_at)
        values (p.id, 'staff', 'Staff', true, true, now(), now(), now());
      end if;
    end if;

    update public.profiles set is_admin = false,
           role = case when public.pv_role_key(role) in ('admin', 'superadmin') then v_next_name else role end
     where id = p.id;
    update public.user_active_roles set active_role_key = public.pv_role_key(v_next_key), active_role_name = v_next_name, updated_at = now()
     where user_id = p.id and public.pv_role_key(active_role_key) in ('admin', 'superadmin');

    update public.reqgen_role_changes set after = jsonb_build_object('role', (select role from public.profiles where id = p.id), 'is_admin', false, 'acting', v_next_name)
     where id = (select id from public.reqgen_role_changes where profile_id = p.id order by created_at desc limit 1);
    v_names := v_names || case when v_names = '' then '' else ', ' end || coalesce(p.full_name, p.email);
    v_next_key := null; v_next_name := null;
  end loop;

  insert into v466_report values ('02 only one Super Admin', 'Super Admin position removed from',
    case when v_names = '' then 'nobody (no personal account held it)' else v_names || ' — they keep their other positions; undo list in reqgen_role_changes' end, 'OK');
end $$;

-- 4. Who has which power ------------------------------------------------------------------------------
create or replace function public.reqgen_is_system_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_account = 'superadmin' and coalesce(p.is_active, true));
$$;
create or replace function public.reqgen_is_developer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_account = 'developer' and coalesce(p.is_active, true));
$$;
revoke all on function public.reqgen_is_system_super_admin() from public, anon;
revoke all on function public.reqgen_is_developer() from public, anon;
grant execute on function public.reqgen_is_system_super_admin() to authenticated;
grant execute on function public.reqgen_is_developer() to authenticated;

-- "Has the Super Admin's powers": the Super Admin account acting as Super Admin, or the Developer.
-- Used by corrections, account recalculation, opening balances, Financial Reset and restore.
create or replace function public.reqgen_is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select (public.reqgen_is_system_super_admin() and public.reqgen_active_role_key() in ('admin', 'superadmin'))
      or public.reqgen_is_developer();
$$;
revoke all on function public.reqgen_is_super_admin() from public, anon;
grant execute on function public.reqgen_is_super_admin() to authenticated;

create or replace function public.reqgen_finance_powers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p record;
  v_acting text := public.reqgen_active_role_key();
  v_sa boolean := public.reqgen_is_system_super_admin();
  v_dev boolean := public.reqgen_is_developer();
  v_super boolean := public.reqgen_is_super_admin();
  v_auditor boolean := v_acting = 'auditor';
  v_reason text;
begin
  select pr.id, pr.full_name, pr.system_account, coalesce(pr.is_active, true) as active into p from public.profiles pr where pr.id = auth.uid();
  if not found then
    return jsonb_build_object('can_correct', false, 'can_reset', false, 'is_super_admin', false, 'is_developer', false, 'is_auditor', false, 'acting', v_acting,
      'reason', 'Your staff record could not be found. Sign out and in again.');
  end if;
  v_reason := case
    when v_super or v_auditor then null
    when not p.active then 'This account is deactivated.'
    when v_sa then 'Switch "Acting as" (top right) to Super Admin, then try again.'
    else 'Only the Super Admin (ietreqgen@gmail.com), the Developer or the Auditor can change finance totals.'
  end;
  return jsonb_build_object(
    'name', p.full_name,
    'acting', v_acting,
    'system_account', p.system_account,
    'is_super_admin', v_super and not v_dev,
    'is_developer', v_dev,
    'is_auditor', v_auditor,
    'can_correct', v_super or v_auditor,
    'can_reset', v_super,
    'reason', v_reason);
end;
$$;
revoke all on function public.reqgen_finance_powers() from public, anon;
grant execute on function public.reqgen_finance_powers() to authenticated;

-- Developer actions stay in the Audit Log; the Super Admin is no longer alerted for each one.
create or replace function public.reqgen_tell_superadmin_of_developer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  return new;
end;
$$;
insert into v466_report values ('03 powers', 'reqgen_is_super_admin · reqgen_finance_powers',
  'finance changes: Super Admin, Developer, Auditor · reset and restore: Super Admin, Developer', 'OK');

-- 5. Module switches (Developer) ------------------------------------------------------------------------
create table if not exists public.reqgen_module_switches (
  module_key text primary key,
  label text not null,
  enabled boolean not null default true,
  note text,
  changed_by uuid,
  changed_label text,
  changed_at timestamptz not null default now()
);
alter table public.reqgen_module_switches enable row level security;
drop policy if exists reqgen_module_switches_read on public.reqgen_module_switches;
create policy reqgen_module_switches_read on public.reqgen_module_switches for select to authenticated using (true);
grant select on public.reqgen_module_switches to authenticated;
insert into public.reqgen_module_switches (module_key, label) values
  ('requests', 'Requests'), ('approvals', 'Approvals'), ('finance', 'Finance'), ('vouchers', 'Payment Vouchers'),
  ('registry', 'Registry'), ('reports', 'Reports'), ('audit', 'Audit')
on conflict (module_key) do nothing;

create or replace function public.reqgen_set_module(p_key text, p_enabled boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_label text; v_row record;
begin
  if not public.reqgen_is_developer() then raise exception 'Only the Developer can switch modules on or off.'; end if;
  if not p_enabled and length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Write the message people will see while it is off (at least 5 characters).'; end if;
  v_label := public.reqgen_actor_label(auth.uid());
  update public.reqgen_module_switches
     set enabled = p_enabled, note = case when p_enabled then null else trim(p_note) end,
         changed_by = auth.uid(), changed_label = v_label, changed_at = now()
   where module_key = p_key returning * into v_row;
  if not found then raise exception 'Unknown module.'; end if;
  perform public.reqgen_audit_write('settings', 'Developer', v_row.label || case when p_enabled then ' switched on' else ' switched off' end, v_row.label, null,
    jsonb_build_object('enabled', p_enabled, 'note', v_row.note));
  return jsonb_build_object('ok', true, 'module', v_row.module_key, 'enabled', v_row.enabled);
end;
$$;
revoke all on function public.reqgen_set_module(text, boolean, text) from public, anon;
grant execute on function public.reqgen_set_module(text, boolean, text) to authenticated;
insert into v466_report values ('04 developer', 'reqgen_module_switches · reqgen_set_module', '7 modules, all on; only the Developer can switch them', 'OK');

-- 6. Releases ("What's new") ---------------------------------------------------------------------------
create table if not exists public.reqgen_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null,
  notes text not null,
  published_by uuid,
  published_label text,
  published_at timestamptz not null default now()
);
alter table public.reqgen_releases enable row level security;
drop policy if exists reqgen_releases_read on public.reqgen_releases;
create policy reqgen_releases_read on public.reqgen_releases for select to authenticated using (true);
grant select on public.reqgen_releases to authenticated;

create or replace function public.reqgen_publish_release(p_version text, p_title text, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if not public.reqgen_is_developer() then raise exception 'Only the Developer can publish a release.'; end if;
  if length(trim(coalesce(p_version, ''))) < 3 or length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Give the version and a short title.'; end if;
  if length(trim(coalesce(p_notes, ''))) < 10 then raise exception 'Write what changed (at least 10 characters).'; end if;
  v_label := public.reqgen_actor_label(auth.uid());
  insert into public.reqgen_releases (version, title, notes, published_by, published_label)
  values (trim(p_version), trim(p_title), trim(p_notes), auth.uid(), v_label)
  on conflict (version) do update set title = excluded.title, notes = excluded.notes, published_by = excluded.published_by,
    published_label = excluded.published_label, published_at = now();
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  select p.id, 'ReqGen ' || trim(p_version) || ' released', trim(p_title), '/whats-new', false, now()
  from public.profiles p where p.system_account = 'superadmin' and coalesce(p.is_active, true);
  perform public.reqgen_audit_write('settings', 'Developer', 'Release ' || trim(p_version) || ' published', trim(p_version), null, jsonb_build_object('title', trim(p_title)));
  return jsonb_build_object('ok', true, 'version', trim(p_version));
end;
$$;
revoke all on function public.reqgen_publish_release(text, text, text) from public, anon;
grant execute on function public.reqgen_publish_release(text, text, text) to authenticated;
insert into v466_report values ('05 releases', 'reqgen_releases · reqgen_publish_release', 'the Developer publishes; everyone reads "What''s new"; the Super Admin is told', 'OK');

-- 7. Live status of both system accounts -----------------------------------------------------------------
create or replace function public.reqgen_system_accounts_status()
returns table(kind text, email text, signin text, last_sign_in timestamptz, full_name text, marked text, active boolean, positions text, acting text, has_2fa boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not (public.reqgen_is_system_super_admin() or public.reqgen_is_developer()) then
    raise exception 'Only the Super Admin and the Developer can see the system accounts.';
  end if;
  return query
  select s.kind, s.email,
         case when u.id is null then 'Not created' when u.email_confirmed_at is null then 'Email not confirmed' else 'Ready' end,
         u.last_sign_in_at, p.full_name, p.system_account, coalesce(p.is_active, false),
         (select string_agg(x.role_name, ', ') from public.profile_roles x where x.profile_id = p.id and x.is_active),
         (select a.active_role_name from public.user_active_roles a where a.user_id = p.id),
         exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')
  from (values ('Super Admin', 'ietreqgen@gmail.com'), ('Developer', 'info@barderians.com.ng')) s(kind, email)
  left join auth.users u on lower(u.email) = s.email
  left join public.profiles p on p.id = u.id;
end;
$$;
revoke all on function public.reqgen_system_accounts_status() from public, anon;
grant execute on function public.reqgen_system_accounts_status() to authenticated;
insert into v466_report values ('06 status', 'reqgen_system_accounts_status', 'System Accounts page and the Developer Console show both accounts live', 'OK');

-- 8. Checks -----------------------------------------------------------------------------------------------
insert into v466_report
select '07 check', 'functions present', count(*)::text || ' of 9', case when count(*) = 9 then 'OK' else 'MISSING' end
from pg_proc where pronamespace = 'public'::regnamespace and proname in (
  'reqgen_is_system_super_admin', 'reqgen_is_developer', 'reqgen_is_super_admin', 'reqgen_finance_powers', 'reqgen_set_module',
  'reqgen_publish_release', 'reqgen_system_accounts_status', 'reqgen_tell_superadmin_of_developer', 'reqgen_finance_correct');
insert into v466_report
select '07 check', 'Super Admin accounts now',
       coalesce(string_agg(coalesce(p.email, p.full_name), ', '), 'none'),
       case when count(*) filter (where coalesce(p.system_account, '') not in ('superadmin', 'developer')) = 0 then 'OK' else 'CHECK' end
from public.profiles p
where coalesce(p.is_active, true)
  and (exists (select 1 from public.profile_roles x where x.profile_id = p.id and x.is_active and public.pv_role_key(x.role_key) in ('admin', 'superadmin'))
       or public.pv_role_key(p.role) in ('admin', 'superadmin'));
insert into v466_report values ('07 check', 'routing engine untouched', 'approve_request_step, reqgen_next_route_step and the route tables are only read', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v466_report order by step, item;
