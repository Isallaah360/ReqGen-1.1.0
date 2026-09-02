# ReqGen Global Data Accuracy + Section 5 PV Consolidation

- Sections 1-4 remain locked.
- Global readability baseline: 13px for main and collapsible navigation and top-bar operational text.
- Finance Overview now renders every department and every active subhead; no top-7/top-6 truncation in analytical panels.
- Canonical subhead balance displayed as Approved Allocation - Reserved - Expenditure; stored-balance mismatches are surfaced.
- IET Accounts bank distribution lists every bank and its live available balance; no static donut and no top-4 truncation, so Jaiz/Providus/etc. cannot disappear merely due to ranking.
- Payment Voucher operations are consolidated into one Payment Voucher Centre with Overview, Pending, Approved, History and Print/PDF views; Settings remains separate and restricted. Legacy PV routes redirect to the consolidated workspace.
- PV bank-account source now checks `iet_accounts` first.
- PV subhead availability uses Allocation - Reserved - Expenditure.
- `audit:data-accuracy` protects these contracts.
- `20260902_dg_expenditure_reconciliation_audit.sql` is read-only. The live body of `approve_request_step` is not in this source package, so ReqGen does not guess or double-post expenditure. Run the audit against Supabase before altering financial posting semantics.
