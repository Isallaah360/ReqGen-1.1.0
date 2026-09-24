# ReqGen v2.0.0.6 - Phase 5

ReqGen Phase 5 advances the live-data integrity, Audit Centre, interactive data presentation, pagination and system-wide UI standards established in earlier v2 releases.

## Release identity

- Product: ReqGen
- Product version: 2.0.0.6
- Patch: 06
- Phase: 5 - Live Data Integrity & Single-Source Calculations
- npm package version remains `2.0.0` for valid SemVer compatibility.

## Major Phase 5 work

- Rebuilt Audit Centre around its approved live-data governance mockup.
- Added Overview, Audit Logs, User Activity, Data Integrity, Workflow Trace and Compliance Reports workspaces.
- Added live source health, actor resolution, filters, pagination, evidence detail dialogs, CSV export and print output.
- Preserved Workflow as backend/history evidence inside Audit Centre rather than recreating a standalone Workflow module.
- Removed the duplicate greeting from Admin Dashboard; greeting remains in the global topbar.
- Added a system-wide `Important Note` tooltip surface to every authenticated route via the shared shell.
- Standardised interactive/focus/hover behaviour for tables, buttons, inputs, selects and links.
- Added interactive chart tooltips/hover behaviour to Audit, Finance, Dashboard and Registry chart surfaces touched in Phase 5.
- Paginated Expenditure by Department, Budget Health and IET Account Balances on Finance Overview without truncating authoritative data.
- Preserved canonical subhead balance calculation: Approved Allocation - Reserved - Expenditure.
- Updated live-data audit expectations so pagination is treated as full reachability, not truncation.

See `docs/REQGEN_V2_0_0_6_PHASE5_RELEASE_NOTES.md` for the implementation and verification register.
