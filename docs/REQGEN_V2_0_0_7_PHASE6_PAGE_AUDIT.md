# ReqGen v2.0.0.7 - Phase 6 Page-by-Page Visual Audit

Physical pages audited: **98**  
Visual containment PASS: **98**  
Pages requiring review: **0**

The audit is paired with the Phase 6 global design contract in `app/globals.css`: frame containment, minimum readable typography, standard controls, visible focus states, responsive grids, viewport-safe dialogs, table wrapping/containment, canonical tabs and interactive chart affordances.

| Route | Type | Tables | Forms | Selects | Dialog/Modal refs | Chart refs | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| `/` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/about` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/admin` | SCREEN | 1 | 0 | 0 | 0 | 2 | **PASS** |
| `/admin/access-audit` | SCREEN | 1 | 0 | 1 | 0 | 0 | **PASS** |
| `/admin/account-routing` | SCREEN | 1 | 0 | 2 | 4 | 0 | **PASS** |
| `/admin/audit` | SCREEN | 1 | 0 | 1 | 0 | 0 | **PASS** |
| `/admin/departments` | SCREEN | 1 | 0 | 5 | 8 | 4 | **PASS** |
| `/admin/release-readiness` | SCREEN | 0 | 0 | 1 | 0 | 0 | **PASS** |
| `/admin/roles` | SCREEN | 1 | 0 | 0 | 0 | 0 | **PASS** |
| `/admin/security` | SCREEN | 0 | 0 | 3 | 0 | 0 | **PASS** |
| `/admin/settings` | SCREEN | 0 | 0 | 2 | 0 | 0 | **PASS** |
| `/admin/system-health` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/admin/users` | SCREEN | 1 | 0 | 7 | 9 | 0 | **PASS** |
| `/admin/workflow-test` | SCREEN | 0 | 0 | 2 | 0 | 0 | **PASS** |
| `/approvals` | SCREEN | 1 | 0 | 0 | 0 | 0 | **PASS** |
| `/approvals/action-centre` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/audit-centre` | SCREEN | 3 | 0 | 4 | 4 | 2 | **PASS** |
| `/change-password` | SCREEN | 0 | 1 | 0 | 0 | 0 | **PASS** |
| `/dashboard` | SCREEN | 0 | 0 | 0 | 0 | 10 | **PASS** |
| `/dashboard/activity` | SCREEN | 0 | 0 | 1 | 0 | 0 | **PASS** |
| `/docs` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/analytics` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/audit` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/calendar` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/finance` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/hr` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/meetings` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/notifications` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/registry` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/reports` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/executive/requests` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance` | SCREEN | 1 | 0 | 4 | 0 | 4 | **PASS** |
| `/finance/account-ledger` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/account-transfers` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/accounts` | SCREEN | 0 | 0 | 2 | 0 | 0 | **PASS** |
| `/finance/activity-history` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/assign-account` | SCREEN | 0 | 0 | 2 | 0 | 0 | **PASS** |
| `/finance/audit` | SCREEN | 4 | 0 | 4 | 0 | 0 | **PASS** |
| `/finance/audit-trail` | SCREEN | 1 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/departments` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/export-centre` | SCREEN | 0 | 0 | 2 | 0 | 0 | **PASS** |
| `/finance/manage-accounts` | SCREEN | 1 | 0 | 2 | 30 | 0 | **PASS** |
| `/finance/manage-accounts/assign` | SCREEN | 1 | 0 | 6 | 12 | 4 | **PASS** |
| `/finance/manual-voucher` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/print-centre` | PRINT | 0 | 0 | 1 | 0 | 0 | **PASS** |
| `/finance/processing` | SCREEN | 1 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/reports` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/reports/annual` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/reports/monthly` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/reports/print` | PRINT | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/request/[id]` | SCREEN | 0 | 0 | 1 | 0 | 0 | **PASS** |
| `/finance/settings` | SCREEN | 0 | 0 | 1 | 0 | 0 | **PASS** |
| `/finance/subhead-ledger` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/subheads` | SCREEN | 1 | 0 | 7 | 8 | 4 | **PASS** |
| `/finance/transactions` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/finance/vouchers` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/forgot-password` | SCREEN | 0 | 1 | 0 | 0 | 0 | **PASS** |
| `/hr` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/login` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/mfa` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/mfa/setup` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/output` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers` | SCREEN | 1 | 0 | 10 | 15 | 1 | **PASS** |
| `/payment-vouchers/[id]` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/[id]/print` | PRINT | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/approved` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/history` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/manual` | SCREEN | 1 | 1 | 4 | 0 | 0 | **PASS** |
| `/payment-vouchers/new` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/pending` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/print-centre` | PRINT | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/reports` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/payment-vouchers/settings` | SCREEN | 1 | 0 | 5 | 0 | 0 | **PASS** |
| `/profile` | SCREEN | 0 | 0 | 1 | 0 | 0 | **PASS** |
| `/profile/access` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/profile/activity` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/profile/security` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/profile/security/replace-authenticator` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/registry` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/registry/archive` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/registry/dispatch` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/registry/incoming` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/registry/operations` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/registry/outgoing` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/reports` | SCREEN | 2 | 0 | 3 | 0 | 4 | **PASS** |
| `/reports/enterprise-analytics` | SCREEN | 1 | 0 | 2 | 0 | 0 | **PASS** |
| `/requests` | SCREEN | 1 | 0 | 3 | 0 | 1 | **PASS** |
| `/requests/[id]` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/requests/[id]/edit` | SCREEN | 0 | 0 | 1 | 7 | 0 | **PASS** |
| `/requests/[id]/print` | PRINT | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/requests/new` | SCREEN | 0 | 0 | 6 | 10 | 0 | **PASS** |
| `/reset-password` | SCREEN | 0 | 1 | 0 | 0 | 0 | **PASS** |
| `/signup` | SCREEN | 0 | 1 | 2 | 0 | 0 | **PASS** |
| `/staff` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/test-supabase` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |
| `/unauthorized` | SCREEN | 0 | 0 | 0 | 0 | 1 | **PASS** |
| `/workflow` | SCREEN | 0 | 0 | 0 | 0 | 0 | **PASS** |

## Phase 6 acceptance controls

- All authenticated content stays inside the ReqGen main frame with a controlled inset.
- No production screen route uses an oversized fixed-width utility that can force horizontal page overflow.
- Shared tables are width-contained and cells wrap instead of expanding the application frame.
- Profile / Security tabs use explicit high-contrast active and inactive states.
- Buttons, links, fields and selects have consistent focus/hover/active visibility.
- Screen CSS modules use an 11px minimum for microcopy; core controls/tables use 12-13px minimums.
- Charts touched in Phase 6 expose hover/focus values using `title`, ARIA labelling or existing interactive controls.
- Print-only layouts retain their print geometry and are excluded from screen-only fixed-width rules.