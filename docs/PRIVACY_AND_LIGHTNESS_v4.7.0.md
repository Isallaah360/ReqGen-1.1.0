# ReqGen v4.7.0: Barderian Privacy and Lightness Check

Checked on 23 Nov 2026, for the website (v4.7.0) and the app (2.0.0). The rule: ReqGen never sells, shares or leaks staff data. No trackers, no adverts. Fonts and scripts come from our own website.

## 1. Who gets what

| Service | Data it gets | Verdict | Action |
| --- | --- | --- | --- |
| Supabase (our database) | All ReqGen records: staff, requests, approvals, files | Needed. It is our own project; row security decides who reads what. | Kept. Registry sees no contents; staff see no subhead balances. |
| Vercel (our website host) | Page requests and the address they come from | Needed to serve the website. No analytics turned on. | Kept. No Vercel Analytics or Speed Insights. |
| Sendchamp (SMS and e-mail) | Staff phone number and e-mail; the 6-digit code; the request number | Needed for codes and alerts. Sent from our server only, never from a phone. | E-mails no longer carry request titles. Alerts carry the number only, never the title or amount. Codes are stored only as a keyed hash. |
| Google Fonts | Nothing | Not used | The phone's own fonts are used (Aptos, Segoe UI, Roboto). |
| Outside scripts or analytics | Nothing | Not used | None in the website or the app. |
| GitHub | The code only | No staff data | `.env` files and the app signing key are never in the code. |
| The app (Android) | Same as the website, on the phone | Talks only to our website and our database | Content Security Policy in the app; no website address inside the APK. |

## 2. Content Security Policy

- **Website** (next.config.ts): `default-src 'self'`; connections only to this website and our Supabase host; no outside scripts, fonts or frames; `frame-ancestors 'self'`. Plus Referrer-Policy, X-Content-Type-Options and Permissions-Policy (no camera, microphone or location).
- **App** (mobile/app/index.html): only its own files, our Supabase host and ietreqgen.barderians.com.ng.

## 3. Privacy test every round

Each test round records every address the website and the app contact, and fails if any is not ours:
- website: only the website itself and Supabase;
- app: only its own files, Supabase and ietreqgen.barderians.com.ng.

`npm run audit:v470` also fails if an outside address, an analytics package or an outside font appears in the code.

## 4. Lighter

| | v4.6.12 | v4.7.0 |
| --- | --- | --- |
| Website start-up JavaScript | 523 KB | 523 KB (unchanged) |
| Website JavaScript, all pages | 3,154 KB | 3,063 KB (91 KB less) |
| Website public files | 2,210 KB | 2,003 KB (206 KB less) |
| App screens inside the APK | none (it loaded the whole website each time) | 538 KB, 143 KB of it JavaScript once compressed |

Removed: 9 unused page images, 5 unused starter icons, an unused logo mark, the `clsx` package, and the old offline page.

## 5. Stability and look

- **Tab switch:** leaving ReqGen for another tab or app and coming back keeps the page and what was typed; nothing reloads (tested on the website and in the app).
- **Status bar on Android 15 and newer:** the app draws edge to edge, keeps its content below the status bar, and sets light or dark icons to match the theme, so the time and battery stay readable.
- **Wording:** no long dashes and no dot bullets in the app; IET navy and orange; no purple. Barderian appears only as the developer in the footer.
