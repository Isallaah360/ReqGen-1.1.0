# ReqGen Finance Tables & Shell Polish V3.2

This focused update preserves the adopted ReqGen shell and applies the following corrections:

- Finance Subheads desktop register is fit-to-workspace; the old 1580px minimum width is removed.
- Finance Departments desktop register is fit-to-workspace; the old 1100px minimum width is removed.
- Action columns are compact grids so all actions remain visible.
- A project-wide authenticated table contract removes forced minimum table widths, wraps long values safely, and keeps tables within the available workspace.
- All Finance routes under the collapsible Finance navigation inherit the adopted 13px/12px/11px typography, card radius, border, shadow, form and control treatment through `.module-finance`.
- Legacy dark Finance hero sections are visually flattened into the adopted white workspace language without altering business logic.
- The known Tailwind/Turbopack malformed escaped `hidden` selector is fixed using `[class~="xl:hidden"]`.
- Print layouts retain automatic table sizing.

Controlled files:
- `app/globals.css`
- `app/finance/subheads/page.tsx`
- `app/finance/departments/page.tsx`
