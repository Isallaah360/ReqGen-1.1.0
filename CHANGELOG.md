# ReqGen changelog

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
