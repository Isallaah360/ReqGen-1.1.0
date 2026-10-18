# ReqGen v3.1.11 — Release Notes

**Full project.** Replace your whole project folder with this zip, keeping your `.env.local`. `npm install` adds the `qrcode` library.

## 1. Authenticator QR code now scans

**Cause.** Supabase sends the QR code as an image *address* (a data URI). The setup screens were pasting that address into the page as if it were HTML, so the browser showed text instead of a picture. That is why only the manual key worked.

**Fix.** ReqGen now draws the QR code itself, from the authenticator link Supabase provides. The new shared component is `app/components/AuthenticatorQr.tsx`.

- The code is pure black on white, with a full quiet zone and standard error correction, at 240 px.
- It stays readable in dark mode.
- I tested it: a generated code decodes correctly with a standard QR reader, at full size and at 240 px.
- On a phone, **Open in authenticator app** adds the account without scanning.
- The setup key is grouped in fours with a **Copy key** button, and three plain-language steps sit under the code.
- It is used on both **2FA setup** (first sign-in) and **Profile → Security → Replace authenticator**.

## 2. Routing Engine: one page for every department

The page is at Admin → **Routing Engine**. The previous page is kept as **Advanced Routing**, for templates, backups and away cover.

**Departments list.** Each department shows its current official route, and either "Ready" or a warning when a step is set to *hold* with no officer.

**Step matrix.** The rows are PO, DOD / Director, HOD, DIN Admin, HR and Registrar. The columns are Official, Personal Fund and Personal Other.

- Switch any step **ON** or **OFF** for each type.
- For each step, choose *If vacant: skip* or *If vacant: hold*.
- **DG, Account and HR Filing are fixed** by IET rules, and the page shows them locked:
  - DG is always included.
  - Account comes right after DG on Official and Personal Fund.
  - HR Filing is last on personal requests.

**Who acts.** Choose the officer for each step in this department: PO, DOD, HOD, DIN Admin, HR, Registrar and DG. Any step left blank uses the institution default from Admin → System Settings.

**Exact route.** A live chain for each request type shows every step, the officer who will receive it, and any step that would be skipped or would *hold*.

**Copy to other departments.** This copies the ON/OFF steps and hold rules; each department keeps its own officers.

**Save** is one validated database action. It creates a **new route version**: requests already moving keep the route they started with, and new requests follow the new one.

**Notifications** are unchanged. Each officer is notified in the app (plus SMS and email where enabled) when a request reaches them, and the requester is notified of every decision.

**Database.** Run `database/v3_1_11_routing_engine_v2.sql` in Supabase. Rows 1 to 5 should say OK.

- It adds a table for department step officers.
- The route resolver now uses the department officer first, then the institution officer, then backups.
- It adds the save and overview functions.
- It is safe to re-run and safe while staff are working.

**Tests.** I ran the SQL as one script on a test database built from the real v3.0.5 routing engine:

- A non-Admin is refused.
- Steps are always put in the institutional order: PO → DOD → HOD → DIN Admin → HR → Registrar → DG → Account → HR Filing.
- The chosen officers resolve correctly in the route.
- PO, DOD and HOD are copied back to the department record.
- Each save creates a new version.
- Re-running the file is safe.

## Deploy

```
npm install
npm run lint
npm run typecheck
npm run build
git status
git add -A
git commit -m "ReqGen v3.1.11: scannable 2FA QR code, one-page Routing Engine"
git push origin main
```

Then run `database/v3_1_11_routing_engine_v2.sql` in Supabase.

## New audit

`npm run audit:v3111` runs 7 checks and is added to `audit:production`.
