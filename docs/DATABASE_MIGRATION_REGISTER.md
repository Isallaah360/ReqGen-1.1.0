# ReqGen Database Migration Register

This project ZIP does not contain a local `supabase/migrations` directory. Earlier SQL was applied manually through Supabase SQL Editor. Therefore the authoritative migration history must be reconciled against `supabase_migrations.schema_migrations` and the live catalog.

## Required register

| Migration / SQL package | Purpose | Applied in Supabase | Status | Superseded by / notes |
|---|---|---:|---|---|
| Phase 8A HR security | HR officer assignments and history | Confirm manually | Pending verification | Check HR tables and RLS |
| Phase 8A.2 HR authority workflow | HR request assignments, reviews and comments | Confirm manually | Pending verification | Function parameter correction was issued |
| Phase 8A.4 active role context | Active-role persistence and switch history | Confirm manually | Pending verification | Core role-context dependency |
| Phase 8A.5 strict active-role enforcement | Active-role-aware security functions | Confirm manually | Pending verification | Verify final function definitions |
| Phase 8B Staff Files | Staff files and file movements | Confirm manually | Pending verification | Required by Registrar and Archive |
| Phase 8B Leave Management | Leave records and history | Confirm manually | Pending verification | Verify actual table names used by app |
| Phase 8B Archive | Archive fields and secured RPC | Confirm manually | Pending verification | Depends on Staff Files |
| Phase 8C Weekly Seminar | Sessions, attendance and settings | Confirm manually | Pending verification | Verify realtime if required |
| Phase 8C Strategic HR | Capacity, KPI and 360 assessment objects | Confirm manually | Pending verification | Check app table names exactly |
| Phase 8D HR governance | HR policy settings | Confirm manually | Pending verification | Admin/HR Boss only |
| Active-role Admin security | Strict Admin route/database writes | Confirm manually | Pending verification | Earlier execution reported a deadlock; verify policies |
| Remaining enterprise phases | Registry, workflow, notifications and audit | Confirm manually | Pending verification | Verify all seven created tables |

## Application contract snapshot

The Phase C scanner found **48 table/view references**, **32 RPC references**, and **9 realtime channel names** in the current project. Run `npm run audit:db-contract` to regenerate `audit-output/database-contract.json`.
