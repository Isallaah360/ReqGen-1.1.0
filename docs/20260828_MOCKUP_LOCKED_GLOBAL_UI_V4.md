# ReqGen Mockup-Locked Global UI V4

This update is built from the current 129-page ReqGen project and locks the authenticated application to the approved ReqGen mockup family.

## Scope

- Restores the public Homepage to the approved KISS mockup structure.
- Does not modify Login, Sign Up, MFA or Forgot Password page files.
- Rebuilds the authenticated application shell to the approved 270px white sidebar + 72px top command bar architecture.
- Restores a compact Active Role switcher in the top command bar.
- Applies the approved 12px working text / 11px table and metadata text scale system-wide.
- Converts legacy dark gradient hero blocks into the approved flat page-title architecture.
- Removes duplicate legacy navigation and duplicate page footers inside the authenticated shell.
- Normalises legacy cards, buttons, links, inputs, tabs, tables, charts, spacing, borders, shadows and animations system-wide.
- Protects desktop layouts from Windows/browser scaling by keeping the desktop sidebar until a true mobile viewport of 640px or less.
- Provides one mockup-aligned institutional footer across authenticated pages.

## Validation

- 129 page routes inspected.
- Duplicate routes: 0.
- Unclassified sensitive routes: 0.
- Workflow readiness: PASSED.
- Required workflow files missing: 0.
- No merge-conflict markers were found in application source.

The responsive audit still reports legacy fixed-width patterns in source files. The V4 global compatibility layer deliberately neutralises those patterns at runtime without rewriting business logic in all 129 route files.
