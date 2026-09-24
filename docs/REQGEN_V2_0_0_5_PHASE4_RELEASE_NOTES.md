# ReqGen v2.0.0.5 - Phase 4 Release Notes

## Release objective
Phase 4 standardises the Admin experience around compact, legible, internationally familiar enterprise UI patterns while correcting navigation state, action-button contrast and global workflow-officer configuration.

## Implemented
- Hardened the main navigation active-state resolver with longest-prefix matching.
- Parent module clicks now navigate to the selected module when coming from another module, then behave as expand/collapse controls while the user remains inside that module.
- Child navigation uses longest-prefix matching so contextual/dynamic routes remain attached to the correct location.
- Increased hover/current-location contrast without changing the approved shell geometry.
- Added complete visual definitions for every `reqgen-btn-*` variant used by ReqGen so white text cannot disappear on white/transparent backgrounds.
- Compacted Admin Dashboard cards, charts, tables, spacing and toolbars while preserving readable typography.
- Reworked User Management detail management into a focused modal workspace so role/department actions remain visible and the page does not expand into large empty areas.
- Reworked Account Routing editing into a focused modal with an explicit, high-contrast Save Routing action.
- Reduced Roles & Permissions spacing and table width while retaining the permission matrix and role management functions.
- Tightened Security Centre cards, checklist spacing, filters and action contrast.
- Rebuilt System Settings around canonical workflow officers and three Account Officer assignments.
- Added settings for Registry Officer, Registrar, DIN Admin, DG, HR, General Secretary and Account Officers 1-3.
- Preserved legacy `ACCOUNT_USER_ID` compatibility by mirroring Account Officer 1.
- Account Routing now recognises canonical Account Officer role variants instead of depending on one literal role string.
- Product version advanced to `2.0.0.5` / Patch 05 / Phase 4.

## Verification performed in the implementation environment
- Route registry: 98/98 registered - PASS.
- Internal navigation: 228 references, 0 broken - PASS.
- Route/RBAC audit: 0 duplicate routes, 0 duplicate policy prefixes, 0 unclassified sensitive routes - PASS.
- Live-data audit: 20/20 - PASS.
- NavBar coverage: 98 physical pages, 0 pages without a deliberate NavBar parent - PASS.
- Changed TypeScript/TSX files transpile successfully with the TypeScript compiler API.

## Workstation release gates
Run on the deployment workstation with the project's installed dependencies:

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

Release only when TypeScript and lint return zero production errors and the Next.js production build succeeds.
