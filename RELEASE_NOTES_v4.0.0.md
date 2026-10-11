# ReqGen v4.0.0 — the new IET look, mother pages, fingerprint and passcode sign-in

**Full project.** Replace your whole project folder with this zip, keeping your `.env.local`.
Then run `node scripts/cleanup-v4.0.0.mjs` once (it removes retired files).

## 1. What changes for everyone

- **New app frame from the approved mock-ups**: left menu with the ten modules (Offices, Oversight), approval and notification counts, collapse on laptops, drawer on phones; top bar with greeting, search, bell, "Acting as" and account menu; loading bar below the top bar; breadcrumb on every page; footer with IET, the version, the 2FA window and "Powered by Barderian Enterprises".
- **Mother pages**: every module opens on a page of tiles with live numbers. The old front pages moved one step down:
  Requests › My Requests, Approvals › Requests to Approve, Finance › Finance Overview, Payment Vouchers › Voucher Centre, Registry › Registry Centre, Reports › Reports Centre, Audit › Audit Log, Administration › System Overview, My Account › Profile.
- **New pages**: Home (Dashboard), Notifications, My Account, Security & Devices, Passcode, sign-in, 2FA, first-time security set-up, reset password.
- **IET brand everywhere**: tab icon, phone icon, app colour, home page and sign-in. Barderian Enterprises appears only in the footer.
- **Light and dark mode** kept (account menu › Appearance).
- Pages not yet rebuilt keep working inside the new frame with the v4 header and stat cards. Their full redesign follows in 4.1 – 4.6.

## 2. Sign-in

- **Fingerprint** (Windows Hello, Touch ID, phone fingerprint): add it in My Account › Security & Devices or during first set-up. It signs you in and counts as the 2FA check for 12 hours.
- **Passcode**: a 6-digit passcode joined to one trusted device. Easy codes are refused, five wrong tries remove it, only a scrambled copy is stored, and setting it signs out every other device. 2FA is still asked every 12 hours.
- Password + 2FA code still work on any device.

## 3. Names and payments

- **PO is now PD (Program Director)**; **HR Boss is now HR Coordinator**; DIN Admin everywhere.
- **Payment methods: Bank Transfer, Cheque, Cash only.** POS is removed from the methods and from the standard account list.
- The routing engine itself is **not changed**.

## Deploy — in this order

```
npm install
npm run lint
npm run typecheck
npm run build
git status
git add -A
git commit -m "ReqGen v4.0.0: new IET frame, mother pages, fingerprint and passcode sign-in, PD and HR Coordinator"
git push origin main
```

1. Any time (safe with v3 or v4): `database/v4_0_0_step1_finish_cleanup.sql`.
2. **As soon as Vercel shows Ready**: `database/v4_0_0_step2_standardise.sql`. It renames PO → PD and HR Boss → HR Coordinator in the data, rules and functions (old versions backed up first), removes POS, marks the Super Admin and Developer accounts, and creates the fingerprint and trusted-device tables. Every row of the table at the end says OK. Running it twice is safe.
   Between the push and this step (about a minute) the routing pages and fingerprint/passcode set-up wait for the database; everything else works.

## Tested

- lint, typecheck, production build, every release audit including the new `npm run audit:v400` (48 checks).
- Browser at laptop (1440), tablet (820) and phone (390): no sideways scroll; light and dark; menu drawer; bell panel; no hydration errors.
- SQL step 2 on a copy of the database logic: all rows OK, re-run safe.
