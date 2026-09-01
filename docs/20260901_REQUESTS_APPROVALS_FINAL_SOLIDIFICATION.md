# ReqGen Requests + Approvals Final Solidification — 2026-09-01

This pass removes dimmed/black modal overlays from the two daily core workflows.

## Approvals
- Explicit Process Request action is visible in every pending row.
- Action column is positioned immediately after Date and before Status.
- Processing stays on /approvals and replaces the content canvas with the full Request Details workspace.
- No fixed overlay, backdrop blur, or hidden page context.
- Successful processing closes the treatment workspace and reloads the Approvals data.
- Responsive layout preserves the full form on desktop and mobile.

## Requests
- Create Request and Edit Request now use the entire ReqGen content canvas while Requests remains the active module.
- The former dark drawer backdrop is not used by these flows.
- Request submission has one Sign Request control. The final submission button remains labelled Submit Request and is enabled only after signing.
- Save as Draft remains available.

## Verification
- Shell lock: PASS.
- Route audit: PASS.
- Workflow audit: PASS.
- Internal navigation: PASS, 0 broken targets.
- Component contracts: PASS.
- TypeScript TSX transpilation diagnostics for touched TSX files: 0.

Final workstation gate remains `npm run lint && npm run build`.
