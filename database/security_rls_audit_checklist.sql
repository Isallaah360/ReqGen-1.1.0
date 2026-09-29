-- =====================================================================
-- ReqGen 2.15 - Security / RLS / Backup Audit Checklist
--
-- READ-ONLY. This file only inspects. It never changes data or policies.
--
-- HOW TO USE (Supabase -> SQL Editor):
--   * PART A is ONE query. Paste ONLY Part A, click Run, and you get ONE
--     result table with everything that needs attention listed first.
--     (Note: the SQL Editor only shows the result of the LAST query in the
--     editor, which is why Part A is a single query.)
--   * PART B has the detailed queries. To use them, highlight ONE query
--     (from its "-- B" comment to its ending semicolon) and click Run.
--
-- Meaning of the STATUS column in Part A:
--   ATTENTION = likely a real security or data problem - look at it first
--   REVIEW    = worth a human look, may be perfectly fine
--   INFO      = for your information
--   OK        = nothing to do
--
-- Column names used below were cross-checked against the columns the
-- ReqGen application itself reads from each table.
-- =====================================================================


-- =====================================================================
-- PART A  -  ONE-CLICK SUMMARY  (paste from "with" down to the final ";")
-- =====================================================================
with
rls as (
  select
    'RLS status'::text as section,
    t.tablename::text as item,
    (case
       when t.rowsecurity then 'OK'
       when t.tablename in (
         'profiles','departments','requests','request_history','request_attachments',
         'notifications','subheads','payment_vouchers','payment_voucher_history',
         'payment_voucher_items','payment_voucher_counter_signatories',
         'finance_bank_accounts','finance_account_assignments'
       ) then 'ATTENTION'
       else 'REVIEW'
     end)::text as status,
    (case
       when t.rowsecurity then 'Row Level Security is ON'
       else 'Row Level Security is OFF - signed-in users may be able to read or change this table directly'
     end)::text as detail
  from pg_tables t
  where t.schemaname = 'public'
),
pol as (
  select
    'Policies per table'::text as section,
    t.tablename::text as item,
    (case
       when t.rowsecurity and count(p.policyname) = 0 then 'ATTENTION'
       else 'OK'
     end)::text as status,
    (case
       when t.rowsecurity and count(p.policyname) = 0
         then 'RLS is ON but there are NO policies (regular users are locked out - only the server key can use it)'
       else count(p.policyname)::text || ' policy(ies)'
     end)::text as detail
  from pg_tables t
  left join pg_policies p
    on p.schemaname = t.schemaname and p.tablename = t.tablename
  where t.schemaname = 'public'
  group by t.tablename, t.rowsecurity
),
openpol as (
  select
    'Wide-open policies'::text as section,
    (p.tablename || ' / ' || p.policyname)::text as item,
    (case
       when p.cmd in ('INSERT','UPDATE','DELETE','ALL') then 'ATTENTION'
       else 'REVIEW'
     end)::text as status,
    ('Allows ' || p.cmd || ' with no real condition (just "true") for roles ' || p.roles::text)::text as detail
  from pg_policies p
  where p.schemaname = 'public'
    and p.roles::text not like '%service_role%'
    and (
      trim(coalesce(p.qual, '')) in ('true', '(true)')
      or trim(coalesce(p.with_check, '')) in ('true', '(true)')
    )
),
secdef_raw as (
  select
    p.proname::text as fname,
    pg_get_function_arguments(p.oid)::text as fargs,
    (p.proconfig is not null
       and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')) as has_search_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
),
secdef as (
  select
    'SECURITY DEFINER functions'::text as section,
    s.fname as item,
    (case when s.has_search_path then 'REVIEW' else 'ATTENTION' end)::text as status,
    ('(' || s.fargs || ') runs with elevated rights'
      || (case when s.has_search_path then ' - search_path is fixed'
               else ' and has NO fixed search_path - should be added' end))::text as detail
  from secdef_raw s
),
priv as (
  select
    'Admin / Auditor accounts'::text as section,
    coalesce(pr.full_name, pr.email, pr.id::text)::text as item,
    'REVIEW'::text as status,
    ('Role: ' || coalesce(pr.role, '(none)') || ' | ' || coalesce(pr.email, ''))::text as detail
  from profiles pr
  where lower(replace(replace(coalesce(pr.role, ''), ' ', ''), '_', '')) in ('admin', 'auditor')
),
sig as (
  select
    'Profiles without signature'::text as section,
    'count'::text as item,
    (case when count(*) = 0 then 'OK' else 'REVIEW' end)::text as status,
    (count(*)::text || ' user(s) have no signature_url (needed for workflow and voucher approvals)')::text as detail
  from profiles pr
  where pr.signature_url is null
     or trim(coalesce(pr.signature_url, '')) = ''
),
noowner as (
  select
    'Active requests with no current owner'::text as section,
    'count'::text as item,
    (case when count(*) = 0 then 'OK' else 'REVIEW' end)::text as status,
    (count(*)::text || ' active request(s) have no current_owner (possibly stuck in the workflow)')::text as detail
  from requests r
  where lower(coalesce(r.status, '')) not in ('completed', 'paid', 'rejected', 'cancelled', 'deleted')
    and r.current_owner is null
),
badpv as (
  select
    'Vouchers with zero or negative amount'::text as section,
    'count'::text as item,
    (case when count(*) = 0 then 'OK' else 'ATTENTION' end)::text as status,
    (count(*)::text || ' payment voucher(s) have an amount of zero or less')::text as detail
  from payment_vouchers v
  where coalesce(v.total_amount, v.amount, 0) <= 0
),
negsub as (
  select
    'Subheads over-committed'::text as section,
    'count'::text as item,
    (case when count(*) = 0 then 'OK' else 'ATTENTION' end)::text as status,
    (count(*)::text || ' subhead(s) where Approved Allocation - Reserved - Expenditure is below zero')::text as detail
  from subheads s
  where coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0) < 0
),
balmismatch as (
  select
    'Subhead stored balance vs formula'::text as section,
    'count'::text as item,
    (case when count(*) = 0 then 'OK' else 'ATTENTION' end)::text as status,
    (count(*)::text || ' subhead(s) where the stored balance differs from Approved Allocation - Reserved - Expenditure')::text as detail
  from subheads s
  where abs(
          coalesce(s.balance, 0)
          - (coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0))
        ) > 0.005
),
notif as (
  select
    'Notifications table'::text as section,
    'table'::text as item,
    'INFO'::text as status,
    (case
       when to_regclass('public.notifications') is null then 'notifications table was not found'
       else 'notifications table exists (about '
            || greatest(coalesce((select c.reltuples::bigint from pg_class c where c.oid = to_regclass('public.notifications')), 0), 0)::text
            || ' rows)'
     end)::text as detail
),
backup_note as (
  select
    'Backups'::text as section,
    'reminder'::text as item,
    'INFO'::text as status,
    'Confirm daily database backups are enabled in Supabase Dashboard -> Database -> Backups, and export before any big change.'::text as detail
)
select section, item, status, detail
from (
  select section, item, status, detail from rls
  union all select section, item, status, detail from pol
  union all select section, item, status, detail from openpol
  union all select section, item, status, detail from secdef
  union all select section, item, status, detail from priv
  union all select section, item, status, detail from sig
  union all select section, item, status, detail from noowner
  union all select section, item, status, detail from badpv
  union all select section, item, status, detail from negsub
  union all select section, item, status, detail from balmismatch
  union all select section, item, status, detail from notif
  union all select section, item, status, detail from backup_note
) all_checks
order by
  case status when 'ATTENTION' then 1 when 'REVIEW' then 2 when 'INFO' then 3 else 4 end,
  section,
  item;


-- =====================================================================
-- PART B  -  DETAILED QUERIES  (run ONE at a time: highlight, then Run)
-- =====================================================================

-- B1. Real columns of the main tables (shows your actual database layout)
select table_name, ordinal_position, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'requests', 'payment_vouchers', 'subheads', 'notifications')
order by table_name, ordinal_position;

-- B2. RLS status of every public table
select schemaname, tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;

-- B3. Every RLS policy in the public schema
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- B4. Tables with RLS switched OFF
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- B5. SECURITY DEFINER functions (run with elevated rights - audit carefully)
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_arguments(p.oid) as arguments,
       p.proconfig as fixed_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- B6. Admin / Auditor / Finance / HR / Director accounts (check for over-assignment)
select id, full_name, email, role, dept_id, created_at
from profiles
where lower(replace(replace(coalesce(role, ''), ' ', ''), '_', '')) in (
  'admin', 'auditor', 'account', 'accounts', 'accountofficer', 'hr', 'director', 'hod', 'dg'
)
order by role, full_name;

-- B7. Profiles without a signature
select id, full_name, email, role, signature_url
from profiles
where signature_url is null
   or trim(coalesce(signature_url, '')) = ''
order by role, full_name;

-- B8. Active requests with no current owner
--     (FIXED in 2.15: uses created_by; the old file used a column that does not exist)
select id, request_no, title, status, current_stage, current_owner, created_by, created_at
from requests
where lower(coalesce(status, '')) not in ('completed', 'paid', 'rejected', 'cancelled', 'deleted')
  and current_owner is null
order by created_at desc;

-- B9. Payment vouchers with a zero or negative amount
select id, voucher_no, request_id, payee_name, amount, total_amount, status, created_at
from payment_vouchers
where coalesce(total_amount, amount, 0) <= 0
order by created_at desc;

-- B10. Subheads over-committed, using the canonical formula
--      Balance = Approved Allocation - Reserved - Expenditure
select id, code, name, approved_allocation, reserved_amount, expenditure, balance,
       (coalesce(approved_allocation, 0) - coalesce(reserved_amount, 0) - coalesce(expenditure, 0)) as formula_balance,
       is_active
from subheads
where coalesce(approved_allocation, 0) - coalesce(reserved_amount, 0) - coalesce(expenditure, 0) < 0
order by formula_balance asc;

-- B11. Notifications table layout (FIXED in 2.15: the old query assumed an
--      is_read column that your app never uses; this shows the real columns)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'notifications'
order by ordinal_position;

-- B12. Backup reminder (this is NOT a backup command)
--   Recommended: daily database backup, weekly storage backup, and a manual
--   export before any major change. Use the Supabase Dashboard or CLI.
select now() as audit_run_at,
       current_database() as database_name,
       current_user as run_by;
