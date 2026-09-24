# ReqGen v2.0.0.8 — Phase 7 Architecture Stabilisation

## Purpose
This release hardens the Phase 6/7 system architecture against workflow-authority drift, legacy-module re-exposure, non-interactive analytics and incomplete production-gate automation.

## Locked workflow correction
Subhead assignment is now restricted to the officer operating in one of these active roles:

- Director
- DIN Admin / legacy Dean Admin alias
- HOD
- Registrar
- HR

DG, Admin, Auditor, Account/Finance and Staff roles cannot assign a request subhead. The assigning officer must also be the current workflow owner.

An Official request cannot be routed to DG without a subhead. DG approval cannot route to Account without both a subhead and the Account Officer attached through the approved routing path.

### Database enforcement
Apply both migrations in order before production workflow validation:

1. `database/20260924_phase6_workflow_integrity_guard.sql`
2. `database/20260924_phase7_subhead_authority_guard.sql`

The Phase 7 migration enforces the subhead-authority allow-list against `user_active_roles` at the database boundary for authenticated application calls. SQL/service maintenance without an end-user JWT remains possible for controlled administration.

## RBAC reconciliation
- HOD is now represented in the canonical runtime role model and access matrix.
- Legacy `deanadmin` normalises to canonical `dinadmin`.
- Legacy `gensec` normalises to canonical `generalsecretary`.
- Director approval-stage matching recognises both historical `DOD` and canonical `DIRECTOR` stage keys.
- Reports remain Admin + Auditor only.

## Legacy architecture cleanup
- Standalone HR remains a compatibility redirect only; HR is a role, not a module.
- Standalone Staff remains a compatibility redirect only.
- Standalone Workflow remains a compatibility redirect to Audit Centre; workflow engine/history are preserved.
- Executive routes remain compatibility redirects to canonical modules.
- Orphaned `app/components/executive/*` implementation code was removed.

## Interactive analytics correction
The key operational charts now expose exact filtered values through an explicit click/keyboard interaction instead of relying only on hover titles:

- Dashboard request trend points and donut summaries.
- Reports summary donut and legend rows.
- Finance monthly expenditure bars and department expenditure rows.
- Registry trend and donut summaries.
- Audit Centre already retains clickable module/user bars that drill into the filtered audit register.

## Audit automation
Added:

- `npm run audit:phase7-architecture`
- `npm run audit:production`
- restored `npm run audit:section4`
- `npm run typecheck`
- strict `npm run lint` with `--max-warnings=0`

Current source-audit results in the stabilisation environment:

- Phase 7 architecture: 22/22 PASS
- Section 4 lock: 10/10 PASS
- Route audit: 98 routes, 0 duplicate routes/policies, 0 unclassified sensitive routes
- Internal navigation: 225 references, 0 broken targets
- Route registry: 98/98 registered
- Workflow readiness: PASS
- Responsive audit: 0 warnings
- Data accuracy: 20/20 PASS
- Component contracts: 163 application TypeScript files, PASS
- Phase 6 page audit: 98/98 PASS

## Mandatory workstation gates before production push
The source package does not include `node_modules`. Dependency installation timed out in the audit container, so this release does **not** claim the final ESLint, TypeScript or Next.js production-build result from that environment.

Run on the deployment workstation:

```powershell
npm ci
npm run typecheck
npm run lint
npm run audit:production
npm run build
```

Required release gate:

- TypeScript: 0 errors
- ESLint: 0 errors and 0 warnings
- Architecture/audit suite: PASS
- Next.js production build: SUCCESS

Only after all five commands pass should the source be committed and pushed for Vercel production deployment.
