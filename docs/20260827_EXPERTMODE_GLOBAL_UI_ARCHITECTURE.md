# ReqGen ExpertMode Global UI Architecture — 2026-08-27

## Scope completed

- Audited 130 application page routes.
- Applied one root page shell to public and authenticated routes.
- Added a stable footer to every route through the root layout.
- Added a route-aware fallback hero for pages that do not already expose a page heading.
- Promoted simple legacy page headings into the same hero visual language without changing page logic.
- Standardised maximum page width, page gutters, typography, cards, controls, tabs, tables, charts, status chips, focus states and animation behaviour.
- Restored Tailwind CSS v4 loading with `@import "tailwindcss";`.
- Rebuilt the public homepage at a fixed professional scale and constrained the Barderian footer logo.
- Removed the root NavBar from public authentication routes.
- Changed Global Tips from automatic global tooltips to explicit `data-tip` only. Search, active-role switching and logout remain eligible for contextual tips.
- Normalised selected visible labels that unnecessarily started with “Enterprise”. Internal component names were not renamed because that could break imports.
- Preserved role-based route enforcement, MFA, session timeout, navigation search, Supabase logic and page business functions.

## Display contract

The global shell now uses a 1440px maximum content width with fluid gutters. Normal page content does not create its own arbitrary viewport width. Tables use fixed layout and wrapping so ordinary desktop pages remain within the display rather than requiring page-level horizontal panning. Controls and status chips use compact sizing to preserve data density.

## Validation

- Route audit: 130 routes inspected; 0 duplicate routes; 0 unclassified sensitive routes.
- Workflow readiness: PASSED; 11 required files present; 0 missing.
- Modified TSX files were syntax-transpiled with the TypeScript compiler API successfully.
- No Git conflict markers remain in the modified UI files.
- A complete `next build` was attempted but could not finish within the execution window because dependency installation/build execution exceeded the environment timeout. The project should still be built by Vercel after the commit.

## Production deployment

Production source remains `main`.

After copying the patch to `C:\reqgen-web`:

```powershell
git checkout main
git status
git add .
git commit -m "Standardise ReqGen global UI architecture"
git push origin main
```

Vercel should create a new Production deployment from `main` and attach the normal production domain `req-gen-1-1-0.vercel.app`.
