# ReqGen 2.0.0.4 - Global Standardisation Patch

## Scope
This patch reconciles the approved Admin/Profile/Manual Voucher mockups with ReqGen's canonical navigation and corrects the remaining Phase 3 lint architecture issues before production deployment.

## Locked corrections
- Canonical user-facing role name is **DIN Admin**. The retired `deanadmin` key is accepted only as a runtime compatibility alias so historical assignments do not break.
- Profile is a first-class ReqGen navigation module with consistent local tabs and a redesigned personal-information workspace.
- Manual Voucher Creation is canonically under **Payment Vouchers** at `/payment-vouchers/manual`.
- `/finance/manual-voucher` remains only as a compatibility redirect to the canonical Payment Voucher route.
- Every physical authenticated page has a deliberate main NavBar parent. Global current-location breadcrumbs now display that parent and the current page.
- Payment Vouchers sidebar now exposes Payment Voucher Centre, Create Manual Voucher, and PV Settings.

## UI reconciliation
- Profile rebuilt to the approved enterprise layout: identity summary, role/department metadata, personal details, institutional signature, credential actions, and security/2FA state.
- Manual Payment Voucher rebuilt around the approved workflow header, step indicator, live summary, department/account/subhead context, balance preview, controlled save/post workflow, and recent voucher register.
- Department selection on manual vouchers uses live departments and filters live subheads without fabricating unsupported database values.
- Global breadcrumb/location surface keeps contextual pages visually anchored to the main navigation.

## Lint corrections
The two reported `react-hooks/set-state-in-effect` failures were corrected without disabling the rule:
- `app/admin/account-routing/page.tsx`
- `app/admin/page.tsx`

Initial async workspace loads are scheduled after the effect body rather than synchronously invoking state-setting loaders. The same pattern was applied proactively to the Admin Roles, Admin Settings and Manual Voucher initial loaders.

## Audit results in the delivery environment
- TypeScript/TSX syntax transpilation: 183 files, 0 syntax errors.
- Route registry: 98/98 physical routes registered.
- Internal navigation: 0 broken internal targets.
- NavBar coverage: 98 physical pages inspected, 0 authenticated pages without a deliberate NavBar parent.
- Route/RBAC audit: 0 duplicate routes, 0 duplicate policies, 0 unclassified sensitive routes.
- Live-data accuracy: 20/20 PASS.
- Component contracts: PASS.

## Workstation production gate
The delivery environment does not contain the project's installed npm dependency tree, so the authoritative release gate remains the project workstation:

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
npm run audit:navbar
npm run audit:route-registry
npm run audit:navigation
npm run audit:routes
npm run audit:data-accuracy
npm run audit:components
```

Do not deploy unless TypeScript, ESLint and the Next.js production build complete successfully.
