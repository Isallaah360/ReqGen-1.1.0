# ReqGen 2.0.0 Environment Contract

Required browser-safe values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required server-only values (never expose with `NEXT_PUBLIC_`):
- `SUPABASE_SERVICE_ROLE_KEY` - privileged administrative server routes only.

Notification routes may additionally require the existing Sendchamp/SMS variables already referenced by the codebase. Keep production secrets in Vercel/Supabase environment settings, never in source control.

Production gates:
```bash
npm ci
npm run lint
npx tsc --noEmit
npm run audit:stabilization
npm run build
```
