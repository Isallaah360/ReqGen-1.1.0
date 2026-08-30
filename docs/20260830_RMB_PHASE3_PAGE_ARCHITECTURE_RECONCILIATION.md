# RMB Phase 3 — Page Architecture Reconciliation

**Blueprint state:** RMB MODE — Blueprint Locked.

This phase reconciles every real Next.js page route against the Master Route Registry and assigns one canonical page class, canonical template and design disposition. It does not redesign already-approved mockups.

## Executive result

- Total registered routes: **135**
- Mockup Locked: **87**
- Unique Mockup Required: **17**
- Canonical Template Required: **28**
- Consolidate / Redirect: **2**
- Retire / Redirect: **1**

### Architectural conclusions

1. **87 routes are already mockup-locked** by the adopted Sections 1–4 and Sections 5–12 design evidence. These are preserved; only global RMB shell reconciliation is allowed.
2. **17 routes require dedicated mockup review before coding**: the complete Command Centre family plus six complex Finance governance/output/settings pages.
3. **28 routes do not need an independent dashboard mockup.** They must inherit canonical Form, Detail, Register, Profile/Auth, Print, Report or Utility templates.
4. **2 Finance legacy duplicates should be consolidated rather than redesigned:** `/finance/accounts` → `/finance/manage-accounts`, and `/finance/assign-account` → `/finance/manage-accounts/assign`.
5. **`/test-supabase` is retired as a production page** and remains only as a redirect to `/admin/system-health`.

## Canonical RMB page classes

- **Root Page / Dashboard** → `DashboardShell`
- **Operational Workspace** → `WorkspaceShell`
- **Register / Ledger** → `RegisterShell`
- **Form** → `FormShell`
- **Sub-form / Transaction Form** → `TransactionFormShell`
- **Detail Page** → `DetailShell`
- **ITTT / Workflow Control** → `ITTTWorkflowShell`
- **Settings / Configuration** → `SettingsShell`
- **Audit / Governance** → `AuditShell`
- **Report / Analytics** → `ReportShell`
- **Print View** → `PrintShell`
- **Utility / Information** → `UtilityShell`
- **Redirect / Alias** → `RedirectOnly`

## Unique mockups still required

- `/executive`
- `/executive/analytics`
- `/executive/audit`
- `/executive/calendar`
- `/executive/finance`
- `/executive/hr`
- `/executive/meetings`
- `/executive/notifications`
- `/executive/registry`
- `/executive/reports`
- `/executive/requests`
- `/finance/activity-history`
- `/finance/audit`
- `/finance/audit-trail`
- `/finance/export-centre`
- `/finance/print-centre`
- `/finance/settings`

## Consolidation / retirement decisions

- `/finance/accounts` → consolidate into `/finance/manage-accounts`; keep old URL only as compatibility redirect.
- `/finance/assign-account` → consolidate into `/finance/manage-accounts/assign`; keep old URL only as compatibility redirect.
- `/test-supabase` → retire from navigation/search and redirect to `/admin/system-health`.

## Route-by-route register

| Route | Root | Page Class | Design Status | Template |
|---|---|---|---|---|
| `/about` | `/help` | Utility / Information | CANONICAL TEMPLATE REQUIRED | `UtilityShell` |
| `/admin/access-audit` | `/admin` | Audit / Governance | MOCKUP LOCKED | `AuditShell` |
| `/admin/account-routing` | `/admin` | Settings / Configuration | MOCKUP LOCKED | `SettingsShell` |
| `/admin/audit` | `/admin` | Audit / Governance | MOCKUP LOCKED | `AuditShell` |
| `/admin/departments` | `/admin` | Settings / Configuration | MOCKUP LOCKED | `SettingsShell` |
| `/admin` | `/admin` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/admin/release-readiness` | `/admin` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/admin/roles` | `/admin` | Operational Workspace | MOCKUP LOCKED | `WorkspaceShell` |
| `/admin/security` | `/admin` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/admin/settings` | `/admin` | Settings / Configuration | MOCKUP LOCKED | `SettingsShell` |
| `/admin/system-health` | `/admin` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/admin/users` | `/admin` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/admin/workflow-test` | `/admin` | ITTT / Workflow Control | MOCKUP LOCKED | `ITTTWorkflowShell` |
| `/approvals/action-centre` | `/approvals` | ITTT / Workflow Control | MOCKUP LOCKED | `ITTTWorkflowShell` |
| `/approvals` | `/approvals` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/audit-centre` | `/audit-centre` | Audit / Governance | MOCKUP LOCKED | `AuditShell` |
| `/change-password` | `/profile` | Form | CANONICAL TEMPLATE REQUIRED | `FormShell` |
| `/dashboard/activity` | `/dashboard` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/dashboard` | `/dashboard` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/docs` | `/help` | Utility / Information | CANONICAL TEMPLATE REQUIRED | `UtilityShell` |
| `/executive/analytics` | `/executive` | Report / Analytics | UNIQUE MOCKUP REQUIRED | `ReportShell` |
| `/executive/audit` | `/executive` | Audit / Governance | UNIQUE MOCKUP REQUIRED | `AuditShell` |
| `/executive/calendar` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive/finance` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive/hr` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive/meetings` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive/notifications` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive/registry` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/executive/reports` | `/executive` | Report / Analytics | UNIQUE MOCKUP REQUIRED | `ReportShell` |
| `/executive/requests` | `/executive` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/finance/account-ledger` | `/finance` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/finance/account-transfers` | `/finance` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/finance/accounts` | `/finance` | Root Page / Dashboard | CONSOLIDATE / REDIRECT | `DashboardShell` |
| `/finance/activity-history` | `/finance` | Register / Ledger | UNIQUE MOCKUP REQUIRED | `RegisterShell` |
| `/finance/assign-account` | `/finance` | Sub-form / Transaction Form | CONSOLIDATE / REDIRECT | `TransactionFormShell` |
| `/finance/audit` | `/finance` | Audit / Governance | UNIQUE MOCKUP REQUIRED | `AuditShell` |
| `/finance/audit-trail` | `/finance` | Audit / Governance | UNIQUE MOCKUP REQUIRED | `AuditShell` |
| `/finance/departments` | `/finance` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/finance/export-centre` | `/finance` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/finance/manage-accounts/assign` | `/finance` | Sub-form / Transaction Form | MOCKUP LOCKED | `TransactionFormShell` |
| `/finance/manage-accounts` | `/finance` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/finance/manual-voucher` | `/finance` | Sub-form / Transaction Form | MOCKUP LOCKED | `TransactionFormShell` |
| `/finance` | `/finance` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/finance/print-centre` | `/finance` | Root Page / Dashboard | UNIQUE MOCKUP REQUIRED | `DashboardShell` |
| `/finance/reports/annual` | `/finance` | Report / Analytics | CANONICAL TEMPLATE REQUIRED | `ReportShell` |
| `/finance/reports/monthly` | `/finance` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/finance/reports` | `/finance` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/finance/reports/print` | `/finance` | Print View | CANONICAL TEMPLATE REQUIRED | `PrintShell` |
| `/finance/request/[id]` | `/finance` | Detail Page | CANONICAL TEMPLATE REQUIRED | `DetailShell` |
| `/finance/settings` | `/finance` | Settings / Configuration | UNIQUE MOCKUP REQUIRED | `SettingsShell` |
| `/finance/subhead-ledger` | `/finance` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/finance/subheads` | `/finance` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/finance/transactions` | `/finance` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/finance/vouchers` | `/finance` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/forgot-password` | `PUBLIC` | Form | CANONICAL TEMPLATE REQUIRED | `FormShell` |
| `/hr/analytics` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/archive` | `/hr` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/hr/assessments/annual-360` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/assignments` | `/hr` | Sub-form / Transaction Form | MOCKUP LOCKED | `TransactionFormShell` |
| `/hr/audit` | `/hr` | Audit / Governance | MOCKUP LOCKED | `AuditShell` |
| `/hr/capacity-building/departments` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/capacity-building/staff` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/compliance` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/department-kpi` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/filing` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/leave` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/my-work` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/officer-performance` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/output` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/registrar/analytics` | `/hr` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/hr/registrar/assessments/annual-360` | `/hr` | Operational Workspace | MOCKUP LOCKED | `WorkspaceShell` |
| `/hr/registrar/capacity-building/departments` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/registrar/capacity-building/staff` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/registrar/compliance` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/registrar/department-kpi` | `/hr` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/hr/registrar/officer-performance` | `/hr` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/hr/registrar/output` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/registrar` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/registrar/reports` | `/hr` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/hr/registrar/settings` | `/hr` | Settings / Configuration | MOCKUP LOCKED | `SettingsShell` |
| `/hr/registrar/weekly-seminar` | `/hr` | Operational Workspace | MOCKUP LOCKED | `WorkspaceShell` |
| `/hr/reports` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/review` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/settings` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/hr/staff` | `/hr` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/hr/weekly-seminar` | `/hr` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/login` | `PUBLIC` | Form | CANONICAL TEMPLATE REQUIRED | `FormShell` |
| `/mfa` | `PUBLIC` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/mfa/setup` | `PUBLIC` | Form | CANONICAL TEMPLATE REQUIRED | `FormShell` |
| `/output` | `/reports` | Utility / Information | CANONICAL TEMPLATE REQUIRED | `UtilityShell` |
| `/` | `PUBLIC` | Utility / Information | CANONICAL TEMPLATE REQUIRED | `UtilityShell` |
| `/payment-vouchers/[id]` | `/payment-vouchers` | Detail Page | MOCKUP LOCKED | `DetailShell` |
| `/payment-vouchers/[id]/print` | `/payment-vouchers` | Print View | MOCKUP LOCKED | `PrintShell` |
| `/payment-vouchers/approved` | `/payment-vouchers` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/payment-vouchers/history` | `/payment-vouchers` | Register / Ledger | CANONICAL TEMPLATE REQUIRED | `RegisterShell` |
| `/payment-vouchers/new` | `/payment-vouchers` | Sub-form / Transaction Form | CANONICAL TEMPLATE REQUIRED | `TransactionFormShell` |
| `/payment-vouchers` | `/payment-vouchers` | Operational Workspace | MOCKUP LOCKED | `WorkspaceShell` |
| `/payment-vouchers/pending` | `/payment-vouchers` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/payment-vouchers/print-centre` | `/payment-vouchers` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/payment-vouchers/reports` | `/payment-vouchers` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/payment-vouchers/settings` | `/payment-vouchers` | Settings / Configuration | MOCKUP LOCKED | `SettingsShell` |
| `/profile/access` | `/profile` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/profile/activity` | `/profile` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/profile` | `/profile` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/profile/security` | `/profile` | Root Page / Dashboard | CANONICAL TEMPLATE REQUIRED | `DashboardShell` |
| `/registry/archive` | `/registry` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/registry/dispatch` | `/registry` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/registry/incoming` | `/registry` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/registry/operations` | `/registry` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/registry/outgoing` | `/registry` | Register / Ledger | MOCKUP LOCKED | `RegisterShell` |
| `/registry` | `/registry` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/reports/enterprise-analytics` | `/reports` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/reports` | `/reports` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/requests/[id]/edit` | `/requests` | Sub-form / Transaction Form | CANONICAL TEMPLATE REQUIRED | `TransactionFormShell` |
| `/requests/[id]` | `/requests` | Detail Page | CANONICAL TEMPLATE REQUIRED | `DetailShell` |
| `/requests/[id]/print` | `/requests` | Print View | CANONICAL TEMPLATE REQUIRED | `PrintShell` |
| `/requests/new` | `/requests` | Sub-form / Transaction Form | MOCKUP LOCKED | `TransactionFormShell` |
| `/requests` | `/requests` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/reset-password` | `PUBLIC` | Form | CANONICAL TEMPLATE REQUIRED | `FormShell` |
| `/signup` | `PUBLIC` | Form | CANONICAL TEMPLATE REQUIRED | `FormShell` |
| `/staff/attendance` | `/staff` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/staff/downloads` | `/staff` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/staff/leave/new` | `/staff` | Sub-form / Transaction Form | MOCKUP LOCKED | `TransactionFormShell` |
| `/staff/leave` | `/staff` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/staff/notifications` | `/staff` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/staff` | `/staff` | Operational Workspace | MOCKUP LOCKED | `WorkspaceShell` |
| `/staff/performance` | `/staff` | Report / Analytics | MOCKUP LOCKED | `ReportShell` |
| `/staff/profile` | `/staff` | Redirect / Alias | MOCKUP LOCKED | `RedirectOnly` |
| `/staff/requests` | `/staff` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/staff/training` | `/staff` | Root Page / Dashboard | MOCKUP LOCKED | `DashboardShell` |
| `/test-supabase` | `/admin` | Utility / Information | RETIRE / REDIRECT | `UtilityShell` |
| `/unauthorized` | `PUBLIC` | Utility / Information | CANONICAL TEMPLATE REQUIRED | `UtilityShell` |
| `/workflow` | `/workflow` | ITTT / Workflow Control | MOCKUP LOCKED | `ITTTWorkflowShell` |

## Enforcement

- `lib/pageArchitecture.ts` codifies the RMB page-class/template/design rules.
- `npm run audit:rmb-architecture` verifies 135 registry routes, no duplicate route definitions, no legacy `IFTTT` taxonomy, and presence of the architecture contract.
- Any future route must be added to the Master Route Registry and must resolve to an RMB page class before production.