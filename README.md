# ReqGen v3.1.11

ReqGen (Request Generator) is the IET Request Management System: request creation, multi-stage approval, finance monitoring, payment vouchers, registry, reports and audit — role-based and backed by Supabase.

## Release identity

- Product version: **v3.1.11** (Semantic Versioning, MAJOR.MINOR.PATCH — next planned: v4.0.0)
- Defined in one place only: `lib/version.ts`
- `package.json` "version" carries the same number without the "v" (3.1.11)

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

## Theme (from v3.0.6)

- Light / Dark / System switch in the top bar (remembered per device).
- All colours in `app/**/*.css` are theme-aware variables whose fallback is the
  original light colour, so light mode is unchanged.
- After adding or changing CSS colours, regenerate the dark palette:
  `npm run theme:build` (writes `app/theme-dark.generated.css`).
- Hand-tuned dark rules live in `app/theme-dark.css`.
