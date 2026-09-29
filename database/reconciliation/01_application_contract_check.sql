-- ReqGen 2.15 - Application contract check (tables and views)
-- Read-only. Run in Supabase SQL Editor.
--
-- Compares the tables/views the ReqGen APP actually references (generated from
-- the current source code) with what exists in your live database.
--   AVAILABLE = found in the database
--   MISSING   = the app refers to it but the database does not have it
--               (the used_by column shows which page needs it)
--
-- NOTE: the HR *pages* were removed from the app, but the role system still
-- reads hr_officer_assignments and hr_assignment_history (lib/activeRole.ts,
-- Profile, Audit Centre). Those HR tables must STAY in the database.

with expected(name, object_type, used_by) as (
  values
    ('account_officer_accounts', 'table_or_view', 'finance/accounts'),
    ('account_transfers', 'table_or_view', 'finance/_components/FinanceOperationsWorkspace.tsx'),
    ('app_settings', 'table_or_view', 'admin/settings'),
    ('audit_logs', 'table_or_view', 'admin, admin/audit +4 more'),
    ('department_account_routing', 'table_or_view', 'admin/account-routing, api/admin/users/[id]/route.ts'),
    ('departments', 'table_or_view', 'admin, admin/account-routing +21 more'),
    ('enterprise_audit_events', 'table_or_view', 'admin/workflow-test, audit-centre'),
    ('finance_activity_history', 'table_or_view', 'admin/audit, audit-centre +4 more'),
    ('finance_transactions', 'table_or_view', 'admin/system-health, admin/workflow-test +8 more'),
    ('hr_assignment_history', 'table_or_view', 'admin/audit, audit-centre +2 more'),
    ('hr_officer_assignments', 'table_or_view', 'admin/system-health, lib/activeRole.ts +1 more'),
    ('hr_request_assignments', 'table_or_view', 'admin/workflow-test'),
    ('hr_request_reviews', 'table_or_view', 'audit-centre'),
    ('hr_seminar_attendance_corrections', 'table_or_view', 'audit-centre'),
    ('iet_account_officer_assignments', 'table_or_view', 'api/admin/users/[id]/route.ts, finance/manage-accounts +1 more'),
    ('iet_account_officers', 'table_or_view', 'finance/assign-account'),
    ('iet_account_transactions', 'table_or_view', 'audit-centre, finance/_components/FinanceOperationsWorkspace.tsx'),
    ('iet_accounts', 'table_or_view', 'admin/account-routing, audit-centre +12 more'),
    ('iet_bank_ledger', 'table_or_view', 'finance/audit'),
    ('manual_payment_voucher_audit', 'table_or_view', 'admin/audit, audit-centre +1 more'),
    ('notifications', 'table_or_view', 'admin/system-health, admin/workflow-test +1 more'),
    ('payment_voucher_counter_signatories', 'table_or_view', 'payment-vouchers, payment-vouchers/settings'),
    ('payment_voucher_history', 'table_or_view', 'audit-centre'),
    ('payment_vouchers', 'table_or_view', 'admin/system-health, admin/workflow-test +10 more'),
    ('profile_roles', 'table_or_view', 'admin, admin/settings +14 more'),
    ('profiles', 'table_or_view', 'admin, admin/account-routing +35 more'),
    ('registry_correspondence', 'table_or_view', 'audit-centre, components/registry/RegistryArchiveWorkspace.tsx +3 more'),
    ('registry_file_movements', 'table_or_view', 'audit-centre'),
    ('reqgen_roles', 'table_or_view', 'admin, admin/roles +2 more'),
    ('request_attachment_checks', 'table_or_view', 'audit-centre, components/requests/RequestDetailsWorkspace.tsx'),
    ('request_attachments', 'table_or_view', 'components/requests/RequestDetailsWorkspace.tsx, requests/new'),
    ('request_history', 'table_or_view', 'admin/workflow-test, audit-centre +6 more'),
    ('requests', 'table_or_view', 'admin/departments, admin/system-health +20 more'),
    ('sms_logs', 'table_or_view', 'api/notifications/sms/request-approval/route.ts, api/notifications/sms/request-event/route.ts +1 more'),
    ('sms_otps', 'table_or_view', 'api/otp/request-submission/send/route.ts, api/otp/request-submission/verify/route.ts'),
    ('subheads', 'table_or_view', 'admin/departments, admin/workflow-test +13 more'),
    ('user_active_roles', 'table_or_view', 'api/admin/users/[id]/route.ts, lib/activeRole.ts'),
    ('user_role_switch_history', 'table_or_view', 'admin/audit, api/admin/users/[id]/route.ts +3 more')
), live as (
  select table_name::text as name, 'table_or_view'::text as object_type
  from information_schema.tables where table_schema = 'public'
  union all
  select table_name::text, 'table_or_view'::text
  from information_schema.views where table_schema = 'public'
)
select e.object_type, e.name,
       case when l.name is null then 'MISSING' else 'AVAILABLE' end as status,
       e.used_by
from expected e
left join live l on l.name = e.name and l.object_type = e.object_type
order by status desc, e.name;
