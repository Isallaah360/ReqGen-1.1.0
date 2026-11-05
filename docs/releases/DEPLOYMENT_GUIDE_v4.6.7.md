# ReqGen v4.6.7 — deployment guide

This is a code-only release. **There is no SQL to run to install it**, and the Vercel settings do not change.

One optional SQL file is included: `database/v4_6_7_request_queue_trace_READONLY.sql`. It only reads data. It changes nothing.

## Install

1. **Back up the code.** In GitHub, create the branch `backup-before-v4.6.7` from `main`.

2. **Bring your folder up to date.**
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```

3. **Replace the files.**
   - Delete everything in the folder **except** `.git` and `.env.local`.
   - Unzip `reqgen-web_v4.6.7.zip` into the folder.

4. **Push the code.**
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.7: clean positions (no permission tokens), separate Official and Personal routing views, read-only request queue trace, code clean-up"
   git push origin main
   ```

5. **Wait for Vercel.** The deployment must show **Ready**. Then check that the footer shows **ReqGen v4.6.7**.

## Check it worked

- [ ] **Muhammad Alhassan, My Account.** Positions show Staff, Registrar and HR Officer. No `hr:...` chips appear.
- [ ] **"Acting as" (top bar).** Only Staff, Registrar and HR Officer are offered.
- [ ] **Super Admin › Administration › Routing Engine › Routes.** There are two buttons:
  - **Official Requests**: shows only the Official lane.
  - **Personal Requests**: shows only Personal Fund and Personal Other.
- [ ] **Change in the Personal view.** The editor has only the Personal Fund and Personal Other columns. Close it with **Cancel** unless you mean to change the route.
- [ ] **Sign-up (from the earlier v4.6.7 build).** The phone number is required, and the name turns into CAPITAL LETTERS.

## The request that is in Registry but not with the HR Officer

Do not edit the request. Find out where it is waiting first:

1. Open Supabase › **SQL Editor** › New query.
2. Paste the contents of `database/v4_6_7_request_queue_trace_READONLY.sql`.
3. In the `params` block near the top, replace:
   - `PUT-REQUEST-NUMBER-HERE` with the request number;
   - `put.officer@email.here` with Muhammad Alhassan's email.
4. Press **Run**. Read the last row, **VERDICT**.
5. Send a screenshot of the whole table to Barderian Enterprises.

The next step depends on the verdict:

- **"waiting with [another officer] at the HR step".** On Personal routes, the HR step goes to the officer named as **HR Coordinator** in the Routing Engine.
  - If Muhammad should receive these requests, the Super Admin sets him as that officer under Routing Engine › Routes › Personal Requests › **Change**.
  - New requests will then come to him.
  - The request already moving stays with its current officer, who acts on it as normal.
- **"Nobody owns the request".** The route has a step with no officer. Report it; nothing is changed automatically.
- **"The request IS with this officer".** Ask him to sign out and in again, and acting as HR Officer, open **Approvals**.

## To go back

Vercel → Deployments → the last v4.6.6 deployment → ⋯ → **Promote to Production**.

Nothing in the database needs to be undone.
