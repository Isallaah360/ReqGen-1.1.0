# ReqGen 2.0.0.2 Release Notes

## Release identity
ReqGen 2.0.0.2 is the first controlled patch of the ReqGen 2.0 stabilisation line.

The user-facing product version is centralised in `lib/version.ts` and is displayed consistently in application metadata, the authenticated shell, route hero badges, navigation branding, shared page footers and the Department export subtitle.

`package.json` deliberately remains npm SemVer `2.0.0`; the exact ReqGen release is stored separately as `reqgenVersion: 2.0.0.2`. A four-component value such as `2.0.0.2` is not valid npm SemVer and must not replace the package `version` field.

## Architecture carried into this patch
- Canonical route/navigation registry retained.
- Standalone Workflow UI remains removed; compatibility redirect retained.
- HR remains a role rather than a standalone module.
- Legacy Staff and Executive/Command Centre exposures remain compatibility redirects.
- Canonical Admin Department Management retained.
- Canonical Subheads & Budget Structure Admin entry retained.
- Protected server-side Admin user deletion retained.
- Existing workflow/history and live-data architecture retained.

## Validation executed in the delivery environment
- Route registry: PASS - 97/97 routes.
- Internal navigation: PASS - 235 references, 0 broken targets.
- Route/RBAC classification: PASS - 0 duplicate routes, 0 duplicate policy prefixes, 0 unclassified sensitive routes.
- Live-data accuracy: PASS - 20/20 checks.
- Component contract audit: PASS - 165 application TypeScript files, 0 unsupported typed component props.

Dependency-aware ESLint, TypeScript and Next.js production build must be executed in the normal VS Code/Vercel dependency environment before the Git push is accepted as a release gate.
