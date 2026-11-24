# ReqGen 5.0.0 (website) and app 3.0.0: deployment guide

Do these steps in this order. Steps 1 and 2 are enough for the DG to approve. Step 4 can follow later.

## Step 1. Database (Supabase): one small fix, 1 minute

1. Open Supabase, then **SQL editor**, then **New query**.
2. Paste all of `database/v5_0_0_status_fix.sql` and press **Run**.
3. The result shows `requests_status_check` with "Sent directly" and "Answered" in the list.

This adds two allowed statuses. Nothing is removed, no row changes, no table is dropped. It is safe to run twice. Direct requests work at once, even in the app you already have.

4. Then run `database/v5_0_0_step2_registry_pa.sql` the same way. It:
   - makes Registry (incoming and outgoing books, Request Tracking, reminders, filing, dispatch, archive and Registry reports) open only to the PA to the DG and the Super Admin;
   - merges the duplicate "pa to the dg" positions into the one "PA to the DG", which also holds Registry.

   It ends with a short report where every row says OK. Nothing is dropped.

## Step 2. Website 5.0.0 (GitHub, then Vercel)

1. Unzip `ReqGen_v5.0.0_website.zip` over your local `reqgen-web` folder. Keep your own `.env.local`; the zip has no `.env` files.
2. Open PowerShell in that folder and run:

```
npm install
npm run build
git add -A
git commit -m "ReqGen 5.0.0: Blueprint 07 look (Sand and Gold), direct request fix, Super Admin edit details"
git push
```

3. Vercel builds by itself. When it shows **Ready**, open https://ietreqgen.barderians.com.ng/login. You should see the big floating IET logo and the large "ReqGen".
4. The new font is installed by `npm install` (`@fontsource/plus-jakarta-sans`). It is served from our own site, never from Google.

## Step 3. Check the DG's request (before 10:00)

1. The DG signs in with password and authenticator code. On a phone, use the website or the current app.
2. Go to **Approvals** and open the request, then **Approve**.
3. Enter the 6-digit code sent by SMS and e-mail. The sender and the next officer get an SMS and an e-mail.

## Step 4. App 3.0.0 (APK)

1. Unzip `ReqGen_App_Kit_3.0.0.zip` over the `mobile` folder of `reqgen-web`.
2. Double-click `MAKE_APP.bat`. It reads version 3.0.0, build 6.
3. Sign it with your key at `C:\ReqGen_Key\reqgen-android.keystore`, the same as before.
4. The signing key and its password never go to GitHub, Vercel or WhatsApp.
5. Upload the APK as before. Phones on 2.0.x are offered the update.

## What changed

- **Look:** Sand (warm sand with IET blue, the default) and Gold (the IET logo gold). Each one has Light, Dark and Match device. Change it in My Account › Appearance (website) or Me › Appearance (app).
- **Font:** Plus Jakarta Sans on every screen.
- **Printing:** printed requests and payment vouchers are unchanged. They keep the IET standard templates, one A4 page each, with the request number and PV number.
- **Super Admin:** Edit details now changes name, sign-in e-mail, phone for SMS codes and department. Routes are set in Administration › Routing. Departments, subheads and positions work as before.
- **Fix:** direct requests no longer stop with `requests_status_check`.
- **Registry:** only the PA to the DG and the Super Admin. The DG, the Auditor, Finance and the Registrar no longer see it. Registry never sees request contents.
- **One PA to the DG:** the duplicate spellings are merged.

## Tested before delivery

- Website: production build, then three test rounds covering sign-in, official, personal and direct requests, approvals, the code checks, printing and vouchers. Phone and laptop sizes, light and dark.
- App: four sizes (412, 360 dark, 320, 412 dark). No cut-off rows, no sideways scroll, every tap target at least 40 px.
- Print pages compared with 4.7.1: the same single A4 page.
