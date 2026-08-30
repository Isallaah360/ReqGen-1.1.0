# ReqGen RMB Mode - Phase 2 Header, Title and Space Cleanup

Date: 2026-08-30
Status: Implemented in current audited source tree
Governance: RMB MODE - Blueprint Locked

## Scope

This phase makes the global application shell authoritative for page identity and removes duplicated legacy hero/header content from operational screens without removing page actions or business functions.

## Implemented

- Global page header reduced to one operational title and time-aware greeting.
- Route taxonomy/category labels remain in the Master Route Registry but are no longer displayed as page overlines.
- Duplicate `.rg-module-header` titles, overlines and descriptive copy are suppressed inside the authenticated shell while action controls remain available.
- Legacy gradient hero titles are compacted where the global shell already provides the page identity.
- Global footer is compacted as the authenticated application footer authority.
- User-facing Executive wording was cleaned from legacy navigation/report/management surfaces while internal `/executive` route compatibility remains unchanged.
- Visible Phase/Production/System Administration jargon identified in operational UI was cleaned or neutralised.
- Long route titles were shortened in the Master Route Registry for navigation and global page headers.

## Short route-title corrections

- Route Access Audit Matrix -> Access Audit
- Account Assignment (Legacy) -> Account Assignment
- Officer Assignment & Delegation Centre -> Assignments
- HR Audit & Compliance Centre -> HR Audit
- HR Filing & Request Processing -> HR Filing
- Department Capacity Building -> Department Training
- HR Review & Decision Centre -> HR Review
- Staff Files & Records Intelligence -> Staff Records
- Payment Voucher Print View -> Voucher Print
- Registry Archive Register -> Archive
- Dispatch & Collection Register -> Dispatch
- Departments (Supabase Test) -> System Health

## Validation

- Source routes: 135
- Master registry routes: 135
- Missing registry routes: 0
- Stale registry routes: 0
- Internal references checked: 304
- Broken internal targets: 0
- Route-registry audit: PASSED
- Internal navigation audit: PASSED

## Build note

The production build could not execute in the current container because the existing dependency installation is incomplete (`next: not found`). Run `npm ci` followed by `npm run build` in the normal ReqGen development/deployment environment before production deployment.
