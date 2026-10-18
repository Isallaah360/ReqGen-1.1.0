# ReqGen v4.6.5 — release notes

v4.6.5 fixes the refusal you saw when you tried, as the Super Admin, to remove DIN FORD's
₦3,000,000. It also lets you remove such an amount straight from the spending list, opened from
the Finance home. It is built on v4.6.4 and replaces it completely.

**The routing engine is not changed.**

---

## Why the Super Admin was refused

The database counted someone as the Super Admin only when their staff record was marked as the
Trust's Super Admin system account (the ietreqgen@gmail.com account). Your account **holds** the
Super Admin position and was **acting as** Super Admin, but was not that system account, so the
database answered "Only the Auditor or the Super Admin can correct stored finance totals."
This was reproduced exactly on the test database before it was fixed.

From v4.6.5 the Super Admin is: **an active person who holds the Super Admin position and is acting
as Super Admin**. The same rule is used everywhere: correcting totals, removing amounts with no
record, recalculating accounts, recording opening balances, Financial Reset and restore. The
Developer system account is still not treated as the Super Admin for finance.

Every finance page now asks the database who may act **before** showing a button, and when
someone cannot act it says exactly why — for example *Switch "Acting as" (top right) to Super Admin,
then try again* — instead of a refusal after the 2FA code.

---

## Removing the ₦3,000,000 from the spending list

- **Finance home › Spent** now opens **Finance › Transaction Centre** on the spending list.
- At the top is a new box: **Recorded with no record behind it**. It lists every amount that a
  subhead shows as spent or reserved but that no request, voucher or ledger line supports —
  DIN 27 / DIN FORD ₦3,000,000 among them. The Spent card says how much that is.
- The Auditor or the Super Admin clicks **Remove ₦3,000,000.00**, writes the reason and confirms
  with the 2FA code (or fingerprint). The subhead's Spent goes to what the records support (₦0.00
  for DIN FORD), so its balance goes back to its full allocation of ₦10,640,744.00. Supabase is
  updated in the same step.
- Each removal gets a correction number (COR-…), is listed in Finance Integrity under
  "Corrections made" and in the Audit Log, and the DG, Auditor and Super Admin are told.
- No bank balance changes. Real records (a released request, a paid voucher) are still never
  deleted: they are reversed with the Account Officer → Auditor → DG approval, as before.
- Others (DG, Account Officer, Developer) see the list but no Remove button, with the reason.

The other Finance home cards keep their links: Approved budget and Reserved open Budget &
Subheads, Bank cash opens Bank Accounts.

---

## Results of this build

| Check | Result |
|-------|--------|
| `npm run lint` (zero warnings allowed) | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed — 150 routes, no warnings |
| All 46 audit scripts, including the new `audit:v465` (17 checks) | Passed |
| SQL on a fresh database (every file in order), then v4.6.5 run a second time | Every row OK |
| SQL tests: the live refusal reproduced on v4.6.4 rules, then allowed on v4.6.5; Developer, someone acting as another position, a deactivated account and staff refused with the right reason | All passed |
| Browser tests: v4.6.5 (Finance › Spent → Transaction Centre → Remove ₦3,000,000 as a Super Admin holder, laptop and phone width; DG, Developer and system Super Admin) | 22 / 22 |
| Browser tests: earlier releases 4.1.2 / 4.3 / 4.4 / 4.5 / 4.6 / 4.6.3 / 4.6.4 | All passed |
| Every page (106) opened as 8 positions | No page errors, no failed requests, no request loops |

All tests ran against a local copy of the database, not your live Supabase.

---

## SQL for this release

Only **one** new file: `database/v4_6_5_super_admin_finance.sql` (you have already run the v4.6.3
and v4.6.4 files). It changes no data, backs up the function it replaces, is safe to run twice,
and ends with a table where every row says OK. One row lists, by name, everyone who will be
treated as the Super Admin when acting as Super Admin — check that it is who you expect.

The step-by-step is in `DEPLOYMENT_GUIDE_v4.6.5.md`.
