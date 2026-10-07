# ReqGen v3.1.8 — Release Notes

Builds on v3.1.7. No files were removed. A new library, `fflate` (zip), is installed by `npm install`.

## 0. Fix: v3.1.7 SQL deadlock (rev 2)

- The v3.1.7 SQL collided with live app traffic and PostgreSQL stopped it with "deadlock detected". Everything was rolled back, which is why Pending Signatures showed "Could not find the function public.reqgen_pv_tracker".
- Rev 2 takes its lock on `payment_vouchers` first, before anything else, and waits at most 10 seconds. If it ever reports "lock timeout", just run it again.
- It was tested with a reader holding the table open at the same time: it waited, then completed.

## 1. Master Backup & Restore (Audit Centre → 2)

This page is for Admin and the Auditor.

**Download** a backup for one financial year (1 Jan – 31 Dec, by record date) or for all years. It is one zip file containing:

- `00_README.txt`, which explains how to read and restore the backup.
- `01_MANIFEST.csv`, listing every table with its row count and status.
- `02_REQGEN_MASTER.csv`, with every record in one sheet (table, id, date, summary, full data). Filter it in Excel for manual audit.
- `tables/NN_<table>.csv`, one full sheet per table (33 tables):
  - user accounts and roles
  - requests, approvals and signatures
  - payment vouchers, items, signing and reminder history, and PV signatories
  - subheads and balances, expenditure transactions, the bank ledger, and bank accounts and balances
  - department account routing and workflow routes
  - registry, settings and the audit log

**Restore** from the zip (or from its master CSV):

- **Preview** (Admin or Auditor) shows, for each table, what is in the file and what is missing in ReqGen now.
- **Restore missing records** (Admin only) adds back only the records that are gone.
- **Overwrite with backup** (Admin only) also replaces existing records with the backup copy.
- Nothing is ever deleted. Restored requests and vouchers can be printed again, because the signature and attachment files stay in storage and the backup keeps their paths.

A **backup log** records every download, preview and restore.

## 2. Account Setup Guide (Profile → 2)

The guide has four steps, each checked from real data:

1. Own password.
2. Authenticator (2FA).
3. Profile photo.
4. Signature (required).

Each step explains why it matters, gives numbered plain-language instructions written for non-technical staff, and has a **Take me there** button.

- **On-page coach:** the target page opens with a floating card that repeats the steps and highlights the right section. It turns green when the step is done.
- **Banner:** while anything is missing, a slim bar under the top bar says what is missing, and it is orange when a required step is missing.
- **Welcome dialog:** once per sign-in session, a centred dialog offers to start the guide.
- Changing your password now records it, so the step ticks itself. People who already changed it can confirm with **I already changed it**.

## 3. Payment Vouchers

- Each tab now introduces itself: Voucher Centre, Pending Signatures, Ready to Pay, Voucher History and Print Centre.
- The create buttons appear only on the Centre.
- Once the v3.1.7 rev 2 SQL runs, the signing tracker, reminders and Print Register work.

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
   git commit -m "ReqGen v3.1.8: master backup and restore, account setup guide, PV fixes"
   git push origin main
   ```

3. In Supabase, run in this order, sending a screenshot of each:
   1. `database/v3_1_7_registers_tracker_manual_pv.sql` (rev 2). Rows 1 to 5 should say OK.
   2. `database/v3_1_8_master_backup_log.sql`. Rows 1 to 3 should say OK.

## New audit

`npm run audit:v318` runs 12 checks and is added to `audit:production`.
