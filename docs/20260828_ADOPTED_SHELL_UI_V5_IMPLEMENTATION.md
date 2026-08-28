# ReqGen Adopted Shell UI V5 Implementation

Date: 28 August 2026

## Scope

This package consolidates the authenticated ReqGen application around the adopted mockup shell used for the Finance and Requests redesign.

### Shell contract
- 286px desktop navigation rail with compact ReqGen 2.0 branding.
- 68px sticky command bar.
- Aptos / Segoe UI typography stack.
- 10–12px operational UI typography with 25px page headings.
- ReqGen blue `#0b5cf0`, navy `#071b4d`, subtle `#dfe6f0` borders and `#fbfcff` application background.
- Compact rounded cards, filters, tables, status pills and action controls.
- Responsive drawer navigation below 1100px.
- Finance and Requests subnavigation remain expanded on their active module.

### Functional preservation
The update does not remove Supabase authentication, MFA, route access guards, finance workflow logic, request OTP/signature logic, account recalculation, voucher processing, transaction registers, or existing audit/workflow services.

### Updated architecture
- `app/components/GovernmentAppShell.tsx` is the single authenticated shell.
- `app/finance/_components/FinancePageFrame.tsx` is the common Finance page header/body contract.
- `app/finance/_components/FinanceDirectoryPage.tsx` supplies the formerly redirected Finance Vouchers / Finance Reports / Monthly Reports / Annual Reports routes with an on-brand workspace while retaining links into the enterprise report/voucher engines.
- `app/globals.css` contains the V5 shell and workspace tokens/overrides.

## Deployment
Run locally before production:

```bash
npm ci
npm run build
```

Then commit to `main` and allow Vercel to build the production deployment. No database migration is introduced by this UI package.
