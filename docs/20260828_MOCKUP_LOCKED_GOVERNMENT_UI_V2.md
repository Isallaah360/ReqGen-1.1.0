# ReqGen Mockup-Locked Government UI V2

This release locks the authenticated ReqGen interface to the approved visual references supplied on 28 August 2026.

## Locked system rules
- ReqGen remains **ReqGen**, not ERP.
- Authenticated shell: white 270px sidebar, white 72px command bar, blue active module state.
- Body/data typography: 12px; compact table/meta text: 11px; page title approximately 26–27px.
- Cards use restrained 13px radius, subtle neutral borders and low-elevation shadows.
- Tables fill the available workspace and wrap content; page-level horizontal scrolling is not used at desktop widths.
- One institutional footer only, with IET identity, Secure/Reliable/Accountable, Barderian website/email and developer mark.
- Important contextual tips use explicit `data-tip` only.
- Existing business rules, Supabase data access and role restrictions remain unchanged.

## Directly reconstructed screens
- Homepage
- Login
- Main Dashboard

## System-wide normalization
Requests, Approvals, Finance, Registry, HR, Reports, Audit, Workflow, Staff, Admin and all subordinate pages inherit the locked typography, geometry, tables, forms, cards, responsive behavior, shell and footer from `app/globals.css` and `GovernmentAppShell.tsx`.
