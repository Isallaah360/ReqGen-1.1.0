# ReqGen v4.6.3 — step-by-step deployment guide

Follow the parts in order. Each part says what you should see when it worked. Do not skip
Part 1 — it is your safety copy.

You need: the file `reqgen-web_v4.6.3.zip`, your GitHub repository for ReqGen, your Vercel
project, and your Supabase project. Sign in to GitHub, Vercel and Supabase in your browser first.

---

## Part 1 — Safety copy (10 minutes)

1. Open ReqGen as the **Super Admin**. Go to **Audit › Master Backup**.
2. Click **Back up now**. Wait for "Backup stored".
3. Under the financial years, click **Download** for the current year and keep the zip file on
   your computer (for example in `Documents\ReqGen backups`).
4. In GitHub, open your repository. Click the **branch** button (it says `main`) → type
   `backup-v4.6.2` → click **Create branch: backup-v4.6.2 from main**. This keeps the current code.

✅ You now have a copy of the data and a copy of the code.

---

## Part 2 — Put the new code on GitHub (15 minutes)

**Important:** this release *deletes* 50 old files and *moves* old release notes. If you only copy
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
3. Unzip `reqgen-web_v4.6.3.zip` **into that same folder**, so `package.json`, `app`, `lib`,
   `database` and `RELEASE_NOTES_v4.6.3.md` sit directly in it (not inside an extra folder).
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
   git commit -m "ReqGen v4.6.3: finance integrity, Transaction Centre, reversals, Financial Reset, verified backups, v4 pages"
   git push origin main
   ```

✅ GitHub shows the commit "ReqGen v4.6.3 …" on `main`, and the files list no longer shows
`RELEASE_NOTES_v3.1.5.md` at the top level.

### Option B — with GitHub Desktop

1. In GitHub Desktop choose your ReqGen repository, branch `main`, click **Fetch origin**
   then **Pull origin**.
2. Click **Repository → Show in Explorer**. Do steps 2 and 3 of Option A in that folder.
3. Back in GitHub Desktop you will see many changes (new, changed and deleted files). Type the
   summary `ReqGen v4.6.3`, click **Commit to main**, then **Push origin**.

---

## Part 3 — Vercel settings (10 minutes)

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

1. Click **Deployments** (top menu). The newest one should be your "ReqGen v4.6.3" commit.
2. Wait until its status is **Ready** (green). If it shows **Error**, open it, copy the red
   lines and send them to me — do not continue.
3. Because you added or changed variables, click the **⋯** on that newest deployment →
   **Redeploy** → **Redeploy**. Wait for **Ready** again.

✅ Open ReqGen. The footer shows **ReqGen v4.6.3**.

---

## Part 4 — Supabase database (10 minutes)

1. Go to <https://supabase.com/dashboard>, open the ReqGen project → **SQL Editor** → **New query**.
2. *(Optional, read-only)* Open `database/v4_6_3_step0_READONLY_inventory.sql` from the zip in
   Notepad, copy everything, paste into the editor, click **Run**, then **Download CSV**. Keep it
   (and send it to me if you want me to double-check your tables). It changes nothing.
3. New query again. Open `database/v4_6_3_finance_integrity_reset.sql` in Notepad, select all,
   copy, paste into the editor, click **Run**.
4. The result is a table. **Every row in the last column must say OK** (about 13 rows).
   If any row does not say OK, or a red error appears, stop and send me a screenshot — the file
   runs in one transaction, so nothing will have changed.

Only this one SQL file is new. The v4.1.2 – v4.6.0 files are already in your database.

✅ Every row says OK.

---

## Part 5 — Remove the ₦3,000,000 (choose ONE way)

### Way 1 — keep what you already entered for the new year (recommended if the new subheads and allocations are correct)

1. Sign in as the **Auditor** (or the Super Admin), acting as Auditor.
2. Go to **Finance › Finance Integrity**.
3. You will see **DIN 27 — DIN FORD · Spent · Stored ₦3,000,000.00 · Records support ₦0.00**,
   and possibly other differences.
4. Read each line. If the money was **really paid**, do not correct it — tell me and we record it
   properly. If it was test data deleted by hand, tick the box at the start of the line.
5. Click **Correct … to the records**, write the reason (for example "Pilot test records were
   deleted by hand in Supabase; no record supports this amount."), click
   **Confirm with 2FA and correct**, type your 2FA code.
6. The line disappears. The Finance home now shows the true figures. The correction is listed
   under "Corrections made" and in **Audit › Audit Log**.

### Way 2 — clear all finance test data and start the pilot at ₦0.00

1. Sign in as the **Super Admin** and make sure **Acting as** shows **Super Admin**.
2. Go to **Administration › Financial Reset**.
3. **Step 1:** choose what to clear. Finance records are always included. Tick Payment vouchers
   and Requests to clear the test requests too.
4. **Step 2:** read the preview: how many records will be cleared, and what is kept. If a red box
   says "The reset cannot run yet", send me a screenshot.
5. **Step 3:** click **Confirm with 2FA and take the backup**, type your 2FA code, wait for
   **Backup verified**.
6. **Step 4:** write the reason, type `RESET FINANCE` in capital letters, click
   **Confirm with 2FA and reset the finance records**, type your 2FA code.
7. You will see "RST-2026-001 — reset complete and checked" with every figure going to ₦0.00.
8. Then the **Auditor**:
   - **Finance › Bank Accounts** → **Set fund** for each IET account, from the bank statement.
   - **Finance › Budget & Subheads** → open each subhead → enter its allocation for the new year
     (with the bank account and a note) → Save.
   - **Finance › Finance Settings** → **Lock budget** when the budget is approved.

To undo a reset: **Audit › Master Backup** → choose the "Backup before a financial reset" copy →
Restore (Super Admin, 2FA code). It restores everything in one step.

---

## Part 6 — Check it worked (15 minutes)

Tick each line:

- [ ] Footer shows **ReqGen v4.6.3**.
- [ ] **Finance › Finance Integrity** says every total matches (or only lines you understand).
- [ ] The Finance home "Spent" figure is right.
- [ ] **Finance › Transaction Centre** opens and lists movements (empty right after a reset).
- [ ] **Administration › Financial Reset** opens for the Super Admin; the Developer sees
      "Only the Super Admin can reset the finance records".
- [ ] **My Account**: Profile, Signature & Photo, My Access, My Activity, Setup Guide all have the
      new look; **Help** and **Privacy** (footer) open the new Help page.
- [ ] Sign out and sign in again with the fingerprint or passcode on one phone and one laptop.
- [ ] **Audit › Master Backup** → **Back up now** shows a new backup in the log.
- [ ] The next morning, the backup log shows a **Nightly backup** at about 02:00
      (this proves `CRON_SECRET` works).

---

## If something goes wrong

- **Vercel deployment shows Error:** open it, copy the red lines, send them to me. ReqGen keeps
  running the previous version until a new one is Ready.
- **SQL shows an error:** nothing was changed (one transaction). Send me a screenshot.
- **Go back to v4.6.2 code:** in Vercel → Deployments → the last v4.6.2 deployment → ⋯ →
  **Promote to Production**. Your code is also in the GitHub branch `backup-v4.6.2`.
- **Undo a financial reset:** Audit › Master Backup → Restore from the "Backup before a financial
  reset" copy.
