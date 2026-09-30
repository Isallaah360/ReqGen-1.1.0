-- ============================================================================
-- ReqGen v3.0.3 — Policy inventory (READ-ONLY · changes nothing)
--
-- Lists the exact current RLS policies on the tables v3.0.4 will tighten, plus
-- the helper functions available to policies. I need this to write the v3.0.4
-- fixes precisely against YOUR database instead of guessing:
--   * requests / request_history / request attachments — "only the requester,
--     the officer it is routed to, officers who acted on it, and oversight"
--   * payment_vouchers / account_transfers — currently any logged-in user can
--     UPDATE any row
--   * signatures storage bucket — currently public
-- HOW TO USE: SQL Editor → paste → Run → Export CSV → send me the file.
-- ============================================================================
select
  'policy'                                   as kind,
  p.tablename                                as object_name,
  p.policyname                               as name,
  p.cmd                                      as command,
  array_to_string(p.roles, ',')              as roles,
  coalesce(p.qual, '')                       as using_expression,
  coalesce(p.with_check, '')                 as with_check_expression
from pg_policies p
where (p.schemaname = 'public' and (
         p.tablename like 'request%'
      or p.tablename in ('payment_vouchers', 'payment_voucher_items', 'account_transfers', 'profiles', 'profile_roles', 'user_active_roles')
    ))
   or (p.schemaname = 'storage' and p.tablename = 'objects')

union all
select
  'function',
  n.nspname || '.' || p.proname,
  pg_get_function_identity_arguments(p.oid),
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
  pg_get_function_result(p.oid),
  '',
  ''
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname ilike '%role%' or p.proname ilike '%admin%' or p.proname ilike 'is\_%' or p.proname ilike 'has\_%' or p.proname ilike '%can\_%')

union all
select 'column', c.table_name, c.column_name, c.data_type, '', '', ''
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('requests', 'request_history', 'payment_vouchers', 'account_transfers')
order by 1, 2, 3;
