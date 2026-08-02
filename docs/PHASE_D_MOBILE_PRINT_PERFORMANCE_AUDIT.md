# Phase D — Mobile, Print and Performance Audit

## Mobile acceptance widths

Test the complete application at:

- 360px
- 390px
- 768px
- 1024px
- 1440px and above

Confirm that navigation, tables, filters, modals, dropdowns, charts and action buttons remain readable and operable. No page should require uncontrolled horizontal scrolling outside a deliberate table wrapper.

## Print acceptance

Verify:

- A4 portrait or landscape is deliberate.
- IET identity appears where required.
- Navbar and screen-only controls are hidden.
- Tables wrap or scale without clipping.
- Page breaks do not split headings or signature areas.
- The selected report section is the exact content printed.
- Payment Voucher and Request print templates remain unchanged unless specifically approved.

## Performance acceptance

Review all warnings produced by `npm run audit:performance`:

- replace unnecessary `select("*")` calls with explicit columns;
- add pagination for registers likely to exceed 100 rows;
- limit realtime channels to pages that require them;
- unsubscribe channels on unmount;
- avoid loading large optional data sources on initial render;
- ensure indexed columns are used for status, user, request, department and date filters.

## Required commands

```powershell
npm run audit:responsive
npm run audit:print
npm run audit:performance
npm run audit:phase-d
```

The reports are written to `audit-output/`.
