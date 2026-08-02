-- Read-only RPC/function audit
with expected(name) as (
  values ('approve_request_step'),
  ,('assign_request_subhead_and_reserve'),
  ,('counter_sign_payment_voucher_cheque'),
  ,('create_manual_payment_voucher'),
  ,('delete_payment_voucher_for_regeneration'),
  ,('delete_request_restore'),
  ,('generate_multi_payment_voucher'),
  ,('get_hr_filing_requests'),
  ,('get_my_active_role'),
  ,('get_my_pending_approval_count'),
  ,('get_payment_voucher_detail'),
  ,('get_payment_voucher_history'),
  ,('get_payment_voucher_items'),
  ,('get_payment_vouchers'),
  ,('get_print_request_detail'),
  ,('get_requests_ready_for_payment_voucher'),
  ,('hr_archive_staff_file'),
  ,('hr_move_staff_file'),
  ,('hr_record_seminar_attendance'),
  ,('hr_set_seminar_session_status'),
  ,('post_account_transfer'),
  ,('reject_request_step'),
  ,('reqgen_assign_profile_role'),
  ,('reqgen_deactivate_profile_role'),
  ,('reqgen_recalculate_all_iet_accounts'),
  ,('reqgen_set_iet_account_fund'),
  ,('reqgen_set_primary_profile_role'),
  ,('set_my_active_role'),
  ,('sign_payment_voucher_cheque'),
  ,('submit_request_with_reservation'),
  ,('update_payment_voucher_status'),
  ,('update_request_adjust_reservation')
), live as (
 select p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments, pg_get_function_result(p.oid) as result_type, p.prosecdef as security_definer
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
)
select e.name, case when l.name is null then 'MISSING' else 'AVAILABLE' end as status, l.arguments, l.result_type, l.security_definer
from expected e left join live l on l.name=e.name order by status desc,e.name,l.arguments;
