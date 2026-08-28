# ReqGen International Government Interface Restructure

Date: 2026-08-28

## Purpose
This update restructures the current ReqGen interface without converting the product into an ERP. It introduces one role-aware government-style application shell and one visual contract across authenticated pages while preserving existing routes, business logic, Supabase access controls and module workflows.

## Global architecture
- One fixed institutional sidebar for primary modules.
- One top command bar containing authorised search, notifications, active-role switching and user identity.
- One route-aware context header on every authenticated page.
- One constrained content width and consistent spacing scale.
- One institutional footer using IET and Barderian Enterprises identities.
- Role-aware navigation using the existing permission engine.
- Contextual tips only on controls explicitly marked with `data-tip`.
- Public homepage remains a KISS institutional landing page and does not display the authenticated shell.

## System-wide visual rules
- 16px base font with readable headings and 14px operational text.
- Standardised cards, buttons, forms, tabs and table density.
- Desktop pages remain within the content stage and do not cause page-level horizontal scrolling.
- Tables use controlled wrapping and compact actions.
- Charts, images and SVGs respect their parent width.
- Duplicate module navigation and duplicate legacy hero surfaces are suppressed under the new shell.
- Only one application footer is shown.

## Product naming
The application is identified as **ReqGen** / **Request Management System**. User-facing ERP terminology is not introduced by the new shell.

## Main changed files
- `app/components/GovernmentAppShell.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/components/GlobalTips.tsx`
- `app/components/staff/StaffFooter.tsx`
- `app/page.tsx`
- `lib/navigation.ts`
- selected visible titles in Audit, HR, Reports and Executive pages

## Deployment
Deploy from `main` to Vercel Production after local/Vercel build validation.
