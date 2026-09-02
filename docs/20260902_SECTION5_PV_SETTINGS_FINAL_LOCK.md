# Section 5 - Payment Voucher Settings final implementation

## Locked foundation
- Sections 1-4 remain locked.
- Finance remains eight user-facing workspaces.
- Global shell navigation typography remains 13px.

## Payment Voucher Settings
- Source of authority records: `payment_voucher_counter_signatories`.
- Source of user identity/signature readiness: `profiles`.
- Active role source: `get_my_active_role`.
- Management access: Admin and Auditor only.
- Account Officers may operate Payment Vouchers but cannot grant cheque-signing authority.
- New authority must be linked to an active ReqGen profile with a saved signature.
- KPIs are derived from the loaded live signatory register; no hard-coded counts.
- Search and filters operate on live register/profile data.
- Live Postgres changes and window focus refresh the register.
- Destructive deletion is blocked when the signatory name already appears on a historical Payment Voucher; deactivation is required instead.
- Page typography is normalized to the same 13px readability family used by the locked Requests/Approvals experience.

## Verification
Run:

```bash
npm run audit:section4
npm run audit:section5-pv-settings
npm run lint
npm run build
```
