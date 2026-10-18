-- =============================================================================
-- ReqGen v4.6.5 — Super Admin finance powers
-- Run in the Supabase SQL Editor AFTER the v4.6.5 code shows "Ready" on Vercel,
-- and after v4_6_3_finance_integrity_reset.sql and v4_6_4_finance_opening_balances.sql.
--
-- Why: in v4.6.3 / v4.6.4 the database treated someone as the Super Admin only when their
-- profile was marked as the Trust's system account (profiles.system_account = 'superadmin').
-- A person holding the Super Admin position, acting as Super Admin, was refused with
-- "Only the Auditor or the Super Admin can correct stored finance totals."
--
-- From v4.6.5 the Super Admin is: an ACTIVE person who HOLDS the Super Admin (admin) position
-- and is ACTING AS Super Admin. The Developer system account is still never treated as the
-- Super Admin for finance (it keeps its own, separately logged role).
--
--   reqgen_is_super_admin   new rule above (used by corrections, account recalculation,
--                           opening balances, Financial Reset and restore)
--   reqgen_finance_powers   what the signed-in person may do on the finance pages, and if not,
--                           exactly why — so a page never shows a button that will be refused
--
-- The routing engine is NOT changed. No data is changed. Safe to run more than once.
-- Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v465_report (step text, item text, result text, status text);
truncate v465_report;

do $$ begin
  if to_regprocedure('public.reqgen_finance_record_opening(text)') is null then
    raise exception 'Run database/v4_6_3_finance_integrity_reset.sql and database/v4_6_4_finance_opening_balances.sql first, then this file.';
  end if;
end $$;

insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
select p.proname, pg_get_function_identity_arguments(p.oid), 'v4.6.5', pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'reqgen_is_super_admin'
  and not exists (select 1 from public.reqgen_function_backups b where b.function_name = p.proname and b.release = 'v4.6.5');
insert into v465_report values ('00 backup', 'reqgen_function_backups', 'the previous Super Admin rule is saved first', 'OK');

-- 1. Who is the Super Admin ----------------------------------------------------------------------
create or replace function public.reqgen_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- active, holds the Super Admin position (or is the Trust's Super Admin system account),
  -- is acting as Super Admin, and is not the Developer system account
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true)
      and coalesce(p.system_account, '') <> 'developer'
      and (p.system_account = 'superadmin' or public.reqgen_pv_user_has_role(p.id, array['admin', 'superadmin']))
  ) and public.reqgen_active_role_key() in ('admin', 'superadmin');
$$;
revoke all on function public.reqgen_is_super_admin() from public, anon;
grant execute on function public.reqgen_is_super_admin() to authenticated;
insert into v465_report values ('01 super admin', 'reqgen_is_super_admin', 'active + holds Super Admin + acting as Super Admin (not the Developer)', 'OK');

-- 2. What may I do here, and if not, why -----------------------------------------------------------
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
  v_holds_admin boolean;
  v_super boolean := public.reqgen_is_super_admin();
  v_auditor boolean := v_acting = 'auditor';
  v_reason text;
begin
  select pr.id, pr.full_name, pr.system_account, coalesce(pr.is_active, true) as active into p from public.profiles pr where pr.id = auth.uid();
  if not found then
    return jsonb_build_object('can_correct', false, 'is_super_admin', false, 'is_auditor', false, 'acting', v_acting, 'reason', 'Your staff record could not be found. Sign out and in again.');
  end if;
  v_holds_admin := p.system_account = 'superadmin' or public.reqgen_pv_user_has_role(p.id, array['admin', 'superadmin']);
  v_reason := case
    when v_super or v_auditor then null
    when not p.active then 'This account is deactivated.'
    when p.system_account = 'developer' then 'The Developer account cannot change finance records. Sign in as the Super Admin or the Auditor.'
    when v_holds_admin then 'Switch "Acting as" (top right) to Super Admin, then try again.'
    else 'Only the Auditor or the Super Admin can correct finance totals. Ask one of them, or check your positions in My Access.'
  end;
  return jsonb_build_object(
    'name', p.full_name,
    'acting', v_acting,
    'system_account', p.system_account,
    'holds_super_admin', v_holds_admin,
    'is_super_admin', v_super,
    'is_auditor', v_auditor,
    'can_correct', v_super or v_auditor,
    'can_reset', v_super,
    'reason', v_reason);
end;
$$;
revoke all on function public.reqgen_finance_powers() from public, anon;
grant execute on function public.reqgen_finance_powers() to authenticated;
insert into v465_report values ('02 powers', 'reqgen_finance_powers', 'pages show the buttons only to those allowed, and say why otherwise', 'OK');

-- 3. Checks ----------------------------------------------------------------------------------------
insert into v465_report
select '03 check', 'functions present', count(*)::text || ' of 2', case when count(*) = 2 then 'OK' else 'MISSING' end
from pg_proc where pronamespace = 'public'::regnamespace and proname in ('reqgen_is_super_admin', 'reqgen_finance_powers');
insert into v465_report
select '03 check', 'people who will be treated as Super Admin when acting as Super Admin',
       coalesce(string_agg(coalesce(p.full_name, 'unnamed'), ', ' order by p.full_name), 'nobody yet'), 'OK'
from public.profiles p
where coalesce(p.is_active, true) and coalesce(p.system_account, '') <> 'developer'
  and (p.system_account = 'superadmin' or public.reqgen_pv_user_has_role(p.id, array['admin', 'superadmin']));
insert into v465_report values ('03 check', 'routing engine untouched', 'approve_request_step, reqgen_next_route_step and the route tables are only read', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v465_report order by step, item;
