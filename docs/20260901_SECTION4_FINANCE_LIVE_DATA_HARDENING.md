# ReqGen Section 4 — Finance Live Data Hardening

This pass corrects the Finance deployment where the Section 4 foundation changed permissions but did not yet apply the promised eight-item Finance navigation or fully live dashboard data contract.

## Applied
- Finance collapsible navigation reduced to eight workspaces: Finance Overview; IET Accounts; Budget & Subheads; Transactions & Ledgers; Transfers; Finance Processing; Reports & Output; Finance Settings.
- Added `/finance/processing` as a live request/payment-voucher queue.
- Global search now exposes the same consolidated Finance workspaces instead of the nineteen legacy destinations.
- Finance Overview now reads live `departments`, `subheads`, `finance_transactions`, `requests`, `payment_vouchers`, and `iet_accounts` records.
- KPI values use live subhead budget state: approved allocation, expenditure, reserved amount, and balance.
- Fiscal year, department, budget/subhead and transaction type filters are populated from live records.
- Removed synthetic trend fallback, hard-coded expenditure-category percentages, and fabricated invoice-aging values.
- Empty visualizations now explicitly show an empty state rather than drawing misleading data.
- Expenditure-by-department and budget-health panels are calculated from live subheads.
- Recent Transactions uses the actual Finance transaction contract (`transaction_no`, `narration`, `subhead_id`, debit/credit/amount) instead of unsupported placeholder fields.

## Validation
- Shell lock: PASS
- Route access audit: PASS
- Workflow audit: PASS
- Internal navigation: PASS, 0 broken targets
- Component contract audit: PASS
- TypeScript syntax parse: no syntax diagnostics in touched Finance/shell files. Full lint/build still requires a complete local dependency install.

Legacy Finance route files remain in the source for continuity while their functions are progressively absorbed into the eight consolidated workspaces. They are no longer exposed as nineteen Finance submenu/search destinations.
