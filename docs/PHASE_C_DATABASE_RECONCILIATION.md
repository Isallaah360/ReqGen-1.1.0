# Phase C — Database and Migration Reconciliation

## Execution order

1. Run `npm run audit:db-contract`.
2. Run `npm run audit:migrations`.
3. In Supabase SQL Editor, execute the read-only files in `database/reconciliation` in numeric order.
4. Export each result to CSV or take screenshots.
5. Update `docs/DATABASE_MIGRATION_REGISTER.md` with Applied / Missing / Superseded status.
6. Do not run destructive repair SQL until missing objects and conflicting policies have been confirmed.

## Acceptance criteria

- Every table/view referenced by the application exists, or the page treats it as explicitly optional.
- Every RPC referenced by the application exists with a compatible signature.
- RLS is enabled on sensitive tables.
- No broad policy defeats active-role restrictions.
- Final role helper functions have one intended definition/signature.
- Realtime publication includes only tables that genuinely need subscriptions.
- Frequently filtered foreign keys, status fields and timestamps have appropriate indexes.
- The migration register identifies failed, superseded and manually-applied SQL.

## High-risk review list

- `profiles`, `profile_roles`, `user_active_roles`, `user_role_switch_history`
- `requests`, `request_history`, `notifications`
- `subheads`, `finance_transactions`, `payment_vouchers`, `iet_accounts`
- all `hr_*` operational tables
- `registry_correspondence`, `workflow_rules`, `workflow_sla_events`, `enterprise_audit_events`
- role helper functions and active-role RPCs
