# ReqGen RMB Real Visual Enforcement — 2026-08-30

This corrective implementation is applied directly to the stable project tree supplied by the user.

## Corrections implemented

- GovernmentAppShell now renders one authoritative `GlobalPageHeader` on every authenticated route.
- Local duplicate H1/page hero identities are suppressed for Sections 5–12 and discovered protected routes.
- Shared `EnterpriseHero`, `StrategicHero`, `HRHero`, `StaffHero`, `PVHero`, and `ReportsHero` are converted to action-only RMB toolbars; they can no longer reintroduce oversized duplicate hero banners.
- Root sidebar modules remain uppercase/bold; collapsible child items are compact Title Case and bold, not uppercase.
- Legacy in-page navigation is suppressed where the global sidebar already provides the same route family.
- Profile coloured hero and coloured ProfileNavigation strip are retired. Profile business functions, role switcher, 2FA/security status, profile fields, signature, email and password actions remain.
- Profile Security, Access and Activity routes use the same global page identity rather than their old gradient hero banners.
- Change Password uses the global page identity and retains only the Dashboard action plus the security/password workflow.
- Sections 5–12 receive uniform RMB card radius, shadows, form controls, table typography, fitted register behaviour and compact vertical rhythm.
- Print routes are excluded from screen-only hero/table overrides.

## Route/mockup verification

- Approved Section 5–12 specification set: 69/69 passed.
- Live Section 5–12 route-family audit: 74 pages, 0 failures.
- Master route registry: 135/135, 0 missing, 0 stale.
- Internal navigation: 298 references, 0 broken targets.
- RMB page architecture: PASS.
- Workflow readiness: PASS.
- Mockup lock audit: 100%.
- Component contracts: 216 files, 0 failures.
- TypeScript parser syntax audit: 230 TS/TSX files, 0 syntax failures.

## Build limitation in this environment

A dependency installation attempt timed out and left no usable local Next/ESLint binary. The global TypeScript parser was therefore used for syntax parsing, while all repository-native source/audit scripts above were executed successfully. Run the normal local `npm run lint` and `npm run build` before production push.
