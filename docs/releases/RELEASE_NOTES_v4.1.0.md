# ReqGen v4.1.0 — Requests and Approvals

**Full project** (includes everything in v4.0.0). Replace your project folder with this zip, keeping your `.env.local`, then run `node scripts/cleanup-v4.1.0.mjs` once.

## 1. Greeting
- One greeting per screen. The Dashboard shows a large greeting; every other page shows it in the top bar.
- Title case with a picture for each part of the day: **Good Morning** (sunrise, 04:00–11:59), **Good Afternoon** (sun, 12:00–15:59), **Good Evening** (sunset, 16:00–19:59), **Good Night** (moon, 20:00–03:59).

## 2. Requests
- **My Requests** rebuilt in the v4 look: tabs (All, In progress, Back with me, Approved & paid, Rejected), search, type, financial year, progress bar, Export CSV, pages. A returned request shows **Correct**; a paid one shows **Print**.
- **New Request — live budget check**: staff now pick the subhead of their department. ReqGen answers only **"Fund available"** or **"Not enough fund"** — never the balance. Not enough = you cannot submit (hard block). Senior officers still see the figures. Registry no longer sees subhead figures on this page.

## 3. Approvals
- **Requests to Approve** rebuilt: waiting for me, waiting 3+ days, approved and returned this month, search, department and type filters, oldest first.
- **Vouchers to Sign** rebuilt in the v4 look.
- **Treated by Me** (new): every request and voucher you approved, returned, rejected or signed, with Export CSV. Your recent activity on the Dashboard now comes from here too.

## 4. Printed letters and vouchers
- **IET stamp** in blue beside the Director General's signature on the request letter and beside the DG's authorisation on the payment voucher. It never moves any text.
- **QR check code** on every request letter and payment voucher. Scanning it opens a public check page showing only the document number, status and who signed — never the title, details or amount. A code that matches nothing says the paper may not be genuine.

## Deploy — in this order
```
npm install
npm run lint
npm run typecheck
npm run build
git add -A
git commit -m "ReqGen v4.1.0: Requests and Approvals, live budget check, IET stamp, QR check"
git push origin main
```
When Vercel shows **Ready**, run `database/v4_1_0_requests_approvals.sql` in the Supabase SQL Editor. All 5 rows say OK. Safe to run again.
Until it runs, the live check and Treated by Me wait for it; everything else works.

**Please test the QR code with two or three real phones** (normal camera app) on a printed letter and a printed voucher.

## Tested
- lint, typecheck, production build, every release audit including `audit:v400` and the new `audit:v410` (20 checks).
- SQL on a test database: live check says "available" for ₦50,000 and "not_enough" for ₦50,001 on a subhead with ₦50,000 left; Treated by Me returns only the officer's own decisions; run twice safely.
- Browser at laptop and phone size: no sideways scroll, no errors.
