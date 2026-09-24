# ReqGen v2.0.0.8 — GitHub / Vercel Deployment Handoff

## 1. Open the project in VS Code
From PowerShell, enter the extracted ReqGen project directory and run:

```powershell
code .
```

## 2. Install and validate locally

```powershell
npm ci
npm run typecheck
npm run lint
npm run audit:production
npm run build
```

Do not push when any command fails.

## 3. Apply required Supabase migrations
Apply, in order:

1. `database/20260924_phase6_workflow_integrity_guard.sql`
2. `database/20260924_phase7_subhead_authority_guard.sql`

Then validate one Official request through Director/DIN Admin/HOD/Registrar/HR → DG → Account Officer routing before production promotion.

## 4. Git commit and push
For an existing GitHub-connected repository:

```powershell
git status
git add -A
git commit -m "ReqGen v2.0.0.8 phase 7 architecture stabilisation"
git push origin main
```

If the deployment branch is not `main`, replace `main` with the actual Vercel production branch.

## 5. Vercel
With GitHub integration already connected, the push starts the Vercel deployment automatically. In Vercel, verify that the production project has the required environment variables documented in `docs/ENVIRONMENT.md` and that the build command remains the standard Next.js production build.

## 6. Post-deployment smoke test
Validate at minimum:

- Login + MFA and active-role switching.
- Direct-URL RBAC for Admin, Auditor, DG, Director, HOD, HR, Registrar, Account Officer and Staff.
- Official request cannot reach DG without a subhead.
- DG cannot assign a subhead.
- Director/DIN Admin/HOD/Registrar/HR can assign only while they are the active role and current owner.
- DG approval routes to the already attached Account Officer.
- Finance/PV calculations remain live and use Allocation − Reserved − Expenditure.
- Dashboard, Reports, Finance, Registry and Audit chart interactions expose exact live values.
- No broken navigation target, clipped action, overlapping modal or horizontal application-frame overflow.
