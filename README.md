# ReqGen 2.0.0.2

ReqGen is the Islamic Education Trust Request Management System maintained by Barderian Enterprises.

## Product release
- Product version: **2.0.0.2**
- npm package SemVer: **2.0.0**
- Framework: Next.js 16 / React 19 / TypeScript
- Backend: Supabase
- Deployment: GitHub-connected Vercel project

The four-part ReqGen product version is defined centrally in `lib/version.ts`. `package.json` keeps a valid three-part npm SemVer and also stores the product release in the custom `reqgenVersion` field.

## Safe replacement
This delivery contains the complete application tree required for the release, but intentionally contains **no `.env*` file, no `.git` directory, and no embedded Supabase service-role secret**. Preserve your existing local `.env.local` and Git repository metadata when copying the project over your laptop working tree.

## Release gates
Run in VS Code before pushing:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run audit:route-registry
npm run audit:navigation
npm run audit:routes
npm run audit:data-accuracy
npm run audit:responsive
npm run audit:components
npm run build
```

See `docs/REQGEN_V2_RELEASE_RUNBOOK.md` for the deployment procedure and `docs/REQGEN_V2_0_0_1_RELEASE_NOTES.md` for this patch.
