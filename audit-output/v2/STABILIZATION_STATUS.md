# ReqGen 2.0.0.2 Stabilisation Status

## Implemented in this pass
- RAR baseline extracted without altering the original archive; SHA-256 baseline/current manifests generated.
- Product identity updated to ReqGen 2.0.0.2.
- Standalone Workflow removed from navigation/search; `/workflow` is now a compatibility redirect to Audit Centre workflow trace context.
- Legacy Command Centre/Executive pages are compatibility redirects to canonical ReqGen workspaces and are no longer root navigation/search modules.
- Standalone HR UI removed; `/hr` remains only as a compatibility redirect to Approvals. HR remains an RBAC/workflow role.
- Obsolete Staff workspace removed; `/staff` is now a compatibility redirect to Dashboard.
- Canonical Department Management moved to Admin; legacy Finance Departments redirects to Admin.
- Department CRUD preserves dependency-safe delete/deactivate behavior and now includes HOD/Director routing assignments.
- Admin sidebar exposes the canonical live Subheads & Budget Structure workspace without duplicating CRUD.
- Server-side Admin Delete User endpoint added with: service-role isolation, admin verification, self-delete prevention, historical dependency blocking, relationship cleanup, and Auth deletion.
- Route registry reconciled to the current physical route set.
- Environment contract documented; service role remains server-only.

## Static gates executed here
- Route registry audit: PASS (97/97 routes).
- Internal navigation audit: PASS (235 internal references, 0 broken targets).
- Route/RBAC classification audit: PASS (0 duplicate routes, 0 duplicate policy prefixes, 0 unclassified sensitive routes).
- Live-data accuracy audit: PASS (20/20 checks).
- Component-contract audit: PASS (165 application TS files, 0 unsupported typed component props).
- TypeScript/TSX syntax transpile audit: PASS (181 files, 0 syntax errors).
- Responsive audit: completed; 72 review warnings remain and require browser-level breakpoint review rather than being treated as silent passes.

## Environment-limited gates
A true `npm run lint`, dependency-aware `npx tsc --noEmit`, and `npm run build` could not be certified in this isolated runtime because `node_modules` was not supplied and the environment cannot reach npm. The global TypeScript compiler therefore reports missing React/Next/Supabase declarations, not a valid project type-check result.

Do not call the release production-ready until the VS Code/workstation commands in `docs/REQGEN_V2_RELEASE_RUNBOOK.md` all pass with the real dependencies and production-equivalent environment variables.
