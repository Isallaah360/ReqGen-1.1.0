# ReqGen Approved Mockup Reconstruction — 2026-08-31

## Scope

This consolidation pass reconciles the deployed remaining-page family with the newly supplied approved mockups for Sections 5–12 plus canonical/form pages.

## Implemented architecture

- Rebuilt the authenticated Government shell toward the approved 1536×1024 mockup architecture: dark navy fixed sidebar, compact white top bar, approved blue active state, search-first topbar, language/appearance controls, ReqGen/IET identity, version block and approved content canvas.
- Increased all expandable sidebar submenu items to 13px and removed the nested 330px submenu scroll trap. The main navigation remains the single scrolling region.
- Added fluid hover/focus/page-entry animation with `prefers-reduced-motion` protection.
- Activated `ApprovedMockupFrame` globally for protected routes and supplied the canonical approved title/description frame for Sections 5–12 and canonical Payment Voucher routes.
- Added section-local CSS Modules (`approved-mockup.module.css`) for Payment Vouchers, Registry, HR, Reports, Audit Centre, Workflow, Staff, Admin, Profile and Docs.
- Added/updated section layouts so those CSS modules are actually applied rather than existing as unused files.
- Preserved existing route/business/data logic and local page components; the work is a presentation/shell consolidation rather than a database/workflow rewrite.

## Verification completed in this package

The following source-level audits were executed after consolidation and passed:

- Route access audit: 135 routes, 0 duplicates, 0 unclassified sensitive routes.
- Workflow readiness: PASSED.
- Internal navigation: 298 internal references, 0 broken targets.
- Mockup-lock audit: 100/100.
- Sections 5–12 mockup audit: 69 approved specs, PASSED.
- Approved redesign audit: 74 pages, PASSED.
- Component contract audit: 223 TypeScript app files, 0 unsupported typed component props.
- Approved mockup-frame audit: PASSED.
- Route registry audit: 135/135 routes reconciled.
- RMB page architecture audit: PASSED.

Responsive, print and performance static review scripts were also executed. They continue to emit review findings because those scripts are advisory scanners rather than pass/fail gates.

## Dependency-bound checks

The supplied project archive does not include `node_modules`. Two attempts to install dependencies in the execution environment timed out before `next`, `tsc` and `eslint` became available. For that reason this package does not claim a locally executed `npm run build`, `tsc --noEmit`, or `npm run lint` result. Deployment environments such as Vercel will install dependencies from `package-lock.json`; the final deployment gate should run `npm ci`, `npm run lint`, and `npm run build`.

## Deployment gate

```bash
npm ci
npm run lint
npm run build
```

If all three commands pass in the deployment environment, deploy the resulting project normally.
