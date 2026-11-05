# ReqGen v4.6.7 — release notes

A clean-up release. It is built on v4.6.6 (the version now live) and replaces it.
**No database change.** The Routing Engine is not changed: its functions and route tables are
only read, and routes are still saved through its own `reqgen_save_department_route`.

This release answers the review "ReqGen v4.6.7 Findings and Recommended Solutions".

## 1. Positions are clean (finding 3)

- **What was wrong.** HR section permissions were shown as if they were positions, for
  example `hr:archive`, `hr:registrar` and `hr:annual360assessment`. They came from the HR
  officer assignments table and appeared on My Account and in "Acting as".
- **What changed.**
  - My Account, My Access and "Acting as" now list **Staff plus the positions the person
    genuinely holds**, for example Staff, Registrar and HR Officer. Permission tokens are no
    longer listed.
  - The permissions themselves are **kept**. They stay in the database and still work on the
    server exactly as before; they are simply not offered as positions.
  - Anyone whose "Acting as" was left on an old `hr:...` value now sees **HR Officer**. Old
    history lines that carry such a value also read as **HR Officer**. The records themselves
    are not changed.

## 2. Official and Personal routes are set separately (finding 1)

- **Where.** Administration › Routing Engine › Routes now has two views: **Official Requests**
  and **Personal Requests**.
  - The Personal view shows only **Personal Fund** and **Personal Other**.
  - Press **Change** in either view to edit only the columns of that view.
- **What is unchanged.**
  - Saving uses the same engine call as before. The lanes of the other view are sent back
    exactly as they were, so saving a Personal route never changes an Official route. This was
    tested, and the reverse also holds.
  - Requests already moving keep the route they started with.
- **Department officers.** The officers listed under the route (PD, DOD, HOD, HR Coordinator
  and the others) serve that department for both Official and Personal requests. The screen
  now says so.

## 3. Request in Registry but not in the HR Officer's queue (finding 2)

- **The rule (unchanged).** A request is in a person's Approvals only when it is **waiting
  with that person**, meaning they are its current owner. The position they are acting as does
  not add or remove requests. Registry sees every request because it tracks movement.
- **The likely cause.** On Personal routes, the **HR** step belongs to the **HR Coordinator**
  officer set in the Routing Engine, not to every HR Officer.
- **New read-only trace.** Use `database/v4_6_7_request_queue_trace_READONLY.sql` to confirm
  the cause for the actual request.
  - You enter the request number and the officer's email.
  - One table comes back showing: the request, the route it follows, who it is waiting with,
    the officer's positions and permissions, the last movements, and a **verdict**.
  - The script only reads. It does not repair, recreate or advance anything.

## 4. Terminology and the acting position (finding 4)

- The words on screen are **Staff**, **Registrar**, **HR Officer** and **HR Coordinator**.
  "HR Boss" does not appear anywhere on screen.
- The chosen "Acting as" position was already saved for each person and written on every
  action they take. This is unchanged. History is not rewritten.

## 5. Code clean-up (finding 6), after reference analysis

- The repository's own unused-file report found **0** unused pages or files.
- Functions that nothing in the app calls were removed:
  - the old one-lane route saver (`saveRouteLane`);
  - two unused routing lists;
  - an unused route-slot helper;
  - an unused SMS-plus-email sender;
  - an unused people directory loader;
  - three unused constants;
  - the HR-assignment pseudo-position code.

  No page, database function or audit used any of them.

## 6. From the earlier v4.6.7 build (kept)

- On Create Account, the full name, phone number and email are all required. The phone number
  must be a valid Nigerian number, and the name is typed and saved in CAPITAL LETTERS.
- The six 2FA code boxes fit every phone screen.

## Results

| Check | Result |
|---|---|
| Clean `npm ci`, `npm run typecheck`, `npm run lint` (0 warnings), `npm run build` | Passed |
| 46 audit scripts (including `audit:deploy` and `audit:production`); `audit:v467` now has 16 checks | Passed |
| New browser suite v4.6.7 (positions, Acting as, both routing views, Personal save leaves Official untouched, read-only trace) | 17 / 17 passed |
| Earlier browser suites 4.1.2 / 4.6 / 4.6.3 / 4.6.4 / 4.6.5 / 4.6.6 | 25 / 53 / 46 / 49 / 22 / 51, all passed |
| Every page crawled as 10 accounts (Super Admin, Developer, Auditor, Account Officer, DG, HOD, PD, Registry, Staff, Muhammad Alhassan) | 112 pages each, 0 issues |
