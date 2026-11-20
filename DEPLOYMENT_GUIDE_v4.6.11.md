# ReqGen v4.6.11 and app 1.0.0: release guide

**From:** v4.6.10. **Time:** about 15 minutes for the website and the database. The app takes 20 to 40 minutes the first time on your laptop.

Files in this release:
- `ReqGen_v4.6.11_website.zip`: the website project (no `.env` files, no secrets).
- `ReqGen_v4.6.11_source.zip`: the full source, including the Android app kit (`mobile` folder).
- `v4_6_11_upgrade.sql`: the database step (safe to run twice).
- `ReqGen_schema_REFERENCE_ONLY.sql`: **for a brand-new empty project only.** Never run it on the live database.

## 1. Put the new website live

1. Open Command Prompt and run:
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
2. Delete everything in the folder **except** `.git` and `.env.local`. Then unzip `ReqGen_v4.6.11_source.zip` into the folder. It has the website and the `mobile` app kit.
3. Push the code:
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.11: brief colours, glass tabs, skeletons, app support"
   git push origin main
   ```
4. Wait until Vercel shows **Ready**. The footer should read **ReqGen v4.6.11**.

The `mobile` folder goes to GitHub too. It holds no secrets, and `.vercelignore` keeps it out of the website deploy.

## 2. Run the database step

1. Open Supabase › **SQL Editor** › New query.
2. Paste the whole of `database/v4_6_11_upgrade.sql` and press **Run**.
3. The last line says **ReqGen v4.6.11 upgrade done**.

It only adds indexes, so lists stay fast with many users. Nothing is dropped or changed.

Then open Supabase › **Advisors** › Performance and Security, and send me a screenshot of anything listed.

## 3. The new address: reqgen.barderians.com.ng

1. Vercel › ReqGen project › **Settings › Domains** › Add `reqgen.barderians.com.ng`. Choose Production, with no redirect.
2. Copy the **CNAME** value Vercel shows.
3. WhoGoHost › DirectAdmin › **DNS Management** for barderians.com.ng › **Add Record**:
   - Type **CNAME**
   - Name **reqgen**
   - Value: the Vercel value with a dot at the end
   
   Do not use Subdomain Management or DirectAdmin SSL.
4. Wait until Vercel shows **Valid Configuration** (minutes to a few hours). Vercel makes the SSL certificate itself.
5. Vercel › Settings › **Environment Variables** › set `NEXT_PUBLIC_APP_URL` to `https://reqgen.barderians.com.ng` (Production) › **Redeploy**. SMS and email links then use the new address.
6. Supabase › Authentication › **URL Configuration**:
   - Site URL: `https://reqgen.barderians.com.ng`;
   - add it to Redirect URLs, and keep the old vercel.app one.

The old req-gen-1-1-0.vercel.app address keeps working. Website fingerprints (passkeys) belong to an address, so staff who used a fingerprint on the website add it again once on the new address. The app does not need this.

**Barderian Console:** the developer's hidden sign-in is `https://reqgen.barderians.com.ng/console`. Type it into the Console's app switcher once.

## 4. Build the app (on your laptop)

The app opens the live site, so do this after step 3 works.

1. **Close Chrome and other big programs.** Open `C:\Projects\reqgen-web\mobile` and double-click **MAKE_APP.bat**.
   - The first time, it downloads Java 21, Node (if missing) and the Android build tools, about 1 GB in total.
   - It makes a **new ReqGen signing key** in `Documents\ReqGen_Key\reqgen-android.keystore` and asks you to choose a password twice. The key is kept outside the project.
     - **Copy the key file to a flash drive and to Google Drive, and write the password down.**
     - Every future ReqGen update must use this same key and password.
     - Never put the key on GitHub, Vercel or WhatsApp.
   - It builds the app, checks the signature itself, and ends with **DONE: ReqGen.apk 1.0.0 is ready and signed with the ReqGen key.**
   - It puts three files in the website folder:
     - `public\downloads\ReqGen.apk`;
     - `public\downloads\app-version.json`, with the version, size, date, SHA-256, and the New, Fixed and Better lists;
     - `public\.well-known\assetlinks.json`, so ReqGen links open in the app.
2. Put the app on the website:
   ```
   cd C:\Projects\reqgen-web
   git add -A
   git commit -m "ReqGen app 1.0.0"
   git push origin main
   ```
3. Check these:
   - `https://reqgen.barderians.com.ng/app` shows **Download ReqGen 1.0.0** and the SHA-256 in full;
   - `https://reqgen.barderians.com.ng/.well-known/assetlinks.json` shows the file.
4. On your phone, open the `/app` page, download and install. Android asks once to allow "Install unknown apps".
5. If the build stops with red lines, send me a photo of them.

## 5. Check it (10 minutes)

1. **Look:**
   - On the laptop: a cream page, a navy menu, orange buttons.
   - On a phone: the glass bottom bar. Approvals shows only for an approving position.
2. **Back and breadcrumb:** open any page from Home. Back and "Home › …" appear at the top.
3. **Me:** tap Me. It shows only your own account and **Log out**.
4. **Skeletons:** on slow data, lists show grey shapes, not spinners.
5. **Approve:** "Approved. Saving…" shows at once. With Airplane mode on, it is undone with a message.
6. **Developer:** the developer account is refused at /login and signs in at /console.
7. **App:**
   - Sign in with your password. It asks "Use your fingerprint next time?": tap **Turn on**.
   - Log out, then use **Sign in with fingerprint**.
   - Me › App PIN: turn it on. Leave the app for 5 minutes and come back: the PIN screen shows, with **Use fingerprint**.
   - Me › Settings: the app version, and **Check for updates**.
   - Open a request, then **Print**: the phone's print screen offers **Save as PDF**. Export a list: the Share box opens.
   - Press back on Home: it asks **Exit ReqGen?**
   - Turn on Airplane mode: **You are offline** shows, with **Try again**.

## Releasing a new app version later

1. Raise both numbers in `mobile\version.properties`, for example 1.0.1 and 2. Write the changes in `mobile\release-notes.json`.
2. Run **MAKE_APP.bat** with the same key and password.
3. Commit and push. Every phone shows **New update available** on Home, and **Update** installs the new version over the old one.

A website-only change needs no new APK: the app shows the live site.
