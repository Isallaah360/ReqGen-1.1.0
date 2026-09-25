# ReqGen v2.0.0.7 - Phase 6

ReqGen Phase 6 is the visual and responsive reconciliation release. It standardises the full application page-by-page against the adopted ReqGen shell while preserving live functionality, RBAC and Phase 5 data-integrity rules.

## Release identity

- Product: ReqGen
- Product version: 2.0.0.7
- Patch: 07
- Phase: 6 - Visual & Responsive Reconciliation
- npm package version remains `2.0.0` for valid SemVer compatibility.

## Phase 6 highlights

- Audited all 98 physical application pages; all 98 pass the Phase 6 containment scan.
- Reconciled frame spacing, typography, cards, controls, tables, tabs, forms, dialogs and responsive grids system-wide.
- Added a final responsive design contract in `app/globals.css` so no screen table, chart, dialog or component can force the main application frame wider than the viewport.
- Standardised screen CSS-module microcopy to an 11px minimum and primary controls/tables to 12-13px for readability.
- Corrected Profile / Security & 2FA tab contrast and action-button visibility.
- Replaced brittle five/six-column desktop-only grids with content-aware auto-fit grids on Admin, Finance, Registry and supporting workspaces.
- Removed oversized fixed-width screen constraints from Access Audit, Admin readiness/system health, Registry, Payment Voucher and related workspaces.
- Preserved print-specific geometry separately from screen-responsive rules.
- Added/retained hover/focus value affordances for live charts in Dashboard, Finance, Reports, Registry and Audit surfaces.
- Improved the responsive audit so it distinguishes real CSS sizing risks from Tailwind class names embedded inside CSS selectors.
- Responsive audit now completes with zero warnings.

## Verification artifacts

- `docs/REQGEN_V2_0_0_7_PHASE6_RELEASE_NOTES.md`
- `docs/REQGEN_V2_0_0_7_PHASE6_PAGE_AUDIT.md`
- `audit-output/phase6-page-audit.json`
- `audit-output/responsive-ui-audit.json`

## Workstation release gate

Run on the deployment workstation after copying the project while preserving `.env.local` and `.git`:

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
npm run audit:responsive
npm run audit:phase6-ui
npm run audit:navbar
npm run audit:route-registry
npm run audit:navigation
npm run audit:routes
npm run audit:data-accuracy
npm run audit:components
```

Do not deploy unless TypeScript, ESLint and Next.js production build are clean.

## Phase 8 Stabilisation Addendum — 24 September 2026

Phase 8 adopts Finance > Budget & Subheads as the system-wide visual component source of truth for operational tabs, tables, dropdowns, filters, action controls, chart containers, cards and density.

Implemented in this package:
- Dashboard Request by Category and Request by Status now use true SVG donut geometry rather than CSS conic-gradient buttons.
- Dashboard request data remains scoped to the authenticated creator.
- Registry Centre Overview now reads live requests, request_history and payment_vouchers and presents workflow movement, current queues, Account queues, PV counts and recent request movements.
- Registry correspondence workspaces remain available under Incoming, Outgoing, Dispatch and All Operations.
- Audit Centre Daily Activity Trend was replaced with exact 14-day numeric intelligence and a compact daily count strip.
- Canonical tab treatment was extended to Requests, Payment Voucher register, Finance directory, Profile local navigation and Registry workspaces.
- Global table geometry was aligned to the approved Budget & Subheads density and header treatment.
- Release shell label updated to Phase 8 · Stabilised.
- Added `npm run audit:phase8-stabilisation` and included it in `audit:production`.
