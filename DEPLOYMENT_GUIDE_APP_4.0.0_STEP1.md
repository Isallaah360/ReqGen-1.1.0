# ReqGen app 4.0.0 (Step 1): a real app, database only

App 4.0.0 is a real app of its own. Every screen is drawn by the app itself, from the loading screen and sign-in to sign-out. It talks only to the ReqGen database (Supabase) and to two small database programs (Supabase Edge Functions) for SMS and e-mail. It never opens or calls the website.

The colours come from the official IET logo:

| Colour | Hex |
|---|---|
| IET Blue | #31A8E0 |
| IET Gold | #F9A11F |
| IET Orange | #F47824 |
| IET Red | #EF3F27 |
| Logo lettering | black |

Deeper shades of those colours are used where text must stay readable.

Do the steps in this order.

## Step 1. Database (Supabase SQL editor), 1 minute

If any of these have not been run yet, run them first, in order:
- `v5_0_0_status_fix.sql`
- `v5_0_0_step2_registry_pa.sql`
- `v5_0_1_rls_fix.sql`

Then run **`database/v6_0_0_app_step1.sql`**. It adds:
- **App devices:** this phone's key for confirming with the fingerprint or the app PIN. The database keeps only its SHA-256 fingerprint. Five wrong tries switch the phone off. Deactivating an account switches its phones off.
- **App error reports:** what failed, on which screen and in which version. Only the Super Admin and the Developer can read them.
- **App releases:** the newest APK is announced from the database. A public storage folder, `app-releases`, holds the APK files.
- **Help contact:** the name of the person holding the Auditor position, shown to staff when a subhead cannot cover an amount. Staff never see balances.

It ends with a report where every row says OK. Nothing is dropped, and it is safe to run twice.

## Step 2. The two database programs (Edge Functions), 5 minutes

1. Make sure your `.env.local` (in `reqgen-web`) has the same SENDCHAMP values as Vercel: `SENDCHAMP_API_KEY`, `SENDCHAMP_SENDER_NAME`, and the others that start with `SENDCHAMP_`. Add `OTP_HASH_SECRET` too if Vercel has one. Copy them from Vercel › Settings › Environment Variables if they are missing.
2. Double-click **`DEPLOY_FUNCTIONS.bat`** in `reqgen-web`. It:
   - signs you in to Supabase (a browser window opens the first time);
   - saves those values as Supabase secrets, never printing them or keeping a copy;
   - deploys `reqgen-notify` (SMS and e-mail notices) and `reqgen-code` (the back-up 6-digit code).
3. Supabase › Edge Functions should now list both as active.

## Step 3. The forgot-password e-mail, 1 minute

Forgot password now works inside the app with a code from the e-mail:

1. Supabase › Authentication › Emails (Email Templates) › **Reset Password**.
2. Add this line to the message, then save: `Your ReqGen code: {{ .Token }}`

## Step 4. The website files (GitHub)

The website itself does not change in this step. Copy the files over your `reqgen-web` folder to keep everything in one place:
- `supabase/functions`;
- `supabase/config.toml`;
- `DEPLOY_FUNCTIONS.bat` and `deploy_functions.ps1`;
- the database file;
- the updated checks in `scripts`.

Then:

```
git add -A
git commit -m "ReqGen app 4.0.0 step 1: real app, database only; Edge Functions for notices and codes"
git push
```

## Step 5. Build the APK

1. Unzip `ReqGen_App_Kit_4.0.0.zip` over the `mobile` folder of `reqgen-web`. The `mobile` folder must stay inside `reqgen-web`: the build reads the database address and its **public** key from `reqgen-web\.env.local`. The secret service key is never read or packed.
2. Double-click `MAKE_APP.bat`. It reads version 4.0.0, build 9.
3. Sign it with your key at `C:\ReqGen_Key\reqgen-android.keystore`, as before. The key and its password never go to GitHub, Vercel or WhatsApp.
4. Install it on your phone. **The first time, sign in once** with your password and authenticator code. That sets up this phone's fingerprint and PIN confirmation.

To let other phones find the update in Me › App version:
1. Upload the APK to Supabase › Storage › `app-releases`.
2. Copy its public link.
3. Run in the SQL editor:

```
insert into public.reqgen_app_releases (version, build, apk_url, notes)
values ('4.0.0', 9, 'PASTE THE PUBLIC LINK HERE', '{"new":["A real app of its own, with fingerprint confirmation and the IET logo colours."]}');
```

## What is in Step 1

- **No website inside:** the office pages that were borrowed from the website are gone. The app went from several MB of screens to about 770 KB.
- **Signed out elsewhere:** the fix for "permission denied for function reqgen_admin_people". If your password, passcode or 2FA changes on another device, or the Super Admin switches the account off, the app says so plainly and goes to sign-in.
- **Plain messages:** database wording is never shown. Each problem is explained in a sentence and reported to the Super Admin.
- **Confirming actions:**
  - Send, approve, forward, sign and pay are confirmed with the fingerprint or app PIN.
  - The SMS and e-mail code is still there as the back-up ("Use an SMS code instead").
  - The database rules are unchanged: a fingerprint gives exactly the same one-action pass as a code.
- **Rebuilt as app screens:**
  - forgot password (with the authenticator code);
  - setting up 2FA;
  - Profile (name, phone, gender, password, and "acting as" for people with more than one position);
  - Signature and photo (draw it, or take a photo; the background is cleaned);
  - Security and phones (see and switch off your phones);
  - open-source credits.
- **Attachments** open on the phone in its own viewer.
- **Nothing cut:** long names and lines wrap. Nothing ends in "…".

## Not in the app yet (arrives in the next steps)

The office screens are being rebuilt as app screens. Until then they say "Being rebuilt for the app"; use them on a computer.
- **Step 2:** requests under HR's rule (only the sender edits, and only when the request is back with them; officers comment). The sender chooses the subhead, sees green or red for the amount, and is pointed to the Auditor when it cannot be covered.
- **Step 3:** Payment Vouchers and Finance, including the IET A4 request and voucher PDFs made in the app.
- **Step 4:** Registry, Reports and Administration.

## Tested before delivery (three full rounds)

- **The app's main flows** in four looks and sizes (412 light IET Blue, 360 dark IET Blue, 320 light IET Gold, 412 dark IET Gold), 28 screens each: sign-in with 2FA and PIN, Home, requests, direct memos, approvals, notices, Me, lock, offline, and the "signed out elsewhere" screen. Each screen was checked for:
  - text cut with "…";
  - text too faint (WCAG AA contrast);
  - boxes wider than the screen;
  - buttons under 40 px;
  - long dashes or dot bullets.
- **The new screens** at three sizes: forgot password, 2FA set-up, profile, acting as, signature, phones, credits, and offices.
- **Live notices:** the banner shows in under 0.1 seconds.
- **Database step:** the device, pass, lockout, error-report, release and help-contact rules, as a signed-in user.
- **The notices Edge Function:**
  - the next officer is told by SMS and e-mail;
  - the request title is never in the SMS;
  - a bad sign-in is refused;
  - the app is allowed to call it.
- **Independence:** in every test the app never contacted the website, only the database.
