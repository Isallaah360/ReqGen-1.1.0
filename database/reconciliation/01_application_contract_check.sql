-- ReqGen Phase C: compare live database objects with application references.
-- Read-only. Run in Supabase SQL Editor.

with expected(name, object_type) as (
  values ('account_officer_accounts','table_or_view'),
  ,('account_transfers','table_or_view'),
  ,('app_settings','table_or_view'),
  ,('department_account_routing','table_or_view'),
  ,('departments','table_or_view'),
  ,('finance_activity_history','table_or_view'),
  ,('finance_transactions','table_or_view'),
  ,('hr_assessment_assignments','table_or_view'),
  ,('hr_assessment_cycles','table_or_view'),
  ,('hr_assignment_history','table_or_view'),
  ,('hr_department_capacity_programmes','table_or_view'),
  ,('hr_department_kpis','table_or_view'),
  ,('hr_leave_records','table_or_view'),
  ,('hr_officer_assignments','table_or_view'),
  ,('hr_policy_settings','table_or_view'),
  ,('hr_request_assignments','table_or_view'),
  ,('hr_request_reviews','table_or_view'),
  ,('hr_seminar_attendance','table_or_view'),
  ,('hr_seminar_sessions','table_or_view'),
  ,('hr_seminar_settings','table_or_view'),
  ,('hr_staff_file_movements','table_or_view'),
  ,('hr_staff_files','table_or_view'),
  ,('hr_staff_training_programmes','table_or_view'),
  ,('iet_account_officer_assignments','table_or_view'),
  ,('iet_account_officers','table_or_view'),
  ,('iet_account_transactions','table_or_view'),
  ,('iet_accounts','table_or_view'),
  ,('iet_bank_ledger','table_or_view'),
  ,('notifications','table_or_view'),
  ,('payment_voucher_counter_signatories','table_or_view'),
  ,('payment_vouchers','table_or_view'),
  ,('profile_roles','table_or_view'),
  ,('profiles','table_or_view'),
  ,('registry_correspondence','table_or_view'),
  ,('reqgen_roles','table_or_view'),
  ,('request-attachments','table_or_view'),
  ,('request_attachment_checks','table_or_view'),
  ,('request_attachments','table_or_view'),
  ,('request_history','table_or_view'),
  ,('requests','table_or_view'),
  ,('signatures','table_or_view'),
  ,('sms_logs','table_or_view'),
  ,('sms_otps','table_or_view'),
  ,('subheads','table_or_view'),
  ,('user_active_roles','table_or_view'),
  ,('user_role_switch_history','table_or_view'),
  ,('workflow_rules','table_or_view'),
  ,('workflow_sla_events','table_or_view')
), live as (
  select table_name as name, 'table_or_view'::text as object_type
  from information_schema.tables where table_schema='public'
  union all
  select table_name, 'table_or_view' from information_schema.views where table_schema='public'
)
select e.object_type, e.name, case when l.name is null then 'MISSING' else 'AVAILABLE' end as status
from expected e left join live l on l.name=e.name and l.object_type=e.object_type
order by status desc, e.name;
