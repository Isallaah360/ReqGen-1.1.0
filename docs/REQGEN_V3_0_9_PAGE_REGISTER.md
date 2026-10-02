# ReqGen Page Register (v3.0.9)

Generated from the code: every `page.tsx`, its access (live rules), data sources and layout type.

| Route | Type | Title | Lines | Who can open | Reads (tables / functions) |
|---|---|---|---:|---|---|
| `/about` | A · Sign-in & public | About ReqGen | 29 | Everyone signed in | — |
| `/admin/access-audit` | Internal tool | Route Access Audit Matrix | 204 | admin | — |
| `/admin/account-routing` | C · Register & list | Account Routing Management | 133 | admin | profiles, departments, iet_accounts, department_account_routing |
| `/admin/audit` | C · Register & list | Administrative Audit Trail | 139 | admin | profiles, rpc:get_my_active_role |
| `/admin/department-routing` | G · Configuration | Routing Engine | 446 | admin | profiles, departments, app_settings, reqgen_department_routes, reqgen_stage_backups, reqgen_route_templates |
| `/admin/departments` | C · Register & list | Department Management | 1813 | admin | profiles, departments, subheads |
| `/admin` | B · Overview dashboard | Administration Overview | 327 | admin | profiles, departments, reqgen_roles, profile_roles, audit_logs |
| `/admin/release-readiness` | Internal tool | Mobile, Print & Performance Readiness | 137 | admin | — |
| `/admin/roles` | C · Register & list | Access denied | 867 | admin | profiles, reqgen_roles |
| `/admin/security` | B · Overview dashboard | Security Checklist Access | 784 | auditor, admin | profiles |
| `/admin/settings` | G · Configuration | System Settings | 229 | admin | profiles, profile_roles, app_settings |
| `/admin/system-health` | Internal tool | System Health Centre | 30 | admin | — |
| `/admin/users` | C · Register & list | User Management | 1207 | admin | profiles, profile_roles, departments, reqgen_roles, rpc:reqgen_assign_profile_role, rpc:reqgen_set_primary_profile_role, |
| `/admin/workflow-test` | Internal tool | End-to-End Workflow Test Centre | 342 | admin | — |
| `/approvals/action-centre` | Redirect |  | 6 | Everyone signed in | — |
| `/approvals` | B · Overview dashboard | Approvals | 250 | Everyone signed in | profiles, requests, rpc:get_my_active_role |
| `/audit-centre` | B · Overview dashboard | Audit Centre | 382 | auditor, admin | profiles, departments, subheads, iet_accounts, rpc:get_my_active_role |
| `/change-password` | D · Form |  | 432 | Everyone signed in | — |
| `/dashboard/activity` | C · Register & list | Global Activity Timeline | 57 | Everyone signed in | — |
| `/dashboard` | B · Overview dashboard | Dashboard | 313 | Everyone signed in | requests |
| `/docs` | A · Sign-in & public | ReqGen Help Centre | 18 | Everyone signed in | — |
| `/finance/account-ledger` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/account-transfers` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/accounts` | C · Register & list | Accounts Setup | 182 | accountofficer, auditor, admin | profiles, iet_accounts, account_officer_accounts |
| `/finance/activity-history` | C · Register & list | Activity History | 65 | accountofficer, auditor, admin | — |
| `/finance/assign-account` | D · Form | Assign Account to Officer | 216 | accountofficer, auditor, admin | profiles, iet_accounts, iet_account_officers |
| `/finance/audit-trail` | C · Register & list | Audit Trail | 51 | accountofficer, auditor, admin | — |
| `/finance/audit` | C · Register & list | Audit & Reconciliation Access | 2353 | accountofficer, auditor, admin | profiles, iet_accounts, departments, subheads, requests, iet_bank_ledger, rpc:reqgen_recalculate_all_iet_accounts, rpc:g |
| `/finance/departments` | Redirect |  | 6 | accountofficer, auditor, admin | — |
| `/finance/export-centre` | C · Register & list | Export Centre | 52 | accountofficer, auditor, admin | — |
| `/finance/manage-accounts/assign` | C · Register & list | Assign Bank Account to Officer | 460 | accountofficer, auditor, admin | profiles, iet_accounts, iet_account_officer_assignments, departments |
| `/finance/manage-accounts` | C · Register & list | IET Bank Accounts | 439 | accountofficer, auditor, admin | profiles, iet_accounts, iet_account_officer_assignments, rpc:reqgen_recalculate_all_iet_accounts, rpc:reqgen_set_iet_acc |
| `/finance/manual-voucher` | Redirect |  | 10 | accountofficer, auditor, admin | — |
| `/finance` | B · Overview dashboard | Finance Overview | 407 | accountofficer, auditor, admin | departments, subheads, finance_transactions, payment_vouchers, iet_accounts, rpc:reqgen_recalculate_all_iet_accounts |
| `/finance/print-centre` | F · Print | Print Centre | 51 | accountofficer, auditor, admin | — |
| `/finance/processing` | C · Register & list | Finance Processing | 24 | accountofficer, auditor, admin | requests, payment_vouchers |
| `/finance/reports/annual` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/reports/monthly` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/reports` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/reports/print` | F · Print | IET Finance Report | 44 | accountofficer, auditor, admin | — |
| `/finance/request/[id]` | E · Detail & workflow | Unable to open finance request | 1176 | accountofficer, auditor, admin | requests, subheads, iet_accounts, payment_vouchers |
| `/finance/settings` | G · Configuration | Finance Settings | 121 | accountofficer, auditor, admin | finance_activity_history |
| `/finance/subhead-ledger` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/subheads` | C · Register & list | Budget & Subheads | 2433 | accountofficer, auditor, admin | profiles, departments, iet_accounts, subheads |
| `/finance/transactions` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/finance/vouchers` | Wrapper (shared workspace) |  | 3 | accountofficer, auditor, admin | — |
| `/forgot-password` | A · Sign-in & public | Forgot Password | 13 | Everyone signed in | — |
| `/login` | A · Sign-in & public | Welcome Back! | 31 | Everyone signed in | — |
| `/mfa` | A · Sign-in & public | Two-Factor Authentication | 9 | Everyone signed in | — |
| `/mfa/setup` | A · Sign-in & public | Set Up 2FA | 9 | Everyone signed in | — |
| `/notifications` | C · Register & list | Notifications | 95 | Everyone signed in | — |
| `/output` | Redirect |  | 6 | auditor, admin | — |
| `/` | A · Sign-in & public | ReqGen | 58 | Everyone signed in | — |
| `/payment-vouchers/[id]` | E · Detail & workflow | Payment Voucher | 1165 | accountofficer, pvsigner, auditor, admin | profiles, rpc:get_payment_voucher_detail, rpc:get_payment_voucher_items, rpc:get_payment_voucher_history, rpc:update_pay |
| `/payment-vouchers/[id]/print` | F · Print | Prepared By | 979 | accountofficer, pvsigner, auditor, admin | rpc:get_payment_voucher_detail, rpc:get_payment_voucher_items |
| `/payment-vouchers/approved` | Redirect |  | 6 | accountofficer, pvsigner, auditor, admin | — |
| `/payment-vouchers/history` | Redirect |  | 6 | accountofficer, pvsigner, auditor, admin | — |
| `/payment-vouchers/manual` | D · Form | Finance access required | 1655 | accountofficer, pvsigner, auditor, admin | profiles, profile_roles, departments, iet_accounts, subheads, payment_vouchers |
| `/payment-vouchers/new` | Redirect |  | 6 | accountofficer, pvsigner, auditor, admin | — |
| `/payment-vouchers` | B · Overview dashboard | Payment Voucher Access | 1689 | accountofficer, pvsigner, auditor, admin | profiles, profile_roles, payment_voucher_counter_signatories, departments, subheads, rpc:get_payment_vouchers, rpc:get_r |
| `/payment-vouchers/pending` | Redirect |  | 6 | accountofficer, pvsigner, auditor, admin | — |
| `/payment-vouchers/print-centre` | Redirect |  | 6 | accountofficer, pvsigner, auditor, admin | — |
| `/payment-vouchers/reports` | Redirect |  | 6 | accountofficer, pvsigner, auditor, admin | — |
| `/payment-vouchers/settings` | G · Configuration | Restricted Payment Voucher Settings | 565 | auditor, admin | profiles, payment_voucher_counter_signatories, payment_vouchers, rpc:get_my_active_role |
| `/profile/access` | C · Register & list |  | 55 | Everyone signed in | profiles, profile_roles, hr_officer_assignments |
| `/profile/activity` | C · Register & list |  | 49 | Everyone signed in | user_role_switch_history, hr_assignment_history |
| `/profile` | D · Form |  | 685 | Everyone signed in | profiles, departments, signatures |
| `/profile/security` | C · Register & list |  | 118 | Everyone signed in | — |
| `/profile/security/replace-authenticator` | D · Form | Change 2FA & Password | 396 | Everyone signed in | — |
| `/registry/archive` | Wrapper (shared workspace) |  | 4 | registrar, registry, auditor, admin | — |
| `/registry/dispatch` | Redirect |  | 3 | registrar, registry, auditor, admin | — |
| `/registry/incoming` | Redirect |  | 3 | registrar, registry, auditor, admin | — |
| `/registry/operations` | Redirect |  | 3 | registrar, registry, auditor, admin | — |
| `/registry/outgoing` | Redirect |  | 3 | registrar, registry, auditor, admin | — |
| `/registry` | Wrapper (shared workspace) |  | 4 | registrar, registry, auditor, admin | — |
| `/reports/enterprise-analytics` | B · Overview dashboard | Executive Analytics | 76 | auditor, admin | departments, subheads, finance_transactions, payment_vouchers, iet_accounts, registry_correspondence |
| `/reports` | B · Overview dashboard | Reports Centre | 152 | auditor, admin | departments, subheads, finance_transactions, payment_vouchers, registry_correspondence |
| `/requests/[id]/edit` | D · Form | Edit Request | 1113 | staff, hod, director, dg, registrar, hr, accountofficer, pvsigner, auditor, admin | profile_roles, profiles, requests, subheads, request_history, rpc:update_request_adjust_reservation |
| `/requests/[id]` | E · Detail & workflow |  | 15 | staff, hod, director, dg, registrar, hr, accountofficer, pvsigner, auditor, admin | — |
| `/requests/[id]/print` | F · Print | Request Print | 877 | staff, hod, director, dg, registrar, hr, accountofficer, pvsigner, auditor, admin | profiles, profile_roles, request_history, rpc:get_print_request_detail |
| `/requests/new` | D · Form | Create New Request | 1272 | Everyone signed in | profiles, profile_roles, departments, subheads, request_attachments, rpc:submit_request_with_reservation |
| `/requests` | B · Overview dashboard | Requests Overview | 118 | Everyone signed in | requests, departments |
| `/reset-password` | A · Sign-in & public | Reset Password | 466 | Everyone signed in | — |
| `/signup` | A · Sign-in & public | Create Account | 15 | Everyone signed in | departments, profiles |
| `/test-supabase` | Internal tool | Department Diagnostics | 35 | admin | departments |
| `/unauthorized` | A · Sign-in & public | Access Restricted | 110 | Everyone signed in | — |
| `/workflow` | Redirect |  | 13 | auditor, admin | — |

## Summary by type

- **A · Sign-in & public**: 10
- **B · Overview dashboard**: 10
- **C · Register & list**: 19
- **D · Form**: 7
- **E · Detail & workflow**: 3
- **F · Print**: 4
- **G · Configuration**: 4
- **Internal tool**: 5
- **Redirect**: 15
- **Wrapper (shared workspace)**: 10
