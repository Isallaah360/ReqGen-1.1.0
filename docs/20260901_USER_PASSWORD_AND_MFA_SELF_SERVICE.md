# ReqGen User Password and MFA Self-Service

Implemented for presentation readiness without recreating user accounts.

## User flow
1. User logs in with the currently assigned password and existing authenticator code.
2. Open Profile > Security.
3. Select Replace Authenticator.
4. If the current session is not already AAL2, verify the existing authenticator once.
5. Generate a new QR code and scan it with the user's own authenticator app.
6. Verify the new 6-digit code.
7. ReqGen removes the previous verified TOTP factor only after the new factor verifies successfully.
8. User selects Change Password, confirms current password, and sets a new private password.
9. ReqGen signs the user out; the user signs in again with the new password and new authenticator.

## Safety
- Existing TOTP is never removed before the replacement verifies.
- Passwords and TOTP secrets are handled by Supabase Auth; ReqGen does not persist them in its own tables.
- No account recreation is required.
