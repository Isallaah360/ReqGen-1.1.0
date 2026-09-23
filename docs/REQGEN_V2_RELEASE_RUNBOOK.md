# ReqGen 2.0.0.1 - VS Code Release Runbook

## 1. Protect the authoritative baseline
Keep the original `reqgen-web.rar` unchanged. Copy the delivered `ReqGen_v2.0.0.1_stabilized` folder into your development workspace and open that folder in VS Code.

## 2. Configure environment values
Create `.env.local` locally (do not commit it):

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

Keep all existing Sendchamp/SMS secrets required by your current notification routes. Never prefix the service-role key with `NEXT_PUBLIC_`.

## 3. Install exactly the locked dependencies
```bash
npm ci
```

If `npm ci` fails because the lockfile and package file differ, stop and inspect the diff; do not use `npm install --force` as a release shortcut.

## 4. Run the hard gates
```bash
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

Expected hard result: lint = 0 errors, TypeScript = 0 errors, production build = success, route/navigation/RBAC/data audits = pass. Responsive warnings must be manually reviewed at mobile, tablet, laptop and wide-desktop widths.

## 5. Local production-mode smoke test
```bash
npm run build
npm run start
```

Test at minimum: login/MFA, Dashboard, Requests, Approvals, Finance, Payment Vouchers, Registry, Reports (Admin/Auditor only), Audit Centre, Admin Users, Admin Departments, Finance Subheads, Profile/Security, `/workflow` redirect, `/executive` redirect, `/hr` redirect and `/staff` redirect.

## 6. Supabase checks
Before testing destructive administration, confirm the deployed schema contains all tables referenced by the safe-delete endpoint. Verify RLS and RPC expectations using the existing reconciliation SQL scripts. Do not modify DG expenditure posting semantics until the existing `approve_request_step` behavior is verified, because the roadmap explicitly warns against double expenditure.

## 7. Git commit and push from VS Code terminal
Replace `<branch>` and `<remote>` only if your repository uses different names.

```bash
git status
git checkout -b reqgen-v2-0-0-1-stabilisation
git add -A
git commit -m "feat: stabilise ReqGen 2.0.0.1 architecture and admin controls"
git push -u origin reqgen-v2-0-0-1-stabilisation
```

After review/approval, merge through your normal GitHub workflow. For a direct main-branch workflow only after all gates pass:

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff reqgen-v2-0-0-1-stabilisation -m "release: ReqGen 2.0.0.1 stabilisation"
git push origin main
```

## 8. Deployment gate
On Vercel/your host, set the same environment variables, then deploy the pushed commit. Review build logs for zero lint/type/build failures. Run the same role-by-role direct-URL checks against the deployed URL before declaring the release locked.

## Rollback
Tag the last known-good production commit before merge:

```bash
git checkout main
git pull --ff-only origin main
git tag reqgen-pre-v2-stabilisation
git push origin reqgen-pre-v2-stabilisation
```

If release validation fails, redeploy that tag/commit while the failing v2 branch is corrected.
