-- =============================================================================
-- ReqGen v4.0.0 · DATABASE CLEAN-UP · PART 1 (v2) — MOVE UNUSED OBJECTS OUT OF PUBLIC
-- v2 (11 Oct 2026): also moves the last HR leftovers that held back 5 tables in the
-- first run (their audit/trigger functions). Safe to run again: objects already
-- archived are reported as "already in archive".
-- Islamic Education Trust · prepared 11 October 2026 from the owner's inventory
--
-- SAFE TO RUN NOW, while v3.1.14 is live and before the pilot.
--
-- WHAT IT DOES
--   Moves the old HR / executive / unused tables and functions out of the
--   "public" schema into a private schema called "reqgen_archive".
--   The app and its users can no longer see or use them, so Supabase is clean.
--   NOTHING IS DELETED YET: every moved object is kept, untouched, in the
--   archive and listed in reqgen_archive.moved_objects. If anything is missed
--   during the pilot, PART 2 puts everything back in one run.
--   After a successful pilot, PART 3 deletes the archive for good.
--
-- BUILT-IN SAFETY CHECKS (an object is NOT moved, and is reported, if)
--   • a table that stays in public has a foreign key pointing to it
--   • a function, view or security policy that stays in public uses it
--   • it no longer exists (already removed) — reported as "not found"
--
-- WHAT IT DOES NOT TOUCH
--   Requests, history, attachments, vouchers, subheads, accounts, ledgers,
--   routing engine, roles, profiles, notifications, SMS/OTP, registry
--   correspondence, settings, backups. The PO→PD and HR Coordinator renames
--   are in a separate script that ships WITH the v4.0.0 code (v3 still reads
--   the old codes, so renaming now would break the live app).
--
-- HOW TO RUN
--   Supabase → SQL Editor → paste everything → Run.
--   The last result is a verification table. Every row must say OK.
--   Download it as CSV (or screenshot) and send it back.
-- =============================================================================

begin;
set local lock_timeout = '8s';
set local statement_timeout = '120s';

create schema if not exists reqgen_archive;
comment on schema reqgen_archive is 'ReqGen v4 clean-up: unused objects moved out of public. Not visible to the app. Purge with Part 3 after the pilot.';

-- Hide the archive from the app (Supabase roles), if those roles exist.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema reqgen_archive from %I', r);
    end if;
  end loop;
end $$;

create table if not exists reqgen_archive.moved_objects (
  id          bigserial primary key,
  object_kind text not null,            -- 'table' or 'function'
  object_name text not null,            -- table name, or function name(args)
  rows_at_move bigint,
  moved_at    timestamptz not null default now(),
  restored_at timestamptz
);

-- -----------------------------------------------------------------------------
-- The lists (from the inventory of 11 Oct 2026, checked against the v3.1.14 code)
-- -----------------------------------------------------------------------------
drop table if exists pg_temp.clean_tables;
create temporary table clean_tables (name text primary key);
insert into clean_tables values
  -- old HR module (pages removed in v3.0.7; not used by v3.1.14 or v4)
  ('hr_assessment_assignments'), ('hr_assessment_cycles'), ('hr_assessment_responses'),
  ('hr_assessment_results'), ('hr_assignment_comments'), ('hr_assignment_history'),
  ('hr_department_capacity_assessments'), ('hr_department_capacity_interventions'),
  ('hr_department_capacity_programmes'), ('hr_department_kpis'), ('hr_kpi_evidence'),
  ('hr_kpi_reviews'), ('hr_leave_balances'), ('hr_leave_comments'), ('hr_leave_history'),
  ('hr_leave_records'), ('hr_policy_settings'), ('hr_request_assignments'),
  ('hr_request_reviews'), ('hr_seminar_attendance'), ('hr_seminar_attendance_corrections'),
  ('hr_seminar_sessions'), ('hr_seminar_settings'), ('hr_staff_file_audit'),
  ('hr_staff_file_movements'), ('hr_staff_files'), ('hr_staff_training_programmes'),
  ('hr_training_evidence'), ('hr_training_feedback'), ('hr_training_impact_reviews'),
  ('hr_training_needs'), ('hr_training_participants'),
  -- old executive / experimental tables, all empty
  ('enterprise_audit_events'), ('workflow_rules'), ('workflow_sla_events'),
  ('notification_preferences'), ('payment_evidence'), ('payment_voucher_counters'),
  ('manual_payment_voucher_audit'), ('registry_archive_records'), ('registry_file_movements'),
  -- old account-officer link tables, all empty (replaced by iet_account_officer_assignments)
  ('iet_account_assignments'), ('iet_account_officers'), ('account_officer_accounts');

drop table if exists pg_temp.clean_functions;
create temporary table clean_functions (name text primary key);
insert into clean_functions values
  -- old HR module
  ('hr_archive_staff_file'), ('hr_move_staff_file'), ('hr_record_seminar_attendance'),
  ('hr_set_seminar_session_status'), ('hr_can_manage_strategic_section'), ('can_manage_hr_leave'),
  ('hr_assignment_audit'), ('audit_hr_leave_record'), ('hr_classify_seminar_arrival'), ('hr_staff_file_audit_trigger'),
  ('hr_can_manage_staff_files'), ('hr_can_manage_weekly_seminar'), ('is_hr_boss_or_admin'),
  ('hr_staff_file_touch'), ('hr_touch_policy_settings'), ('hr_touch_updated_at'), ('touch_hr_leave_record'),
  -- superseded versions, not called by the app or by any other database function
  ('submit_request'), ('submit_request_with_funds'), ('reserve_request_funds'),
  ('finalize_request_funds'), ('reject_request_and_restore'), ('update_request_amount'),
  ('generate_payment_voucher'), ('sign_payment_voucher_cheque'), ('counter_sign_payment_voucher_cheque'),
  ('set_iet_account_balance'), ('set_primary_profile_role'), ('assign_profile_role'),
  ('deactivate_profile_role'), ('find_profile_by_full_name'), ('get_print_request_history'),
  ('get_my_pending_approval_count'), ('recalculate_all_subhead_finance');

drop table if exists pg_temp.clean_report;
create temporary table clean_report (
  kind text, name text, action text, detail text, rows_n bigint, status text
);

-- -----------------------------------------------------------------------------
-- Move functions first (only if nothing that stays in public still uses them)
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
  blocker text;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (select name from clean_functions)
    order by p.proname
  loop
    blocker := null;
    -- used by a function that stays in public?
    select string_agg(q.proname, ', ') into blocker
    from pg_proc q
    where q.pronamespace = 'public'::regnamespace
      and q.proname not in (select name from clean_functions)
      and q.prosrc ~* ('\m' || f.proname || '\M');
    -- used by a trigger on a table that stays in public?
    if blocker is null then
      select string_agg(tc.relname || '.' || tg.tgname, ', ') into blocker
      from pg_trigger tg join pg_class tc on tc.oid = tg.tgrelid
      where tg.tgfoid = f.oid
        and tc.relnamespace = 'public'::regnamespace
        and tc.relname not in (select name from clean_tables);
    end if;
    -- used by a policy on a table that stays?
    if blocker is null then
      select string_agg(pl.tablename || '.' || pl.policyname, ', ') into blocker
      from pg_policies pl
      where pl.schemaname = 'public'
        and pl.tablename not in (select name from clean_tables)
        and (coalesce(pl.qual, '') || ' ' || coalesce(pl.with_check, '')) ~* ('\m' || f.proname || '\M');
    end if;

    if blocker is null then
      execute format('alter function public.%I(%s) set schema reqgen_archive', f.proname, f.args);
      insert into reqgen_archive.moved_objects(object_kind, object_name) values ('function', f.proname || '(' || f.args || ')');
      insert into clean_report values ('function', f.proname || '(' || f.args || ')', 'moved to archive', '', null, 'OK');
    else
      insert into clean_report values ('function', f.proname || '(' || f.args || ')', 'kept in public', 'still used by: ' || blocker, null, 'OK');
    end if;
  end loop;

  insert into clean_report
  select 'function', c.name,
         case when exists (select 1 from pg_proc p where p.proname = c.name and p.pronamespace = 'reqgen_archive'::regnamespace)
              then 'already in archive' else 'not found' end,
         case when exists (select 1 from pg_proc p where p.proname = c.name and p.pronamespace = 'reqgen_archive'::regnamespace)
              then 'moved on an earlier run' else 'already gone' end, null, 'OK'
  from clean_functions c
  where not exists (select 1 from pg_proc p where p.proname = c.name and p.pronamespace = 'public'::regnamespace)
    and not exists (select 1 from clean_report r where r.kind = 'function' and r.name like c.name || '(%');
end $$;

-- -----------------------------------------------------------------------------
-- Move tables (only if nothing that stays in public still uses them)
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
  blocker text;
  n bigint;
begin
  for t in
    select c.oid, c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and c.relname in (select name from clean_tables)
    order by c.relname
  loop
    blocker := null;
    -- a table that stays has a foreign key to it?
    select string_agg(distinct k.conrelid::regclass::text, ', ') into blocker
    from pg_constraint k
    join pg_class kc on kc.oid = k.conrelid
    where k.contype = 'f' and k.confrelid = t.oid
      and kc.relname not in (select name from clean_tables);
    -- a function that stays uses it?
    if blocker is null then
      select string_agg(q.proname, ', ') into blocker
      from pg_proc q
      where q.pronamespace = 'public'::regnamespace
        and q.prosrc ~* ('\m' || t.relname || '\M');
    end if;
    -- a view that stays uses it?
    if blocker is null then
      select string_agg(distinct v.relname, ', ') into blocker
      from pg_depend d
      join pg_rewrite rw on rw.oid = d.objid
      join pg_class v on v.oid = rw.ev_class
      where d.refobjid = t.oid and v.oid <> t.oid
        and v.relnamespace = 'public'::regnamespace;
    end if;
    -- a policy on a table that stays uses it?
    if blocker is null then
      select string_agg(pl.tablename || '.' || pl.policyname, ', ') into blocker
      from pg_policies pl
      where pl.schemaname = 'public'
        and pl.tablename not in (select name from clean_tables)
        and (coalesce(pl.qual, '') || ' ' || coalesce(pl.with_check, '')) ~* ('\m' || t.relname || '\M');
    end if;

    execute format('select count(*) from public.%I', t.relname) into n;

    if blocker is null then
      execute format('alter table public.%I set schema reqgen_archive', t.relname);
      insert into reqgen_archive.moved_objects(object_kind, object_name, rows_at_move) values ('table', t.relname, n);
      insert into clean_report values ('table', t.relname, 'moved to archive', '', n, 'OK');
    else
      insert into clean_report values ('table', t.relname, 'kept in public', 'still used by: ' || blocker, n, 'OK');
    end if;
  end loop;

  insert into clean_report
  select 'table', c.name,
         case when to_regclass('reqgen_archive.' || quote_ident(c.name)) is not null then 'already in archive' else 'not found' end,
         case when to_regclass('reqgen_archive.' || quote_ident(c.name)) is not null then 'moved on an earlier run' else 'already gone' end, null, 'OK'
  from clean_tables c
  where to_regclass('public.' || quote_ident(c.name)) is null
    and not exists (select 1 from clean_report r where r.kind = 'table' and r.name = c.name);
end $$;

-- -----------------------------------------------------------------------------
-- Final checks: the core of ReqGen is still in place
-- -----------------------------------------------------------------------------
insert into clean_report
select 'core check', x.t,
       case when to_regclass('public.' || x.t) is not null then 'present' else 'MISSING' end,
       '', null,
       case when to_regclass('public.' || x.t) is not null then 'OK' else 'CHECK' end
from (values ('requests'), ('request_history'), ('request_attachments'), ('profiles'), ('profile_roles'),
             ('departments'), ('subheads'), ('iet_accounts'), ('payment_vouchers'), ('payment_voucher_items'),
             ('payment_voucher_history'), ('notifications'), ('reqgen_route_templates'), ('reqgen_route_steps'),
             ('reqgen_department_routes'), ('reqgen_department_stage_officers'), ('reqgen_stage_backups'),
             ('reqgen_roles'), ('hr_officer_assignments'), ('registry_correspondence'), ('account_transfers')) as x(t);

commit;

select kind as "object type", name as "object", action as "what happened", detail as "note",
       rows_n as "rows", status as "status"
from clean_report
order by case kind when 'table' then 1 when 'function' then 2 else 3 end, action, name;
