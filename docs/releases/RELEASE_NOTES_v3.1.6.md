# ReqGen v3.1.6 — Release Notes

A standardisation release on top of v3.1.5. No files were removed, so no cleanup script is needed.

## 1. Payment Voucher signing chain (database + app)

Run `database/v3_1_6_pv_signing_chain.sql` after deployment.

The signing order is:

1. Prepared by the Account Officer.
2. Checked by an Auditor.
3. Signed by the Cheque Signer.
4. Counter-signed by the Counter Signer.
5. Authorised by the Director General.
6. Paid.

How it works:

- Every mode (Transfer, Cash and Cheque) needs a Cheque Signer and a Counter Signer.
- Each signature is added at its own step, and the next signer is notified in the app.
- "Received by" uses the payee's saved signature when Account marks the voucher paid.
- A voucher can be paid and printed only after the DG has authorised it.

The SQL file does the following:

- Removes the old automatic "Checked" and "Authorized" stamps.
- Resets unpaid request vouchers that were auto-stamped to "Pending Check". Manual vouchers are not touched.
- Backs up the original functions to `public.reqgen_function_backups`.
- Is safe to re-run.

## 2. Voucher detail page rebuilt

- A six-step signing tracker shows each signature as it is added.
- A Sign button appears only for the person whose turn it is.
- Account can assign or change the signers until the Auditor checks the voucher.
- The page also has the voucher history, plus Pay, Cancel and Delete controls.
- The DG, Cheque Signer and Counter Signer sign from **Approvals → 2. Voucher Signing**.

## 3. A4 documents

- The request and the PV are each exactly one A4 page (210 × 297 mm), centred, with even margins and larger text.
- A long document is scaled down to fit. A short one is stretched to fill the page, with signatures at the foot.
- Printing uses an isolated frame, so the app frame can no longer affect paper.
- "Checked by" now accepts any forward decision ("Approve", "Approved", "Recommended" and so on).
- Dates print in British style.
- Faint signatures are strengthened automatically.

## 4. Numbered tabs

- **Payment Vouchers:** 1 Voucher Centre, 2 Pending Signatures, 3 Approved, 4 History, 5 Print Centre, 6 Create Manual Voucher, 7 PV Settings. A **Manual Voucher** button also sits on the Centre.
- **Requests:** 1 My Requests, 2 New Request, 3 Print Register.
- **Approvals:** 1 Approvals Inbox, 2 Voucher Signing.
- On Payment Vouchers, "Approved" now means fully signed by the DG. The tabs, KPIs and donut all use the same rule.

## 5. Manual voucher

- Choose **1. Department** first.
- **2. IET Account** then lists only the accounts attached to that department, through Account Routing or its subheads.

## 6. Print Register (Requests → 3)

- **My completed requests** is available to every requester. Requesters can now print and save their own completed requests.
- **Treated by me** is for Account Officers.
- **All treated requests** is for the Auditor and Admin.

## Deploy order

1. Copy the zip over the project folder and choose Replace.
2. Run `npm install`, `npm run lint`, `npm run typecheck` and `npm run build`.
3. Commit and push.
4. In Supabase, run `database/v3_1_6_pv_signing_chain.sql` and send the screenshot.
   - Rows 1 to 10 should say OK.
   - Rows numbered "11." list vouchers that need signers. Open each one as the Account Officer and assign the Cheque Signer and Counter Signer.
5. Routing: General Admin has no HOD, so the HOD step is skipped and "Checked by" stays empty. Assign a HOD in Admin → Routing Engine, and set HOD to Block if checking must always happen.

## New audit

`npm run audit:v316` runs 18 checks and is added to `audit:production`.
