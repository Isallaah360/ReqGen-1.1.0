# ReqGen Mockup-Locked Global Tune V3

This release restores the approved ReqGen mockup contract across public authentication and authenticated pages.

## Locked visual rules
- Desktop sidebar: 270px white rail with blue active state.
- Top command bar: 72px.
- Authenticated body: 12px standard working copy; 11px table/meta copy.
- Page titles: 26-27px; section titles: 16px.
- Content canvas: up to 1440px, no normal desktop horizontal page scroll.
- Compact cards, tables, controls, footer and restrained shadows.
- The mobile drawer breakpoint is delayed to 760px so Windows display scaling does not accidentally switch laptops to the mobile navigation overlay.
- One system footer only.
- Tips remain opt-in through data-tip attributes.

## Direct page rebuilds
- Login: approved centered IET authentication mockup + Back to Homepage.
- Sign Up: same authentication family while preserving Supabase profile creation.
- Forgot Password: same authentication family while preserving reset-email flow.
- MFA Verify: same authentication family while preserving AAL2 verification.
- MFA Setup: same authentication family while preserving TOTP enrollment/verification.
- Reset Password: existing recovery/security logic preserved and globally restyled.
- Main Dashboard: rebuilt from redirect into the approved dashboard workspace with live ReqGen request/voucher data.

## System-wide effect
GovernmentAppShell and the final CSS contract apply the same sidebar, command bar, typography, sizing, table behavior, controls, surfaces and footer to every authenticated route.
