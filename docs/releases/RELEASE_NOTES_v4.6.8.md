# ReqGen v4.6.8 — release notes

Built on v4.6.7 and replaces it. It has **one database step**: `database/v4_6_8_admin_access.sql`, run after the code is live.

The Routing Engine is not changed. Its functions and route tables are only read.

## 1. What went wrong on Administration › Departments

The Super Admin (ietreqgen@gmail.com) is a system account. It has no department and holds only the Super Admin position. The older security rules on staff records and department paying accounts were written before such an account existed, so they let it see only its own record. That caused every fault in the screenshots:

- Every name showed as "undefined", and every department showed "0 staff".
- The officer lists offered only "Super Admin".
- "Pays from" showed "Not set" for every department, even where one is set.
- Saving a department's account failed with "new row violates row-level security policy for table department_account_routing".

**The fix**

- The v4.6.8 database step **adds** rules so that the Super Admin and the Developer can read every Administration table and change the setting tables. No existing rule is changed or removed, and staff keep exactly the access they had. A copy of the current rules is saved first.
- The Departments page and the Routing Engine › Accounts tab now read and save through their own Administration functions (Super Admin and Developer only). They therefore work whatever the older table rules say.
- Before the database step is run, the page says so instead of printing "undefined".

## 2. One setting shows everywhere

What is set once now appears on every page that uses it:

- DOD, HOD and PD set in the Routing Engine appear on Departments.
- A department's paying account appears in Departments, Routing Engine › Accounts, New subhead and the DG step.
- Account Officers assigned in Finance appear on Departments.

### Departments › Edit

- **Pays from account.** Funded accounts are listed first. Each account shows its bank and its fund, or "no fund yet". Under the field you see the chosen account's fund, the amount given to subheads, and the balance. For example: "Fund ₦20,000,000.00 · Given to subheads ₦6,623,240.00 · Balance ₦13,376,760.00". An account with no fund says "has no fund yet (not allocated)".
- **Account Officer.** The account's own Account Officer is filled in for you when you choose the account. Account Officers are listed first, and system accounts are never offered.
- A person who does not hold the Account Officer position cannot be chosen to pay a department. The Routing Engine would not send them the request, so ReqGen now says so straight away.

### Other settings

- **Routing Engine › Routes › Change** has a new "Copy steps from" field. Choose another department, and its steps (and any officers not yet set) are copied. Then press Save route. Saving still goes through the engine's own function.
- **Finance › Subheads › New subhead**: choosing a department fills in the account that department is paid from.

## 3. FUNDRAISING

- The database step makes sure FUNDRAISING exists and is active, so staff can choose it when they register.
- FUNDRAISING is paid from **the same account and Account Officer as General Admin**.
- Its approval route is compared with General Admin's. If they differ, the report tells you to use "Copy steps from General Admin".
- **Still to do.** FUNDRAISING needs its own subheads (budget lines). Add them in Finance › Subheads › New subhead. The funding account is filled in as General Admin's account. Until it has subheads, an officer who opens a FUNDRAISING request is told exactly this.

## 4. Faults found by testing every request type end to end

Each request was raised as a staff member and taken through every officer: HOD, HR, DG, Account Officer and HR Filing. Testing found and fixed these:

- **HR Coordinator could not recommend a subhead on a personal fund request.** That would have stopped every personal fund request at the HR step. Fixed.
- **DG could not approve an official request** unless an Account Officer had already been attached to it. DG now follows the department's Account Officer, the same rule the Routing Engine uses. If a department has none, DG is told which department to fix.
- **A subhead could be chosen only at the DOD or HOD step.** A new function (`reqgen_officer_assign_subhead`) lets the officer who holds the request choose it at the DOD, DIN Admin, HOD, Registrar or HR step. On a personal fund, HR recommends it. The older function is untouched.
- **Signatures read "registrar (acting HR)".** The officer named for a step in Routing Engine settings now shows as that step's position (for example "HR Coordinator") on the request, its history and the printed letter. The stored history is not changed.

## 5. The database report tells you what is missing

The last table lists every active department that has **no paying account or Account Officer**, or whose Account Officer does not hold the position. Each one is marked **TO DO**. DG approval of official requests from those departments stops until it is set in Administration › Departments.

## Results

| Check | Result |
|---|---|
| Clean `npm ci`, `npm run typecheck`, `npm run lint` (0 warnings), `npm run build` | Passed |
| 47 audit scripts, including the new `audit:v468` (25 checks), `audit:deploy` and `audit:production` | Passed |
| New Administration suite with live-like security rules (Super Admin, Developer and staff; Departments, Routing, Subheads, Staff, Positions, Signatories, sign-up) | 38 / 38 passed |
| New end-to-end suite: 6 requests (Official, Personal Fund and Leave; FUNDRAISING, General Admin, ASAP-ALLI) from staff to the end, through every officer | 18 / 18 passed |
| Earlier browser suites: 4.6.7 / 4.6.5 / 4.6.4 / 4.6.3 / 4.6 / 4.1.2 / 4.3 to 4.5 / 4.6.6 | 17 / 22 / 49 / 46 / 53 / 25 / 42 / 51, all passed |
| Every page opened as 10 accounts, with live-like security rules (Super Admin, Developer, Auditor, Account Officer, DG, HOD, PD, Registry, Staff, Muhammad Alhassan) | 112 pages each, 0 issues (no errors, no "undefined", no security messages) |
