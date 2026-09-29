-- ReqGen 2.15 - Application contract check (database functions / RPC)
-- Read-only. Run in Supabase SQL Editor.
--
-- Lists every database function the ReqGen APP calls (generated from the
-- current source code) and whether it exists in your live database.
--   AVAILABLE = function found
--   MISSING   = the app calls it but the database does not have it
--               (the used_by column shows which page would break)
-- Also shows each function's arguments, return type, and whether it is
-- SECURITY DEFINER (runs with elevated rights).

with expected(name, used_by) as (
  values
    ('approve_request_step', 'components/requests/RequestDetailsWorkspace.tsx'),
    ('assign_request_subhead_and_reserve', 'components/requests/RequestDetailsWorkspace.tsx'),
    ('counter_sign_payment_voucher_cheque', 'payment-vouchers/[id]'),
    ('create_manual_payment_voucher', 'payment-vouchers'),
    ('delete_payment_voucher_for_regeneration', 'payment-vouchers, payment-vouchers/[id]'),
    ('delete_request_restore', 'components/requests/RequestDetailsWorkspace.tsx'),
    ('generate_multi_payment_voucher', 'payment-vouchers'),
    ('get_hr_personal_fund_subhead_summary', 'components/requests/RequestDetailsWorkspace.tsx'),
    ('get_my_active_role', 'admin/audit, approvals +6 more'),
    ('get_payment_voucher_detail', 'payment-vouchers/[id], payment-vouchers/[id]/print'),
    ('get_payment_voucher_history', 'payment-vouchers/[id]'),
    ('get_payment_voucher_items', 'payment-vouchers/[id], payment-vouchers/[id]/print'),
    ('get_payment_vouchers', 'finance/audit, payment-vouchers'),
    ('get_print_request_detail', 'requests/[id]/print'),
    ('get_requests_ready_for_payment_voucher', 'payment-vouchers'),
    ('post_account_transfer', 'finance/_components/FinanceOperationsWorkspace.tsx'),
    ('post_finance_payment', 'finance/request/[id]'),
    ('post_manual_payment_voucher', 'payment-vouchers/manual'),
    ('reject_request_step', 'components/requests/RequestDetailsWorkspace.tsx'),
    ('reqgen_assign_profile_role', 'admin/users, api/admin/users/route.ts'),
    ('reqgen_assign_subhead_bank_allocation', 'finance/subheads'),
    ('reqgen_deactivate_profile_role', 'admin/users'),
    ('reqgen_recalculate_all_iet_accounts', 'finance, finance/audit +2 more'),
    ('reqgen_set_iet_account_fund', 'finance/manage-accounts'),
    ('reqgen_set_primary_profile_role', 'admin/users'),
    ('save_manual_payment_voucher', 'payment-vouchers/manual'),
    ('set_my_active_role', 'lib/activeRole.ts'),
    ('sign_payment_voucher_cheque', 'payment-vouchers/[id]'),
    ('submit_request_with_reservation', 'requests/new'),
    ('update_payment_voucher_status', 'payment-vouchers/[id]'),
    ('update_request_adjust_reservation', 'requests/[id]/edit')
), live as (
  select p.proname::text as name,
         pg_get_function_identity_arguments(p.oid) as arguments,
         pg_get_function_result(p.oid) as result_type,
         p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select e.name,
       case when l.name is null then 'MISSING' else 'AVAILABLE' end as status,
       e.used_by, l.arguments, l.result_type, l.security_definer
from expected e
left join live l on l.name = e.name
order by status desc, e.name, l.arguments;
