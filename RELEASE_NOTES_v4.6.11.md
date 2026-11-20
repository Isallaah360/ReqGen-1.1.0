# ReqGen v4.6.11 and the ReqGen app 1.0.0

Built from the "ReqGen: app and update brief" (20 Nov 2026) and the approved mock-ups.

## New look (all screens, light and dark)
- Cream page, navy menus and text, orange buttons with navy writing. Dark mode is navy.
- The left menu on laptops is navy; the chosen page is orange.
- No purple anywhere. Request and voucher print-outs are unchanged.

## Phones
- A frosted-glass bottom bar: Home, Requests, New (raised), Approvals, Me. Approvals shows only for people who approve. The chosen tab lifts with a short amber line; a small dot shows new items.
- Me holds only your own account: profile and signature, password, security, passcode or PIN and fingerprint, notifications, appearance, settings, Log out.
- Home has "Everything else" for the other modules you can open.
- Every page that is not Home has a Back button and a breadcrumb (Home > Group > Page).
- Phones in Chrome "Desktop site" mode get a short note to turn it off.

## Faster to feel
- No spinners while pages load: grey shapes the size of the real parts, shimmering left to right (plain grey with reduced motion or on low-power phones). Screen readers hear "Loading".
- Approve and send back show the result at once; if the server refuses, it is undone with a short message. Mark as read works the same way.

## Kept apart
- No developer sign-in on public pages. The Developer signs in at the hidden address /console.
- After Log out you return to the ReqGen sign-in. Barderian Enterprises appears only in the footer, with WhatsApp 0803 119 7746 and info@barderians.com.ng.

## Speed
- Fonts and /assets are cached for a year; the public document check is cached for 60 seconds.
- Database step v4_6_11_upgrade.sql adds indexes on the columns ReqGen filters by. Nothing else changes.

## The ReqGen Android app 1.0.0
- Capacitor 8, id ng.com.barderians.reqgen. It opens the live website, so website updates reach the app with no rebuild.
- Its own short sign-in page with the app version and the developer footer. No website pages inside the app.
- "Use your fingerprint next time?" after a password sign-in; "Sign in with fingerprint" on the sign-in page. If the password changes, the app forgets it and asks once more.
- App PIN and fingerprint lock (after 5 minutes away). Signing, stamping and paying still need a fresh fingerprint or the 2FA code.
- Status bar follows light and dark. The back button closes an open box first and leaves the app only from Home.
- Files open the phone's Share box; Print opens the phone's print screen, which also offers Save as PDF.
- Updates inside the app: Home shows "New update available"; Update downloads with a progress bar, then Android asks to Install.
- ReqGen links in SMS and email open in the app (after assetlinks.json is on the website).
- Offline: a calm "You are offline" with Try again.

## Not in this release
- httpSMS as a backup SMS sender (the brief says: only after the owner confirms the phone and SIM).
- Phone push alerts when the app is closed (needs a Firebase project).
