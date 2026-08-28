# ReqGen Mockup-Locked Government UI Implementation

Date: 2026-08-28

This update aligns the current ReqGen project to the approved page mockups while preserving existing workflow, role, finance, registry, HR, audit and administration logic.

## Locked visual architecture
- White institutional sidebar with IET identity, compact module navigation and blue active state.
- 72px top command bar with authorised search, notifications/messages, active-role selector and user identity.
- Full-width page workspace sized to the available display; no generic duplicate hero is injected by the root shell.
- Readable 16px base typography with restrained page headings and compact table text.
- Consistent cards, tabs, inputs, buttons, shadows, radii, tables, charts and status controls.
- One institutional footer only, with IET identity, Secure/Reliable/Accountable statement, developer website/email and Barderian Enterprises logo.
- Context tips remain opt-in through data-tip attributes only.
- Existing module-level duplicated navigation/footer chrome is suppressed by the global shell.
- Legacy dark hero banners are neutralised into the approved clean page-heading language.

## Directly rebuilt to the approved mockups
- Homepage
- Login page
- Main Dashboard
- Global authenticated application shell
- Global footer

## System-wide normalization
All remaining ReqGen pages inherit the same shell, content width, typography, table sizing, responsive behaviour and control styling without replacing their working business logic.

## Validation
- Route audit completed with no duplicate routes or unclassified sensitive routes.
- No Git conflict markers remain.
- Tailwind v4 import retained.
- Full Next.js build could not be run in this packaging environment because dependencies were not available locally and npm installation exceeded the execution window. Vercel production build remains the authoritative compiler check.
