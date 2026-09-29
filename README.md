# ReqGen 2.15

ReqGen is the IET Request Management System: request creation, multi-stage approval, finance monitoring, payment vouchers, registry, reports and audit — role-based and backed by Supabase.

## Release identity

- Product version: **2.15** (format MAJOR.PATCH — next release is 2.16)
- Defined in one place only: `lib/version.ts`
- npm package version is `2.15.0` (SemVer requires three parts)

## Before every push

```
npm install
npm run lint
npm run typecheck
npm run build
npm run audit:deploy
```
