# ReqGen v3.1.10 — Release Notes

**Full project.** Replace your whole project folder with this zip, keeping your `.env.local`. No SQL to run in this release.

## Request template: "Checked by" is no longer blank

- REQ-202608-908021 went Staff → DG with no reviewing step: General Admin has no HOD, so the HOD step was skipped as vacant.
- "Checked by" now uses:
  1. the reviewing officer (PO / DOD / HOD / Director / DIN Admin / Registrar), if there is one;
  2. otherwise HR, on personal requests;
  3. otherwise the **Account Officer who checked and treated the request**, with name, capacity, signature and date.
- Printing is no longer blocked by a missing reviewer step.

## IET financial year: 1 September – 31 August

- Financial years are named by their start year: FY 2025/26 runs from 1 Sep 2025 to 31 Aug 2026.
- The new shared rule is in `lib/financialYear.ts`.
- It applies to:
  - **Master Backup:** the year choice and the backup file name.
  - **Print Register:** the year filter.
  - **Finance overview:** the year filter.
  - **Finance Settings:** the default year.

## Setup Guide completes and turns green

- The password step now applies only to accounts the Administrator created with a temporary password. It completes when that password is changed, or when the person confirms it is already their own.
- Accounts made before this release are treated as already done, so they no longer stay stuck at "1 of 4".
- When every step is done, a green "Your account is fully set up" bar shows once, with an OK button.
- The guide no longer appears on document print pages.

## One loading bar

- The IET stripe at the very top of the app now comes alive while ReqGen loads.
- The second strip under the top bar is retired; screen readers still announce loading.

## Every page reachable by role

- A system-wide scan found 17 pages that nothing in the app linked to.
- Now linked as module tabs:
  - **Finance → Finance Audit**
  - **Admin → Audit Log**
  - **Admin → Diagnostics**, whose page also links the Access audit, Release readiness and Workflow test tools.
- Retired duplicates now forward to their real pages:

| Old address | Now opens |
|---|---|
| Finance Accounts | IET Accounts |
| Assign Account | Assign |
| Finance Print Centre | Payment Vouchers Print Centre |
| Export Centre | Finance Reports |
| Report print | Finance Reports |
| Audit Trail | Finance Audit |
| Activity History | Finance Audit |

- A new audit fails the build if any page becomes unreachable again.

## Layout standard

- A browser sweep of 49 pages confirmed:
  - one page width everywhere (no page wider or narrower than the others);
  - no sideways scrolling;
  - no page errors.
- These pages had a box inside a box, and all now read as one frame:
  - Activity
  - Finance Audit
  - Reports
  - Executive Analytics
  - Profile (signature box)
  - Access & Roles
  - Profile Activity
  - Security
  - Admin Users

## Notifications

All notifications stay inside the app; ReqGen never uses browser notifications. The release audit now enforces this.

## Deploy

```
npm install
npm run lint
npm run typecheck
npm run build
git status
git add -A
git commit -m "ReqGen v3.1.10: system-wide audit, financial year Sep-Aug, Checked by, one loader"
git push origin main
```

## New audit

`npm run audit:v3110` runs 8 checks, including page reachability. It is added to `audit:production`.
