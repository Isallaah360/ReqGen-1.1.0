# ReqGen v2.0.0.8 — Phase 7 UI/UX Stabilisation

## Locked reference
Finance → Budget & Subheads remains unchanged and is the canonical visual/component reference for Phase 7. Its page and module stylesheet were intentionally preserved byte-for-byte from the v2.0.0.8 Phase 7 baseline.

## Implemented stabilisation
- Standardised Phase 7 workspace geometry, cards, tables, inputs, action controls and tab strips around the Budget & Subheads component language.
- Stabilised sidebar hover/scroll behaviour by eliminating layout-changing hover transforms and reserving scrollbar geometry.
- Corrected the sidebar release label to `Phase 7 · Stabilised` while retaining ReqGen version `2.0.0.8`.
- Dashboard request queries are scoped to `created_by = authenticated user id`; organisation-wide payment voucher data is no longer queried by the personal dashboard.
- Dashboard request trend, status/category charts and recent activity are therefore derived from the authenticated user's request dataset.
- Dashboard donut/legend and line-chart points expose exact selected values through click/touch/keyboard-friendly controls.
- Finance Overview department expenditure and empty-state layout were compacted and standardised.
- Registry Centre removed the duplicate internal breadcrumb, standardised tabs, chart sizing and empty states.
- Reports Centre standardised tabs, table/chart geometry and interactive report chart presentation.
- Executive Analytics standardised insight-card layout and added exact-value selection for monthly/department expenditure rows.
- Audit Centre standardised tabs/tables and changed chart detail interaction from hover-only wording to explicit selection.
- Admin Roles fixed the narrow/wrapping action column, compacted the register, and presents legacy `registry` role data canonically as `Registrar` without breaking compatibility.
- Account Routing gained concise live routing KPIs and canonical register styling.
- Security Centre removed redundant Admin/Dashboard action controls, reduced duplicate information, compacted tabs/filters/checklist rows and aligned with the Phase 7 component standard.

## Automated source/architecture verification
`npm run audit:production` passes the following gates:
- Phase 7 architecture: 22/22 PASS
- Phase 7 UI stabilisation: 26/26 PASS
- Route audit: 98 routes, 0 duplicate routes, 0 duplicate policies, 0 unclassified sensitive routes
- Workflow readiness: PASS
- Internal navigation: 224 references, 0 broken targets
- Route registry: 98/98 aligned
- Responsive audit: 0 warnings
- Live-data/data-accuracy audit: 20/20 PASS
- Component contracts: 163 application TypeScript files, 0 unsupported typed props
- Section 4 lock audit: 10/10 PASS

A TypeScript syntax-only parse was also completed across 178 `app`/`lib` TypeScript files with 0 syntax errors.

## Dependency-gated release verification
This execution environment could not complete `npm ci` because external npm registry resolution/download timed out and the required dependency tarballs are not fully cached. Therefore ESLint, full dependency-aware `tsc --noEmit`, and `next build` cannot be truthfully certified in this container.

On the deployment workstation, run the following unchanged release gate after dependency restoration:

```powershell
npm ci
npm run typecheck
npm run lint
npm run audit:production
npm run build
```

Do not push to production if any of those commands returns a non-zero exit code.
