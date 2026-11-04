# ReqGen v4.6.6 — release notes

v4.6.6 makes the two system accounts work properly and gives the Developer a console of
their own. It is built on v4.6.5 and replaces it completely.

**The routing engine is not changed.**

---

## Why the Super Admin and Developer accounts showed "This page is not open to you"

A sign-in (email and password) and a **staff record** (profile) are two different things in
ReqGen. ReqGen decides what a person can open from their staff record: their position and
the position they are acting as. The Super Admin sign-in (ietreqgen@gmail.com) had no staff
record, so ReqGen found no position at all and refused every page, even My Access. The
Developer account was in the same situation: it had no position that any page knew.

The v4.6.6 database step gives both accounts their staff record and position. Then they open
their pages normally. If a sign-in still has no staff record, ReqGen now says **"Your account
is not set up yet"** and what to do, instead of "not open to you".

---

## What is new

### 1. Only ietreqgen@gmail.com is the Super Admin
- The database step gives the Super Admin account its staff record:
  - marked as the Trust's Super Admin;
  - active, and in **no department**;
  - holds only the Super Admin position, and acts as Super Admin.
- It **takes the Super Admin position away from every personal account**, including the
  registry personal account (isallalah360@gmail.com). They keep their other positions.
  - Every change is written to `reqgen_role_changes` (before and after), so it can be undone.
  - This happens only once the Super Admin account is confirmed working.
- The Super Admin is not a staff member. Its Setup Guide asks only for its own password and 2FA,
  with no signature, no photo and no department.

### 2. Who can change finance totals
| Action | Who |
|---|---|
| Remove an amount with no record, correct totals, recalculate accounts, record opening balances | Super Admin (ietreqgen@gmail.com, acting as Super Admin), Developer, Auditor |
| Financial Reset, restore a backup | Super Admin, Developer |
| Everyone else | Sees the figures (if their position allows) and is told who can act |

### 3. The Developer Console: the Developer's own interface
The Developer account (info@barderians.com.ng) now has a different look from every other user:
- a deep navy console menu with ReqGen-blue accents, in light and dark;
- the Barderian logo with "ReqGen Console";
- a "DEVELOPER CONSOLE" badge in the top bar.

After signing in, the Developer lands on the Console instead of the Trust's dashboard.

- **Console:**
  - the running version;
  - which modules are on;
  - whether the Super Admin account is ready;
  - system health: tables, protection, today's audit events, last nightly backup, response time;
  - data checks, including finance differences;
  - a button for every module of the Trust's ReqGen.
- **Modules:** switch Requests, Approvals, Finance, Payment Vouchers, Registry, Reports or Audit
  off for maintenance, with a message.
  - While a module is off, staff see the message instead of its pages, and it leaves their menu.
  - The Developer can still open it.
  - Dashboard, Notifications, My Account and Administration can never be switched off, so
    nobody is locked out.
- **Releases:** publish what changed. Everyone reads it in the new **What's new** page, and the
  Super Admin gets a notification.
- **System Accounts:** both accounts live: sign-in ready, marked, position, 2FA, last sign-in.
- **Developer Activity:** everything the Developer account did in the last 90 days.

The Developer opens every module and every page. Money decisions (raising, approving, signing,
stamping, paying) stay with the Trust's officers.

### 4. The Developer's actions in the Audit Log
- They are no longer mixed into the everyday Audit Log. They have their own **Developer** tab.
- The Super Admin is no longer sent an alert for each action. The Super Admin is told about
  releases instead.
- The trail is still kept and cannot be changed or deleted. The Super Admin and the Auditor can
  read it. It is what shows the Trust that the Developer never touched their decisions.

### 5. System Accounts page (Administration)
It now shows both accounts live, with an updated list of what each can and cannot do. Each
account signs in on the normal sign-in page with its own email, password and 2FA. The page is
not a way to switch into another account.

---

## Results of this build

| Check | Result |
|-------|--------|
| `npm run lint` (zero warnings allowed) | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed — 156 routes, no warnings |
| All 47 audit scripts, including the new `audit:v466` (28 checks) | Passed |
| SQL on a copy set up like your live database, run three times | Every row OK; nothing repeated |
| SQL tests: Super Admin, Developer, Auditor allowed; former Super Admins, registry personal account and staff refused with the right reason | All passed |
| Browser tests v4.6.6 (51 checks) | All passed. The run covered: the "not set up" message; both accounts opening their pages; ₦3,000,000 removed by the Super Admin and again by the Developer; Console in light and dark at phone width; a module switched off and the message shown to staff; a release published and the Super Admin told; former Super Admins refused; the Developer tab in the Audit Log |
| Browser tests: earlier releases 4.1.2 / 4.3 / 4.4 / 4.5 / 4.6 / 4.6.3 / 4.6.4 / 4.6.5 | 25 / 42 / 29 / 47 / 53 / 46 / 49 / 22 — all passed (updated where v4.6.6 changes the rules: the Developer may now reset, and only ietreqgen@gmail.com is the Super Admin) |
| Every page (112) opened as 9 accounts — Super Admin, Developer, Auditor, Account Officer, DG, HR Coordinator, PD, Registry, Staff | No page errors, no failed requests, no request loops |

All tests ran against a local copy of the database, not your live Supabase.

---

## SQL for this release

1. `database/v4_6_5a_hotfix_account_recalc.sql`: only if you have not run it yet.
2. `database/v4_6_6_system_accounts.sql`: new. Safe to run more than once. Ends with a table
   where every row says OK, or "TO DO" with exactly what to do.

Optional, read-only: `database/v4_6_5_check_system_accounts_READONLY.sql`.
