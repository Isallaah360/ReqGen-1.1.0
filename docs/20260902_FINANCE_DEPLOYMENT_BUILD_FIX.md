# ReqGen Finance Deployment Build Fix — 2026-09-02

## Failure fixed
Vercel Turbopack rejected `app/finance/processing/processing.module.css` because CSS Modules require every selector to include a local class or id.

The four invalid selectors were:
- `table`
- `th, td`
- `th`
- `td a`

They are now scoped to the local `.tableWrap` class:
- `.tableWrap table`
- `.tableWrap th, .tableWrap td`
- `.tableWrap th`
- `.tableWrap td a`

This preserves the visual layout while satisfying Next.js 16 / Turbopack CSS Module purity rules.

## Source audits rerun
- Shell architecture lock: PASS
- Route access audit: 137 routes, 0 duplicates, 0 unclassified sensitive routes
- Workflow readiness: PASS
- Internal navigation: 298 references, 0 broken targets
- Component contracts: 227 TypeScript app files, 0 failures
- TypeScript syntax/transpile audit: 241 app/lib TS/TSX files, 0 syntax errors

## Notes
The Vercel `npm warn allow-scripts` messages for `sharp` and `unrs-resolver` are warnings, not the build failure. The build failure was the CSS Module purity error above.
