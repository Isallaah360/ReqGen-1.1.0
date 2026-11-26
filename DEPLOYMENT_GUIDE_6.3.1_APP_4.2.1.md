# ReqGen 6.3.1 and app 4.2.1 (build 13): the new look

A new look for the website and the app. There is **no database step** and **no Edge Function change** in this release.

6.3.1 includes everything in 6.3.0. **If you have not deployed 6.3.0 yet,** first do its Step 1 (database, `database/v6_3_0_backup_handover.sql`) and Step 2 (Edge Functions, `ReqGen_Edge_Functions_6.3.0.zip`, included in this pack). Then continue below. If you are also behind on 6.1.0, run `database/v6_1_0_requests_hr_rule.sql` first.

## What changes

**Website**
- **Royal Blue is the default look.** The top bar and the office menu are IET blue with gold highlights.
  - The black bar is gone.
  - The colour strip across the top of every page is gone.
  - The footer is dark blue.
- **Glass** is a second look. Anyone can switch to it from the menu under their photo (top right): **Look: Royal Blue, Switch to Glass**. Each computer remembers its own choice.
- **The search bar is easy to read:** white text and a light-blue hint on a deep blue box.
- **Dark mode** is deep IET blue, not black.
- **The home page** has the big IET logo again, with "Welcome to ReqGen" under it.
  - It also has the sign-in and create-account buttons and the app banner.
  - A moving strip of short notices runs across the top. It pauses when you point at it, and it stays still on devices set to reduce motion.
- **Animations:**
  - buttons lift and press;
  - menu links get a sliding gold underline;
  - pages fade in;
  - cards rise when you point at them;
  - "saved" and "sent" messages slide in.

**App 4.2.1**
- **The home screen shows app icons, like a phone.** The first row is New request, Approvals, Direct, My vouchers, My requests and Notices. Every office you hold comes after them. A red number shows where something is waiting.
- **Each office opens to its own page of app icons.**
- **"Me" is now Settings:**
  - fingerprint and App PIN;
  - look, and light or dark;
  - security and phones;
  - setup guide, notices, app version and update;
  - Sign out.
- **Tap your photo** at the top of the home screen to open **Profile**:
  - my account, signature and photo;
  - my access and my activity;
  - notices and About ReqGen;
  - the version and Sign out.
- **Two looks, switched in Settings › Look:**
  - **Icon Grid** (the default, IET blue);
  - **Glass Dock** (frosted glass on deep IET blue).

## Step 1. Website and app together (10 minutes)

1. Unzip the two files into your `reqgen-web` folder:
   - **`ReqGen_v6.3.1_source.zip`** over `reqgen-web`;
   - **`ReqGen_App_Kit_4.2.1.zip`** over its `mobile` folder.

   Choose "Replace all" both times.
2. Double-click **`MAKE_APP.bat`**. It reads version **4.2.1, build 13**, signs the app with `C:\ReqGen_Key\reqgen-android.keystore` (alias `reqgen`) and puts the APK into the website's download folder (`public/downloads`).
   - Do this **before** pushing, so the push carries the new APK to the website's /app page.
   - The key and its password never go on GitHub, Vercel or WhatsApp.
3. Push:

```
cd C:\path\to\reqgen-web
git add -A
git commit -m "ReqGen 6.3.1: Royal Blue and Glass looks, home page logo and strip; app 4.2.1 icon home screen, Settings and Profile"
git push
```

Vercel builds the website by itself in about 3 minutes.

4. Go to Supabase › Storage › `app-releases`. Upload the same `ReqGen.apk` and copy its public link. Then run this in the SQL editor, so phones with 4.2.0 are offered the update:

```
insert into public.reqgen_app_releases (version, build, apk_url, notes)
values ('4.2.1', 13, 'PASTE THE PUBLIC LINK HERE', '{"new":["Your offices and pages are now app icons on the home screen, like a phone.","Settings has its own tab: App PIN, fingerprint, look, security and setup guide.","Tap your photo at the top to open your Profile: account, access, activity, notices and about.","Two looks: Icon Grid (the IET blue default) and Glass Dock. Switch in Settings."],"better":["Smoother animations on buttons, tabs and saved messages.","Every word is easy to read in both looks."]}');
```

## Step 2. Check it (5 minutes)

**Website**
- [ ] The home page shows the big IET logo, ReqGen, the two buttons and the moving strip.
- [ ] After signing in, the top bar is IET blue. There is no black bar and no colour strip above it.
- [ ] Type in the search bar: the text and the hint are easy to read.
- [ ] Your photo (top right) › **Look: Switch to Glass**. The page turns to frosted glass. Switch back to Royal Blue.
- [ ] Turn on dark mode: the page is deep blue, not black.

**App** (after the update)
- [ ] The home screen shows app icons with red numbers where something waits.
- [ ] Open an office: its pages are app icons too.
- [ ] The last tab says **Settings**.
- [ ] Tap your photo on the home screen: **Profile** opens with Sign out at the bottom.
- [ ] Settings › Look › **Glass Dock**: the app turns to glass. Switch back to **Icon Grid**.

## Tested before delivery (three full rounds)

- **The app**, in both looks:
  - every screen at 412, 360 and 320 wide, in light and dark;
  - every text and background pair checked for contrast (4.5 to 1 for normal text);
  - every office as an icon page;
  - the request, approval, voucher and backup flows;
  - Settings and Profile.
- **The website** in all four combinations: Royal Blue and Glass, each in light and dark.
  - 68 pages at three widths each.
  - No script errors and no sideways scroll.
  - No black bar and no top strip.
  - The search text was checked readable on every page.
- **Every release check**, including the new 6.3.1 check, and the full website build.
- **The 6.1.0 and 6.3.0 database steps** were run again on fresh test databases, and the three Edge Functions type-check on Deno.
