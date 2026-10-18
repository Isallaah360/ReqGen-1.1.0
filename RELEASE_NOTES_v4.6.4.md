# ReqGen v4.6.4 — release notes

v4.6.4 finishes the finance clean-up from the v4.6.3 checklist, using the inventory you ran on your
live database (18 October 2026). It also replaces the on-screen number pad for passcodes. It is
built on v4.6.3 and replaces it completely.

**The routing engine is not changed.** No SQL file in this release creates or replaces
`approve_request_step`, `reqgen_next_route_step`, `build_request_route`,
`reqgen_build_route_for_template` or `reqgen_save_department_route`, and the route tables are only read.

---

## What your inventory showed, and what v4.6.4 does about each

| Found in your live database | What v4.6.4 gives you |
|---|---|
| DIN 27 / DIN FORD: ₦3,000,000 "spent" with no request, voucher or ledger line behind it | Already correctable in v4.6.3. v4.6.4 also fixes a fault that stopped a correction when **both** Spent and Reserved were wrong on the same subhead. |
| ALLI, Admin and DIN Account show figures "given to subheads" and "spent" that no longer match their subheads | **Recalculate accounts** on the Integrity page works each account's figures out again from its subheads. The total fund is never changed. |
| Every IET account fund is ₦0, below what its subheads were given (₦790.8m for 2026/27) | New check **Given more than the fund**. It explains the cause and links to Bank Accounts → Set fund. Nothing is changed automatically. |
| The ledger is empty, so the 57 allocations have no ledger line | They are now listed as **Opening balances to record**, not as errors. **Record opening balances** writes one opening line for each allocation (and each fund) that has none. No amount changes. |
| Requests have attachment checks and budget lines linked to them | Financial Reset now also clears `request_attachment_checks` and `reqgen_request_budget_lines` when requests are cleared, so the reset cannot be stopped by them. |

---

## What is new

### 1. Finance Integrity page, grouped by what can be done
- **Subheads**: Spent and Reserved that the records do not support. Tick and **Correct to the
  records** (as in v4.6.3). One correction number now covers every figure it changed.
- **IET accounts**: figures that no longer match their subheads. Tick and **Recalculate**.
- **Given more than the fund**: subheads hold more than the account has. Explained, with links to
  Bank Accounts and Budget & Subheads. Goes away when the fund is set from the bank statement.
- **Opening balances to record**: allocations and funds entered before the ledger had a line for
  them. One button records them all.
- **Other records to check**: records without their parent, and anything counted twice.
- Every action needs the Auditor or the Super Admin, a written reason and a fresh 2FA code (or
  fingerprint). Each one is listed under "Corrections made", written to the Audit Log, and
  correction numbers are only used when something actually changes.
- The Finance home count no longer includes opening lines, because they are not errors.

### 2. Passcode entry with the phone's own keyboard
- The on-screen number pad is removed from sign-in and from setting a passcode.
- Tap the six boxes and the phone's number keyboard opens. On a laptop, type on the keyboard.
- Only numbers are taken, Backspace removes one, paste works, and the passcode is sent as soon as
  the sixth number is typed. The boxes never show the numbers, so no show/hide eye is added.

### 3. Database safety
- `reqgen_finance_correct` and `reqgen_reversal_approve` write their ledger line only when the
  subhead has a bank account (the ledger requires one), so they can no longer fail on a subhead
  without an account. A subhead with an allocation but no IET account is now listed on the
  Integrity page.

---

## Results of this build

| Check | Result |
|-------|--------|
| `npm run lint` (zero warnings allowed) | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed — 150 routes, no warnings |
| All 45 audit scripts, including the new `audit:v464` (25 checks) | Passed |
| SQL on a fresh database (every file in order), then v4.6.4 run a second time | Every row OK |
| SQL tests copying your live state (empty ledger, allocations, ₦0 funds, stale accounts, DIN FORD with Spent and Reserved) | All passed |
| Browser tests: v4.6.4 (Integrity clean-up in order, refusals, passcode typing on laptop and phone width, sign-in with passcode) | 49 / 49 |
| Browser tests: earlier releases 4.1.2 / 4.3 / 4.4 / 4.5 / 4.6 / 4.6.3 | 25 / 42 / 29 / 47 / 53 / 46 — all passed |
| Every page (106) opened as 8 positions — Super Admin, Auditor, Account Officer, DG, HR Coordinator, PD, Registry, Staff | No page errors, no failed requests, no request loops |

All tests ran against a local copy of the database, not your live Supabase.

---

## SQL for this release

Run in this order, after the code shows **Ready** on Vercel:

1. `database/v4_6_3_finance_integrity_reset.sql` — **only if you have not run it yet**.
2. `database/v4_6_4_finance_opening_balances.sql` — new. It changes no figures, backs up the
   four functions it replaces, is safe to run twice, and ends with a table where every row says OK.

The full step-by-step is in `DEPLOYMENT_GUIDE_v4.6.4.md`.
