# ReqGen 1.1.0 — Global UI and Production Main Upgrade

Date: 27 August 2026

## Scope

- Standardised system-wide ERP canvas, typography, cards, buttons, forms, tabs, tables, charts, icons, hero headers and footers.
- Added responsive scaling rules for tables, charts, SVGs, images and interactive controls.
- Removed the static NavBar Tips menu.
- Added contextual hover/focus tips to buttons, links, tabs, inputs, selects and module actions across authenticated pages.
- Removed the duplicate Current Working Role selector from the Staff Main Dashboard. Role switching remains in the NavBar.
- Removed the user-facing “Enterprise” prefix from Audit labels.
- Preserved role-aware navigation and system-wide search.
- Preserved the corrected IET bank-account migration and approved IET001–IET020 bank register from the previous update.

## Production branch correction

The official production URL remains:

https://req-gen-1-1-0.vercel.app

The production branch should be `main`.

Recommended Git sequence after copying this upgrade into the real project folder:

```powershell
git status
git add .
git commit -m "Standardise ReqGen global UI tips and production navigation"
git push origin stable-pre-erp
git checkout main
git pull origin main
git merge stable-pre-erp
git push origin main
```

If Git reports a merge conflict, stop and resolve the conflict before pushing `main`.

Then in Vercel:

1. Project > Settings > Git.
2. Set Production Branch to `main`.
3. Save.
4. Project > Deployments.
5. Confirm the new `main` commit builds as Production.
6. Project > Settings > Domains: confirm `req-gen-1-1-0.vercel.app` remains assigned to the project.
7. Open the production deployment and verify Environment = Production and Source = main.

Do not delete `stable-pre-erp`; keep it as a safe integration/staging branch.
