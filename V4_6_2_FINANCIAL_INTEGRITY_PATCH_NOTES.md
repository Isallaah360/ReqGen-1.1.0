# ReqGen v4.6.2 — Financial disclosure patch (NOT production certified)

This incremental patch corrects the central version label and clarifies that Finance dashboard expenditure is a stored subhead aggregate, not a reconciled transaction total. It adds a static source assertion. It does not resolve the underlying data discrepancy or implement the requested destructive reset.

## Observed production discrepancy
DIN 27 / DIN FORD: `subheads.expenditure` = NGN 3,000,000; six queried related tables contain zero matching records. Previous manual deletions may have removed the supporting entries. Do not assume the payment never happened.

## Installation
Apply changed files over the exact v4.6.1 source baseline, then run `npm ci`, `npm run audit:v462`, `npm run lint`, `npm run typecheck`, and `npm run build` in your own environment. Do not deploy until all checks pass and staging verification is complete.

## Outstanding release blockers
- Reconciliation engine and transaction provenance
- Super Admin-only financial-year reset with verified backup and rollback testing
- Developer role and navigation E2E tests
- Database integration tests and full production build

No destructive SQL is included.
