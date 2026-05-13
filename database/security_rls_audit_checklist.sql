-- =========================================================
-- ReqGen 1.1.0 Security / RLS / Backup Audit Checklist
-- Purpose:
--   This file is for inspection and audit only.
--   It does not change production policies.
--   Run in Supabase SQL Editor to review security posture.
-- =========================================================

-- =========================================================
-- 1. Confirm RLS status for all public tables
-- =========================================================
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;

-- =========================================================
-- 2. List all RLS policies in public schema
-- =========================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- =========================================================
-- 3. Tables that should normally have RLS enabled
-- Review result manually.
-- =========================================================
select
  t.tablename,
  t.rowsecurity as rls_enabled,
  case
    when t.tablename in (
      'profiles',
      'departments',
      'requests',
      'request_history',
      'request_attachments',
      'notifications',
      'subheads',
      'payment_vouchers',
      'payment_voucher_history',
      'payment_voucher_items',
      'payment_voucher_counter_signatories',
      'finance_bank_accounts',
      'finance_account_assignments'
    )
    then 'HIGH_PRIORITY_REVIEW'
    else 'GENERAL_REVIEW'
  end as review_priority
from pg_tables t
where t.schemaname = 'public'
order by review_priority desc, t.tablename;

-- =========================================================
-- 4. Tables with RLS disabled
-- These should be reviewed carefully.
-- =========================================================
select
  schemaname,
  tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- =========================================================
-- 5. Public functions / RPC review list
-- Review SECURITY DEFINER functions carefully.
-- Every sensitive function should validate auth.uid(), role,
-- ownership, current_owner, or account permissions internally.
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- =========================================================
-- 6. SECURITY DEFINER functions only
-- These need special audit because they can run with elevated privileges.
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- =========================================================
-- 7. Check users with Admin/Auditor/Finance roles
-- Review whether roles are correct and not over-assigned.
-- =========================================================
select
  id,
  full_name,
  email,
  role,
  dept_id,
  created_at
from profiles
where lower(replace(replace(coalesce(role, ''), ' ', ''), '_', '')) in (
  'admin',
  'auditor',
  'account',
  'accounts',
  'accountofficer',
  'hr',
  'director',
  'hod',
  'dg'
)
order by role, full_name;

-- =========================================================
-- 8. Check profiles without signatures
-- Important because signatures are used in workflow/PV approvals.
-- =========================================================
select
  id,
  full_name,
  email,
  role,
  signature_url
from profiles
where signature_url is null
   or trim(coalesce(signature_url, '')) = ''
order by role, full_name;

-- =========================================================
-- 9. Check request ownership and current_owner gaps
-- Active requests should generally have an owner.
-- =========================================================
select
  id,
  request_no,
  title,
  status,
  current_stage,
  current_owner,
  requester_id,
  created_at
from requests
where lower(coalesce(status, '')) not in ('completed', 'paid', 'rejected', 'cancelled', 'deleted')
  and current_owner is null
order by created_at desc;

-- =========================================================
-- 10. Check payment vouchers with suspicious amount
-- =========================================================
select
  id,
  voucher_no,
  request_id,
  payee_name,
  amount,
  total_amount,
  status,
  created_at
from payment_vouchers
where coalesce(total_amount, amount, 0) <= 0
order by created_at desc;

-- =========================================================
-- 11. Check subheads with negative balance
-- =========================================================
select
  id,
  code,
  name,
  approved_allocation,
  reserved_amount,
  expenditure,
  balance,
  is_active
from subheads
where coalesce(balance, 0) < 0
order by balance asc;

-- =========================================================
-- 12. Check notifications unread volume
-- Useful for diagnosing workflow bottlenecks.
-- =========================================================
select
  user_id,
  count(*) filter (where is_read = false) as unread_count,
  count(*) as total_notifications
from notifications
group by user_id
order by unread_count desc;

-- =========================================================
-- 13. Backup reminder query
-- This is not a backup command.
-- Use Supabase Dashboard/CLI for backups.
-- Recommended:
--   - Daily database backup/export
--   - Weekly storage backup
--   - Manual backup before major SQL migrations
-- =========================================================
select
  now() as audit_run_at,
  'Run database backup before applying schema/RLS/function changes.' as reminder;