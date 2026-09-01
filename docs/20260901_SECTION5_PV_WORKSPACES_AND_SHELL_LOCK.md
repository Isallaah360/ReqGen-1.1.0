# Section 5 Payment Voucher Workspaces + Shell Lock

## Locked shell
- Existing GovernmentAppShell architecture is preserved.
- Main navigation typography remains 13px.
- Collapsible/subnavigation typography is 12px (one pixel smaller), normal title case.
- Create Voucher has been removed from the Payment Vouchers collapsible navigation; creation remains available from the Payment Voucher dashboard.
- `npm run audit:shell` guards these invariants and is now part of `audit:deploy`.

## Rebuilt Payment Voucher workspaces
The shared legacy register presentation was replaced by purpose-specific workspace modes while retaining the existing Payment Voucher data source and detail/print routes.

- Pending Approval: pending queue KPIs, approval-state tabs, queue filters, pending summary, top departments, recent pending vouchers.
- Approved Vouchers: approval KPIs, authorised/cheque-ready/paid tabs, approval register, approval summary, top departments, recent approvals.
- Payment History: historical KPIs, this-month/completed/cancelled tabs, historical register, history summary, amount by payment method, recent cancelled vouchers.
- Print / PDF Centre: printable KPIs, transfer/cheque/cash tabs, printable voucher register, print summary, amount by payment method, recent printable vouchers.
- Payment Voucher Settings: header/breadcrumb architecture aligned to the Payment Voucher dashboard while preserving the existing signatory administration functions.

All counters and summaries are calculated from live `payment_vouchers` rows. No hard-coded mock data was introduced.

## Audits executed in this environment
- Shell architecture lock: PASS
- Route audit: PASS (84 routes, 0 duplicates, 0 unclassified sensitive routes)
- Workflow readiness: PASS
- Internal navigation: PASS (238 references, 0 broken targets)
- Component contract audit: PASS (139 app TypeScript files, 0 unsupported typed-component-prop failures)

`npm ci` timed out in the execution environment, so full local ESLint/Next build must still be executed on the deployment workstation before push.
