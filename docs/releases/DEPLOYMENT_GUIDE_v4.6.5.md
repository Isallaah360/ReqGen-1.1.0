# ReqGen v4.6.5 — step-by-step deployment guide

You already have v4.6.4 running, with the v4.6.3 and v4.6.4 SQL files run. This release needs the
new code and **one** new SQL file. Vercel settings do not change.

---

## Part 1 — Safety copy (5 minutes)

1. Open ReqGen as the Super Admin → **Audit › Master Backup** → **Back up now**. Wait for
   "Backup stored".
2. In GitHub, click the branch button (`main`) → type `backup-before-v4.6.5` →
   **Create branch: backup-before-v4.6.5 from main**.

---

## Part 2 — Put the new code on GitHub (10 minutes)

1. Open your ReqGen folder (for example `C:\Projects\reqgen-web`) in a terminal and bring it up to date:
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
2. Delete everything in it **except** the hidden `.git` folder and `.env.local` (File Explorer:
   View → Show → Hidden items). This release moves the v4.6.4 notes into `docs/releases/`, so
   copying on top would leave old files behind.
3. Unzip `reqgen-web_v4.6.5.zip` into that folder, so `package.json`, `app`, `lib`, `database` and
   `RELEASE_NOTES_v4.6.5.md` sit directly in it.
4. Run the push code:
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.5: Super Admin finance powers, remove amounts with no record from the Transaction Centre"
   git push origin main
   ```
5. In Vercel → **Deployments**, wait for the "ReqGen v4.6.5" deployment to show **Ready**.

✅ The footer shows **ReqGen v4.6.5**.

---

## Part 3 — Supabase (5 minutes)

1. Supabase → your ReqGen project → **SQL Editor** → **New query**.
2. Open `database/v4_6_5_super_admin_finance.sql` from the zip in Notepad, select all, copy, paste,
   click **Run**.
3. The result has 6 rows; **every row must say OK**. Read the row
   "people who will be treated as Super Admin when acting as Super Admin": it lists names. It
   should show your Super Admin account(s) only. If someone there should not be Super Admin,
   remove that position from them in **Administration › Staff**, and tell me.

If a red error appears, stop and send me a screenshot. Nothing will have changed.

---

## Part 4 — Remove the ₦3,000,000 from DIN FORD (2 minutes)

1. Sign in, and check the top right says **Acting as Super Admin** (or Auditor).
2. Go to **Finance**. Click the **Spent** card.
3. The Transaction Centre opens on the spending list. At the top, **Recorded with no record behind
   it** shows **DIN 27 — DIN FORD · Spent · ₦3,000,000.00**.
4. Click **Remove ₦3,000,000.00**. Write the reason (for example "Pilot test records were deleted
   by hand in Supabase; nothing supports this amount."). Click **Confirm with 2FA and remove** and
   type your 2FA code.
5. You will see "₦3,000,000.00 removed from DIN 27 — DIN FORD". DIN FORD now shows Spent ₦0.00 and
   a balance of ₦10,640,744.00. The Finance home Spent figure drops by ₦3,000,000.

If the button is missing, the page tells you why (for example to switch "Acting as" to Super
Admin). Do that and click **Check again** on Finance Integrity, or reload the page.

Then, when convenient, finish the rest of the clean-up on **Finance › Finance Integrity** as in
the v4.6.4 guide (`docs/releases/DEPLOYMENT_GUIDE_v4.6.4.md`, Part 5, Steps 2–4): recalculate the
IET accounts, set each account's fund from the bank statement, record the opening balances.

---

## Part 5 — Check it worked

- [ ] Footer shows **ReqGen v4.6.5**.
- [ ] Finance › Spent opens the Transaction Centre on spending.
- [ ] DIN FORD shows Spent ₦0.00 and balance ₦10,640,744.00 (Finance › Budget & Subheads).
- [ ] Finance › Finance Integrity lists the removal under **Corrections made**; Audit › Audit Log
      has the line.
- [ ] As the Super Admin, **Administration › Financial Reset** opens (do not run it unless you
      mean to clear all finance records).

---

## If something goes wrong

- **Vercel shows Error:** open it, copy the red lines, send them to me. The previous version keeps
  running.
- **Go back to v4.6.4:** Vercel → Deployments → the last v4.6.4 deployment → ⋯ →
  **Promote to Production**. The code is also in the GitHub branch `backup-before-v4.6.5`.
- **Undo the database step:** not needed — it changes no data. The previous rule is saved in
  `reqgen_function_backups` (release v4.6.5) if it is ever wanted back.
