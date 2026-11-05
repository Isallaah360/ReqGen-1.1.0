# ReqGen v4.6.8 — deployment guide

There are two parts: the code first, then **one** SQL file. The Vercel settings do not change.

## 1. Deploy the code

1. **Back up the code.** In GitHub, create the branch `backup-before-v4.6.8` from `main`.
2. **Bring your folder up to date.**
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
3. **Replace the files.**
   - Delete everything in the folder **except** `.git` and `.env.local`.
   - Unzip `reqgen-web_v4.6.8.zip` into the folder.
4. **Push the code.**
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.8: Super Admin sees and sets every Administration setting, one setting shows everywhere, FUNDRAISING paid like General Admin, every request type tested end to end"
   git push origin main
   ```
5. **Wait for Vercel.** The deployment must show **Ready**. Then check that the footer shows **ReqGen v4.6.8**.

## 2. Run the database step

1. Open Supabase › **SQL Editor** › New query.
2. Paste the whole of `database/v4_6_8_admin_access.sql` and press **Run**.
3. A table comes back. Every row should say **OK**, except:
   - **TO DO** rows list departments that have no paying account and Account Officer (or whose officer does not hold the Account Officer position). Set them in Administration › Departments › Edit. DG cannot send their official requests on until this is done.
   - A **CHECK** row means a table has an extra restrictive rule. Send a screenshot of the table to Barderian Enterprises.
4. Send a screenshot of the whole table to Barderian Enterprises.

The file is safe to run again; it only adds.

## 3. Check it worked (as the Super Admin)

- [ ] **Administration › Departments:** real names (no "undefined"), staff numbers, and "Pays from" for the departments you set.
- [ ] **Edit FUNDRAISING:**
  - "Pays from account" shows **the same account as General Admin**.
  - Under it you see the fund, the amount given to subheads, and the balance.
  - Account Officer shows the same officer as General Admin.
- [ ] **Edit any department:**
  - The HOD, DOD and PD lists show every staff member.
  - The Account Officer list shows Account Officers first.
  - Save works, with no "row-level security" message.
- [ ] **Routing Engine › Routes:**
  - Press **Change** on the FUNDRAISING card (or choose FUNDRAISING in the editor).
  - If its steps differ from General Admin's, use **Copy steps from: General Admin**, then **Save route**.
- [ ] **Finance › Subheads › New subhead:**
  - Choose Department **FUNDRAISING**. The funding account fills in as General Admin's account.
  - Add FUNDRAISING's budget lines with their allocations.
- [ ] **A FUNDRAISING staff member raises a request:** it reaches the HOD with the subheads listed.
- [ ] **Muhammad Alhassan, a personal fund request at the HR step:** he can recommend the subhead and approve. His signature reads **HR Coordinator**.

## To go back

1. In Vercel, go to Deployments, open the last v4.6.7 deployment, choose ⋯, then **Promote to Production**.
2. The database step only added rules and functions, and older code ignores them. To remove the added rules, ask Barderian Enterprises. A copy of the earlier rules is in `reqgen_policy_snapshots`.
