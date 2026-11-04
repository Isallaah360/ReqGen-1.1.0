# ReqGen v4.6.6 — step-by-step deployment guide

Do the parts in order. **Read Part 4 before running it:** after the database step, your
personal accounts no longer hold the Super Admin position. From then on, ietreqgen@gmail.com
is the only Super Admin. Make sure you can sign in with it, or that its sign-in exists, before
you start.

---

## Part 1 — Safety copy (5 minutes)

1. Open ReqGen with the account you use today → **Audit › Master Backup** → **Back up now**.
   Wait for "Backup stored".
2. In GitHub, click the branch button (`main`), type `backup-before-v4.6.6`, then click
   **Create branch: backup-before-v4.6.6 from main**.

---

## Part 2 — Put the new code on GitHub (10 minutes)

1. Bring your folder up to date:
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
2. Delete everything in the folder **except** the hidden `.git` folder and `.env.local`.
3. Unzip `reqgen-web_v4.6.6.zip` into the folder. `package.json`, `app`, `lib`, `database` and
   `RELEASE_NOTES_v4.6.6.md` must sit directly in it.
4. Run the push code:
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.6: Super Admin and Developer system accounts, Developer Console, module switches, What's new"
   git push origin main
   ```
5. In Vercel → **Deployments**, wait until the "ReqGen v4.6.6" deployment shows **Ready**.

✅ The footer shows **ReqGen v4.6.6**.

---

## Part 3 — Make sure both sign-ins exist (5 minutes)

The database step needs a **sign-in** for each email. It creates the staff record itself.

1. Supabase → your ReqGen project → **Authentication** → **Users**.
2. Look for **ietreqgen@gmail.com** and **info@barderians.com.ng** in the list.
3. **If one is missing:**
   - click **Add user** → **Create new user**;
   - type the email and a strong password;
   - tick **Auto Confirm User**;
   - click **Create user**.
   
   Keep the password safe; you will change it at the first sign-in.
4. **If one exists but you do not know its password:** go to the ReqGen sign-in page, click
   **Forgot password**, type that email, and follow the email sent to its inbox.
   - ietreqgen@gmail.com needs access to that Gmail.
   - info@barderians.com.ng needs access to that mailbox.

---

## Part 4 — Supabase database (5 minutes)

1. **SQL Editor → New query.** If you have not run it yet, run
   `database/v4_6_5a_hotfix_account_recalc.sql`. Every row must say OK.
2. **New query.** Open `database/v4_6_6_system_accounts.sql` from the zip in Notepad, select
   all, copy, paste, click **Run**.
3. Read the result table:
   - **01 superadmin / 01 developer:** each says "staff record created" or "staff record
     repaired" with **OK**. If one says **TO DO** ("NO sign-in exists"), do Part 3 for that
     email, then run this file again.
   - **02 only one Super Admin:** names the personal accounts that held the Super Admin
     position and no longer do. They keep their other positions.
   - **07 check · Super Admin accounts now:** must list only ietreqgen@gmail.com and
     info@barderians.com.ng, with **OK**.
   - Every other row: **OK**.

If a red error appears, stop and send me a screenshot. The file runs in one transaction, so
nothing will have changed.

---

## Part 5 — Sign in with each system account (10 minutes)

### The Super Admin
1. Sign out. Sign in with **ietreqgen@gmail.com** and its password.
2. The Setup Guide asks for only two things:
   - your own password: if it was a temporary one, change it;
   - 2FA: scan the QR code with an authenticator app and type the code.
   
   No signature and no photo are needed.
3. The top right shows **Acting as Super Admin**. Open Administration, Finance and Audit to
   check they open.
4. **Remove the ₦3,000,000:**
   - go to Finance › **Spent** → **Remove ₦3,000,000.00**;
   - write the reason, then confirm with your 2FA code;
   - DIN FORD now shows Spent ₦0.00 and a balance of ₦10,640,744.00.

### The Developer
1. Sign out. Sign in with **info@barderians.com.ng**. Set its own password and 2FA in the same
   way.
2. You land on the **Developer Console**. It has a navy menu, the "DEVELOPER CONSOLE" badge,
   and the Barderian logo.
3. **Releases** → the version shows v4.6.6. Write a title and what changed → **Publish**.
   - The Super Admin gets a notification.
   - Everyone can read it in **What's new**.
4. **Modules** lets you switch a module off for maintenance, with a message. Switch it on
   again when you finish.

### Your personal account
It is now a normal staff account. It keeps its other positions, such as Registry and PA to
the DG, but no longer holds the Super Admin position.

---

## Part 6 — Check it worked

- [ ] Footer shows **ReqGen v4.6.6**.
- [ ] ietreqgen@gmail.com opens Dashboard, Administration, Finance, Audit and My Access, with
      no "not open to you".
- [ ] info@barderians.com.ng lands on the Developer Console and opens every module.
- [ ] Your personal account cannot open Administration.
- [ ] DIN FORD: Spent ₦0.00, balance ₦10,640,744.00.
- [ ] Audit › Audit Log has a **Developer** tab with the Developer's actions.
- [ ] Administration › System Accounts shows both accounts as **Can sign in**.

---

## If something goes wrong

- **A system account still sees "Your account is not set up yet":** run
  `v4_6_6_system_accounts.sql` again and read rows 01. If it says TO DO, do Part 3.
- **You need the Super Admin position back on a personal account:** the before and after of
  every change is in the table `reqgen_role_changes`. Send me its rows and I will give you the
  exact undo.
- **Vercel shows Error:** copy the red lines and send them to me. The previous version keeps
  running.
- **Go back to v4.6.5:**
  - Vercel → Deployments → the last v4.6.5 deployment → ⋯ → **Promote to Production**;
  - the code is also in the GitHub branch `backup-before-v4.6.6`.
