# ReqGen v4.6.0 — release notes (v4.1.2 → v4.6.0)

This package brings ReqGen from v4.1.1 to v4.6.0 in six steps. Every step was built on the
approved mock-ups (pages 01–90) and the v4 Build Reference, then tested before the next one began.

**The routing engine is not changed.** `approve_request_step`, `reqgen_next_route_step`,
`build_request_route`, `reqgen_build_route_for_template`, `reqgen_save_department_route` and the
route tables are only read, or used through their own functions. No SQL file in this package
creates or replaces any of them.

---

## 1. How to deploy (in this order)

1. **Push the code** (section 6). Wait until Vercel shows the deployment as **Ready**.
2. **Add the new environment values** in Vercel › Settings › Environment Variables (section 5),
   then redeploy once.
3. **Run the SQL files in the Supabase SQL Editor, one at a time, in this order.** Each one ends
   with a table; every row must say **OK** before you run the next file. Each file is safe to run
   again.

   | # | File | What it adds |
   |---|------|--------------|
   | 1 | `database/v4_1_2_requests_drafts_reopen.sql` | Drafts, reopen, correct, request chain |
   | 2 | `database/v4_2_0_finance.sql` | Financial years, budget lock, transfers, finance settings |
   | 3 | `database/v4_3_0_payment_vouchers.sql` | Multi-payee vouchers, return/resend, mark paid, manual voucher, attachments |
   | 4 | `database/v4_4_0_reports.sql` | Reports by acting position, compliance checks, print register |
   | 5 | `database/v4_5_0_registry_audit.sql` | Registry, one Audit Log, trace, reconciliation, backups bucket, reminders |
   | 6 | `database/v4_6_0_administration.sql` | Administration, security rules, diagnostics, Developer alerts |

   (If v4.1.0 and v4.1.1 SQL were not run before, run `v4_1_0_requests_approvals.sql` and
   `v4_1_1_return_resubmit.sql` first.)

4. Sign in as the Super Admin and open **Administration › Diagnostics**. Every check should be
   green or show a count you recognise.

Nothing in the database is deleted by these files. Functions that are replaced are backed up
first (`reqgen_function_backups`).

---

## 2. What is in each version, and the checklist for each

Tick each line as you check it. The automatic results are from this build.

### v4.1.2 — Requests

- New Request has **one** Department field (the duplicate is gone).
- Subhead balances follow the position you are **acting as**: hidden for Staff, Registry and PD;
  shown for DIN Admin, HR Coordinator, DOD, HOD, DG, Account, Auditor and Super Admin.
- Modern dropdowns everywhere (search inside long lists, keyboard friendly, work inside pop-ups).
- Drafts (saved, not sent), correct a request sent back, reopen a closed request with a reason,
  request chain on the record page. Request letter keeps the v3 template on one A4 page.

Checklist:
- [ ] Requests › New Request: one Department field; balances follow the acting position
- [ ] Switch "Acting as" from Staff to HOD: balances appear; back to Staff: they disappear
- [ ] Save a draft, open it again, send it
- [ ] A returned request: correct it and resubmit
- [ ] Reopen a closed request (reason required)
- [ ] Print a request letter: one A4 page, v3 layout
- Automatic: end-to-end test 25 of 25 passed · release audit passed

### v4.2.0 — Finance

- Finance pages on the v4 kit: overview, accounts, subheads, ledgers, transactions, departments,
  settings, export centre.
- Financial year (1 September – 31 August): Open → Budget locked → Closed.
- Transfers between accounts or between subheads: Account Officer starts → Auditor checks →
  DG (or General Secretary acting) approves and stamps with a **fresh fingerprint or 2FA code**.
  Balances change only when the DG approves.
- Account lists show the account name, with the bank in grey. Payment methods: Transfer, Cheque, Cash.

Checklist:
- [ ] Finance home and every Finance tile opens
- [ ] Start a transfer as Account Officer → check as Auditor → approve as DG (asks for fingerprint / code)
- [ ] Lock the budget; a subhead allocation can then change only by transfer
- [ ] Account lists: name only, bank in grey
- Automatic: covered by the v4.3 end-to-end test (42 of 42) · release audit 24 checks passed

### v4.3.0 — Payment Vouchers

- Treat a request (Account Officer) → generate a voucher (up to 10 official requests by transfer,
  with a Transfer Schedule page), "Preparing as" General Admin / DIN / ASAP-ALLI.
- Signing order: Account Officer → Auditor → Counter Signer → DG (sign, stamp, authorise with
  fresh fingerprint or 2FA). Any signer can send it back with a reason; resend restarts the order.
- Ready to Pay, Mark Paid (paid on, reference, Received By), Paid History, Signing Tracker,
  Print Centre with batch A4 printing, Manual Voucher with bill/receipt upload, Signatories.
- Voucher keeps the v3 template on one A4 page (Transfer Schedule on a second page when used).
- **Money is counted once**: spending is recorded when Account releases the fund; marking a
  voucher paid records the payment only.

Checklist:
- [ ] Treat a request and generate a voucher with two payees (Transfer Schedule prints on page 2)
- [ ] Auditor returns it with a reason; Account Officer corrects and resends
- [ ] Counter Signer signs; DG signs and stamps (fresh fingerprint / code)
- [ ] Mark Paid; it moves to Paid History
- [ ] Print Centre: batch print several vouchers on A4
- [ ] Manual Voucher: attach a receipt and post it
- Automatic: end-to-end test 42 of 42 passed · release audit 30 checks passed

### v4.4.0 — Reports

- Reports home shows tiles for your acting position. The database decides who sees what:
  Super Admin and Auditor — everything; Account Officers, DG, General Secretary — finance for all
  departments; everyone else — only their own requests and money paid to them.
- Transactions, Analysis, Request Reports, Finance Statements, Voucher Reports, Registry Reports
  (counts only), Executive Analytics, Compliance (12 automatic checks), Report Print, Print Register.
- Every report downloads as a real Excel (.xlsx) file and prints on A4.

Checklist:
- [ ] As Staff: only your own figures
- [ ] As Account Officer / DG: finance for every department
- [ ] As Auditor: everything, plus Compliance (run the 12 checks)
- [ ] Download any report as Excel; print one on A4
- Automatic: end-to-end test 29 of 29 passed · release audit 24 checks passed

### v4.5.0 — Registry and Audit

- Registry (numbers, dates, offices and people only — never titles, amounts or contents):
  Tracking (where every request is, its moves, daily summary print), Incoming and Outgoing
  correspondence with references (IN/2026/0001, OUT/…), Dispatch (hand delivery, courier, email,
  post), Archive with retention review, Filing queue. Reminders: one an hour, request number
  only; requests never move by themselves.
- Audit: **one Audit Log** for sign-ins, approvals, signatures, stamps, data and settings. Entries
  cannot be changed or deleted (the database refuses). Workflow Trace for any request or voucher
  number. Finance Reconciliation against a bank statement (CSV or Excel). Master Backup: a full
  copy every night at 02:00, download any financial year, Back up now; only the Administrator
  restores, with a fresh fingerprint or 2FA code.

Checklist:
- [ ] Registry home and every tile; no request title or amount anywhere in Registry
- [ ] Record incoming mail, forward it, dispatch outgoing mail
- [ ] Tracking: send a reminder (a second one within the hour is refused)
- [ ] Audit Log: filters, export CSV
- [ ] Workflow Trace: type a request number, print A4
- [ ] Reconciliation: upload a statement, explain an unmatched line, reconcile the month
- [ ] Master Backup: download a year, Back up now, see it in the backup log
- Automatic: end-to-end test 47 of 47 passed · release audit 27 checks passed

### v4.6.0 — Administration

- Administration home, System Accounts (Super Admin is the Trust's account; Developer is
  Barderian Enterprises; every Developer action is logged and the Super Admin is told), Hand over
  the Super Admin account (needs the 2FA code; the old keeper is signed out).
- Staff & Positions: add staff, search, filters. Staff record: details, give / remove positions
  (signing positions need a signature first), main position, deactivate (sign-in blocked, reason
  kept — staff are never deleted), reactivate, reset 2FA, remove passcodes.
- Positions, Permissions Matrix (Excel download), Departments (heads through the Routing
  Engine), Routing Engine (live routes, officers per step, paying accounts, backups and away
  cover), Security Centre (hours signed in, idle sign-out, wrong passcode tries; officers without
  2FA), Diagnostics (health, data checks, route preview).
- Passcode setup and passcode sign-in show the hours and tries actually set in Security Centre.
- Old Administration addresses forward to their new pages.

Checklist:
- [ ] Administration home: 8 tiles and the numbers
- [ ] Add a staff member; give and remove a position; deactivate and reactivate
- [ ] Departments: change a head; add a department
- [ ] Routing Engine: change a route (saved as a new version), set an officer, a paying account, mark an officer away
- [ ] Security Centre: change idle sign-out; remind officers without 2FA
- [ ] Diagnostics: all checks shown
- [ ] As Developer: an action shows in the Audit Log and the Super Admin gets a notice
- Automatic: end-to-end test 53 of 53 passed · release audit 26 checks passed

---

## 3. Results of this build

| Check | Result |
|-------|--------|
| `npm run lint` (zero warnings allowed) | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed — 146 routes, no warnings |
| `npm run audit:deploy` | Passed |
| `npm run audit:production` | Passed |
| All 43 audit scripts run one by one | Passed |
| SQL files 1–6 on a fresh database, then 5 and 6 run again | Every row OK |
| End-to-end tests (browser) 4.1.2 / 4.3 / 4.4 / 4.5 / 4.6 | 25 / 42 / 29 / 47 / 53 — all passed |
| Every page (103) opened as 8 positions — Super Admin, Auditor, Account Officer, DG, HR Coordinator, PD, Registry, Staff | No page errors, no request loops. One finding fixed: the A4 monthly finance report (`/reports/print`) is now closed to Staff, Registry and PD |

---

## 4. Rules kept in this release

- Staff never see subhead balances. Registry never sees request contents or balances. PD cannot see balances.
- Signing, stamping and paying always need a fresh fingerprint or the 2FA code — never the passcode alone.
- The Super Admin cannot raise, approve, sign, stamp or pay.
- Nothing is deleted from the database without the owner typing YES.
- No `.env` file is included in the package.

---

## 5. Environment values (Vercel)

Already set before this release (keep them): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `MFA_TRUST_SECRET`, `OTP_HASH_SECRET`, and the `NEXT_PUBLIC_REQGEN_*` switches.

New or now used:

| Name | Needed for | Value |
|------|-----------|-------|
| `CRON_SECRET` | Nightly backup and daily reminders (`vercel.json` runs `/api/backup/nightly` at 01:00 UTC = 02:00 Lagos) | Any long random text. Vercel sends it automatically to the cron job. |
| `NEXT_PUBLIC_APP_URL` | Links inside reminder emails / SMS | `https://` + your ReqGen address |
| `SENDCHAMP_API_KEY`, `SENDCHAMP_SMS_ENABLED`, `SENDCHAMP_EMAIL_ENABLED` (optional) | SMS / email reminders through Sendchamp | Leave unset (or `false`) to send in-app reminders only |

---

## 6. Push codes

```
npm install
npm run lint
npm run typecheck
npm run build
npm run audit:deploy
git add -A
git commit -m "ReqGen v4.6.0: requests, finance, payment vouchers, reports, registry and audit, administration"
git push origin main
```

---

## 7. Housekeeping

`node scripts/cleanup-unused.mjs` lists source files no page uses any more (old CSS modules and
v3 components). It changes nothing unless you run it with `--delete YES`. Files an older release
audit still reads are kept.
