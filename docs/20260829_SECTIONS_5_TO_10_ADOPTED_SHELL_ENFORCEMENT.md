# ReqGen Sections 5–10 — Adopted Shell Enforcement

Scope: Payment Vouchers, Registry, HR, Reports, Audit Centre and Workflow.

Rules enforced:
- Existing Supabase tables/RPCs/actions are preserved; no new data contract is invented.
- The global GovernmentAppShell remains the only application shell/navigation/footer.
- Legacy dark-gradient hero components are converted to the adopted compact page-heading language.
- Shared Payment Voucher, Enterprise and HR presentation primitives now use the same 12/13px visual system.
- Tables are fitted to the available desktop viewport with wrapping and responsive overflow only on smaller screens.
- Existing redirects (for example Voucher Reports and legacy HR routes) are preserved rather than inventing duplicate modules.
- Role/RLS boundaries and operational mutations remain in their original page logic.

Sections:
5. Payment Vouchers — Voucher Register, Voucher Reports redirect, Voucher Settings, Voucher detail and print routes.
6. Registry — Overview, Incoming, Outgoing, Dispatch, Operations, Archive.
7. HR — Overview, My HR Work, Review Queue, HR Filing, Staff Directory, Leave, Assignments, Analytics, KPI, performance, reports/output/compliance/audit/settings plus existing registrar/capacity-building/assessment routes.
8. Reports — Reports Centre and Analytics.
9. Audit Centre — Audit Centre.
10. Workflow — Workflow Centre.
