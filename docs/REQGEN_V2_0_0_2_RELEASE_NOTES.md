# ReqGen 2.0.0.2 - Phase 2 Usability & Finance Integrity

## Included changes
- Standardised product identity to ReqGen 2.0.0.2.
- Subhead creation/edit modal now displays the selected IET account's live allocatable balance, requested allocation, and projected remaining balance before save.
- Subhead save failures are now displayed inside the modal with actionable reasons; failed allocation after a new insert attempts to roll the empty new record back.
- Finance Overview no longer queries non-existent `finance_transactions.debit`/`credit` columns; transaction values use the canonical `amount` field available in the current application contract.
- Finance Overview uses the canonical subhead balance formula without surfacing legacy stored-balance mismatch as a blocking user warning.
- Removed `SECTION 4 · FINANCE`/`Section 4` presentation labels from active Finance workspaces touched in this patch; pages start with the functional page title.
- Removed duplicate user identity from the bottom of the sidebar; the top profile is the single identity surface and the sidebar footer is now a clean Sign out control.
- Increased greeting and key Finance table/list typography for readability while preserving responsive scrolling.

## Deferred
- Admin Dashboard mockup reconstruction is intentionally deferred until the approved mockup is re-supplied, per the roadmap rule not to invent a major visual target where a locked mockup exists.
