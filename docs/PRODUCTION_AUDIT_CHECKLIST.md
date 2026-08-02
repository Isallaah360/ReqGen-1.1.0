# ReqGen Production Audit Checklist

## Phase A — Security and Role Audit

For every assigned role, switch to that active role and verify:

- Navbar shows only authorized workspaces.
- Dashboard shortcuts match the active role.
- Allowed routes open successfully.
- Forbidden routes redirect to `/unauthorized`.
- Direct URL entry does not bypass the active role.
- Supabase RLS denies unauthorized reads and writes.
- Switching roles immediately refreshes route access.

Test roles:

- Admin
- Auditor
- DG
- Account
- Accounts
- AccountOfficer
- HR Boss
- Assigned HR Officer roles
- Registry
- Staff

Use `/admin/access-audit` as the visual reference matrix.

## Phase B — End-to-End Workflow Testing

Test at least one request in every supported request category:

1. Create and submit.
2. Verify the initial owner and status.
3. Approve, return, reject and resubmit where applicable.
4. Verify Action Centre counters and notifications.
5. Verify HR processing for HR-bound requests.
6. Verify DG decision.
7. Verify Finance processing only for finance-bound requests.
8. Verify voucher generation and payment.
9. Verify filing and archive state.
10. Confirm complete request history.

## Phase C — Database and Migration Reconciliation

Create a migration register containing:

- Migration file name
- Date executed
- Execution status
- Tables/functions/policies created
- Superseded migration
- Verification notes

Confirm:

- No failed migration remains unresolved.
- No duplicate function signature conflicts exist.
- RLS policies match the active-role model.
- Required indexes exist on frequently filtered columns.
- Optional audit tables are handled gracefully.

## Phase D — Mobile, Print and Performance Audit

Test widths:

- 360px
- 390px
- 768px
- 1024px
- Desktop

Verify:

- Navbar and Action Centre
- Tables and cards
- Dropdowns and modals
- Long text wrapping
- A4 printing and PDF output
- No navigation in printed documents
- Query pagination
- Realtime subscription count
- Bundle and image sizes

## Phase E — Pilot Testing and Production Release

Pilot roles:

- Admin
- DG
- Auditor
- HR Boss
- Registry
- Account Officer
- Ordinary requester

For each test case capture:

- Expected result
- Actual result
- Screenshot
- Severity
- Assigned owner
- Resolution status
- Retest result

Do not declare production readiness until all critical and high-severity findings are closed.
