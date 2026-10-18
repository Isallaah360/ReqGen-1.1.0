# ReqGen v3.1.14 — DG signs and authorises in one click · 12-hour 2FA

**Full project.** Replace your whole project folder with this zip, keeping your `.env.local`.
Then run `database/v3_1_14_pv_dg_sign_authorise.sql` in Supabase (v3.1.13 must already be run — it is).

## 1. New payment voucher order

| Step | Who | What they do |
|---|---|---|
| 1 | Account Officer | Prepares the voucher and chooses the **Counter Signer** |
| 2 | Auditor | Checks |
| 3 | Counter Signer | Counter-signs |
| 4 | Director General | **One button: "Sign and authorise"** — the DG's signature goes on the cheque line AND the authorisation line |
| 5 | Account Officer | Marks it paid; the payee's signature is added as "Received by" |

- The **Cheque Signer** step is gone. The generation form and the voucher page now ask only for the Counter Signer (and, optionally, a specific Auditor as checker).
- The Account Officer can change the Counter Signer until the Counter Signer signs.
- Vouchers that were waiting for a Cheque Signer are moved to their Counter Signer by the SQL file. Nothing is deleted and signatures already given are kept. Each moved voucher gets a history line explaining why.
- The signing tracker, "Waiting for you", reminders, print messages and PV Settings all show the new order.

## 2. Two-factor once every 12 hours

- When you enter your authenticator code, that code keeps you verified **on that device for 12 hours**.
- Inside the 12 hours, signing in again (for example after the 15-minute inactivity sign-out) asks only for your password. No new code is needed.
- **When the 12 hours end, ReqGen signs you out completely** and asks for your password and a new code.
- The 12 hours start from the moment Supabase recorded your code, so the window can never be stretched.
- The window is kept in a **server-signed, httpOnly cookie** that only ReqGen's server can create. It cannot be copied into another browser by hand.
- **Replacing your authenticator** (Profile → Security) ends every window and signs out every device using your account. Anyone who stole your password is removed at once; a session that was already open elsewhere is closed within about five minutes. Changing your password also signs out every device.

Optional: you can set `MFA_TRUST_SECRET` in Vercel to a long random value. If you do not, ReqGen uses your existing server secret.

## Tested

- Local PostgreSQL with the real functions: new voucher → Auditor check → Counter Signer → DG "Sign & Authorise" (cheque and authorised lines both carry the DG's signature) → Paid.
- A voucher left at "Pending Cheque Signature" was moved to its Counter Signer and finished the chain.
- Refused correctly: Counter Signer before the check, the old Cheque Signer, a non-DG authorising, changing the Counter Signer after they signed.
- SQL file re-run safely (0 vouchers moved the second time).
- Browser: the DG sees **"Your action: Sign and authorise"** and a 4-signature chain; lint, typecheck, build and every release audit (v3.1.5 → v3.1.14) pass.

## Deploy

```
npm install
npm run lint
npm run typecheck
npm run build
git status
git add -A
git commit -m "ReqGen v3.1.14: DG signs and authorises in one step; 12-hour 2FA window"
git push origin main
```

Then run `database/v3_1_14_pv_dg_sign_authorise.sql`. Rows 1 to 4 should say OK; row 5 lists the DG(s) with a saved signature. If row 4 says RUN AGAIN, the table was busy — just run the file again.
