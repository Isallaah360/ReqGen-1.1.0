# ReqGen v4.6.9 — deployment guide

There are three parts: check the Vercel settings, deploy the code, then run **one** SQL file.

## 1. Check the Vercel settings (SMS and email)

Open Vercel › the ReqGen project › **Settings › Environment Variables** (Production) and check each setting:

| Setting | What it should be |
|---|---|
| `SENDCHAMP_API_KEY` | Your Sendchamp key. **It must be there.** Without it, nothing is sent. |
| `SENDCHAMP_SMS_ENABLED` | `true`, or delete it. It must **not** be `false`. |
| `SENDCHAMP_EMAIL_ENABLED` | `true`, or delete it. It must **not** be `false`. |
| `SENDCHAMP_SENDER_NAME` | The sender ID approved in Sendchamp. If it is not set, ReqGen uses `IET REQGEN`, which must be approved in Sendchamp. |
| `SENDCHAMP_EMAIL_FROM_EMAIL` | An address on a domain verified in Sendchamp. |
| `NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED` | Delete it, or set it to `true`. It must **not** be `false`. |
| `NEXT_PUBLIC_APP_URL` | The live address, so that the links in messages open ReqGen. |

If you change any of these, the deployment in part 2 picks them up.

## 2. Deploy the code

1. **Back up the code.** In GitHub, create the branch `backup-before-v4.6.9` from `main`.
2. **Bring your folder up to date.**
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
3. **Replace the files.**
   - Delete everything in the folder **except** `.git` and `.env.local`.
   - Unzip `reqgen-web_v4.6.9.zip` into the folder.
4. **Push the code.**
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.9: SMS and email after every officer action, watermark removed, green tick and live alerts, themes, Hijri date, Request Insight, delete deactivated accounts"
   git push origin main
   ```
5. **Wait for Vercel.** The deployment must show **Ready**. Then check that the footer shows **ReqGen v4.6.9**.

## 3. Run the database step

1. Open Supabase › **SQL Editor** › New query.
2. Paste the whole of `database/v4_6_9_request_insight.sql` and press **Run**.
3. A table of 5 rows comes back. Every row should say **OK**.
4. Send a screenshot of the table to Barderian Enterprises.

The file only adds one read-only function and is safe to run again. Until it is run, the Insight panel simply does not appear. Everything else works without it.

## 4. Check it worked

- [ ] **Home page:** it looks the same as before, but without the faint logo watermark behind the card. The sign-in page has no watermark either.
- [ ] **SMS and email:** approve a test request. The next officer should receive the SMS and the email within a minute.
  - If not, run `database/v4_6_9_sms_check_READONLY.sql` and send a screenshot.
  - "failed" with a Sendchamp message points to a Sendchamp problem: the sender ID is not approved, the balance is used up, or the email domain is not verified.
  - No row at all points to a Vercel setting from part 1.
- [ ] **Green tick:** Administration › Departments › Edit › Save shows the green tick in the centre.
- [ ] **Dashboard:** the date line shows the Hijri date, and there is a "Did you know?" line.
- [ ] **My Account:**
  - Appearance › IET green changes the colour, and IET orange brings it back.
  - Milestones are listed.
- [ ] **Request Insight:** the DG opens a request waiting for them and sees the panel with five tabs. Approving shows the IET stamp.
- [ ] **Delete a demo account (Super Admin):**
  1. Open Administration › Staff & Positions and choose one of the three deactivated demo accounts.
  2. Press **Delete permanently**.
  3. If the box says it has history, it stays deactivated. That is expected.
  4. Otherwise type **DELETE**, enter your 2FA code, and press **Delete permanently**.

## To go back

1. In Vercel, go to Deployments, open the last v4.6.8 deployment, choose ⋯, then **Promote to Production**.
2. The database step only added one read-only function, and older code ignores it. To remove it, run:
   `drop function if exists public.reqgen_request_insight(uuid);`

## Results of testing before release

- **Build and checks.** These passed from a clean unzip of the zip: clean install, lint, typecheck, production build, all deploy audits (including the new v4.6.9 lock with 29 checks) and all production audits.
- **New v4.6.9 browser suite: 32 of 32**, run three times. It covered:
  - no watermark;
  - SMS and email attempted for the next officer straight after the DG approved;
  - tick and stamp;
  - live alerts;
  - Hijri date and tip;
  - themes and milestones;
  - Request Insight, including for the requester;
  - deleting accounts, including the refusals.
- **Earlier suites:** v4.6.7 17/17, v4.6.5 22/22, v4.6.4 49/49, v4.6.3 46/46, v4.6 53/53, v4.1.2 25/25, v4.3 42/42, v4.4 29/29, v4.5 47/47, v4.6.6 51/51, v4.6.8 38/38.
- **Every request type end to end: 18 of 18.** FUNDRAISING passes once it has a subhead. Until then, the officer is told to add one, as in the v4.6.8 TO DO.
- **Page crawl:** every page, as every position (10 accounts), 112 pages each. No errors, no "undefined", and no security-rule messages.
