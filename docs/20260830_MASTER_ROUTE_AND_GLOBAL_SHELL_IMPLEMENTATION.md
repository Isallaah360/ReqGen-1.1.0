# ReqGen Master Route and Global Shell Implementation

Date: 2026-08-30

## Bismillah

This phase establishes a single source of truth for ReqGen page discovery and global shell identity.

## Implemented

- Added a master route registry covering all 135 `app/**/page.tsx` routes.
- Added a route-registry audit that fails when a real page is missing from the registry or a stale registry entry remains.
- Rebuilt system-wide search from the same route registry.
- Rebuilt the Government App Shell navigation from the same route registry.
- Added root navigation families for Dashboard, Requests, Approvals, Finance, Payment Vouchers, Registry, HR, Reports, Audit, Workflow, Staff, Command Centre, Admin, Profile and Help.
- Added Command Centre as the user-facing name for `/executive` routes without changing stable URLs.
- Added real profile-name lookup from `profiles.full_name`; email-prefix fallback was removed from the shell identity.
- Added a global greeting standard: Good Morning 🌅 / Good Afternoon ☀️ / Good Evening 🌙.
- Added global page header and global application footer components.
- Root navbar labels are uppercase and bold; children remain compact Title Case.
- Protected `/docs` and `/change-password` as authenticated routes.
- Restricted the legacy `/test-supabase` route to Admin and redirected it to `/admin/system-health` so raw diagnostics do not remain as a production screen.
- Removed user-facing Executive prefixes from Command Centre page metadata.
- Removed/shortened several visible Phase/Production/System overlines in Admin and Finance settings.

## Verification

- Master route registry audit: 135 routes in source, 135 routes in registry, 0 missing, 0 stale.
- Internal navigation audit: 135 routes, 304 internal references, 0 broken targets.

## Build note

A full Next production build could not be completed in this environment because the dependency installation was incomplete/timed out. The source-level route and navigation audits pass. Run `npm ci`, `npm run audit:route-registry`, and `npm run build` in the normal development/deployment environment before production promotion.
