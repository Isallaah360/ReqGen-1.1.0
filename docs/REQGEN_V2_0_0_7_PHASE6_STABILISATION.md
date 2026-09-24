# ReqGen v2.0.0.7 — Phase 6 Stabilisation

This hotfix remains inside Phase 6 and addresses defects observed in the deployed 2.0.0.7 UI.

## Corrected
- System Settings is constrained to one responsive content column and can no longer force the main frame horizontally.
- Active-role verification now runs silently; only denial/failure redirects are user-visible.
- Floating global hover tooltips are disabled. Contextual guidance remains consolidated under the shell Important Note control.
- Request action feedback is now a centred in-app status card with explicit success/error contrast and dismiss control.
- Official requests are blocked client-side from DG approval without a subhead.
- DG approval is blocked when the request has no attached Account Officer routing.
- A server-side workflow-integrity trigger is supplied to prevent an official request reaching DG without a subhead and to force DG→Account ownership to the assigned Account Officer.
- Audit Centre reconstructs missing historical role labels from recorded role-switch evidence when the business event omitted the role.
- Audit register spacing is compacted and the daily activity chart no longer renders zero days as misleading bars.

## Database migration
Apply `database/20260924_phase6_workflow_integrity_guard.sql` to the production Supabase database before validating the DG→Account workflow.

The migration intentionally does not duplicate financial posting logic inside `approve_request_step`; the existing canonical RPC remains responsible for reserve/expenditure accounting so balances cannot be double-posted.

## Repository audits
- Phase 6 UI: 98/98 PASS
- Responsive warnings: 0
- Internal navigation: 0 broken targets
- Route registry: 98/98
- Sensitive-route classification: 0 unclassified
- Live-data accuracy: 20/20 PASS
- NavBar coverage: 98/98
- Component contracts: PASS

Full workstation gates still required: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
