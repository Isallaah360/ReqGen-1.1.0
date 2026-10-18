# ReqGen v3.1.7 — Release Notes

Builds on v3.1.6. No files were removed, so no cleanup script is needed.

Run `database/v3_1_7_registers_tracker_manual_pv.sql` after deployment.

## Payment Vouchers: each tab has its own job

1. **Voucher Centre:** the overview (KPIs, register, summary).
2. **Pending Signatures:** a signing tracker.
   - It shows five steps (Prepared → Checked → Cheque signer → Counter signer → DG) for every unsigned voucher.
   - Each voucher shows who it is waiting for, how long it has waited (amber after 1 day, red after 3), and the last reminder.
   - The step counts at the top act as filters.
   - **Remind** sends an in-app alert, an SMS and an email to whoever holds the step, logs the delivery and records it in the voucher history. It can be used once per voucher every 30 minutes.
3. **Approved:** "Ready to pay". Fully signed vouchers with totals by mode, plus Print and Mark-paid buttons.
4. **History:** paid and cancelled vouchers grouped by month, with monthly totals.
5. **Print Centre:** print cards for fully signed vouchers only. A note shows how many are still being signed.

Quick Actions now show only what the user can open. Account Officers see Signing Tracker and Download CSV. Voucher Report and PV Settings appear only for the Auditor and Admin.

## Manual vouchers

- No voucher, manual or generated, can be created without the preparer's saved signature. The signature is attached automatically.
- Posting a manual voucher still deducts the account and subhead balances. It now also sends the voucher into the same signing chain:
  1. The Account Officer assigns the signers.
  2. The Auditor checks it.
  3. The Cheque Signer and Counter Signer sign.
  4. The DG authorises it.
  5. It is marked paid.
- A posted manual voucher can no longer be edited. Posted rows open the voucher.
- Manual vouchers that were already posted join the chain.

## Print Register (Requests → 3)

The register is now built on the server (`reqgen_print_register`), so nothing is hidden by partial table access.

- **Requesters:** their own completed requests.
- **Account Officers:** every request they treated, whether a PV exists or not. A new **Voucher** column shows the PV number or "Not yet".
- **Auditor / Admin:** every request treated by Accounts.

## Layout

New Request, and every other page that used a full-height layout, no longer slides over the footer.

## Deploy order

1. Copy the zip over the project folder and choose Replace.
2. Push:

   ```
   npm install
   npm run lint
   npm run typecheck
   npm run build
   git status
   git add -A
   git commit -m "ReqGen v3.1.7: PV tabs, signing tracker and reminders, manual PV chain, print register"
   git push origin main
   ```

3. In Supabase, run `database/v3_1_7_registers_tracker_manual_pv.sql`. Rows 1 to 5 should say OK. Rows numbered "6." list posted manual vouchers whose preparer has no signature.

## New audit

`npm run audit:v317` runs 8 checks and is added to `audit:production`.
