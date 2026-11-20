# ReqGen v4.6.9 — release notes

Built on v4.6.8 and replaces it. This is a screens release.

- It has **one database step**, `database/v4_6_9_request_insight.sql`. The step only **adds one read-only function** for Request Insight.
- `database/v4_6_9_sms_check_READONLY.sql` is an optional check. It changes nothing.

The Routing Engine is not changed, and the home page design is not changed.

## 1. SMS and email after an officer acts (fixed)

**Why nobody was told.** After an officer approved, the screen asked the server to send the SMS and email. By then the request already belonged to the next officer. The server allowed only the requester or the officer holding the request to send alerts, so it refused the officer who had just approved (error 403), and nothing was sent. Most screens also sent nothing at all unless a separate Vercel setting was exactly "true".

**What happens now**

| Moment | Who is told |
|---|---|
| A request is submitted | The requester gets "submitted", and the first officer gets "awaits your approval". |
| An officer approves | The next officer, or the Account Officer at the Account step, gets "awaits your approval". |
| An officer sends it back for correction | The requester gets "returned to you". |
| It is sent back to an earlier officer | That officer gets "awaits your approval". |
| The requester corrects and resends it | The officer who returned it is told. |
| It is completed, paid, rejected or withdrawn | The requester is told. |

- **Who may send.** The officer who acted on the request in the last 30 minutes may send its alerts. Nobody else can spend SMS credit on it.
- **On by default.** SMS and email are on whenever `SENDCHAMP_API_KEY` is set in Vercel. They stop only if `SENDCHAMP_SMS_ENABLED` or `SENDCHAMP_EMAIL_ENABLED` is set to `false`. An unset setting no longer switches alerts off. The same applies to the submission code and to the voucher and registry reminders.
- **Logging.** Every attempt is written to `sms_logs`, whether it was sent or failed, and the reason is kept. `v4_6_9_sms_check_READONLY.sql` shows the last 30 attempts.

## 2. Home and sign-in pages

The faint IET logo watermark behind the card has been removed from these pages:

- the home page;
- sign-in, 2FA, create account and reset password;
- the document check page.

Nothing else on the home page has changed: the logo, "Welcome to ReqGen", the text and the buttons are exactly as before.

## 3. Motion (screens only)

- **Green tick in the centre.** A tick appears after every save, submit, approval, signature, payment, filing or reminder sent. This covers Administration, Finance, Registry, Vouchers, Requests and My Account. It reads, for example, "Details saved successfully", "Submitted successfully", "Approved successfully" or "Sent successfully", with the page's own message underneath. It disappears by itself after about two seconds, and clicks pass through it.
- **IET stamp and ink.** When the Director General approves, the IET stamp lands and a stroke of ink is drawn.
- **Live alerts.**
  - When something arrives while you are working, a card slides in with a heading: "Request received", "Voucher received", "Request approved", "Sent back to you" or "Payment made".
  - The bell rings once.
  - Anything that needs your action opens the attention box.
- **Dashboard.** Numbers count up when the page opens. Money is never counted up. Cards and tiles lift slightly and light up under the pointer, and the current step on "My requests" pulses.
- **Welcome.** The dashboard greeting shows the Hijri date next to the usual date (for example "25 Jumada al-Ula 1448 AH"), followed by one "Did you know?" tip a day.
- **Pages.** Pages and journeys rise in gently, and budget bars fill from empty.
- **Where nothing moves.** The Audit Log, the 2FA screens and print-outs stay still. Everything stays still on a device set to "reduce motion".

## 4. My Account

- **Appearance.** Choose Light, Dark or Same as device, and IET orange or **IET green**. The choice is kept on that device and works in both Light and Dark. The Developer Console keeps its own look.
- **Milestones.** Six quiet milestones, with no pop-ups:
  - First request
  - Ten requests
  - First action as an officer
  - Fifty actions
  - Signature saved
  - Fingerprint added

## 5. Request Insight (DG and approving officers)

The officer who has to decide on a request now sees a **Request Insight** panel above "Your decision". It has five tabs:

- **Similar before.** Earlier requests from the same department of the same kind, for the same subhead, or with the same words in the title. Each one links to its record.
- **This subhead.** How often the subhead was used in the last 12 months. Officers who may see balances also get:
  - the allocation, the amount reserved and spent, and what is available;
  - what is left after this request, or how far short it falls.
- **Amount check.** This amount against the average, lowest and highest of approved requests of the same kind in the last 12 months.
- **Requester.** How many requests the requester made in the last 12 months, the total, how many were sent back, and the date of the last one.
- **Time on route.** Each step so far, how long each one took, and how long the request has been with you.

Above the tabs, a **follow-up** note links to the requester's earlier requests for the same thing, including those from previous months and years. If the same amount was asked for in the last 45 days, the note says **possible repeat** so nothing is paid twice.

**Privacy rules**

- The panel is read only.
- Only officers on that request's route can open it. The requester, Registry and everyone else cannot.
- Balances are shown only to positions allowed to see them (DG, General Secretary, DOD, HOD, DIN Admin, Registrar, HR, Account Officers and Auditor). The database decides this, not the screen. PD, PA to the DG, Registry, Counter Signer and Staff never see balances.

## 6. Delete a deactivated account (Super Admin)

The staff record of a **deactivated** account now has a **Delete permanently** button. Only the Super Admin sees it.

- **History blocks deletion.** If the account has any history (requests, approvals, attachments, vouchers, signatures, payments, transfers, reversals or registry records), it cannot be deleted and stays deactivated, so every record keeps its name. The box lists what was found.
- **Settings must be changed first.** The box says so if the account is still named as a HOD, DOD, Account Officer, route officer or backup officer. Nothing in the Routing Engine is changed from here.
- **Confirming.** To delete, type **DELETE** and enter your 2FA code. The server accepts the deletion only within 5 minutes of that code.
- **What is removed.** The sign-in, positions, devices, passcodes, fingerprints, drafts and notifications.
- **Audit Log.** It keeps the line "Deactivated account deleted".
- **Who cannot.** Active accounts, system accounts and your own account can never be deleted.

This is how the three demo accounts can be removed, provided they have no history.

## 7. Checks run before release

- **Install and build.** Clean install, lint, typecheck and production build passed.
- **Release audits.** Every deploy and production audit passed, including a new v4.6.9 lock with 29 checks.
  - The v4.6.0 rule "staff are never deleted" now reads "staff are not deleted while they have history".
- **New browser suite.** 32 checks, all passed. They include:
  - SMS/email attempted for the next officer straight after the DG approved (logged with Usman Gawu as the recipient);
  - the tick, the stamp, live alerts, themes, Hijri date and Insight;
  - deletion allowed, deletion blocked, and the API refusing anyone who is not the Super Admin.
- **Database step.** It ran twice with every row OK. As a check, the DG and HOD see Insight with balances, the PD sees it without balances, and the requester and Auditor are refused.
- **Earlier browser suites and crawl.** See the deployment guide for the results.
