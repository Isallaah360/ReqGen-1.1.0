# ReqGen v3.1.12 — Release Notes (pilot blockers)

**Full project.** Replace your whole project folder with this zip, keeping your `.env.local`.

Then run `database/v3_1_12_pv_checker_and_handoffs.sql` in Supabase. Rows 1 to 4 should say OK; any row 5 lists a voucher still waiting for its signing officers. If you have not yet run `database/v3_1_11_routing_engine_v2.sql`, run that first.

## 1. New Request: the Submit button is back

- **Cause:** an old global style hid every `<footer>` inside a page. It was meant for old page footers, but the New Request action bar (Cancel / Save as Draft / Submit Request) is also a footer.
- **Fix:** only the old release footers are hidden now.
- **Also fixed by the same change:**
  - dialog button rows in the Audit Centre
  - the footer on the request document

## 2. Payment voucher: the Auditor could not act ("locked")

- **Cause:** the voucher had no Cheque Signer or Counter Signer yet. The Auditor's button was greyed out, with no explanation.
- **Fix:** the Account Officer now chooses the signing officers in one in-app form on the voucher: **Checker (an Auditor, or "Any Auditor")**, **Cheque Signer** and **Counter Signer**.
- **After generating a voucher,** ReqGen opens that form straight away ("Action needed: choose the signing officers"). It no longer jumps to printing, which is blocked until the voucher is fully signed.
- **The Auditor now sees a clear message** ("…you can check this voucher as soon as they do") instead of a dead button.
- **If a checker is chosen:**
  - only that Auditor can check;
  - the voucher appears only in that Auditor's **Voucher Signing** list;
  - reminders go to that Auditor;
  - the signing tracker shows that Auditor's name.
- **If no checker is chosen,** any Auditor may check. The voucher appears in their lists only once the two signers are set.

## 3. Loading bar back below the top bar

The coloured stripe at the very top no longer animates. The single loading bar runs just below the top bar, as before.

## 4. Text never overlaps

- Module tabs now wrap onto a second line instead of squeezing or scrolling.
- Stat-card labels wrap cleanly.
- The Routing Engine page no longer has a search box inside the department list.
- "Backups & away cover" (the old routing page) is now a button on the Routing Engine page instead of an extra tab.

## Deploy

```
npm install
npm run lint
npm run typecheck
npm run build
git status
git add -A
git commit -m "ReqGen v3.1.12: Submit button, PV signing officers, loader position"
git push origin main
```

## New audit

`npm run audit:v3112` runs 8 checks and is added to `audit:production`.
