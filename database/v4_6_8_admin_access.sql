-- =============================================================================
-- ReqGen v4.6.8 — Super Admin can see and set everything in Administration
-- Run in the Supabase SQL Editor AFTER the v4.6.8 code shows "Ready" on Vercel.
-- Needs v4_6_0_administration.sql and v4_6_6_system_accounts.sql (already run).
--
-- Why
--   The Super Admin is a system account: no department and only the Super Admin position.
--   The older security rules on staff records and on department paying accounts were
--   written before that, so for the Super Admin:
--     * every staff name showed as "undefined", every department as "0 staff";
--     * the officer lists offered only "Super Admin";
--     * "Pays from" showed "Not set" for every department;
--     * saving a department's account failed with
--       "new row violates row-level security policy for table department_account_routing".
--
-- What it does
--   1. Saves a copy of the current security rules of the tables below (for undo).
--   2. ADDS rules so the Super Admin and the Developer can read the Administration
--      tables (staff records, positions, departments, accounts, routing officers…) and
--      change the setting tables. No existing rule is changed or removed; staff keep
--      exactly the access they have today.
--   3. Adds three Administration functions:
--        reqgen_admin_departments_data()  departments with staff count, paying account,
--                                          Account Officer, and each account's fund
--        reqgen_admin_save_department()    add / edit a department and its paying account
--        reqgen_admin_set_department_account()  set or clear a department's paying account
--   4. FUNDRAISING: makes sure the department exists and is paid from the same account,
--      with the same Account Officer, as General Admin.
--
-- The routing engine is NOT changed (its functions and route tables are only read).
-- Requests are NOT touched: the Super Admin still cannot see request contents.
-- Nothing is deleted. Safe to run more than once.
-- Ends with a table where every row says OK (or explains what to do).
-- =============================================================================
begin;

create temp table if not exists v468_report (step text, item text, result text, status text);
truncate v468_report;

do $$ begin
  if to_regprocedure('public.reqgen_is_admin()') is null then
    raise exception 'Run database/v4_6_0_administration.sql first, then this file.';
  end if;
  if to_regprocedure('public.reqgen_is_super_admin()') is null then
    raise exception 'Run database/v4_6_6_system_accounts.sql first, then this file.';
  end if;
end $$;

-- 0. Copy of the current security rules (undo record) -------------------------------------------
create table if not exists public.reqgen_policy_snapshots (
  id bigserial primary key,
  release text not null,
  table_name text not null,
  policy_name text not null,
  permissive text,
  command text,
  roles text,
  using_rule text,
  check_rule text,
  captured_at timestamptz not null default now()
);
alter table public.reqgen_policy_snapshots enable row level security;
drop policy if exists reqgen_policy_snapshots_read on public.reqgen_policy_snapshots;
create policy reqgen_policy_snapshots_read on public.reqgen_policy_snapshots for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_account in ('superadmin', 'developer')));
revoke all on public.reqgen_policy_snapshots from anon;
grant select on public.reqgen_policy_snapshots to authenticated;

create temp table if not exists v468_tables (t text primary key, writes boolean not null);
truncate v468_tables;
insert into v468_tables values
  ('profiles', false), ('profile_roles', false), ('user_active_roles', false), ('reqgen_roles', false),
  ('hr_officer_assignments', false), ('departments', true), ('iet_accounts', true),
  ('department_account_routing', true), ('iet_account_officer_assignments', true), ('app_settings', true),
  ('reqgen_department_stage_officers', false), ('reqgen_officer_availability', false), ('reqgen_stage_backups', true),
  ('reqgen_department_routes', false), ('reqgen_route_templates', false), ('reqgen_route_steps', false),
  ('payment_voucher_counter_signatories', true), ('subheads', true);

insert into public.reqgen_policy_snapshots (release, table_name, policy_name, permissive, command, roles, using_rule, check_rule)
select 'v4.6.8', p.tablename, p.policyname, p.permissive, p.cmd, array_to_string(p.roles, ','), p.qual, p.with_check
from pg_policies p
join v468_tables t on t.t = p.tablename
where p.schemaname = 'public'
  and p.policyname not like 'reqgen_v468_%'
  and not exists (select 1 from public.reqgen_policy_snapshots s where s.release = 'v4.6.8' and s.table_name = p.tablename and s.policy_name = p.policyname);
insert into v468_report
select '00 undo copy', 'reqgen_policy_snapshots', count(*) || ' existing rules saved (nothing changed or removed)', 'OK'
from public.reqgen_policy_snapshots where release = 'v4.6.8';

-- 1. Super Admin and Developer may read Administration tables, and change the setting tables -------
--    Rules are ADDED only on tables that already have row-level security switched on.
--    (A table without it is already open to signed-in users, so nothing is needed.)
do $$
declare
  r record;
  v_rls boolean;
begin
  for r in select * from v468_tables order by t loop
    if to_regclass('public.' || r.t) is null then
      insert into v468_report values ('01 access', r.t, 'table not in this database (not used here)', 'OK');
      continue;
    end if;
    select c.relrowsecurity into v_rls from pg_class c where c.oid = ('public.' || r.t)::regclass;
    if not v_rls then
      insert into v468_report values ('01 access', r.t, 'no row-level security on this table: already readable, nothing added', 'OK');
      continue;
    end if;

    execute format('drop policy if exists reqgen_v468_admin_read on public.%I', r.t);
    execute format('create policy reqgen_v468_admin_read on public.%I for select to authenticated using (public.reqgen_is_admin())', r.t);
    execute format('grant select on public.%I to authenticated', r.t);

    if r.writes then
      execute format('drop policy if exists reqgen_v468_admin_insert on public.%I', r.t);
      execute format('create policy reqgen_v468_admin_insert on public.%I for insert to authenticated with check (public.reqgen_is_admin())', r.t);
      execute format('drop policy if exists reqgen_v468_admin_update on public.%I', r.t);
      execute format('create policy reqgen_v468_admin_update on public.%I for update to authenticated using (public.reqgen_is_admin()) with check (public.reqgen_is_admin())', r.t);
      execute format('drop policy if exists reqgen_v468_admin_delete on public.%I', r.t);
      execute format('create policy reqgen_v468_admin_delete on public.%I for delete to authenticated using (public.reqgen_is_admin())', r.t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', r.t);
    end if;

    insert into v468_report values ('01 access', r.t,
      'Super Admin and Developer may read' || case when r.writes then ' and change' else '' end
      || case when exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.t and p.permissive = 'RESTRICTIVE')
              then '. NOTE: this table also has a RESTRICTIVE rule; send the report to Barderian Enterprises' else '' end,
      case when exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.t and p.permissive = 'RESTRICTIVE') then 'CHECK' else 'OK' end);
  end loop;
end $$;

-- 2. Administration functions (work whatever the table rules are) ---------------------------------
create or replace function public.reqgen_admin_departments_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.reqgen_is_admin() then raise exception 'Administration is for the Super Admin and the Developer.'; end if;
  select jsonb_build_object(
    'routing', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'dept_id', r.dept_id, 'iet_account_id', r.iet_account_id,
                                                            'officer_user_id', r.officer_user_id, 'is_active', coalesce(r.is_active, true)))
                         from public.department_account_routing r), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('account_id', x.account_id, 'officer_user_id', x.officer_user_id))
                             from public.iet_account_officer_assignments x), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object(
                             'id', a.id, 'name', coalesce(nullif(to_jsonb(a) ->> 'name', ''), to_jsonb(a) ->> 'account_name', 'Account'),
                             'bank_name', to_jsonb(a) ->> 'bank_name',
                             'total_fund', coalesce((to_jsonb(a) ->> 'total_fund')::numeric, 0),
                             'allocated_amount', coalesce((to_jsonb(a) ->> 'allocated_amount')::numeric, 0),
                             'is_active', coalesce((to_jsonb(a) ->> 'is_active')::boolean, true))
                           order by coalesce(nullif(to_jsonb(a) ->> 'name', ''), to_jsonb(a) ->> 'account_name'))
                          from public.iet_accounts a), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.reqgen_admin_departments_data() from public, anon;
grant execute on function public.reqgen_admin_departments_data() to authenticated;

create or replace function public.reqgen_admin_set_department_account(p_dept_id uuid, p_account_id uuid, p_officer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row uuid;
begin
  if not public.reqgen_is_admin() then raise exception 'Only the Super Admin or the Developer can set a department''s account.'; end if;
  if not exists (select 1 from public.departments where id = p_dept_id) then raise exception 'Department not found.'; end if;
  if (p_account_id is null) <> (p_officer_id is null) then raise exception 'Choose both the account and its Account Officer, or neither.'; end if;

  if p_account_id is null then
    update public.department_account_routing set is_active = false where dept_id = p_dept_id and coalesce(is_active, true);
  else
    if not exists (select 1 from public.iet_accounts where id = p_account_id) then raise exception 'Account not found.'; end if;
    if not exists (select 1 from public.profiles where id = p_officer_id and system_account is null and coalesce(is_active, true)) then
      raise exception 'Choose an active staff member as the Account Officer.';
    end if;
    -- the Routing Engine sends DG-approved requests only to an officer who holds the Account Officer position
    if not exists (select 1 from public.profile_roles pr where pr.profile_id = p_officer_id and coalesce(pr.is_active, true)
                   and regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g') in ('account', 'accountofficer')) then
      raise exception '% does not hold the Account Officer position. Give it in Administration › Staff & Positions first, or choose an Account Officer.',
        coalesce((select full_name from public.profiles where id = p_officer_id), 'This person');
    end if;
    select id into v_row from public.department_account_routing where dept_id = p_dept_id
     order by coalesce(is_active, true) desc, created_at desc limit 1;
    if v_row is null then
      insert into public.department_account_routing (dept_id, iet_account_id, officer_user_id, is_active)
      values (p_dept_id, p_account_id, p_officer_id, true);
    else
      update public.department_account_routing set iet_account_id = p_account_id, officer_user_id = p_officer_id, is_active = true where id = v_row;
      update public.department_account_routing set is_active = false where dept_id = p_dept_id and id <> v_row and coalesce(is_active, true);
    end if;
  end if;

  if to_regclass('public.reqgen_audit_log') is not null and to_regprocedure('public.reqgen_actor_label(uuid)') is not null then
    insert into public.reqgen_audit_log (actor_id, actor_label, category, module, action, record_no, record_id, device, details)
    values (auth.uid(), coalesce(public.reqgen_actor_label(auth.uid()), 'Super Admin'), 'settings', 'Administration',
            case when p_account_id is null then 'Department account cleared' else 'Department account set' end,
            (select name from public.departments where id = p_dept_id), p_dept_id, null,
            jsonb_build_object('account', (select coalesce(nullif(to_jsonb(a) ->> 'name', ''), to_jsonb(a) ->> 'account_name') from public.iet_accounts a where a.id = p_account_id),
                               'account_officer', (select full_name from public.profiles where id = p_officer_id)));
  end if;
end;
$$;
revoke all on function public.reqgen_admin_set_department_account(uuid, uuid, uuid) from public, anon;
grant execute on function public.reqgen_admin_set_department_account(uuid, uuid, uuid) to authenticated;

create or replace function public.reqgen_admin_save_department(p_dept_id uuid, p_name text, p_is_active boolean, p_account_id uuid, p_officer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_dept_id;
  v_name text := upper(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
begin
  if not public.reqgen_is_admin() then raise exception 'Only the Super Admin or the Developer can add or change departments.'; end if;
  if length(v_name) < 2 then raise exception 'Write the department name.'; end if;
  if exists (select 1 from public.departments d where upper(trim(d.name)) = v_name and d.id is distinct from p_dept_id) then
    raise exception 'A department with that name already exists.';
  end if;

  if v_id is null then
    insert into public.departments (name, is_active) values (v_name, coalesce(p_is_active, true)) returning id into v_id;
  else
    update public.departments set name = v_name, is_active = coalesce(p_is_active, true) where id = v_id;
    if not found then raise exception 'Department not found.'; end if;
  end if;

  if p_account_id is not null or p_officer_id is not null then
    perform public.reqgen_admin_set_department_account(v_id, p_account_id, p_officer_id);
  end if;

  if to_regclass('public.reqgen_audit_log') is not null and to_regprocedure('public.reqgen_actor_label(uuid)') is not null then
    insert into public.reqgen_audit_log (actor_id, actor_label, category, module, action, record_no, record_id, device, details)
    values (auth.uid(), coalesce(public.reqgen_actor_label(auth.uid()), 'Super Admin'), 'settings', 'Administration',
            case when p_dept_id is null then 'Department added' else 'Department changed' end, v_name, v_id, null,
            jsonb_build_object('active', coalesce(p_is_active, true)));
  end if;
  return v_id;
end;
$$;
revoke all on function public.reqgen_admin_save_department(uuid, text, boolean, uuid, uuid) from public, anon;
grant execute on function public.reqgen_admin_save_department(uuid, text, boolean, uuid, uuid) to authenticated;

-- read-only: will DG approval find this department's Account Officer? (same rule as the Routing Engine)
create or replace function public.reqgen_department_account_officer(p_dept_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dept text;
  r record;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select name into v_dept from public.departments where id = p_dept_id;
  select dar.officer_user_id, p.full_name,
         exists (select 1 from public.profile_roles pr where pr.profile_id = dar.officer_user_id and coalesce(pr.is_active, true)
                 and regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g') in ('account', 'accountofficer')) as holds
    into r
  from public.department_account_routing dar
  left join public.profiles p on p.id = dar.officer_user_id
  where dar.dept_id = p_dept_id and coalesce(dar.is_active, true)
  order by dar.created_at desc
  limit 1;
  if r.officer_user_id is null then
    return jsonb_build_object('ok', false, 'reason', coalesce(v_dept, 'This department') || ' has no paying account and Account Officer yet. Ask the Super Admin to set it in Administration › Departments, then approve.');
  end if;
  if not r.holds then
    return jsonb_build_object('ok', false, 'officer_name', r.full_name, 'reason', coalesce(r.full_name, 'The officer') || ', set to pay ' || coalesce(v_dept, 'this department') || ', does not hold the Account Officer position. Ask the Super Admin to fix it in Administration › Departments.');
  end if;
  return jsonb_build_object('ok', true, 'officer_name', r.full_name);
end;
$$;
revoke all on function public.reqgen_department_account_officer(uuid) from public, anon;
grant execute on function public.reqgen_department_account_officer(uuid) to authenticated;

-- the officer who holds the request chooses (or, for a personal fund, HR recommends) the subhead
-- and reserves the amount — same reservation rules as assign_request_subhead_and_reserve, which
-- stays as it is; this one also covers the steps that one does not (DOD, DIN Admin, Registrar, HR)
create or replace function public.reqgen_officer_assign_subhead(p_request_id uuid, p_subhead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.requests%rowtype;
  v_stage text;
  v_type text;
  v_cat text;
  v_name text;
  v_role_key text;
  v_role_name text;
  v_alloc numeric; v_res numeric; v_exp numeric; v_avail numeric;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  v_stage := upper(regexp_replace(coalesce(v_req.current_stage, ''), '[\s_-]+', '', 'g'));
  v_type := upper(coalesce(v_req.request_type, ''));
  v_cat := upper(coalesce(v_req.personal_category, ''));
  if v_req.current_owner is distinct from v_actor then raise exception 'This request is not with you.'; end if;
  if v_stage in ('DG', 'ACCOUNT', 'HRFILING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DELETED') then
    raise exception 'The subhead is chosen before the Director General.';
  end if;
  if not ((v_type = 'OFFICIAL' and v_stage in ('DOD', 'DIRECTOR', 'DINADMIN', 'HOD', 'REGISTRAR', 'HR'))
          or (v_type = 'PERSONAL' and v_cat = 'FUND' and v_stage = 'HR')) then
    raise exception 'A subhead is not chosen at this step for this kind of request.';
  end if;
  if coalesce(v_req.amount, 0) <= 0 then raise exception 'The request has no amount to reserve.'; end if;

  -- release a reservation on another subhead first
  if v_req.subhead_id is not null and v_req.subhead_id <> p_subhead_id and lower(coalesce(v_req.funds_state, '')) = 'reserved' then
    update public.requests set funds_state = 'Pending Subhead Assignment' where id = p_request_id;
    if to_regprocedure('public.recalculate_subhead_finance(uuid)') is not null then perform public.recalculate_subhead_finance(v_req.subhead_id); end if;
  end if;

  select coalesce(approved_allocation, 0), coalesce(reserved_amount, 0), coalesce(expenditure, 0)
    into v_alloc, v_res, v_exp
  from public.subheads where id = p_subhead_id and coalesce(is_active, true) for update;
  if not found then raise exception 'Choose an active subhead.'; end if;
  if v_req.subhead_id = p_subhead_id and lower(coalesce(v_req.funds_state, '')) = 'reserved' then v_res := v_res - coalesce(v_req.amount, 0); end if;
  v_avail := v_alloc - v_res - v_exp;
  if v_req.amount > v_avail then
    raise exception 'Not enough in this subhead. Available: %, needed: %.', to_char(v_avail, 'FM999,999,999,990.00'), to_char(v_req.amount, 'FM999,999,999,990.00');
  end if;

  update public.requests set subhead_id = p_subhead_id, funds_state = 'Reserved', updated_at = now() where id = p_request_id;
  if to_regprocedure('public.recalculate_subhead_finance(uuid)') is not null then
    perform public.recalculate_subhead_finance(p_subhead_id);
  else
    update public.subheads s set reserved_amount = coalesce(s.reserved_amount, 0) + v_req.amount where s.id = p_subhead_id;
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Officer') into v_name from public.profiles where id = v_actor;
  select coalesce(u.active_role_key, ''), coalesce(u.active_role_name, '') into v_role_key, v_role_name from public.user_active_roles u where u.user_id = v_actor;
  insert into public.request_history (request_id, action_by, actor_name, actor_role_key, actor_role_name, from_stage, to_stage, action_type, comment, created_at)
  values (p_request_id, v_actor, v_name, nullif(v_role_key, ''), coalesce(nullif(v_role_name, ''), v_req.current_stage), v_req.current_stage, v_req.current_stage, 'Edited',
          case when v_type = 'PERSONAL' then 'Subhead recommended and the amount reserved by ' else 'Subhead assigned and the amount reserved by ' end || v_name || '.', now());

  return jsonb_build_object('ok', true, 'request_id', p_request_id, 'subhead_id', p_subhead_id, 'funds_state', 'Reserved',
    'message', case when v_type = 'PERSONAL' then 'Subhead recommended and the amount reserved.' else 'Subhead assigned and the amount reserved.' end);
end;
$$;
revoke all on function public.reqgen_officer_assign_subhead(uuid, uuid) from public, anon;
grant execute on function public.reqgen_officer_assign_subhead(uuid, uuid) to authenticated;

insert into v468_report values ('02 functions', 'reqgen_admin_departments_data · reqgen_admin_save_department · reqgen_admin_set_department_account · reqgen_department_account_officer · reqgen_officer_assign_subhead',
  'Administration ones for the Super Admin and Developer only; the officer holding a request can choose (HR: recommend) its subhead; changes are logged', 'OK');

-- 3. FUNDRAISING: paid from the same account as General Admin ------------------------------------
do $$
declare
  v_ga uuid;
  v_fr uuid;
  v_ga_route record;
  v_fr_route record;
  v_acc text;
begin
  select id into v_ga from public.departments where upper(trim(name)) = 'GENERAL ADMIN' order by coalesce(is_active, true) desc limit 1;
  select id into v_fr from public.departments where upper(trim(name)) = 'FUNDRAISING' order by coalesce(is_active, true) desc limit 1;

  if v_fr is null then
    insert into public.departments (name, is_active) values ('FUNDRAISING', true) returning id into v_fr;
    insert into v468_report values ('03 FUNDRAISING', 'department', 'created and active (staff can now choose it when they register)', 'OK');
  else
    update public.departments set is_active = true where id = v_fr and is_active is distinct from true;
    insert into v468_report values ('03 FUNDRAISING', 'department', 'exists and is active (staff can choose it when they register)', 'OK');
  end if;

  if v_ga is null then
    insert into v468_report values ('03 FUNDRAISING', 'paying account', 'No department named GENERAL ADMIN was found. Set FUNDRAISING''s account in Administration › Departments › Edit.', 'TO DO');
    return;
  end if;

  select r.* into v_ga_route from public.department_account_routing r where r.dept_id = v_ga and coalesce(r.is_active, true) order by r.created_at desc limit 1;
  select r.* into v_fr_route from public.department_account_routing r where r.dept_id = v_fr and coalesce(r.is_active, true) order by r.created_at desc limit 1;

  if v_ga_route.id is null then
    insert into v468_report values ('03 FUNDRAISING', 'paying account',
      'General Admin has no paying account set yet. Set it in Administration › Departments › Edit (General Admin), then set FUNDRAISING the same, or run this file again.', 'TO DO');
  elsif v_fr_route.id is null then
    insert into public.department_account_routing (dept_id, iet_account_id, officer_user_id, is_active)
    values (v_fr, v_ga_route.iet_account_id, v_ga_route.officer_user_id, true);
    select coalesce(nullif(to_jsonb(a) ->> 'name', ''), to_jsonb(a) ->> 'account_name') into v_acc from public.iet_accounts a where a.id = v_ga_route.iet_account_id;
    insert into v468_report values ('03 FUNDRAISING', 'paying account',
      'set: ' || coalesce(v_acc, 'account') || ' · ' || coalesce((select full_name from public.profiles where id = v_ga_route.officer_user_id), 'officer') || ' (same as General Admin)', 'OK');
  else
    select coalesce(nullif(to_jsonb(a) ->> 'name', ''), to_jsonb(a) ->> 'account_name') into v_acc from public.iet_accounts a where a.id = v_fr_route.iet_account_id;
    insert into v468_report values ('03 FUNDRAISING', 'paying account',
      'already set: ' || coalesce(v_acc, 'account')
      || case when v_fr_route.iet_account_id = v_ga_route.iet_account_id then ' (same as General Admin)' else ' — NOT the same as General Admin; change it in Departments if needed' end,
      case when v_fr_route.iet_account_id = v_ga_route.iet_account_id then 'OK' else 'CHECK' end);
  end if;

  -- the route is only READ here (Routing Engine is not changed)
  insert into v468_report values ('03 FUNDRAISING', 'approval route',
    case when public.reqgen_template_for_department(v_fr) = public.reqgen_template_for_department(v_ga)
         then 'same route as General Admin'
         else 'differs from General Admin: in Routing Engine › Routes press Change, choose FUNDRAISING, use "Copy steps from" General Admin, Save' end,
    case when public.reqgen_template_for_department(v_fr) = public.reqgen_template_for_department(v_ga) then 'OK' else 'TO DO' end);
end $$;

-- 4. Check ----------------------------------------------------------------------------------------
insert into v468_report
select '04 check', 'department paying accounts', count(*) filter (where coalesce(is_active, true)) || ' department(s) have a paying account set', 'OK'
from public.department_account_routing;
insert into v468_report
select '04 check', 'functions',
  case when count(*) = 5 then 'all five functions present' else 'MISSING: ' || (5 - count(*)) end,
  case when count(*) = 5 then 'OK' else 'MISSING' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_admin_departments_data', 'reqgen_admin_save_department', 'reqgen_admin_set_department_account', 'reqgen_department_account_officer', 'reqgen_officer_assign_subhead');
insert into v468_report
select '04 check', 'pays from: ' || d.name,
  case when r.officer_user_id is null then 'no paying account / Account Officer: DG approval of its official requests will stop. Set it in Administration › Departments'
       else 'Account Officer ' || coalesce(p.full_name, '?') || ' does not hold the Account Officer position: give it in Staff & Positions, or choose another' end,
  'TO DO'
from public.departments d
left join lateral (select x.officer_user_id from public.department_account_routing x where x.dept_id = d.id and coalesce(x.is_active, true) order by x.created_at desc limit 1) r on true
left join public.profiles p on p.id = r.officer_user_id
where coalesce(d.is_active, true)
  and (r.officer_user_id is null
       or not exists (select 1 from public.profile_roles pr where pr.profile_id = r.officer_user_id and coalesce(pr.is_active, true)
                      and regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g') in ('account', 'accountofficer')));

insert into v468_report values ('04 check', 'routing engine', 'not changed (approve_request_step, build_request_route, reqgen_save_department_route and the route tables untouched)', 'OK');

commit;

-- let the Supabase API see the new functions at once
notify pgrst, 'reload schema';

select step, item, result, status from v468_report order by step, item;
