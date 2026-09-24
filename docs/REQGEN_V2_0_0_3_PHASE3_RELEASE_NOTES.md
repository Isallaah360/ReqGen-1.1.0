# ReqGen 2.0.0.3 - Phase 3 Release Notes

## Release identity

- Product: ReqGen
- Product release: 2.0.0.3
- npm SemVer: 2.0.0
- Phase: Phase 3 - Admin workspace and global UX standardisation

## Approved Admin architecture

The Administration navigation is now limited to the canonical administration workspaces:

1. Admin Dashboard
2. User Management
3. Roles & Permissions
4. Departments
5. Account Routing
6. Security Centre
7. System Settings

Subheads & Budget Structure is no longer an Admin navigation item. The canonical workspace remains under Finance at `/finance/subheads`, where Admin and Auditor can perform the approved budget/subhead operations according to the Finance route and page-level action controls.

## Phase 3 implementation

### Global shell

- Main application brand now displays `ReqGen` only.
- Product version moved to the lower sidebar near Sign out.
- Sidebar parent rows now toggle their collapsible menu from the whole parent tab; the chevron remains an additional toggle target.
- Footer typography increased for normal reading distance.
- Global table headers/body typography increased.
- Page-level horizontal drift is suppressed; wide data remains inside controlled table containers.
- Main content remains inside the adopted fixed responsive shell.

### Admin Dashboard

- Rebuilt to the approved dashboard family.
- Uses live Supabase profiles, departments, roles and role assignments.
- Role distribution chart is calculated from live profiles and primary/active role assignments.
- Department summary uses the live department register and lists every department in its controlled panel.
- Recent Users table uses live profile data.
- User Activity uses live `audit_logs` when readable. If the source is unavailable, ReqGen explicitly shows an unavailable-data state and does not fabricate chart values.

### User Management

- Admin-only user lifecycle management remains protected by the Admin route boundary.
- Added protected server-side **Add New User** flow using `SUPABASE_SERVICE_ROLE_KEY` only on the server.
- User creation provisions Supabase Auth, profile and primary ReqGen role as one guarded operation and rolls back the Auth user if profile/role provisioning fails.
- Existing dependency-safe user deletion remains server-side.
- User list is presented as a controlled paginated table with a focused Manage User workspace for department and multiple-role operations.

### Roles & Permissions

- Existing role CRUD is retained.
- Added a canonical live Route Access Matrix generated from ReqGen's actual route policies rather than manually invented permission values.
- Admin-only management semantics now align with the direct-route policy.

### Departments

- Existing dependency-aware Department Management remains canonical and retains Add/Edit/Activate/Deactivate/Delete and routing-officer controls.
- Phase 3 global Admin visual rules now apply to the workspace.

### Account Routing

- Rebuilt as a searchable, paginated routing table.
- Uses live departments, active IET accounts, Account Officers and `department_account_routing` data.
- Editing is performed in a focused routing editor.
- No secondary-account field was invented because the current authoritative routing schema contains one IET account and one responsible Account Officer per routing record.

### Security Centre

- Retains live Supabase MFA/AAL checks, security checklist, backup/RLS controls and print functionality.
- Renamed and visually harmonised as Security Centre.

### System Settings

- Canonical Admin settings page is now labelled System Settings.
- Existing functional global workflow-officer settings are preserved rather than replaced by decorative non-functional controls.

### Finance ownership of budget/subhead structure

- Removed `Subheads & Budget Structure` from Admin navigation and global Administration search classification.
- Finance retains `Budget & Subheads` as the single canonical workspace.
- Auditor already has approved action access on the Finance subhead page (`canManage` = Admin or Auditor).

### Version traceability

- Sidebar: version 2.0.0.3.
- Application footer: full ReqGen release label.
- Enterprise print engine: `Generated from ReqGen 2.0.0.3`.
- Standard Excel exports: release metadata and release-coded filename.
- Core CSV exports for Requests, Payment Vouchers, Reports, Registry Archive, Finance Accounts, Finance Assignments and Finance Operations include ReqGen release metadata; major filenames also include the release identifier.

## Verification completed in the implementation environment

- Route registry: 97/97 pages registered - PASS.
- Internal navigation: 232 references, 0 broken targets - PASS.
- Route/RBAC audit: 0 duplicate routes, 0 duplicate policy prefixes, 0 unclassified sensitive routes - PASS.
- Live-data accuracy audit: 20/20 - PASS.
- Component contract audit: 167 app TypeScript files, 0 unsupported typed component props - PASS.
- TypeScript/TSX syntax transpilation: 182 source files - PASS.

The implementation environment could not complete `npm ci`: npm exited with its own `Exit handler never called!` failure before dependencies were installed. Consequently the authoritative `npm run lint`, `npx tsc --noEmit`, and `npm run build` gates must be run on the deployment workstation before Git push. No claim is made that those three dependency-backed gates were executed here.

## Required workstation release gate

Run from the existing ReqGen repository after preserving `.env.local` and `.git`:

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

Then run:

```powershell
npm run audit:route-registry
npm run audit:navigation
npm run audit:routes
npm run audit:data-accuracy
npm run audit:components
```

Only push when the TypeScript, lint and production build gates are clean.
