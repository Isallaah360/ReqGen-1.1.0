# ReqGen changelog

## 4.7.0 (23 Nov 2026)

With the ReqGen real app 2.0.0 and the Barderian Privacy and Lightness Check. Needs the database step database/v4_7_0_upgrade.sql (safe to run twice; nothing is dropped). The routing engine and the approval rules are unchanged.

### New
- One 6-digit code for every send and every decision. ReqGen sends it by SMS (sender name ReqGen) and by e-mail at the same time; either one works. This is the same on ietreqgen.barderians.com.ng, the Vercel address and the app. The database itself refuses a request or a decision without a fresh code, so no screen can skip it.
- Approving no longer needs the authenticator app (this is what stopped the Internal Auditor). The SMS or e-mail code is enough. Delete still uses the authenticator.
- Direct to one or many people, from any departments (up to 50). No HOD, HR, DG or Account step. Each person answers on their own: approve, reply, decline, or forward. To be paid, a receiver forwards it to the DG with the Account Officer. The sender sees each answer and can send a reminder.
- Registry tracking shows the real Direct route: sent by, then each person and their answer. Registry still never sees the title, amount or message.
- Everyone is told at once: SMS, e-mail and an in-app notice when a request reaches them. The SMS and e-mail carry the request number and what to do, never the title or amount.
- "What the officers said": every comment and approval on a request, oldest first, so the DG sees what each officer said. Printing adds it as page 2, "Comments and approvals on REQ...". Page 1 is unchanged.
- ReqGen app 2.0.0: a real app. Every screen is inside the APK (Home, Requests, New, Direct, Approvals, Me), with PIN and fingerprint, sheets from the bottom, pull to refresh, swipe back and saved lists for weak network. Only the data comes from our database.

### Fixed
- Password reset: the link from the e-mail opened "This reset link is not valid any more" when it opened inside the app (1.0.2). The reset page now reads the link in every form, clears the one-time key from the address, and explains an expired or used link. Links opened in app 1.0.2 now load the page fully.
- A person sent a Direct request could not open it ("Request details are restricted"). They can now open it and answer.
- Approve and Send back no longer require the authenticator app to be set up.
- If `SENDCHAMP_SENDER_NAME` is missing, SMS go out as ReqGen (the approved sender name).

### Better (Privacy and Lightness Check)
- Content Security Policy on the website and in the app: they may talk only to our website and our database.
- Unused images and files removed; an unused package removed.
- E-mails no longer carry request titles.

### Unchanged on purpose
- Routing engine and approval rules, the home page design, page 1 of every print-out, who can see subhead balances, and the IET stamp rule.

## 4.6.12 (22 Nov 2026)

Blueprint 06 (ReqGen) and Blueprint 00 (the Barderian Design & Motion Kit), in IET colours. Design and motion only: no database step, no change to the routing engine or any approval rule, and print-outs are unchanged.

### New
- The approval route on a request is a vertical timeline. Done steps are filled, the current step pulses softly, and a vacant step the route skipped shows dashed.
- Approve and Reject open a centred box with a comment box. Reject needs the reason, and its red button is never the default.
- After you approve, your step fills at once while it saves. If the save fails, it rolls back with a short message.
- When the Director General gives final approval, the IET stamp lands beside the signature on screen (once). The printed letter is unchanged.
- New request: "Draft saved" with a tick, and "Request sent" with the request number.
- Payment vouchers: requests are cards you tap to choose, with a live "7 of 10". An 11th is refused with a short message.
- Budget and Subheads: a subhead over budget shows a red bar with "Over budget" and the block message.
- The QR check page shows a big green tick for a genuine record, or a red cross with the reason.
- A new website version shows "New version is ready" with Refresh. The app's update box shows the download as "1,204 KB of 4,812 KB", with Cancel.
- Open-source credits page (/credits) and THIRD-PARTY-LICENSES.txt, linked from the footer and from Me, Settings, About in the app.

### Better
- Every confirm box is centred on every screen, enters with a small scale (240 ms) and starts on the safe button for anything risky.
- Ordinary saves show a short message in the centre for 2.5 s. The big tick is kept for real milestones: request sent, an approval, a payment.
- The idle sign-out warning is a centred box with a countdown ring. The 15-minute rule is unchanged.
- New items slide into lists (my requests, approvals, notifications, voucher cards). The bell's dot pops when a new notification arrives.
- Numbers on summary tiles count up once when you first see them (about 1.4 s).
- Busy buttons keep their size and show a small spinner. A second tap does nothing.
- On phones, the orange marker slides to the tab you open.
- Icons use a 2 px stroke. Empty lists show a small drawing and one next step.
- Reduce motion on the phone, Data Saver and low-power phones get instant changes with no animation.

### Fixed (found by the page-by-page check)
- Dark mode: the small orange count badges (menu counts, the bell, numbered steps, the Super Admin avatar) had white text on light orange. They now have navy text.
- Dark mode: A4 report previews turned dark on screen. They now stay white paper with black ink, as they print.
- Permissions matrix: "route", "own" and "no" are easier to read in both modes.
- Wording: long dashes and dot bullets replaced across the screens ("GA05: Fuel", "Personal, Fund", "1 Sep 2026 to 31 Aug 2027"). The values stored in the database are unchanged.
- Phones: buttons, tabs, month arrows and links are at least 44 px tall. On 320 px phones, the transaction report and the budget box no longer push the page sideways.
- The error and "page not found" boxes are in IET colours.
- The footer starts below the screen, so content loading in no longer pushes it about.

### Unchanged on purpose
- Home page design, routing engine and every approval rule, request and voucher print-outs, the database, role names, who can see subhead balances, and the IET stamp rule.
