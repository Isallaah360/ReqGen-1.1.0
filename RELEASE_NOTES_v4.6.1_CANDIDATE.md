# ReqGen v4.6.1 — unverified review candidate

This is NOT a production-certified release. The project has not passed a complete npm install, TypeScript, lint, production build or browser E2E in this environment. Do not deploy to production before these gates pass in a clean environment.

## Changes
- Retains the Registry tracking component needed by RegistryCentreWorkspace.
- Updates cleanup logic and Finance Transfer role guidance from prior review candidate.
- Improves navigation hover visibility from prior review candidate.
- Passcode device storage now verifies persistence and reports failure instead of silently claiming success.
- WebAuthn relying-party origin is taken from NEXT_PUBLIC_APP_URL (HTTPS required), not an untrusted request Origin.
- Fingerprint enrollment accepts an existing valid server-side MFA window, consistent with passcode enrollment.
- WebAuthn verification now reports a credential-counter database write failure.
- Fingerprint step-up reports the configured security window instead of a fixed 12-hour value.

## Deployment prerequisites
- NEXT_PUBLIC_APP_URL must exactly match the production HTTPS origin used by browser clients.
- Supabase v4.0.0 step2 tables reqgen_webauthn_credentials and reqgen_trusted_devices must exist.
- The browser/device must support WebAuthn platform credentials; fingerprints are verified by the operating system and may use a device PIN as fallback.
- The sign-in account must have completed the authenticator/2FA setup.

## Required release gates
npm ci
npm run lint
npm run typecheck
npm run build
npm run audit:deploy
npm run audit:production

Then run browser E2E with real staging Supabase and HTTPS origin: setup/re-enroll passcode, sign out, sign in, wrong PIN limits, WebAuthn register/authenticate/step-up, cross-device, cancel/timeout, and finance/registry regressions.

No new SQL migration is included. Confirm prerequisite tables and permissions before deployment.
