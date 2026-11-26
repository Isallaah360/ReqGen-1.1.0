# ReqGen 6.2.0 and app 4.1.1: the new look on the website, matching papers in the app

This update brings the new website look (Blueprint 08) to every page. The app's printed papers now match the website's exactly.

**No database step.** The database stays as it was after 6.1.0.

**Already deployed 6.1.0?** Do the steps below.
**Not yet?** First do 6.1.0's database step (the HR-rule SQL) and its Edge Functions step. Both are included again, unchanged: `database/v6_1_0_requests_hr_rule.sql` and `ReqGen_Edge_Functions_6.2.0.zip`.

## What you will see

### The website
- **One plain frame on every signed-in page:**
  - The black IET top bar with the logo, search, notices, "Acting as" and your menu.
  - One row of office menus under it: Dashboard, Requests, Approvals, Finance and the rest.
  - The page path (with a **Back** button), the page itself, and the black footer.
- **The sign-in, sign-up, 2FA and password pages** use the same top bar and footer.
- **The old left menu, the phone tab bar and the moving glow are gone.**
- **Colours come from the IET logo only:** Blue, Gold, Orange and Red, with dark shades for text. There is no purple. Cards are plain white with thin lines.
- **On phones:**
  - search sits on its own row;
  - the office menus wrap onto a second row;
  - long buttons wrap, so no page scrolls sideways.
- **The Developer Console** keeps its own name ("ReqGen Console") and its "DEVELOPER CONSOLE" badge.

### Times
- Every time on the website and in the app now shows in 12-hour form with AM or PM, for example "8:19 PM".

### The app (4.1.1, build 11)
- **The opening screen** sits in the middle of the phone. "Opening ReqGen" has moving dots and a loading bar in the IET colours.
- **The A4 request letter and payment voucher** are now laid out exactly like the website's printed papers:
  - the same IET header, boxes and signature lines;
  - the same "Building Bridges" footer and colour stripes;
  - the same QR check code.
- The QR is only printed on the paper. The app still never calls the website.

## Step 1. Unzip both packages, 1 minute

1. Unzip **`ReqGen_v6.2.0_source.zip`** over your `reqgen-web` folder and choose "Replace all".
2. Unzip **`ReqGen_App_Kit_4.1.1.zip`** over the `mobile` folder of `reqgen-web` and choose "Replace all".

## Step 2. Build the APK first (4.1.1, build 11)

Build the APK before you push, so the new app goes onto the website in the same push.

1. Double-click **`MAKE_APP.bat`**. It reads version 4.1.1, build 11, and signs with your key at `C:\ReqGen_Key\reqgen-android.keystore` (alias `reqgen`).
   - The key and its password never go on GitHub, Vercel or WhatsApp.
2. When it finishes, it has put `ReqGen.apk` and `app-version.json` into `reqgen-web\public\downloads`. That is the file staff download from **ietreqgen.barderians.com.ng/app**.

## Step 3. Push the website and the app together (GitHub and Vercel), 3 minutes

In the `reqgen-web` folder, run:

```
git add -A
git commit -m "ReqGen 6.2.0: the new website look, 12-hour times; app 4.1.1"
git push
```

Wait for Vercel to finish (about 3 minutes). Then:
- on a computer, open the website and press **Ctrl + F5** once, so the browser drops the old look;
- on a phone, close the browser tab and open the address again.

## Step 4. Tell phones that already have ReqGen (Supabase), 2 minutes

Phones that already have the app look for updates in the database, not on the website (the app never calls the website).

1. Upload the same `ReqGen.apk` to Supabase › Storage › `app-releases` and copy its public link.
2. Run this in the SQL editor:

```
insert into public.reqgen_app_releases (version, build, apk_url, notes)
values ('4.1.1', 11, 'PASTE THE PUBLIC LINK HERE', '{"new":["The A4 request letter and payment voucher now look exactly like the website papers, with the QR check code.","Times are shown with AM and PM."],"better":["The opening screen sits in the middle, with a live loading bar."]}');
```

Phones with 4.1.0 then offer **Update** by themselves.

**Which link to share:** give staff only **ietreqgen.barderians.com.ng/app**. The Supabase link is only for in-app updates.

## Step 5. Check it (10 minutes)

**On the website, on a computer:**
- [ ] The sign-in page has the black top bar with the IET logo and the black footer.
- [ ] After signing in, the office menus are in one row under the top bar. There is no left menu.
- [ ] Open any page other than the Dashboard: the page path shows, with **Back** at its start.
- [ ] Print a request and a voucher: the papers are unchanged.

**On the website, on a phone:**
- [ ] Search is on its own row, and every office menu shows (on two rows if needed).
- [ ] No page moves sideways when you swipe.

**In the app:**
- [ ] Opening the app: the IET logo is in the middle, with "Opening ReqGen" and a moving bar.
- [ ] Me shows version 4.1.1.
- [ ] Open a voucher and choose **A4 PDF (IET voucher)**: it looks like the website's voucher.
- [ ] Open a request and choose **A4 PDF (IET request letter)**: it looks like the website's letter, and page 2 lists the comments.
- [ ] Scan the QR code on the paper with another phone: it opens the check page.

## Still open

- **The colour for "Available":** it is IET Blue with a tick, because the IET logo has no green. Tell me if you want green for that one word, and I'll change it.
- **Testing on the live database:** every test here ran against a copy that behaves like Supabase. The final proof is a few real requests on your phone (Step 3). Any error the app meets is reported to the Super Admin under Diagnostics.

## Tested before delivery (three full rounds)

- **The website frame:** 68 pages at three widths (1366, 390 and 320). On each page:
  - the new frame shows and the old menus are gone;
  - there are no script errors;
  - nothing scrolls sideways.
- **Every release check (642)**, including the new 6.2.0 checks, and the full website build (145 pages).
- **The app:**
  - the main flows in four looks and sizes;
  - the Step 1 screens at three sizes;
  - all 48 office screens in four looks and sizes;
  - the new flows at three sizes;
  - live notices.
- **Both PDFs** compared with the website's printed papers, side by side.
- **The 6.1.0 HR rule** run twice on a fresh test database, with the same results as at 6.1.0. 6.2.0 has no database step.
- **The three Edge Functions** type-check on Deno, and the notices test passes.
- **Independence:** in every test, the app contacted only the database, never the website.
