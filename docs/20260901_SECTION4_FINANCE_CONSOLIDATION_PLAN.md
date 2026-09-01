# Section 4 — Finance Consolidation Plan

Sections 1–3 are locked. Section 4 will consolidate 24 legacy/current Finance routes into 8 user-facing workspaces without deleting functionality before it is migrated.

## Target eight workspaces

1. **Finance Overview** (`/finance`)
   - Live finance KPIs, account balances, subhead health, current processing queue, recent transactions and quick actions.
   - Sources: `/finance`, selected overview portions of activity history and vouchers.

2. **IET Accounts** (`/finance/manage-accounts`)
   - Bank names/funds, officer assignment, account status and account ledger access.
   - Absorbs: `/finance/accounts` (legacy), `/finance/assign-account` (legacy), `/finance/manage-accounts/assign`, `/finance/account-ledger`.

3. **Budget & Subheads** (`/finance/subheads`)
   - Departments, subheads, allocations, reservations, expenditure, balances and subhead ledger.
   - Absorbs: `/finance/departments`, `/finance/subhead-ledger`.

4. **Transactions & Ledgers** (`/finance/transactions`)
   - Consolidated transaction register, account/subhead drill-down, vouchers and activity chronology.
   - Absorbs: `/finance/vouchers`, `/finance/activity-history`; links contextually to ledgers.

5. **Transfers** (`/finance/account-transfers`)
   - Controlled transfers between authorised IET accounts with audit trail and balances.

6. **Finance Processing** (new consolidated workspace; contextual detail remains `/finance/request/[id]`)
   - Requests routed to Accounts, processing controls, manual voucher creation and handoff to Payment Vouchers.
   - Absorbs: `/finance/manual-voucher` and the operational parts of `/finance/vouchers`.

7. **Reports & Output** (`/finance/reports`)
   - Monthly/annual reports, print centre, export centre and finance audit evidence.
   - Absorbs: `/finance/reports/monthly`, `/finance/reports/annual`, `/finance/reports/print`, `/finance/print-centre`, `/finance/export-centre`, `/finance/audit`, `/finance/audit-trail`.

8. **Finance Settings** (`/finance/settings`)
   - Fiscal year, numbering and finance configuration.

## Lock rules

- No legacy route is deleted until its functions are present in the destination workspace and the route can safely redirect.
- KPIs/charts must use live Supabase data from the same tables that power the registers; no mock production values.
- Finance + Payment Vouchers: Admin, Auditor, Account/Accounts/Account Officer. PV signer/counter-signer may access Payment Vouchers only where required.
- Reports + Workflow: Admin and Auditor only.
- DG, Director, Staff, HR, Registrar, General Secretary and Dean Admin remain on Dashboard + Requests + Approvals + Profile unless explicitly assigned another operational role.
- Auditor does not receive full Admin authority.
- Every consolidated page gets a dedicated approved mockup before implementation.
- Every build must pass lint and TypeScript/Next production build before deployment.
