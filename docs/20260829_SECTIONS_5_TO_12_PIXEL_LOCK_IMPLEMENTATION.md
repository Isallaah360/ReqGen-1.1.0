# ReqGen 1.1.0 — Sections 5–12 Approved Mockup Implementation

Date: 2026-08-29

## Scope
The approved function-locked mockups for Sections 5–12 are now enforced at runtime across all 69 approved routes through a canonical approved-mockup frame plus the existing functional page implementations.

Sections covered:
- Section 5 — Payment Vouchers (5 routes)
- Section 6 — Registry (6 routes)
- Section 7 — HR (32 routes)
- Section 8 — Reports (2 routes)
- Section 9 — Audit Centre (1 route)
- Section 10 — Workflow (1 route)
- Section 11 — Staff (10 routes)
- Section 12 — Admin (12 routes)

## What changed
1. Added `ApprovedMockupFrame` to the global Government shell for every approved non-public route in Sections 5–12.
2. Added an exact route/spec registry generated from the approved function-locked mockup specification.
3. Added canonical approved page headings, spacing, typography, content width, workspace summary panel and route-type layout rules.
4. Converted legacy action-bearing page headers into compact action toolbars while the approved canonical heading remains the visible title.
5. Normalised legacy cards, KPI blocks, forms, tables, buttons, gradients, shadows and rounded surfaces to the approved Government-style shell proportions.
6. Enforced desktop fixed-register tables and responsive mobile horizontal fallback.
7. Applied module density rules to Admin, Staff, HR and Payment Voucher KPI families to match the approved four-card mockup rhythm.
8. Preserved the existing page code, Supabase tables, RPCs, writes, role checks and workflow actions.
9. Regenerated mockup route metadata so specific routes such as `/payment-vouchers/reports` and `/payment-vouchers/settings` resolve before dynamic voucher-detail patterns.
10. Added `npm run audit:mockup-frame` and included it in `audit:deploy`.

## Verification
- Approved Section 5–12 specifications: 69
- Approved frame audit: PASS
- Section 5–12 existing contract audit: PASS
- Route audit: PASS — 130 routes, 0 duplicate, 0 unclassified sensitive routes
- Internal navigation audit: PASS — 300 references, 0 broken targets
- Workflow readiness: PASS
- Typed component contract audit: PASS — 208 files, 0 unsupported typed props
- CSS brace validation: PASS

## Build note
A full local `npm ci` could not complete inside the execution environment within the available network/time window. Vercel's Next.js 16.1.6 production build remains the authoritative compiler/runtime gate after push.
