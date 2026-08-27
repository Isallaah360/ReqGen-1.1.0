# ReqGen Navigation + IET Bank Accounts Update - 2026-08-27

## What changed

- Added an explicit system-wide route catalogue (`lib/navigation.ts`) so valid pages cannot become unintentionally hidden when a module dashboard changes.
- Added role-filtered system-wide Search and contextual Tips to the global NavBar.
- Search results are checked with the same `canAccessPath()` route policy used by `RouteAccessGuard`.
- Corrected global module visibility to use route policies rather than a second hard-coded role list. This also restores Finance navigation for authorised DG/Director contexts.
- Rebuilt IET Bank Account creation so the user enters only Account Name and Bank Name. ReqGen generates the next `IET###` code automatically.
- Added duplicate-code retry handling instead of exposing `iet_accounts_code_unique` to the user.
- Added the approved IET001-IET020 bank register and an idempotent Supabase migration.
- Institutional bank account numbers are intentionally removed from the IET Bank Accounts register.

## Database step

Apply `supabase/migrations/20260827_iet_bank_register_security_and_seed.sql` to the production Supabase project. It is safe to run more than once because the seed uses `ON CONFLICT (code) DO UPDATE`.

## Navigation audit notes

Previously unreferenced/static pages detected in the supplied project included Dashboard Activity; several Finance setup/report utilities; HR Analytics, Compliance, Officer Performance, Output, Reports and Settings; Enterprise Analytics; and Staff Profile. These are now discoverable through the system-wide role-filtered navigation catalogue/search even if a module landing page does not show a dedicated card.
