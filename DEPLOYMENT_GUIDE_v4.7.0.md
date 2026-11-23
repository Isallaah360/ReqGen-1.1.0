# ReqGen v4.7.0 and app 2.0.0: update guide

**From:** v4.6.12. **Time:** about 40 minutes (website 15, database 5, app 20).

This release does seven things:

1. **One code for every send and every decision.** Sending a request (Official, Personal or Direct), approving, sending back, declining and forwarding all need a 6-digit code. ReqGen sends it by SMS (sender ReqGen) and by e-mail at the same time; either one works. The database checks it, so no page and no app can skip it. Approving no longer asks for the authenticator app (this is what stopped the Internal Auditor).
2. **Direct to one or many people, from any departments.** No HOD, HR, DG or Account step. Each person answers on their own (approve, reply, decline or forward). To be paid, a person forwards it to the DG with the Account Officer.
3. **Everyone is told at once:** SMS, e-mail and a notice in ReqGen. The SMS and e-mail carry only the request number and what to do.
4. **What the officers said:** every comment on a request is shown on the request, and printing adds it as page 2. Page 1 is unchanged.
5. **ReqGen app 2.0.0, a real app.** Its screens are inside the APK. It no longer opens the website in a window.
6. **Password reset fixed.** The reset link from the e-mail opens the new-password form, in the browser and in the app. If a link is too old or was already used, the page now says why.
7. **Privacy and Lightness Check:** the website and the app may talk only to our own website and our database.

Unchanged: the Routing Engine and every approval rule, the home page design, page 1 of every print-out, who sees subhead balances, the IET stamp rule.

## Files

- `ReqGen_v4.7.0_source.zip`: the full project, with the `mobile` app kit. It has no `.env` files, no keystore and no `node_modules`.
- `ReqGen_v4.7.0_website.zip`: the same without the Android project (`mobile\android`). Step 2 below uses the source zip. If you use the website zip instead, keep your `mobile\android` folder when you delete.
- `ReqGen_App_Kit_2.0.0.zip`: only the `mobile` folder (for the laptop that builds the APK).
- `v4_7_0_upgrade.sql`: the database step (also in `database`).
- `REFERENCE_ONLY_v4_7_0_schema.sql`: what the step adds, for reading. **Do not run it.**
- `PRIVACY_AND_LIGHTNESS_v4.7.0.md`: the Barderian Privacy and Lightness Check (also in `docs`).
- This guide.

## 1. Check Vercel first (5 minutes)

Without these, no code and no SMS can be sent. Vercel, the ReqGen project, Settings, Environment Variables. Each must be set for **Production**:

| Name | Value |
| --- | --- |
| `SENDCHAMP_API_KEY` | your Sendchamp key (Sendchamp, Account, API keys) |
| `SENDCHAMP_SENDER_NAME` | `ReqGen` (the sender name approved on Sendchamp) |
| `OTP_HASH_SECRET` | a long random text (any 40 letters and numbers). Set it once and never change it. |
| `SUPABASE_SERVICE_ROLE_KEY` | as before |
| `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | as before |

Also set `NEXT_PUBLIC_APP_URL` to `https://ietreqgen.barderians.com.ng` (the reset e-mail sends people back to this address).

Make sure these are **not** set to `false`: `SENDCHAMP_SMS_ENABLED`, `SENDCHAMP_EMAIL_ENABLED`, `NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED`. Leave them out, or set them to `true`.

On Sendchamp, the wallet must have credit, and the sender name **ReqGen** must show as approved for MTN, Glo, Airtel and 9mobile.

**Supabase, for the password reset link.** Supabase, Authentication, URL Configuration:
- **Site URL:** `https://ietreqgen.barderians.com.ng`
- **Redirect URLs:** add `https://ietreqgen.barderians.com.ng/**` and your vercel.app address followed by `/**`.

If the reset address is not in this list, Supabase sends people to the Site URL instead of the reset page.

## 2. Put the website live

1. Open Command Prompt:
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
2. Delete everything in the folder **except** these four, then unzip `ReqGen_v4.7.0_source.zip` into the folder:
   - `.git`;
   - `.env.local`;
   - `public\downloads` (the APK and app-version.json);
   - `public\.well-known` (assetlinks.json).
3. Install, check and push:
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.7.0: code for every send and decision, Direct to many, comments on print, real app 2.0.0"
   git push origin main
   ```
4. Wait for Vercel to show **Ready**. The footer should read **ReqGen v4.7.0**.

If `npm run audit:deploy` prints a FAIL line, stop and send me a photo of it.

## 3. The database step (5 minutes)

Run it **after** the website shows v4.7.0.

1. Supabase, SQL Editor, New query.
2. Paste the whole of `database/v4_7_0_upgrade.sql` and press **Run**.
3. The last table must show **OK** on every row, then **ReqGen v4.7.0 upgrade done**.

It is safe to run twice. It drops nothing and does not touch the Routing Engine.

From this moment every send and every decision needs the code. Before the step, the website still asks for the code; the database just does not insist yet.

## 4. The app 2.0.0 (20 minutes, on the app laptop)

The app is new inside, so it must be built again. Your key is the **new** key you made in `C:\ReqGen_Key\reqgen-android.keystore`.

1. Close Command Prompt. Unzip `ReqGen_App_Kit_2.0.0.zip` into `C:\Projects\reqgen-web` and choose **Replace** for every file. It contains only the `mobile` folder.
2. Double-click `mobile\MAKE_APP.bat`. Type the ReqGen key password. It must end with:
   - **App screens built.**
   - **Checked inside the APK: the real app screens are inside (app 2.0.0, build 4).**
   - **DONE: ReqGen.apk 2.0.0 (build 4) is ready …**
3. Push the APK to the website:
   ```
   cd C:\Projects\reqgen-web
   git add -A
   git commit -m "ReqGen app 2.0.0: real app screens inside the APK"
   git push origin main
   ```
4. On each phone: because the key is new, **uninstall the old ReqGen app first** (Settings, Apps, ReqGen, Uninstall). Then open `https://ietreqgen.barderians.com.ng/app`, check it says **ReqGen 2.0.0**, download and install.

The signing key and its password never go on GitHub, Vercel or WhatsApp. Keep a copy of the key on a flash drive and Google Drive.

## 5. Check it live (20 minutes)

Use two test staff on two phones, A and B, and the Internal Auditor.

1. **Code to send:** A sends an Official request. A box asks for the 6-digit code. An SMS from **ReqGen** and an e-mail arrive within a minute. Type either code: "Request sent". The first officer gets an SMS, an e-mail and a notice in ReqGen.
2. **Code to approve:** the officer presses **Sign and approve**, writes a comment, presses Approve: the code box opens. No authenticator is asked for. The next officer is told at once.
3. **Internal Auditor:** repeat step 2 as the Internal Auditor on the Vercel address. It must pass with the SMS or e-mail code.
4. **Wrong code:** type 000000: "That code is not right" and nothing moves.
5. **Direct to many:** A opens Direct, chooses B and someone from another department, sends with the code. Both get an SMS and e-mail. The request shows **Route: from A to 2 people**, with no HOD, HR, DG or Account step.
6. **Each answers:** B approves (code); the other declines with a reason (code). A sees each answer and can press **Remind** for anyone still waiting.
7. **Forward to be paid:** on a Direct request with money, B chooses **Forward to the DG** and picks the Account Officer. The DG gets it; after the DG approves, the Account Officer treats it in Finance.
8. **Registry:** Registry, Request Tracking, the Direct request: it shows "Sent by A", then each person and their answer. No title, amount or message.
9. **Comments:** on a request that went through 2 or 3 officers, the DG sees **What the officers said**. When it is completed or paid, print it: page 1 is as before; page 2 is **Comments and approvals on REQ-…**.
10. **App:** open ReqGen 2.0.0. Sign in once (e-mail, password, then the code), choose a PIN, turn on the fingerprint. Close it and open it again: "Welcome back" with the PIN or fingerprint. Turn on Airplane mode: your lists still show, with "You are offline". Approve one request in the app: the code box shows, then "Approved".
11. **Status bar:** on an Android 15 or 16 phone, the time and battery at the top are readable in light and in dark (Me, Appearance).

12. **Forgot password (the DG's case):** on the phone, sign out, press **Forgot password?**, type the e-mail, open the link from the e-mail straight away. The **New password** form must open (with the authenticator code first, if the account has one). Save: it goes back to sign in. Sign in with the new password. Open the same link a second time: it must say the link was already used.

If the code box says "ReqGen cannot send codes: the SMS and e-mail service (Sendchamp) is not set up", go back to step 1.

## Notes

- **Why the database checks the code:** even if a page were old (cached) or a link skipped the box, the database refuses to move a request without a fresh code. The page then opens the code box by itself and tries once more.
- **A code is good for 10 minutes** and covers one action (it may be reused for 90 seconds, so a slow network does not ask twice). After 5 wrong tries, ask for a new code.
- **Delete** still uses the authenticator app, as before.
- **Why the DG's reset link failed:** the phone had the ReqGen app 1.0.2, so the link opened inside the app. The app moved to the reset page without loading it again, so the one-time key in the link was never read. This is fixed on the website, so app 1.0.2 is fixed as soon as v4.7.0 is live. In app 2.0.0, website links (reset, print, Finance) open in the phone's browser.
- **Late SMS:** an SMS can arrive late when the phone network is busy. The e-mail is sent at the same moment, and either code works for 10 minutes. If SMS are often late, check the delivery report in Sendchamp and send me a screenshot.
- **App jobs that stay on the website:** Finance (release the fund, vouchers), choosing a subhead where balances show, editing a returned request, printing. The app opens these on the website with one tap.
- **Privacy:** the website and the app talk only to ietreqgen.barderians.com.ng and our Supabase database. SMS and e-mail go out from our server through Sendchamp, never from the phone. No trackers, no adverts, no outside fonts or scripts.
