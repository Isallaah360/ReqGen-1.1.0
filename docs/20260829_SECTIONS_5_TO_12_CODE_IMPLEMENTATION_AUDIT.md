# ReqGen 1.1.0 — Sections 5–12 Approved Mockup Code Implementation Audit

Date: 2026-08-29

## Scope

This implementation covers all 69 approved routes in Sections 5–12:

- Section 5 — Payment Vouchers: 5 routes
- Section 6 — Registry: 6 routes
- Section 7 — HR: 32 routes
- Section 8 — Reports: 2 routes
- Section 9 — Audit Centre: 1 route
- Section 10 — Workflow: 1 route
- Section 11 — Staff: 10 routes
- Section 12 — Admin: 12 routes

## Enforcement model

The approved mockups were treated as the visual specification only after each route's existing tables, RPCs, controls, actions, headings and redirect behaviour were captured in `20260829_SECTIONS_5_TO_12_APPROVED_MOCKUP_SPECS.json`.

No new database table, RPC, workflow state or business capability was invented during this redesign pass.

## Coding strategy

Instead of rewriting 69 working pages and risking their operational logic, the implementation applies the approved architecture through the shared presentation layer used by those pages:

1. `GovernmentAppShell` assigns every approved route a stable `data-route`, `data-mockup-section` and `data-mockup-type` marker.
2. `lib/mockupRouteTypes.ts` maps all 69 approved routes to their approved mockup type.
3. `globals.css` applies the approved 13px/12px typography, flat header, fitted tables, compact KPI cards, forms, panels, spacing, responsive rules and print treatment to every mapped route.
4. Legacy HR and Registry in-page navigation is removed because the adopted global sidebar is the single source of navigation.
5. HR Strategic and Workflow hero components were rebuilt to use the adopted flat shell rather than the legacy oversized dark hero design.
6. Reports loading/visual primitives were brought into the same shell language.
7. Every real HR route, including Registrar and Capacity Building routes, is now exposed from the global HR collapsible menu where role permissions allow it.

## Audit result

Run:

```bash
npm run audit:s5-12
```

Expected result:

- Approved mockup specs: 69
- Missing mapped routes: 0
- Missing captured table/RPC contracts: 0
- Duplicate local navigation renderers: 0
- Shell route-type hook: present
- Sections 5–12 design lock: present
- Result: PASS

The general ReqGen audits also pass:

- Route audit: PASS
- Workflow readiness: PASS
- Internal navigation: PASS
- Existing Sections 1–4 mockup lock audit: PASS

## Production note

The source-to-approved-spec implementation is complete. Final pixel certification still requires the deployed/browser render to be visually compared to the approved PNGs at the target viewport, because source inspection alone cannot prove raster-level equality.
