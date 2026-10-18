# ReqGen v4.6.4 — step-by-step deployment guide

Follow the parts in order. Each part says what you should see when it worked. Do not skip
Part 1 — it is your safety copy.

You need: the file `reqgen-web_v4.6.4.zip`, your GitHub repository for ReqGen, your Vercel
project, and your Supabase project. Sign in to GitHub, Vercel and Supabase in your browser first.

---

## Part 1 — Safety copy (10 minutes)

1. Open ReqGen as the **Super Admin**. Go to **Audit › Master Backup**.
2. Click **Back up now**. Wait for "Backup stored".
3. Under the financial years, click **Download** for the current year and keep the zip file on
   your computer (for example in `Documents\ReqGen backups`).
4. In GitHub, open your repository. Click the **branch** button (it says `main`) → type
   `backup-before-v4.6.4` → click **Create branch: backup-before-v4.6.4 from main**. This keeps the current code.

✅ You now have a copy of the data and a copy of the code.

---

## Part 2 — Put the new code on GitHub (15 minutes)

**Important:** v4.6.3 *deleted* 50 old files and v4.6.4 *moves* the v4.6.3 notes into `docs/releases/`. If you only copy
the new files on top of the old folder, the old files stay. So the folder must be emptied first
(except the hidden `.git` folder and your private `.env.local`, if you have one).

### Option A — with Git on your computer (recommended)

1. Open the folder where your ReqGen repository is on your computer (for example
   `C:\Projects\reqgen-web`). Make sure it is on the `main` branch and up to date:
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
2. Delete everything in the folder **except** the hidden `.git` folder and `.env.local`
   (if you have it). In File Explorer: View → Show → Hidden items, select everything except
   those two, and press Delete.
3. Unzip `reqgen-web_v4.6.4.zip` **into that same folder**, so `package.json`, `app`, `lib`,
   `database` and `RELEASE_NOTES_v4.6.4.md` sit directly in it (not inside an extra folder).
4. In the same folder, run these one after another. Each must finish without "error":
   ```
   npm install
   npm run lint
   npm run typecheck
   npm run build
   npm run audit:deploy
   ```
   (`npm run build` needs your Supabase URL and anon key in `.env.local`. If you do not keep a
   `.env.local`, skip `npm run build`; Vercel builds it in Part 4.)
5. Send it to GitHub:
   ```
   git add -A
   git commit -m "ReqGen v4.6.4: opening balances, account recalculation, over-allocation check, passcode typed with the device keyboard"
   git push origin main
   ```

✅ GitHub shows the commit "ReqGen v4.6.4 …" on `main`, and the top level shows
`RELEASE_NOTES_v4.6.4.md` (not v4.6.3).

### Option B — with GitHub Desktop

1. In GitHub Desktop choose your ReqGen repository, branch `main`, click **Fetch origin**
   then **Pull origin**.
2. Click **Repository → Show in Explorer**. Do steps 2 and 3 of Option A in that folder.
3. Back in GitHub Desktop you will see many changes (new, changed and deleted files). Type the
   summary `ReqGen v4.6.4`, click **Commit to main**, then **Push origin**.

---

## Part 3 — Vercel settings (10 minutes; skip 3a and 3b if you already did them for v4.6.3)

### 3a. Add `CRON_SECRET` (needed for the nightly backup at 02:00 and the daily reminders)

1. Go to <https://vercel.com>, open your **ReqGen project**.
2. Click **Settings** (top menu) → **Environment Variables** (left menu).
3. Make a secret: any long random text with letters and numbers, at least 32 characters, for
   example from a password generator. Do not use spaces. Keep a copy in a safe place.
4. In **Key** type exactly: `CRON_SECRET`
5. In **Value** paste your secret.
6. Under **Environments** tick **Production** (you may also tick Preview).
7. Click **Save**.

You never type this secret anywhere else: Vercel sends it to ReqGen automatically when it runs
the nightly job (it is set in `vercel.json` to run at 01:00 UTC = 02:00 Lagos).

### 3b. Check or add `NEXT_PUBLIC_APP_URL`

1. On the same page, look for the key `NEXT_PUBLIC_APP_URL`.
2. Its value must be **exactly** the web address people use to open ReqGen, starting with
   `https://` and **without** a `/` at the end. Examples:
   - `https://reqgen.iet.org.ng`  (if you use your own domain)
   - `https://reqgen-web.vercel.app`  (if you use the Vercel address)
   To find it: Vercel project → **Domains** (or the address on the project's Overview page).
3. If it is missing: **Add New** → Key `NEXT_PUBLIC_APP_URL`, Value your address, tick
   **Production**, **Save**.
4. If it exists but is different from the address people use (for example `www.` missing, or a
   `/` at the end), click the **⋯** next to it → **Edit**, correct it, **Save**.

This matters: fingerprint sign-in, reminder links and password-reset emails use this address.
If it does not match exactly, fingerprints stop working.

### 3c. Keep the existing values

Do not change `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `MFA_TRUST_SECRET` / `OTP_HASH_SECRET` or the `SENDCHAMP_*` values.

### 3d. Redeploy so the new values are used

1. Click **Deployments** (top menu). The newest one should be your "ReqGen v4.6.4" commit.
2. Wait until its status is **Ready** (green). If it shows **Error**, open it, copy the red
   lines and send them to me — do not continue.
3. Because you added or changed variables, click the **⋯** on that newest deployment →
   **Redeploy** → **Redeploy**. Wait for **Ready** again.

✅ Open ReqGen. The footer shows **ReqGen v4.6.4**.

---

## Part 4 — Supabase database (10 minutes)

1. Go to <https://supabase.com/dashboard>, open the ReqGen project → **SQL Editor** → **New query**.
2. **Only if you have NOT run it before:** open `database/v4_6_3_finance_integrity_reset.sql` from
   the zip in Notepad, select all, copy, paste into the editor, click **Run**. Every row in the last
   column must say OK. (Running it again is harmless if you are not sure.)
3. **New query.** Open `database/v4_6_4_finance_opening_balances.sql` in Notepad, select all, copy,
   paste, click **Run**.
4. The result is a table of 9 rows. **Every row in the last column must say OK.** If any row does not
   say OK, or a red error appears, stop and send me a screenshot — the file runs in one
   transaction, so nothing will have changed. If it says "Run database/v4_6_3_… first", do step 2.

✅ Every row says OK.

---

## Part 5 — Clean up the finance figures (20 minutes, in this order)

This keeps the 2026/27 subheads and allocations you already entered. Do **not** use Financial
Reset for this: it would set those allocations back to ₦0.00.

Sign in as the **Auditor** (or the Super Admin), acting as Auditor, and open
**Finance › Finance Integrity**. You will see up to four groups.

### Step 1 — Subheads: remove the ₦3,000,000 on DIN FORD
1. In **Subheads**, find **DIN 27 — DIN FORD · Spent · ₦3,000,000.00 · Records support ₦0.00**.
2. If the money was really paid, stop and tell me — it must be recorded, not corrected. If it was
   test data deleted by hand, tick the box at the start of the line.
3. Click **Correct 1 subhead to the records**, write the reason (for example "Pilot test records
   were deleted by hand in Supabase; no record supports this amount."), click
   **Confirm with 2FA and correct**, type your 2FA code.
4. The Subheads group disappears.

### Step 2 — IET accounts: work the account figures out again
1. In **IET accounts** (ALLI, Admin and DIN Account are expected), click **Choose every account**.
2. Click **Recalculate 3 accounts**, write the reason (for example "Account figures were left over
   after test records were deleted by hand."), confirm with your 2FA code.
3. The IET accounts group disappears. Only "Given to subheads", "Spent", "Reserved" and "Available"
   change; the total fund does not.

### Step 3 — Given more than the fund: enter each account's real fund
1. The group lists each account whose subheads were given more than its fund (today every fund
   is ₦0.00).
2. Click **Bank Accounts** in the red box (Finance › Bank Accounts). For each IET account, click
   **Set fund**, type the amount from the **bank statement**, add a note (for example "Opening fund
   from statement of 30 September 2026"), **Set fund**.
3. Setting the fund writes its own ledger line, so the fund needs no opening line afterwards.
4. Back on Finance Integrity, click **Check again**. An account stays listed only while its
   subheads still hold more than its fund — then either the fund or the allocations need a second
   look with the DG.

### Step 4 — Opening balances: give each allocation its ledger line
1. **Opening balances to record** lists the 57 allocations entered before the ledger had a line for
   them. These are not errors.
2. Check the amounts look right, then click **Record opening balances**, write the reason (for
   example "2026/27 allocations were entered before the ledger was in use."), confirm with your
   2FA code.
3. The group disappears. The lines now show in **Finance › Transaction Centre** as allocations.

✅ Finance Integrity says **Every subhead, IET account and voucher matches the records behind it**
(or only lines you understand). Every step is listed under **Corrections made** and in
**Audit › Audit Log**.

### If you would rather start the pilot at ₦0.00 instead

Use **Administration › Financial Reset** as described in `docs/releases/DEPLOYMENT_GUIDE_v4.6.3.md`
(Part 5, Way 2). It clears everything, including the 2026/27 allocations, after a verified backup.

---

## Part 6 — Check it worked (15 minutes)

Tick each line:

- [ ] Footer shows **ReqGen v4.6.4**.
- [ ] **Finance › Finance Integrity** says every total matches (or only lines you understand).
- [ ] The Finance home "Spent" figure is right.
- [ ] **Finance › Transaction Centre** opens and lists movements (empty right after a reset).
- [ ] **Administration › Financial Reset** opens for the Super Admin; the Developer sees
      "Only the Super Admin can reset the finance records".
- [ ] **My Account**: Profile, Signature & Photo, My Access, My Activity, Setup Guide all have the
      new look; **Help** and **Privacy** (footer) open the new Help page.
- [ ] Sign out and sign in again with the passcode on one phone and one laptop: there is no
      number pad; tapping the boxes opens the phone's number keyboard, and on the laptop you type.
- [ ] **Audit › Master Backup** → **Back up now** shows a new backup in the log.
- [ ] The next morning, the backup log shows a **Nightly backup** at about 02:00
      (this proves `CRON_SECRET` works).

---

## If something goes wrong

- **Vercel deployment shows Error:** open it, copy the red lines, send them to me. ReqGen keeps
  running the previous version until a new one is Ready.
- **SQL shows an error:** nothing was changed (one transaction). Send me a screenshot.
- **Go back to the previous code:** in Vercel → Deployments → the last deployment before v4.6.4 → ⋯ →
  **Promote to Production**. Your code is also in the GitHub branch `backup-before-v4.6.4`.
- **Undo a correction:** corrections never touch the bank fund; tell me the correction number
  (COR-…) and I will give you the exact undo.
- **Undo a financial reset:** Audit › Master Backup → Restore from the "Backup before a financial
  reset" copy.
