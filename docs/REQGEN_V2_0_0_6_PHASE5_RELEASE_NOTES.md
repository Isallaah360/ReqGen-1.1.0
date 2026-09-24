# ReqGen v2.0.0.6 - Phase 5 Release Notes

## Release

ReqGen `2.0.0.6` / Patch 06 / Phase 5 - Live Data Integrity & Single-Source Calculations.

## Audit Centre reconstruction

The Audit Centre was rebuilt against the approved Phase 5 mockup while preserving live functionality and Admin/Auditor access control.

Implemented workspaces:

1. Overview - live KPIs, module activity, daily trend and recent evidence.
2. Audit Logs - searchable/filterable/paginated chronological evidence register.
3. User Activity - top actors and user activity register derived from the same filtered live audit dataset.
4. Data Integrity - live checks for departments, subheads, canonical balances, IET accounts and audit-source coverage.
5. Workflow Trace - request/approval history retained inside Audit Centre after removal of the standalone Workflow UI.
6. Compliance Reports - export/print output generated from the currently filtered live evidence and source-health register.

Additional controls include event detail dialogs, source table traceability, CSV export, print/PDF output, severity classification and real-time refresh subscriptions for operational audit sources.

## Global UI standardisation

- Removed duplicate Admin Dashboard greeting; global topbar remains the single greeting surface.
- Added a shared `Important Note` tooltip to every authenticated page through `GovernmentAppShell`.
- Added consistent focus, hover and active interaction behaviour to links, buttons, tables, inputs and dropdowns.
- Maintained a small inset between page content and the main application frame.
- Added global table-row hover feedback for clearer interactivity.

## Finance Overview

The following long live-data displays are now paginated rather than visually unbounded:

- Expenditure by Department
- Budget Health
- IET Account Balances

No records are dropped. Numbering reflects the current page position and users can navigate every live row. Finance chart/list items expose hover/focus detail text.

## Interactive charts

- Audit Centre module bars are clickable and filter the evidence register.
- Audit daily trend exposes exact counts on hover.
- Finance expenditure bars expose live amount tooltips.
- Dashboard request-trend points expose exact request counts.
- Registry charts/donuts expose live summary tooltips.

## Live-data integrity

Phase 5 retains the locked canonical balance rule:

`Approved Allocation - Reserved - Expenditure`

The Audit Centre Data Integrity workspace compares stored subhead balance values against this calculated value and reports discrepancies as warnings rather than replacing live data with synthetic values.

## Repository verification performed

The following repository-native gates passed after the final Phase 5 edits:

- TypeScript/TSX syntax transpilation: 183 files, 0 syntax errors.
- Route registry: 98 / 98 physical routes registered.
- Internal navigation: 228 references, 0 broken targets.
- Route/RBAC audit: 0 duplicate routes, 0 duplicate policy prefixes, 0 unclassified sensitive routes.
- Live-data accuracy audit: 20 / 20 PASS.
- Component contract audit: 168 application TypeScript files, 0 unsupported typed props.
- NavBar coverage: 98 physical pages, 0 pages outside a deliberate NavBar parent.

## Workstation production gate

The current execution environment does not provide the project's installed npm dependency tree, so a genuine Next.js lint/build cannot be claimed here. On the deployment workstation run:

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

Then run:

```powershell
npm run audit:navbar
npm run audit:route-registry
npm run audit:navigation
npm run audit:routes
npm run audit:data-accuracy
npm run audit:components
```

Required production result:

- TypeScript: 0 errors
- ESLint: 0 errors
- Next.js production build: SUCCESS
