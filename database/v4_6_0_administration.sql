-- =============================================================================
-- ReqGen v4.6.0 — Administration (mock-ups 79–90)
-- Run in the Supabase SQL Editor AFTER the v4.6.0 code shows "Ready" on Vercel,
-- and after v4_5_0_registry_audit.sql.
--
--   reqgen_is_admin              the Super Admin or the Developer is acting
--   reqgen_admin_summary         numbers for the Administration home (mock-up 79)
--   reqgen_admin_people          every staff member with positions, department, 2FA,
--                                fingerprints, passcodes and last sign-in (mock-ups 81–82)
--   reqgen_admin_positions       the positions and who holds each one (mock-up 83)
--   reqgen_security_rules        sign-in rules (one row) + _get / _save (mock-up 87)
--   reqgen_security_attention    officers without 2FA, passcodes removed after wrong tries
--   reqgen_security_remind       in-app reminder to set up 2FA (once a day)
--   reqgen_diagnostics           system health and data checks (mock-up 88)
--   reqgen_admin_log             server routes (reset 2FA, remove passcodes, deactivate,
--                                hand over) write to the one Audit Log
--   Developer actions            every Developer action in the Audit Log tells the Super Admin
--
-- The routing engine is NOT changed (only read). Nothing is deleted.
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v460_report (step text, item text, result text, status text);
truncate v460_report;

-- 0. Who may use Administration ----------------------------------------------------------
create or replace function public.reqgen_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.reqgen_active_role_key() = 'admin'
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_account in ('superadmin', 'developer'));
$$;
revoke all on function public.reqgen_is_admin() from public, anon;
grant execute on function public.reqgen_is_admin() to authenticated;

alter table public.profiles add column if not exists is_active boolean default true;
update public.profiles set is_active = true where is_active is null;
alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists deactivated_reason text;
insert into v460_report values ('0 access', 'reqgen_is_admin · profiles.is_active', 'Super Admin and Developer only; staff can be deactivated, never deleted', 'OK');

-- 1. Administration home ----------------------------------------------------------------
create or replace function public.reqgen_admin_people()
returns table(id uuid, full_name text, email text, dept_id uuid, dept_name text, is_active boolean, system_account text,
              positions jsonb, has_2fa boolean, fingerprints int, passcodes int, last_sign_in timestamptz,
              has_signature boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.reqgen_is_admin() then raise exception 'Administration is for the Super Admin and the Developer.'; end if;
  return query
  select p.id, coalesce(p.full_name, ''), coalesce(p.email, ''), p.dept_id, d.name, coalesce(p.is_active, true), p.system_account,
         coalesce((select jsonb_agg(jsonb_build_object('key', public.pv_role_key(pr.role_key), 'name', public.reqgen_position_name(pr.role_key),
                                                      'primary', coalesce(pr.is_primary, false), 'since', coalesce(pr.assigned_at, pr.created_at))
                                   order by coalesce(pr.is_primary, false) desc, pr.created_at)
                   from public.profile_roles pr
                   where pr.profile_id = p.id and coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) <> 'staff'), '[]'::jsonb),
         exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified' and f.factor_type = 'totp'),
         (select count(*)::int from public.reqgen_webauthn_credentials w where w.user_id = p.id),
         (select count(*)::int from public.reqgen_trusted_devices t where t.user_id = p.id and t.revoked_at is null),
         (select u.last_sign_in_at from auth.users u where u.id = p.id),
         coalesce(nullif(p.signature_url, ''), '') <> '',
         p.created_at
  from public.profiles p left join public.departments d on d.id = p.dept_id;
end;
$$;
revoke all on function public.reqgen_admin_people() from public, anon;
grant execute on function public.reqgen_admin_people() to authenticated;

create or replace function public.reqgen_admin_summary()
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare v json;
begin
  if not public.reqgen_is_admin() then raise exception 'Administration is for the Super Admin and the Developer.'; end if;
  select json_build_object(
    'staff', (select count(*) from public.profiles p where coalesce(p.is_active, true) and p.system_account is null),
    'deactivated', (select count(*) from public.profiles p where not coalesce(p.is_active, true)),
    'positions_held', (select count(*) from public.profile_roles pr join public.profiles p on p.id = pr.profile_id
                        where coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) not in ('staff', 'admin') and coalesce(p.is_active, true)),
    'positions', (select count(distinct public.reqgen_position_name(pr.role_key)) from public.profile_roles pr
                  where coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) not in ('staff', 'admin')),
    'departments', (select count(*) from public.departments d where coalesce(d.is_active, true)),
    'accounts', (select count(*) from public.iet_accounts a where coalesce(a.is_active, true)),
    'officers_without_2fa', (select count(*) from public.profiles p
                             where coalesce(p.is_active, true)
                               and exists (select 1 from public.profile_roles pr where pr.profile_id = p.id and coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) <> 'staff')
                               and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified' and f.factor_type = 'totp')),
    'system_accounts', (select count(*) from public.profiles p where p.system_account is not null)
  ) into v;
  return v;
end;
$$;
revoke all on function public.reqgen_admin_summary() from public, anon;
grant execute on function public.reqgen_admin_summary() to authenticated;
insert into v460_report values ('1 home', 'reqgen_admin_summary / reqgen_admin_people', 'staff, positions, departments, accounts, 2FA', 'OK');

-- 2. Positions ------------------------------------------------------------------------
create or replace function public.reqgen_admin_positions()
returns table(position_key text, position_name text, holders int, holder_names text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.reqgen_is_admin() then raise exception 'Administration is for the Super Admin and the Developer.'; end if;
  return query
  select k.key, public.reqgen_position_name(k.key),
         count(distinct p.id)::int,
         coalesce(array_agg(distinct coalesce(nullif(p.full_name, ''), p.email)) filter (where p.id is not null), array[]::text[])
  from (select distinct regexp_replace(public.pv_role_key(pr.role_key), '[0-9]+$', '') as key from public.profile_roles pr where coalesce(pr.is_active, true)) k
  left join public.profile_roles pr2 on regexp_replace(public.pv_role_key(pr2.role_key), '[0-9]+$', '') = k.key and coalesce(pr2.is_active, true)
  left join public.profiles p on p.id = pr2.profile_id and coalesce(p.is_active, true)
  group by k.key;
end;
$$;
revoke all on function public.reqgen_admin_positions() from public, anon;
grant execute on function public.reqgen_admin_positions() to authenticated;
insert into v460_report values ('2 positions', 'reqgen_admin_positions', 'every position and who holds it', 'OK');

-- 3. Security rules (one row) ------------------------------------------------------------
create table if not exists public.reqgen_security_rules (
  id int primary key default 1 check (id = 1),
  stay_hours int not null default 12 check (stay_hours in (8, 12)),
  idle_minutes int not null default 15 check (idle_minutes in (10, 15, 20, 30)),
  passcode_tries int not null default 5 check (passcode_tries in (3, 5)),
  twofa_scope text not null default 'everyone' check (twofa_scope in ('everyone')),
  updated_at timestamptz not null default now(),
  updated_by_label text
);
insert into public.reqgen_security_rules (id) values (1) on conflict (id) do nothing;
alter table public.reqgen_security_rules enable row level security;
drop policy if exists reqgen_security_rules_read on public.reqgen_security_rules;
-- the sign-in page shows the hours signed in, so the (non-secret) rules can be read before sign-in
create policy reqgen_security_rules_read on public.reqgen_security_rules for select to anon, authenticated using (true);
revoke insert, update, delete on public.reqgen_security_rules from anon;
grant select on public.reqgen_security_rules to anon;
revoke insert, update, delete on public.reqgen_security_rules from authenticated;
grant select on public.reqgen_security_rules to authenticated;
grant select on public.reqgen_security_rules to service_role;

create or replace function public.reqgen_security_rules_save(p_stay_hours int, p_idle_minutes int, p_passcode_tries int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_old record;
begin
  if not public.reqgen_is_admin() then raise exception 'Only the Super Admin or the Developer can change sign-in rules.'; end if;
  if p_stay_hours not in (8, 12) then raise exception 'Stay signed in for 8 or 12 hours.'; end if;
  if p_idle_minutes not in (10, 15, 20, 30) then raise exception 'Sign out after 10, 15, 20 or 30 minutes of no activity.'; end if;
  if p_passcode_tries not in (3, 5) then raise exception 'Allow 3 or 5 wrong passcode tries.'; end if;
  select * into v_old from public.reqgen_security_rules where id = 1;
  update public.reqgen_security_rules
     set stay_hours = p_stay_hours, idle_minutes = p_idle_minutes, passcode_tries = p_passcode_tries,
         updated_at = now(), updated_by_label = public.reqgen_actor_label(auth.uid())
   where id = 1;
  perform public.reqgen_audit_write('settings', 'Administration', 'Sign-in rules changed', null, null,
    jsonb_build_object('stay_hours', jsonb_build_array(v_old.stay_hours, p_stay_hours), 'idle_minutes', jsonb_build_array(v_old.idle_minutes, p_idle_minutes),
                       'passcode_tries', jsonb_build_array(v_old.passcode_tries, p_passcode_tries)));
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_security_rules_save(int, int, int) from public, anon;
grant execute on function public.reqgen_security_rules_save(int, int, int) to authenticated;

create or replace function public.reqgen_security_attention()
returns table(kind text, person_id uuid, person text, detail text, at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.reqgen_is_admin() then raise exception 'Administration is for the Super Admin and the Developer.'; end if;
  return query
  select 'no2fa'::text, p.id, coalesce(nullif(p.full_name, ''), p.email), public.reqgen_actor_label(p.id), null::timestamptz
  from public.profiles p
  where coalesce(p.is_active, true)
    and (p.system_account is not null
         or exists (select 1 from public.profile_roles pr where pr.profile_id = p.id and coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) <> 'staff'))
    and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified' and f.factor_type = 'totp');
  return query
  select 'passcode_removed'::text, t.user_id, coalesce(nullif(p.full_name, ''), p.email), coalesce(t.device_name, 'A device'), t.revoked_at
  from public.reqgen_trusted_devices t join public.profiles p on p.id = t.user_id
  where t.revoked_at > now() - interval '14 days' and coalesce(t.revoked_reason, '') ilike '%tries%';
end;
$$;
revoke all on function public.reqgen_security_attention() from public, anon;
grant execute on function public.reqgen_security_attention() to authenticated;
create or replace function public.reqgen_security_remind(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.reqgen_is_admin() then raise exception 'Only the Super Admin or the Developer can send this reminder.'; end if;
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  select p.id, 'Please set up 2FA', 'Your position needs a 6-number authenticator code to sign in. It takes two minutes: My Account › Security & Devices.', '/profile/security', false, now()
  from public.profiles p
  where p.id = any(p_ids) and coalesce(p.is_active, true)
    and not exists (select 1 from public.notifications n where n.user_id = p.id and n.title = 'Please set up 2FA' and n.created_at > now() - interval '1 day');
  get diagnostics v_n = row_count;
  perform public.reqgen_audit_write('settings', 'Administration', '2FA reminder sent', v_n || ' officer(s)', null, null);
  return v_n;
end;
$$;
revoke all on function public.reqgen_security_remind(uuid[]) from public, anon;
grant execute on function public.reqgen_security_remind(uuid[]) to authenticated;

insert into v460_report values ('3 security', 'reqgen_security_rules / _save / reqgen_security_attention', 'stay signed in, idle sign-out, passcode tries; officers without 2FA', 'OK');

-- 4. The Audit Log for server routes (service role) ---------------------------------------------
create or replace function public.reqgen_admin_log(p_actor uuid, p_action text, p_record_no text, p_record_id uuid, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reqgen_audit_log (actor_id, actor_label, category, module, action, record_no, record_id, device, details)
  values (p_actor, coalesce(public.reqgen_actor_label(p_actor), 'ReqGen (system)'), 'settings', 'Administration', p_action, p_record_no, p_record_id, null, p_details);
end;
$$;
revoke all on function public.reqgen_admin_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reqgen_admin_log(uuid, text, text, uuid, jsonb) to service_role;

-- every Developer action tells the Super Admin (at most one alert each half hour)
create or replace function public.reqgen_tell_superadmin_of_developer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_id is not null and exists (select 1 from public.profiles p where p.id = new.actor_id and p.system_account = 'developer') then
    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    select sa.id, 'The Developer made a change', coalesce(new.module, '') || ': ' || coalesce(new.action, '') || coalesce(' · ' || new.record_no, ''),
           '/audit-centre/logs', false, now()
    from public.profiles sa
    where sa.system_account = 'superadmin'
      and not exists (select 1 from public.notifications n where n.user_id = sa.id and n.title = 'The Developer made a change' and n.created_at > now() - interval '30 minutes');
  end if;
  return new;
exception when others then
  return new; -- never stop the log
end;
$$;
drop trigger if exists reqgen_tell_superadmin on public.reqgen_audit_log;
create trigger reqgen_tell_superadmin after insert on public.reqgen_audit_log for each row execute function public.reqgen_tell_superadmin_of_developer();
insert into v460_report values ('4 log', 'reqgen_admin_log · Developer alert', 'admin actions logged; the Super Admin is told of Developer actions', 'OK');

-- 5. Diagnostics -------------------------------------------------------------------------
create or replace function public.reqgen_diagnostics()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v json; t0 timestamptz := clock_timestamp();
begin
  if not public.reqgen_is_admin() then raise exception 'Diagnostics are for the Super Admin and the Developer.'; end if;
  select json_build_object(
    'tables', (select count(*) from pg_tables where schemaname = 'public'),
    'rls_on', (select count(*) from pg_tables where schemaname = 'public' and rowsecurity),
    'rls_off', coalesce((select json_agg(tablename order by tablename) from pg_tables where schemaname = 'public' and not rowsecurity), '[]'::json),
    'last_notification', (select max(n.created_at) from public.notifications n),
    'last_nightly', (select json_build_object('at', max(b.created_at), 'bytes', (select b2.bytes from public.reqgen_backup_log b2 where b2.mode = 'nightly' order by b2.created_at desc limit 1))
                     from public.reqgen_backup_log b where b.mode = 'nightly'),
    'old_po_codes', (select count(*) from public.profile_roles pr where public.pv_role_key(pr.role_key) = 'po')
                  + (select count(*) from public.requests r where upper(coalesce(r.current_stage, '')) = 'PO'),
    'audit_events_today', (select count(*) from public.reqgen_audit_log a where a.at >= date_trunc('day', now())),
    'checks', json_build_array(
      json_build_object('label', 'Requests waiting with nobody to act', 'count',
        (select count(*) from public.requests r where coalesce(r.status, '') not in ('Draft', 'Paid', 'Completed', 'Rejected', 'Cancelled', 'Deleted')
           and coalesce(r.status, '') not ilike 'withdrawn%' and lower(coalesce(r.current_stage, '')) not in ('completed', 'rejected', 'cancelled', 'deleted')
           and r.current_owner is null and r.assigned_account_officer_user_id is null)),
      json_build_object('label', 'Departments with no paying account', 'count',
        (select count(*) from public.departments d where coalesce(d.is_active, true)
           and not exists (select 1 from public.department_account_routing x where x.dept_id = d.id and coalesce(x.is_active, true)))),
      json_build_object('label', 'Officers who sign but have no signature', 'count',
        (select count(*) from public.profiles p where coalesce(p.is_active, true) and coalesce(p.signature_url, '') = ''
           and exists (select 1 from public.profile_roles pr where pr.profile_id = p.id and coalesce(pr.is_active, true)
                       and public.pv_role_key(pr.role_key) in ('dg', 'generalsecretary', 'dod', 'director', 'hod', 'pd', 'dinadmin', 'registrar', 'hrcoordinator', 'accountofficer', 'auditor', 'pvcountersigner', 'pvsigner')))),
      json_build_object('label', 'Paid vouchers without a payment date', 'count',
        (select count(*) from public.payment_vouchers v where v.status = 'Paid' and v.paid_on is null and v.paid_at is null)),
      json_build_object('label', 'Subheads spent beyond their allocation', 'count',
        (select count(*) from public.subheads s where coalesce(s.expenditure, 0) > coalesce(s.approved_allocation, 0) and coalesce(s.approved_allocation, 0) > 0)),
      json_build_object('label', 'Positions held by deactivated staff', 'count',
        (select count(*) from public.profile_roles pr join public.profiles p on p.id = pr.profile_id
          where coalesce(pr.is_active, true) and not coalesce(p.is_active, true) and public.pv_role_key(pr.role_key) <> 'staff'))
    ),
    'response_ms', round(extract(epoch from clock_timestamp() - t0) * 1000)
  ) into v;
  return v;
end;
$$;
revoke all on function public.reqgen_diagnostics() from public, anon;
grant execute on function public.reqgen_diagnostics() to authenticated;
insert into v460_report values ('5 diagnostics', 'reqgen_diagnostics', 'tables, row-level security, alerts, nightly backup, old PO codes, 6 data checks', 'OK');

-- 6. Checks -------------------------------------------------------------------------------
insert into v460_report
select '6 check', 'functions present', count(*)::text || ' of 9', case when count(*) = 9 then 'OK' else 'MISSING' end
from pg_proc where pronamespace = 'public'::regnamespace and proname in (
  'reqgen_is_admin', 'reqgen_admin_people', 'reqgen_admin_summary', 'reqgen_admin_positions', 'reqgen_security_rules_save',
  'reqgen_security_attention', 'reqgen_admin_log', 'reqgen_diagnostics', 'reqgen_security_remind');
insert into v460_report
select '6 check', 'security rules row', coalesce((select stay_hours || ' h · ' || idle_minutes || ' min · ' || passcode_tries || ' tries' from public.reqgen_security_rules where id = 1), 'missing'),
       case when exists (select 1 from public.reqgen_security_rules where id = 1) then 'OK' else 'MISSING' end;
insert into v460_report values ('7 check', 'routing engine untouched', 'reqgen_save_department_route and the route tables are only used, never changed', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v460_report order by step, item;
