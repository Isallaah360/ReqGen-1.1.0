# ReqGen v4.6.12: update guide

**From:** v4.6.11. **Time:** about 10 minutes. **Database:** no SQL step in this release. **App:** no new APK is needed.

v4.6.12 brings Blueprint 06 (ReqGen) and the Barderian Design & Motion Kit (Blueprint 00), in IET colours. It changes only design and motion.

These stay exactly as they were:
- the Home page design;
- the routing engine and every approval rule;
- request and voucher print-outs;
- the database;
- role names and who can see subhead balances;
- the IET stamp rule.

## Files

- `ReqGen_v4.6.12_source.zip`: the full project, including the `mobile` app kit. It has no `.env` files, no keystore and no `node_modules`.
- `DEPLOYMENT_GUIDE_v4.6.12.md`: this guide. It is also inside the zip.

## 1. Put it live

1. Open Command Prompt:
   ```
   cd C:\Projects\reqgen-web
   git checkout main
   git pull origin main
   ```
2. Delete everything in the folder **except** these four, then unzip `ReqGen_v4.6.12_source.zip` into the folder:
   - `.git`;
   - `.env.local`;
   - `public\downloads` (the APK and app-version.json);
   - `public\.well-known` (assetlinks.json, so links open in the app).
3. Install, check and push:
   ```
   cd C:\Projects\reqgen-web
   npm install
   npm run lint
   npm run typecheck
   npm run audit:deploy
   git add -A
   git commit -m "ReqGen v4.6.12: Blueprint 06 and the Barderian Design & Motion Kit"
   git push origin main
   ```
4. Wait for Vercel to show **Ready**. The footer should then read **ReqGen v4.6.12**.

If `npm run audit:deploy` prints a FAIL line, stop and send me a photo of it.

**Keep the two `public` folders.** The zip does not contain the APK. If you delete `public\downloads`, the push removes the app download from the website.

## 2. The app

The app shows the live website, so phones get v4.6.12 the next time they open ReqGen. You do not need to run MAKE_APP.bat.

The next time you do release an APK, the update box will show:
- "Do you want to upgrade?" with **Later** and **Upgrade**;
- then the download as "1,204 KB of 4,812 KB" with the %, and **Cancel**;
- then Android's installer.

## 3. Check it live (15 minutes)

Use a test request. Sign in as each officer in turn.

1. **Official request:** Requests, New. The amount formats as you type. Press **Save draft**: "Draft saved" shows with a tick. Sign and submit: the big tick shows "Request sent" with the request number.
2. **Route timeline:** open the request. The route runs from top to bottom:
   - done steps are green with a tick;
   - the current step pulses softly;
   - a vacant step shows dashed as "vacant, skipped".
3. **Approve:** as the Head of Department, press **Sign and approve**. A box opens with a comment box.
   - Press **Approve**: your step turns green at once and "Approved. Saving in the background." shows in the centre. The big tick follows when it is saved.
   - **Airplane mode test:** turn on Airplane mode and approve. The step goes back and "Not saved: … Your approval was undone." shows.
4. **Reject:** the box says "Send this request back?". The reason is required, and the red **Send back** button is on the right. The box starts in the reason field.
5. **DG final approval:** as the DG, press **Approve, sign and stamp**, then confirm with your fingerprint or 2FA. On screen, the IET stamp lands beside the signature (once). Print the letter: it is exactly as before.
6. **Personal and Direct requests:** send one of each through to the end. The route and the rules are unchanged.
7. **Reopen and vacant steps:**
   - Reopen a returned request: it goes where it went before.
   - A position with nobody in it shows dashed and is skipped, as before.
8. **Payment voucher:** as the Account Officer, open Generate from Requests.
   - Requests show as cards. Tap them: the counter shows "7 of 10".
   - Tap an 11th: "A voucher holds up to 10 requests. Start another voucher for the rest." shows, and it is not added.
9. **Budget and Subheads:** a subhead with nothing left shows a red bar, **Over budget**, and a red note that no new request can use it.
10. **QR check:** scan the QR on a printed letter. A green tick card shows. A wrong code shows a red cross with the reason.
11. **Bell:** when a new notification comes in, the dot pops.
12. **Idle:** leave ReqGen for 14 minutes. "Still there?" shows with a countdown ring.
13. **Footer:** **Open-source credits** opens the credits page. In the app, it is under Me, Settings, About.
14. **New website version:** the next time you push an update, any page left open shows "New version v… is ready" with **Refresh** within 15 minutes, or as soon as the tab is opened again.

## Notes

- **Undo:** the Kit's toast can carry an Undo button. A signed approval is not given one, because the signature, the SMS and the next officer's notice go out at once. Instead the step shows as done at once and rolls back only if the save fails. Undo is used only where nothing has left ReqGen yet.
- **Pulse:** the current step pulses for as long as it is on screen, as Blueprint 06 asks. It is off when the phone's "Reduce motion" setting is on, and on Data Saver and low-power phones.
- **Success tick:** it plays from a small dotLottie file made for ReqGen. Its player loads quietly in the background a few seconds after a page opens, so a page never waits for it. On low-power phones, Data Saver and "Reduce motion", the same tick is drawn without the player.
- **Dialogs** are centred on every screen, including phones. Form boxes that used to slide up from the bottom on phones are now centred too.
- **Page-by-page check:** before release, all 134 pages were opened at phone size (360 px) and laptop size (1280 px), in light and dark. Each was checked for errors, sideways scrolling, browser pop-ups, long dashes and dot bullets, purple, text contrast (4.5:1) and 44 px tap targets on phones. What it found is fixed and listed in CHANGELOG.md under "Fixed".
- **Layout shift:** the Kit's motion never moves the layout. It animates only transform and opacity, and the tests measured 0 shift after a page has loaded, including during approve, the toasts and the success tick. While a page first loads its data, some content still settles into place. This was already so in v4.6.11, and this release reduces it (the footer no longer jumps). Removing it fully needs each page's loading shapes matched to its real content, and that can be a later patch.
- **"You have 1.0.1"** in the update box shows only inside the real app.

## App 1.0.2: fix for "You are offline" (22 Nov 2026)

**Why:** the installed app was built from the old files. They open `reqgen.barderians.com.ng`, which Vercel never approved, so every launch failed and showed the offline screen. You can tell that screen is the old one because its logo shows as a broken picture.

`ReqGen_App_Kit_Fix3.zip` makes the build stop unless the app opens `https://ietreqgen.barderians.com.ng`. It checks this before building, after Capacitor prepares the project, and inside the finished APK. It also deletes any older build first, and raises the app to **1.0.2 (build 3)**. The offline screen now shows the app version and the address it opens.

1. Close Command Prompt. Unzip `ReqGen_App_Kit_Fix3.zip` into `C:\Projects\reqgen-web` and choose **Replace** for every file. It contains only the `mobile` folder.
2. Double-click `mobile\MAKE_APP.bat` and type the ReqGen key password. It must end with these two lines:
   - **Checked inside the APK: it opens https://ietreqgen.barderians.com.ng (app 1.0.2, build 3)**
   - **DONE: ReqGen.apk 1.0.2 (build 3) is ready …**
3. Push:
   ```
   cd C:\Projects\reqgen-web
   git add -A
   git commit -m "ReqGen app 1.0.2: opens ietreqgen.barderians.com.ng"
   git push origin main
   ```
4. On the phone:
   - uninstall the old ReqGen app (Settings, Apps, ReqGen, Uninstall);
   - wait for Vercel **Ready**;
   - open `https://ietreqgen.barderians.com.ng/app` and confirm it says **Download ReqGen 1.0.2**;
   - download and install.
5. Open ReqGen. It shows the sign-in page. If the offline screen ever shows on a working network, the small text under **Try again** says the version and address: send me a photo of it.
