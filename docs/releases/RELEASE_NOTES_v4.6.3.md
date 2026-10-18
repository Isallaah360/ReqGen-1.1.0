# ReqGen v4.6.3 — release notes

v4.6.3 follows the agreed "Master Upgrade and Implementation Checklist" (11 categories). It is built
on the deployed v4.6.2 and replaces it completely.

**The routing engine is not changed.** No SQL file in this release creates or replaces
`approve_request_step`, `reqgen_next_route_step`, `build_request_route`,
`reqgen_build_route_for_template` or `reqgen_save_department_route`, and the route tables are only read.

---

## Why the ₦3,000,000 kept showing

A subhead keeps running totals in its own row (`subheads.expenditure`, `reserved_amount`,
`approved_allocation`). Requests and vouchers add to them. Deleting the requests, vouchers and
ledger lines by hand in Supabase does **not** take the amount back out. DIN 27 / DIN FORD kept
₦3,000,000 of "spent" with no record behind it, and the Finance home adds up those stored totals.

There was also a second cause: before v4.6.3, the database's recalculation counted only official
requests, so a posted **manual voucher's** spending could appear or disappear depending on what
happened next on that subhead. v4.6.3 uses one rule everywhere:

> **Spent** = official requests whose fund Account has released + posted manual vouchers,
> minus anything reversed. **Reserved** = open official requests still holding money.

---

## What is new

### 1. Finance Integrity (Finance › Finance Integrity) — categories 3 and 4
- Compares every stored total with the records behind it: subhead spent, reserved and allocation;
  IET account fund, given-to-subheads, spent and available; ledger lines without their subhead or
  account; voucher lines without their voucher or request; released requests without a subhead;
  a request on two live vouchers (double counting).
- The Auditor or the Super Admin can **correct** chosen subheads to what the records support:
  reason required, 2FA code, before/after kept in "Corrections made", a "System Recalculation"
  line in the ledger, an Audit Log line, and the DG / Auditor / Super Admin are told.
- A correction never puts money into a bank account.
- The Finance home now says how many differences there are and links to this page.

### 2. Transaction Centre (Finance › Transaction Centre) — category 2
- One list of every money movement: fund releases, manual and payment vouchers, transfers,
  bank funding, allocations and corrections. Search, filter by kind / effect / period, sort,
  open any line, export CSV.
- Records are never edited or deleted here. A mistake is **reversed**: the Account Officer starts
  it → the Auditor checks it (not the same person) → the DG (or the General Secretary acting)
  approves and stamps it with a fresh fingerprint or 2FA code.
- Only one live reversal per record, so nothing can be reversed twice.
- Reversing gives the subhead its budget back; it never adds money to a bank account.

### 3. Financial Reset (Administration › Financial Reset) — category 1
- **Super Admin only** (the Trust's Super Admin account acting as Super Admin). The Developer and
  any other administrator are refused, in the page, in the server and in the database.
- Step by step: choose what to clear → preview with row counts (and anything that would stop it)
  → **take a verified backup** (stored, read back and checked) → reason + type `RESET FINANCE`
  → 2FA code → the database clears everything in **one transaction** and checks that every
  subhead and IET account figure reads ₦0.00. If anything fails, nothing at all is changed.
- What can be cleared: finance records (always: ledger, account transactions, transfers,
  reversals, reconciliations, finance activity), payment vouchers, requests.
- Always kept: staff accounts, sign-ins, 2FA, fingerprints and passcodes; positions, departments
  and routing; subhead names, codes and IDs; IET account names and bank details; settings,
  signatories and security rules; the Audit Log, backups, and the record of every reset.
- The current financial year's budget lock is opened again so new allocations can be entered.
- Every reset is kept in "Resets done" and in the Audit Log, and the DG, Auditor and Super Admin
  are told.

### 4. Security — category 5
- Destructive actions (reset, restore) need the Super Admin with a 2FA code typed in the last
  10 minutes.
- Every server route now refuses a deactivated account, or one whose staff record cannot be
  found, even while an old session is still valid.

### 5. Backups and restore — category 6
- Every stored backup (nightly, Back up now, before a reset) is read back and checked table by
  table before it is marked verified.
- Restore is the Super Admin's only (with a fresh 2FA code) and is written by the database in
  **one transaction**: every table is restored, or none is. Restore still never deletes anything.

### 6. No v3 look left — category 8 and 9
Rebuilt on the v4 design (approved mock-ups 05, 06, 16–22): Profile, Signature & Photo (now also
"draw with finger or mouse"), My Access, My Activity, Setup Guide (with the switch to hide the
guide strip), Change Password, New phone for 2FA, Recent Activity, Help, Create Account, Reset
Password and the "not open to you" page. The old Finance overview / vouchers / audit addresses
and two development pages forward to their v4 page.

### 7. Code clean-up — category 8
- 50 source files no page used any more (v3 components and style sheets) are deleted; old audit
  checks that read them now check the v4 pages instead.
- The changes made after v4.6.0 were reviewed line by line. Kept: the safer passcode
  replacement, the fingerprint origin check, the counter-save check, the configured window.
  Moved: the menu hover colour out of the generated `v4.css` into `v4-theme.css`. Replaced: the
  "Recorded expenditure" label and its audit (the dashboard now links to Finance Integrity).
- Old release notes moved to `docs/releases/`.

---

## Results of this build

| Check | Result |
|-------|--------|
| `npm run lint` (zero warnings allowed) | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed — 150 routes, no warnings |
| All 44 audit scripts, including the new `audit:v463` (31 checks) | Passed |
| SQL on a fresh database (every file in order), then v4.6.3 run a second time | Every row OK |
| Browser tests: v4.6.3 (integrity, reversal, reset, access, rebuilt pages, phone width) | 46 / 46 |
| Browser tests: earlier releases 4.1.2 / 4.3 / 4.4 / 4.5 / 4.6 | 25 / 42 / 29 / 47 / 53 — all passed |
| SQL behaviour tests (DIN FORD case, refusals, reset, restore all-or-nothing) | All passed |
| Every page (106) opened as 8 positions — Super Admin, Auditor, Account Officer, DG, HR Coordinator, PD, Registry, Staff | No page errors, no failed requests, no request loops |

All tests ran against a local copy of the database, not your live Supabase. Run the step-0
inventory (read-only) before the reset if you want it checked against your real tables.

---

## SQL for this release

Only **one** new file: `database/v4_6_3_finance_integrity_reset.sql` (run after v4.6.0's file,
which is already in your database). It changes no data, backs up the two functions it replaces,
is safe to run twice, and ends with a table where every row says OK.

Optional, read-only: `database/v4_6_3_step0_READONLY_inventory.sql`.

The full step-by-step is in `DEPLOYMENT_GUIDE_v4.6.3.md`.
