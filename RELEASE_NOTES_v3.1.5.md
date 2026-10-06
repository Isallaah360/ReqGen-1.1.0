# ReqGen v3.1.5 — Release Notes

Fix release on top of v3.1.4. No pages were added or removed, so no cleanup script is needed.

## Fixes

1. **Payment voucher generation** (`record "v_cheque_signer" is not assigned yet`).
   Database fix in `database/v3_1_5_voucher_signer_and_queue_repair.sql`.
   - It backs up the original voucher functions to `public.reqgen_function_backups`.
   - It then makes the signer and counter-signer records safe for Transfer and Cash.
   - Cheque behaviour is unchanged.
2. **Approvals consistency.** One rule (`lib/approvalQueue.ts`) now drives the Approvals list, the bell badge, the access gate and the Process screen.
   - "Waiting for you" means you own the request, or you are the attached Account Officer at the Account stage.
   - Requests at your stage that are held by another officer appear as a notice.
   - History lists the requests you personally acted on.
3. **In-app dialogs.** All 24 browser `confirm`/`prompt` pop-ups are replaced by centred ReqGen dialogs (`lib/dialog.ts`, `DialogHost`).
   - Dialogs have titles, named action buttons, a red style for deletions, keyboard support and dark mode.
4. **Signatures.** The new Signature Ink Engine (`lib/signatureInk.ts`, `SignatureInk`) removes the paper background, deepens the ink and trims empty space.
   - Signatures sit in fixed slots: 54px on the request print and 40px on the voucher print. They can no longer cover the document.
   - The Profile page cleans new signatures before saving them.

## New audit
`npm run audit:v315` runs 20 checks and is added to `audit:production`.

## Files
- **New:** `lib/dialog.ts`, `lib/signatureInk.ts`, `app/components/ui/DialogHost.tsx`, `app/components/ui/SignatureInk.tsx`, `scripts/audit-v3-1-5.mjs`, `database/v3_1_5_voucher_signer_and_queue_repair.sql`
- **Changed:** see the zip contents (layout, globals and theme CSS, approvals, request workspace and gate, print pages, profile, payment voucher pages, admin and finance pages that used browser pop-ups, version files).

## Deploy order
1. Copy the zip over the project folder and choose Replace.
2. Run `npm install`, `npm run lint`, `npm run typecheck` and `npm run build`.
3. Commit and push.
4. In the Supabase SQL Editor, run `database/v3_1_5_voucher_signer_and_queue_repair.sql`. Every row should say OK. Rows numbered "5." list requests for your review.
5. Re-upload any signature that still shows a heavy background. Most existing signatures are cleaned automatically when shown.
