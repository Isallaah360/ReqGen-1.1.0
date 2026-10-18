# ReqGen v3.1.13 — Payment Voucher engine stabilised

**Full project.** Replace your whole project folder with this zip, keeping your `.env.local`.
Then run `database/v3_1_13_pv_engine_stable.sql` in Supabase. It is self-contained: it includes everything from v3.1.12, so you do not need to run v3.1.12 first.

## Why the Auditor could not check the voucher

There were two causes, and both are fixed.

1. **The check waited for the signers.** The database refused the Auditor's check until the Account Officer had chosen the Cheque Signer and Counter Signer. If they were not chosen, the voucher stood still. That is the "locked" state.
2. **Pages follow the role you are "acting as".** An Auditor whose main role is Staff, or who switched to Staff, could not open Payment Voucher pages at all. Her notification links also opened those pages.

## What changed

**For the Auditor**

- The Auditor can **always** check a voucher that is waiting for the check.
- A **"Your action"** card sits at the top of the voucher, with a comment box and a **Check and sign as Auditor** button.
- After the check, the voucher moves on to the Cheque Signer. If the signers are not chosen yet, the Account Officer is told in the app to choose them, and the voucher moves as soon as they do.

**Lists and links**

- A **"N voucher(s) waiting for you"** panel appears on **Approvals** and on every Payment Voucher tab, for the Auditor, the Cheque Signer, the Counter Signer and the DG. Each item has a button that opens the voucher.
- Every voucher link and notification now opens under **Approvals → Voucher Signing**, which every signer can open whatever role they are acting as. Old links to `/payment-vouchers/<id>` are re-routed there automatically.
- A voucher opens by **any role you hold** (Admin, Auditor, Account Officer) or by **any part you play on it** (preparer, checker, signer, DG), not only by your active role.

**For the Account Officer**

- The signers can be chosen or corrected **until the Cheque Signer signs**. Before, this was only possible before the check.

**For Admin (oversight, no signing)**

- **Payment Vouchers → 2. Pending Signatures** shows every unsigned voucher, where it is and for how long, with a **Remind** button.
- On any voucher, **"Now with: …"** shows who holds it, with a **Send reminder** button (in-app, plus SMS and email where enabled). The Auditor and the Account Officer have the same button.

## Tests

I ran the full chain on a test database built from your real voucher functions, with the Auditor's main role set to **Staff**. The Auditor:

1. saw the voucher in her list;
2. opened it and read its history;
3. **checked it before any signers were chosen**.

The Account Officer then chose the signers, and the voucher went on to the Cheque Signer, the Counter Signer, the DG and Paid, with all six names filled in.

The tests also confirmed:

- a Cheque Signer cannot sign before the signers are set;
- a stranger is refused access to the voucher;
- the SQL file is safe to re-run.

In a browser, an Auditor acting as Staff who opened an old voucher link landed on the voucher under Approvals and saw the **Check and sign** button.

## Deploy

```
npm install
npm run lint
npm run typecheck
npm run build
git status
git add -A
git commit -m "ReqGen v3.1.13: stable payment voucher signing engine"
git push origin main
```

Then run `database/v3_1_13_pv_engine_stable.sql`. Rows 1 to 4 should say OK. The rows marked "NOW WITH" list every unsigned voucher and who holds it now.
