# ReqGen Core Scope Cleanup and Workflow Reset

## Retained product backbone
- Command Centre
- Dashboard
- Requests
- Approvals
- Finance
- Payment Vouchers
- Registry
- Reports
- Audit Centre
- Workflow
- Admin
- Profile / Account Security
- Authentication and protected request/print utilities

## Removed from the application surface
- Entire HR application module (`/hr/**`)
- Entire Staff application module (`/staff/**`)
- Help & Support / About module (`/docs`, `/about`)
- Executive HR page (`/executive/hr`)
- Supabase test page (`/test-supabase`)
- Redundant advanced Admin pages: Admin Audit, Access Audit, System Health, Release Readiness and Workflow Test
- HR navigation icon asset

## HR workflow principle
HR remains only as a workflow role for Personal Fund / Personal Non-Fund requests where an HR review or minute is required. There is no HR dashboard, HR filing workspace, leave/training/performance application module or staff-management module. HR actors continue to receive actionable requests through the common Approvals / Request Detail workflow.

## Workflow Centre
`/workflow` has been converted from a generic workflow-rule editor into a request-specific monitoring centre using the live `requests` and `profiles` records. It presents the controlled Official, Personal Fund and Personal Non-Fund routes and the live current request queue.

## Verification completed
- Route audit: PASS
- Route registry reconciliation: PASS
- Internal navigation audit: PASS
- Workflow readiness audit: PASS
- Component contract audit: PASS
- RMB architecture audit: PASS

## Important database note
The current remote Supabase RPCs such as `approve_request_step` and `submit_request_with_reservation` remain the authoritative routing engine. HR role/stage keys are intentionally retained where they are required by those request workflows. They must not be deleted from the database until the live RPC function bodies are reconciled and a controlled migration is prepared.
