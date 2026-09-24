# ReqGen v2.0.0.7 - Phase 6 Release Notes

## Scope

Phase 6 is the page-by-page visual and responsive reconciliation release. It does not replace live business logic with mock data. It standardises how every active workspace fits, reads and behaves inside the approved ReqGen shell.

## System-wide reconciliation

### Frame containment
- Added a final application-frame contract that constrains authenticated content to the available viewport width.
- Added a small responsive inset between content and the main frame.
- Removed oversized arbitrary width utilities from production screen pages identified by the responsive audit.
- Screen tables now remain within the application frame; long text wraps rather than widening the page.
- Dialogs and popovers are viewport-bound and vertically scrollable where required.
- Print routes preserve dedicated print geometry independently of screen-layout constraints.

### Typography and readability
- Standardised the screen typography ladder for H1/H2/H3, body text, controls and tables.
- Raised CSS-module microcopy below 11px to an 11px minimum across 23 active UI stylesheet modules.
- Core table cells and interactive controls use 12-13px screen typography.
- Preserved the locked 13px main/collapsible navigation baseline.

### Tabs and 2FA/Profile
- Rebuilt the local-tab visual contract with explicit inactive, hover, focus and active states.
- Added `aria-current="page"` to Profile navigation.
- Reconciled Profile > Security & Sessions so 2FA actions use the canonical ReqGen action-button palette rather than mixed page-local colors.
- The formerly low-contrast Profile/2FA tabs now use blue active surfaces with white text and readable inactive text.

### Forms, buttons and dropdowns
- Standardised input/select/textarea heights, border radius, focus rings and text contrast.
- Added canonical primary/cyan/violet/warning action button styles with guaranteed foreground/background contrast.
- Added consistent keyboard focus visibility to buttons, links and fields.

### Responsive grids
Replaced brittle high-column-count layout utilities with content-aware auto-fit grids in targeted pages/components including:
- Admin Roles & Permissions
- Admin Security Centre
- Admin User Management
- Admin Workflow Test utility
- Registry Centre
- Directorate workspace menus
- Finance output/audit summary areas
- legacy Executive navigation compatibility surfaces

### Tables
- Removed known 1000px+ minimum-width table constraints from screen workspaces.
- Reconciled Registry, Payment Voucher Settings/Register and Admin Permission surfaces for frame-safe width.
- Table rows retain hover feedback and columns wrap rather than forcing horizontal page expansion.

### Charts and data visuals
- Preserved Phase 5 live-data rules.
- Added or retained hover/focus value disclosure on Dashboard, Finance, Reports, Registry and Audit visualisations.
- Reports summary donut now exposes an accessible live-data summary.
- Executive Analytics bars expose exact values on hover/focus.
- Finance account/subhead summary donuts expose exact counts through accessible labels/tooltips.
- Finance monthly bars expose exact income/expenditure values.

## Page-by-page audit

A physical route audit was generated for all 98 `page.tsx` routes. It records screen/print type and the presence of tables, forms, selects, dialogs and charts.

Result:

- Physical pages: 98
- PASS: 98
- REVIEW: 0

See `docs/REQGEN_V2_0_0_7_PHASE6_PAGE_AUDIT.md` and `audit-output/phase6-page-audit.json`.

## Automated verification completed in this environment

- Responsive UI audit: 0 warnings
- Phase 6 page audit: 98/98 PASS
- Route registry: 98/98 registered
- Internal navigation: 228 references, 0 broken
- Route/RBAC audit: 0 duplicate routes, 0 duplicate policy prefixes, 0 unclassified sensitive routes
- Live-data accuracy audit: 20/20 PASS
- NavBar coverage: 98 physical pages, 0 without deliberate parent
- Component contract audit: 168 application TypeScript files, 0 unsupported typed props
- TypeScript/TSX syntax transpilation: 183 files, 0 syntax errors

## Lint/build environment note

The source package intentionally does not ship a dependency tree. The execution container could not complete `npm ci` because one required npm tarball was unavailable in its local cache and outbound package installation timed out. Therefore this release does not claim an ESLint/Next.js production build result from this container.

The deployment workstation must run the authoritative gates:

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

Required release result:

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Next.js production build: SUCCESS

## Version

ReqGen product version: **2.0.0.7**  
Patch: **07**  
Phase: **6 - Visual & Responsive Reconciliation**
