# ReqGen 5.0.2 (website) and app 3.0.2: deployment guide

App 3.0.2 does every office job inside the app. Nothing sends you to the website. Website 5.0.2 is a small companion update.

## Step 1. Database (Supabase): only if not done yet

Run these in the **SQL editor**, one at a time, in this order. Skip any you have already run. Each is safe to run twice, and none drops anything.

1. `database/v5_0_0_status_fix.sql` (direct requests: "Sent directly" and "Answered")
2. `database/v5_0_0_step2_registry_pa.sql` (Registry only for the PA to the DG and the Super Admin; one "PA to the DG")
3. `database/v5_0_1_rls_fix.sql` (no more "infinite recursion"; photo and signature uploads work again)

There is no new SQL in 5.0.2. In-app notices use the notifications table, which is already set up for live updates.

## Step 2. Website 5.0.2 (GitHub, then Vercel)

1. Unzip `ReqGen_v5.0.2_website.zip` over your local `reqgen-web` folder. Keep your own `.env.local`. The zip has no `.env` files.
2. Open PowerShell in that folder and run:

```
npm install
npm run build
git add -A
git commit -m "ReqGen 5.0.2: full office in the app 3.0.2, choices shown in full, A4 preview fits the phone"
git push
```

3. Vercel builds by itself. When it shows **Ready**, the footer reads ReqGen v5.0.2.

## Step 3. App 3.0.2 (APK)

1. Unzip `ReqGen_App_Kit_3.0.2.zip` over the `mobile` folder of `reqgen-web`. The app screens are already built inside `mobile/www`.
2. Double-click `MAKE_APP.bat`. It reads version 3.0.2, build 8.
3. Sign it with your key at `C:\ReqGen_Key\reqgen-android.keystore`, the same as before.
4. The signing key and its password never go on GitHub, Vercel or WhatsApp.
5. Upload the APK as before. Phones on 3.0.x are offered the update.

## What is new in the app

- **Every office in the app:** Finance, Payment Vouchers, Registry, Reports, Audit, Administration, My Account and Developer. Each page opens with the app header and Back.
- **Payment vouchers, start to finish:**
  - generate from approved requests;
  - make a manual voucher;
  - choose the Counter Signer;
  - check and sign (Auditor), counter-sign, then sign, stamp and authorise (DG, with the 6-digit code);
  - mark as paid (with the code);
  - print.
- **Printing:** a request or a voucher becomes the standard IET A4 PDF on the phone, one page, with the request and PV numbers. It opens at once, ready to print or share. On the screen the whole A4 sheet is shown, made smaller to fit the phone.
- **Files:** Excel, CSV and backup downloads, and attachments, are saved on the phone and opened.
- **Live notices:** a new approval or notice shows a short banner and a buzz straight away, and the lists refresh themselves.
- **Super Admin:** staff details, routing, departments, subheads, positions, backups and restore all work in the app. Restoring a backup from a file works too.
- **Sign out from a page:** after a hand-over, the app goes back to its own sign-in screen.

## What changed on the website

- Long choices in drop-down lists (accounts, subheads, staff names) wrap and show in full, instead of being cut with "…".
- On phones, tab rows wrap onto a second line (no tab hidden off the edge), and request and voucher numbers in lists stay on one line.
- On a phone, the A4 preview of a request or a voucher fits the screen instead of being cut at the sides. **Printing is unchanged:** the same IET template on one A4 page.
- In dark mode, the A4 preview keeps its light paper colours, including table heads.
- No purple anywhere: the old purple chart and label colours are now IET teal and navy.

## Tested before delivery (three full rounds)

- All 75 office pages opened inside the app, each in four looks and sizes:
  - 412 light Sand;
  - 360 dark Gold;
  - 320 light Gold;
  - 412 dark Sand.

  No cut text, no sideways scroll, no overlapping boxes, no faint text, the same font everywhere, and every button at least 36 px.
- Core app flows: sign-in with 2FA and PIN, official, personal and direct requests, approvals with the code, notifications.
- Voucher flows:
  - generate from requests with the code;
  - manual voucher with the Counter Signer;
  - DG sign and stamp with the code;
  - mark as paid with the code;
  - print to a one-page A4 PDF.

  Each was tested in light and dark.
- Website: production build, every release audit, and the print templates compared against 5.0.0. The printed sheet is unchanged.
