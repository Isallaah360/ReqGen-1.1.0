# ReqGen v3.0.1

ReqGen (Request Generator) is the IET Request Management System: request creation, multi-stage approval, finance monitoring, payment vouchers, registry, reports and audit — role-based and backed by Supabase.

## Release identity

- Product version: **v3.0.1** (Semantic Versioning, MAJOR.MINOR.PATCH — next patch is v3.0.2)
- Defined in one place only: `lib/version.ts`
- `package.json` "version" carries the same number without the "v" (3.0.1)

## Navigation standard (from v3.0.1)

- Sidebar = flat module links only (no collapsible sub-menus).
- Module sub-sections appear as numbered tabs inside the main workspace
  (`ModuleTabs` in `app/components/GovernmentAppShell.tsx`, driven by `MODULE_SUBNAV`).

## Before every push

```
npm install
npm run lint
npm run typecheck
npm run build
```
