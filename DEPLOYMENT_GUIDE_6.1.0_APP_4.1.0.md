# ReqGen 6.1.0 and app 4.1.0: Steps 2, 3 and 4

This update finishes the real app. Every office is now an app screen. HR's rule for requests applies on both the website and the app.

**In this update:**
- **HR's rule:** once a request is sent, only its sender can change it, and only when it is sent back to them. Everyone else comments.
- **The sender chooses the subhead:** staff see subhead names only. When the amount is typed, ReqGen answers at once:
  - **Available**, with a blue tick;
  - **Not enough**, in red, with the name of the Auditor (Mrs Patricia Michael) to contact.
- **Payment Vouchers:** the Voucher Centre; generate from requests; manual voucher; signing tracker; ready to pay; paid history; print centre; signatories. The voucher actions are check, counter-sign, DG sign and stamp, send back, send again, cancel, mark as paid, and remind.
- **Finance:**
  - processing (release the fund and prepare the voucher in one step);
  - bank accounts and officer assignment;
  - budget and subheads;
  - ledgers, transfers, and the transaction centre with reversals;
  - integrity and settings.
- **Registry:** tracking and reminders, incoming, outgoing, dispatch, archive and filing.
- **Reports:** transactions, requests, finance statements, vouchers, registry, executive analytics, print register and compliance. They have charts and save as Excel on the phone.
- **Audit:** the Audit Log, workflow trace, finance reconciliation (bank statement upload) and the master backup.
- **Administration:**
  - staff and positions (add, edit, e-mail, 2FA reset, switch off, delete);
  - positions and the permissions matrix;
  - departments and the Routing Engine;
  - security, diagnostics, the financial reset and system accounts.
- **Developer Console:** modules, releases and activity.
- **My access, my activity and the setup guide** are in Me.
- **The IET A4 request letter** (with its comments page) **and the payment voucher** are made in the app as PDFs, to print or share.

The app still never calls the website. Office jobs that need the server (staff accounts, reminders, backups, the financial reset) run in a third database program, the Supabase Edge Function `reqgen-office`. It is the website's own server code, so the same checks apply.

Do the steps in this order.

## Step 1. Database (Supabase SQL editor), 1 minute

Run **`database/v6_1_0_requests_hr_rule.sql`**. It adds:

- **The rule:** a request's title, details, amount, type and department change only by its sender, and only while it is back with them.
  - The subhead follows the same rule.
  - One exception: an officer may still give a subhead to an older request that never had one.
  - Officers, the Super Admin and the Auditor are refused by the database itself.
- **Correcting:** the sender corrects only when the request was sent back. Correcting while it is still with an officer is no longer possible.
- **Comments:** anyone who can open a request may comment. The sender and whoever holds it get an app notice.
- **The sender's subhead:** a new official request with an amount must carry a subhead when its department has subheads.

It ends with a report where every row says OK. Nothing is dropped and no data is changed. It is safe to run twice.

## Step 2. The database programs (Edge Functions), 5 minutes

1. Copy the new files over your `reqgen-web` folder (Step 3 lists them).
2. Double-click **`DEPLOY_FUNCTIONS.bat`**. It now deploys three programs:
   - `reqgen-notify`;
   - `reqgen-code`;
   - **`reqgen-office`** (new).
3. Supabase › Edge Functions should list all three as active.

If Supabase shows "502 Bad gateway", wait a minute and run it again. The script retries by itself three times.

## Step 3. The website (GitHub and Vercel)

Unzip **`ReqGen_v6.1.0_source.zip`** over `reqgen-web` and choose "Replace all". Then:

```
git add -A
git commit -m "ReqGen 6.1.0: HR's rule, the sender's subhead, comments; app 4.1.0 with every office"
git push
```

Vercel builds 6.1.0. I ran the full website build here, and all 145 pages built.

What changes on the website:

- **New Request:** every official request asks for the subhead.
  - Staff see the names only, then available or not enough.
  - When it is not enough, the Auditor's name is shown.
- **A request's page:**
  - "Edit" shows only for the sender, and only when the request was sent back.
  - Everyone else gets **Comments** with "Add comment".
- **Correct request:** only the sender, only when it was sent back. Officers are told to comment instead.

## Step 4. Build the APK (4.1.0, build 10)

1. Unzip **`ReqGen_App_Kit_4.1.0.zip`** over the `mobile` folder of `reqgen-web` and choose "Replace all".
2. Double-click **`MAKE_APP.bat`**. It reads version 4.1.0, build 10. Old 3.x files are removed by the build.
3. Sign the APK with your key at `C:\ReqGen_Key\reqgen-android.keystore`. The key and its password never go to GitHub, Vercel or WhatsApp.
4. Install it on your phone. If you made a new key, uninstall the old ReqGen app first.

## Step 5. Test on your phone

**As Staff:**
- [ ] New official request: choose the subhead, type the amount, and see **Available**.
- [ ] Type a very large amount: see **Not enough** with Mrs Patricia Michael's name.
- [ ] A request sent back to you: **Correct it**, change it, and **Sign and send again** (fingerprint or PIN).

**As an officer:**
- [ ] Open a request waiting for you: **Add a comment**. There is no "Edit".

**As the Account Officer:**
- [ ] A request at Account: **Release the fund**. The voucher is prepared and goes to the Auditor.

**As the Auditor, the Counter Signer and the DG:**
- [ ] Approvals › Vouchers: check, counter-sign, then sign and stamp.

**Anyone:**
- [ ] On a voucher or a request: **A4 PDF**. It opens in the phone's PDF viewer.

**As the Super Admin:**
- [ ] Offices › Administration › Staff & Positions: open a staff member and edit their details.

## Step 6. Give the app to everyone

Now that every office is in the app, staff can move to it:

1. Upload the APK to Supabase › Storage › `app-releases` and copy its public link.
2. Run this in the SQL editor:

```
insert into public.reqgen_app_releases (version, build, apk_url, notes)
values ('4.1.0', 10, 'PASTE THE PUBLIC LINK HERE', '{"new":["Every office is now in the app.","Only the sender changes a request, and only when it is sent back. Everyone else comments.","Choose the subhead: ReqGen says at once if it can finance the amount."]}');
```

If the signing key changed, tell staff to uninstall the old app before installing this one.

## A note on colours

You asked for green when the subhead can finance the amount. The official IET logo has no green, so ReqGen uses IET Blue with a tick for "available" and IET Red for "not enough". If you want green for that one answer only, say so and I'll change it.

## Tested before delivery (three full rounds)

- **The app's main flows** in four looks and sizes (412 light IET Blue, 360 dark IET Blue, 320 light IET Gold, 412 dark IET Gold). This includes sending a request with the subhead and the PIN.
- **Step 1 screens** at three sizes.
- **Every office screen (48) opened through the app's own menus** in four looks and sizes, including the Developer Console. Each was checked for:
  - script errors;
  - cut text;
  - faint text;
  - boxes wider than the screen;
  - buttons under 40 px;
  - overlapping parts.
- **The new flows** at three sizes:
  - available and not enough (with the Auditor's name, and no balance shown);
  - an officer comments and is not offered "Edit";
  - the sender corrects and sends again;
  - the Auditor checks and signs a voucher;
  - the voucher and request PDFs;
  - a voucher reminder through `reqgen-office`.
- **Live notices:** the banner shows in under 0.1 seconds.
- **Database:** the 6.0.0 step, and the 6.1.0 rule run twice on a test database, with these results:
  - an officer is refused;
  - the sender is refused while the request is with an officer;
  - the sender may correct after it is sent back;
  - "not enough" is refused;
  - a stranger cannot comment;
  - a request without a subhead is refused.
- **Edge Functions:** all three type-check on Deno. The notices test passes.
- **The website:** every release check (including the new 6.1.0 checks) and the full build.
- **Independence:** in every test the app never contacted the website, only the database.
