# ReqGen v4.1.1 — "Reject" sends the request back

**Full project** (includes v4.0.0 and v4.1.0). Replace your project folder with this zip, keeping your `.env.local`.

## What changes
- **Reject now sends the request back with a reason, instead of closing it** (Build Reference §5). The button reads **"Reject and send back"**. A reason is required.
  - **Rejected by the Director General** → it goes back to the officer whose approval sent it to the DG (for example the HOD). That officer either corrects and approves it again to the DG, or rejects it back to the requester.
  - **Rejected by any other officer** → it goes back to the requester.
  - Reserved funds **stay reserved** while the request is being corrected.
- **The requester sees "Back with me"** in My Requests and, on the request, three buttons: **Correct the request**, **Send it back corrected** (it returns to the officer who sent it back), and **Withdraw**.
- **Withdraw**: the requester can withdraw any of their requests before it reaches the DG. Reserved funds are released. A reason is required and recorded.
- A request sitting with its requester is not counted in anyone's Approvals.
- The routing engine and the existing approval functions are **not changed**.

## Deploy — in this order
```
npm install
npm run lint
npm run typecheck
npm run build
git add -A
git commit -m "ReqGen v4.1.1: Reject sends the request back; correct, resend or withdraw"
git push origin main
```
When Vercel shows **Ready**, run `database/v4_1_1_return_resubmit.sql` in the Supabase SQL Editor. All 6 rows say OK. Safe to run again.
Until it runs, Reject still works the old way (the request closes).

## Tested
- On a test database with the real rules: DG rejects → back to the HOD at the HOD step; HOD rejects → back to the requester; requester sends it back corrected → it returns to the HOD; withdraw → closed and the ₦5,000 reservation released; a closed request cannot be sent back. Six history lines and three notifications written. SQL re-run safely.
- lint, typecheck, production build, every release audit including the new `audit:v411` (9 checks).
