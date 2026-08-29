# ReqGen 1.1.0 — Navigation, Request Workflow & Stability Audit

Date: 2026-08-29

## Scope

This pass was performed against the complete `reqgen-web.zip` supplied by the user. The objective was to correct the missing/hidden request workflow access points, make request submission unmistakably accessible, and remove the protected-route white-screen/flicker during navigation without weakening MFA or role authorization.

## Corrections

1. **Create New Request submission**
   - Kept the existing request validation, signature, OTP and Supabase submission workflow unchanged.
   - Added a visible **Submit Request** action immediately beside the signed state after `Sign Request` succeeds.
   - Kept the original footer Submit action and made the footer action bar sticky so it remains reachable during long forms.

2. **Requests Overview Actions**
   - Eye now links directly to `/requests/[id]`.
   - Pencil now links directly to `/requests/[id]/edit`.
   - More now opens a real action menu with View Details, Edit Request and Print / PDF (`/requests/[id]/print`).
   - Uses Next.js `Link` for prefetch-friendly navigation.

3. **Hidden operational request pages**
   - Verified that request details, edit and print routes exist and are covered by the authenticated `/requests` route policy.
   - Retained their existing workflow/security logic and adopted request-family styling.

4. **Navigation flicker / blank display**
   - The persistent `GovernmentAppShell` now sits outside MFA/route guards so Sidebar, TopBar and Footer remain mounted during secure checks.
   - MFA verification is cached for the verified protected session instead of blanking on every route change.
   - Role authorization remains route-specific and uses an in-shell security transition instead of returning a blank page.
   - Added `app/loading.tsx` and a subtle route progress/skeleton state.
   - Shell role context is no longer reloaded on every pathname change; it refreshes on protected-shell entry and active-role changes.
   - Navigation is not exposed until role context is ready.

5. **Broken Help link**
   - `/requests/new` previously linked to `/docs`, but no `app/docs/page.tsx` existed.
   - Added a lightweight ReqGen Help Centre at `/docs` based only on existing workflows; no new RPC/table/business process was introduced.

6. **Production hotfix continuity**
   - Retained the previously required FinanceOperations TypeScript row/export typing corrections so the clean project does not regress the successful deployment fixes.

## Audit results

- Page routes: **130**
- Duplicate routes: **0**
- Unclassified sensitive routes: **0**
- Workflow readiness: **PASSED**
- Required workflow files missing: **0**
- Mockup-lock audit: **100%**
- Internal navigation references scanned: **300**
- Broken internal navigation targets: **0**
- CSS brace mismatches: **0**
- Merge-conflict markers: **0**
- Changed TypeScript/TSX syntax diagnostics: **0**

## Security note

The visual blanking was removed without removing the security gates. MFA is verified once for the protected authenticated session, while role authorization remains route-specific. During a check, the adopted shell stays visible and the target workspace is concealed behind the secure transition state until authorization succeeds.
