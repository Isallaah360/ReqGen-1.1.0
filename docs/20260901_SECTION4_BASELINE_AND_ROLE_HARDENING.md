# ReqGen Section 4 Baseline and Role Hardening — 2026-09-01

## Locked sections
- Section 1 — Dashboard
- Section 2 — Requests
- Section 3 — Approvals

## Request edit signature hardening
Editing now requires the editor to explicitly sign the changed request using the signature already stored on the authenticated profile before Save Changes is enabled. A signed audit entry is written to `request_history` and the existing `update_request_adjust_reservation` RPC remains responsible for the actual update/reservation adjustment. Existing AAL2 sessions are reused; a new TOTP challenge is requested only when required by the current assurance level.

## Canonical operational role catalogue
The target role catalogue is:
1. Staff
2. Director
3. DG
4. Account Officer
5. Auditor
6. Admin
7. HR
8. Registrar
9. General Secretary
10. Dean Admin

Multiple HR officers should share the `hr` role unless their workflow authority differs. Existing legacy aliases remain understood for compatibility (`hrofficer1/2/3`, `dinadmin*`, etc.). `deanadmin` maps to the existing `DINADMIN` workflow stage in the UI until the backend workflow is formally renamed/migrated.

`database/20260901_reqgen_role_catalog_v2.sql` seeds/updates the canonical role catalogue.

## Access hardening
- Staff, Director, DG, HR, Registrar, General Secretary and Dean Admin: Dashboard + Requests + Approvals + Profile.
- Account/Accounts/Account Officer: core pages + Finance + Payment Vouchers.
- Auditor: core pages + Finance + Payment Vouchers + Reports + Audit Centre + Workflow; no full Admin access.
- Admin: full authorised system access.
- Payment Voucher signers/counter-signers retain Payment Voucher access only where required; Finance is not automatically granted by signer status.
- Reports and Workflow are Admin/Auditor only.
- Legacy HR/Staff/Test routes are quarantined to Admin at route-policy level pending physical source deletion.
- Command Centre remains removed from normal navigation; executive routes are Admin-only pending physical deletion.

## Section 4 target architecture
Finance will be reduced from 24 route surfaces to eight user-facing workspaces after every old function is mapped and migrated:
1. Finance Overview
2. IET Accounts
3. Budget & Subheads
4. Transactions & Ledgers
5. Transfers
6. Finance Processing
7. Reports & Output
8. Finance Settings

No legacy Finance route is deleted before its functionality is present in the new destination workspace.

## Data rule
Every KPI, chart, balance, department summary and subhead figure must be calculated from the same live Supabase records used by the associated tables/registers. Production mock values are prohibited.

## Verification completed in this environment
- Shell lock: PASS
- Route audit: 136 routes, 0 duplicate routes, 0 unclassified sensitive routes
- Workflow readiness: PASS
- Internal navigation: 298 references, 0 broken targets
- Component contract audit: PASS
- TypeScript syntax transpilation: 240 app/lib TypeScript files, 0 syntax errors

A real ESLint and Next.js production build could not be executed in the isolated environment because dependency installation could not complete. The workstation deployment gate remains `npm run lint` and `npm run build`.
