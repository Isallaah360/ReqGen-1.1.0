# ReqGen Requests + Approvals Single-Page Consolidation

Date: 2026-09-01

## Locked UX decisions
- Requests and Approvals are single primary sidebar entries; no nested overview/action-centre navigation.
- Dynamic request detail/edit/print routes remain contextual transaction routes and keep Requests highlighted.
- `/approvals/action-centre` is retained only as a compatibility redirect to `/approvals`.
- Approvals is one workspace with Pending, History and All views.
- Notification bell links directly to `/approvals` and shows the live count of open requests matching the authenticated user's owner/stage/active-role authority.
- Approvals also shows the same pending count badge in the left navigation.
- Main navigation and collapsible navigation are both locked at 13px.
- Topbar greeting, search, active role and user identity typography are increased for readability.
- AAL2 is reused for normal request approval work; re-challenge occurs only when the secure MFA session is no longer AAL2.

## Compatibility
- Existing request detail, edit, print and new-request routes are preserved for direct links, workflow transitions and audit history.
- Request Details now provides a direct Back to Approvals action when the current user can act on the request.
- No database migrations or RPC signatures were changed.

## Source audits
- Shell lock: PASS
- Internal navigation: PASS / 0 broken targets
- Route audit: PASS / 0 duplicates / 0 unclassified sensitive routes
- Workflow readiness: PASS

Final workstation gate: `npm run lint && npm run build`.
