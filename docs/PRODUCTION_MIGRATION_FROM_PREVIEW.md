# ReqGen Preview -> Production migration

## Current condition

The `stable-pre-erp` branch has already been merged into `main`, but Git stopped because `app/globals.css` and `app/layout.tsx` conflicted. Do not restart the merge and do not use `git merge --abort` if you intend to keep the already merged update set.

The two files in this patch are resolved versions built from the uploaded current project. They preserve:

- the ReqGen ERP 2.0 shell and LegacyRootNavigation architecture;
- MFA and route-access wrappers;
- the global contextual Tips layer;
- the global ReqGen UI class applied to page content;
- the official production metadata URL `https://req-gen-1-1-0.vercel.app`;
- the existing ERP 2.0 CSS foundation plus the new global styling layer.

## Apply the patch

Copy these two files into the real project and replace the existing files:

- `app/globals.css`
- `app/layout.tsx`

Project root: `C:\reqgen-web`

## Finish the existing merge

From the VS Code PowerShell terminal in `C:\reqgen-web`:

```powershell
git branch --show-current
git add app/globals.css app/layout.tsx
git diff --name-only --diff-filter=U
git status
```

The active branch must be `main`. The `git diff --name-only --diff-filter=U` command must print nothing.

Then:

```powershell
git commit -m "Merge ReqGen global UI and production upgrade into main"
git push origin main
```

Verify:

```powershell
git status
git branch --show-current
git log -1 --oneline
```

Expected result: branch `main`, clean working tree, latest commit is the merge commit.

## Vercel production correction

In Vercel open the ReqGen project:

1. Settings -> Git -> Production Branch -> set to `main` and save.
2. Deployments -> the new commit from `main` must show Environment = Production.
3. Settings -> Domains -> confirm `req-gen-1-1-0.vercel.app` is assigned to this project.
4. Open the latest Production deployment and confirm Source = `main` and Status = Ready.
5. Visit `https://req-gen-1-1-0.vercel.app` and hard-refresh the browser (Ctrl+F5).

Keep `stable-pre-erp` as a staging/integration branch; production deployments should come from `main`.
