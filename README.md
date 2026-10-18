# ReqGen v4.6.5

ReqGen (Request Generator) is the Islamic Education Trust (IET) request management system: requests, approvals, finance records, payment vouchers, registry, reports and audit — role-based and backed by Supabase. ReqGen keeps the records; the bank moves the money.

## Release identity

- Product version: **v4.6.5** (Semantic Versioning, MAJOR.MINOR.PATCH)
- Defined in one place only: `lib/version.ts`; `package.json` carries the same number (4.6.5).
- The design is the approved v4 mock-ups (Phases 0–7, pages 01–90). The rules are in the v4 Build Reference.
- What changed in v4.6.5: `RELEASE_NOTES_v4.6.5.md`. How to deploy it: `DEPLOYMENT_GUIDE_v4.6.5.md`. Earlier releases (including v4.6.3 and v4.6.4): `docs/releases/`.

## Navigation standard (from v4.0.0)

- Left menu with ten modules (`lib/v4/modules.ts`), grouped as Offices and Oversight; collapses on laptops and opens as a drawer on phones.
- Every module has a **mother page** of tiles (one tile = one page). The tiles, the breadcrumb, the search list and the menu all come from `lib/v4/modules.ts`.
- Breadcrumb on every page: Home › Module › Page › Record.
- The app frame is `app/components/v4/AppFrame.tsx`; `app/components/GovernmentAppShell.tsx` decides which pages use it.

## Design system

- `app/v4/v4.css` is generated from the approved mock-up stylesheet:
  `python3 scripts/v4/css_port.py scripts/v4/mockup-source.css app/v4/v4.css`
  (classes `v4-*`, tokens `--v4-*`). Do not edit it by hand.
- `app/v4/v4-theme.css` holds the dark theme and the React-only parts.
- React parts: `app/components/v4/` (PageHead, Stats, Tiles, Card, Notice, Chip, Rows, Tabs, Icon…).
- Every page is on the v4 kit (v4.6.3 rebuilt the last v3-look pages); retired addresses forward to their v4 page.

## Before every push

```
npm install
npm run lint
npm run typecheck
npm run build
npm run audit:deploy
```

## Sign-in

- Password + 2FA on any device; one check lasts 12 hours on that device (8 or 12, set in Administration › Security Centre).
- Fingerprint (passkey) sign-in counts as the 2FA check: `app/api/auth/webauthn`.
- 6-digit passcode joined to one trusted device: `app/api/auth/passcode` (only a slow, salted hash is stored; 5 or 3 wrong tries — set in Security Centre — remove it).
