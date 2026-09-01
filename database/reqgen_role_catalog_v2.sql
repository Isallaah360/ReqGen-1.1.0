-- ReqGen operational role catalogue v2
-- Safe idempotent seed. Run in Supabase SQL Editor before assigning the new roles.

insert into public.reqgen_roles
  (role_key, role_name, description, is_system, is_active, requires_signature, sort_order)
values
  ('staff', 'Staff', 'Standard ReqGen user. Dashboard, Requests, Approvals and Profile.', true, true, true, 10),
  ('director', 'Director', 'Director-level request reviewer/approver.', true, true, true, 20),
  ('dg', 'DG', 'Director General request approval authority.', true, true, true, 30),
  ('accountofficer', 'Account Officer', 'Finance and Payment Voucher processing officer.', true, true, true, 40),
  ('auditor', 'Auditor', 'Finance, reports, workflow and audit oversight.', true, true, true, 50),
  ('admin', 'Admin', 'ReqGen system administrator.', true, true, true, 60),
  ('hr', 'HR', 'Human Resources workflow reviewer; no standalone HR module.', true, true, true, 70),
  ('registrar', 'Registrar', 'Registrar workflow reviewer; no standalone HR module.', true, true, true, 80),
  ('gensec', 'General Secretary', 'General Secretary workflow reviewer.', true, true, true, 90),
  ('dinadmin', 'DIN Admin', 'DIN Administration workflow reviewer. Mapped to the existing DIN Admin workflow stage.', true, true, true, 100)
on conflict (role_key) do update set
  role_name = excluded.role_name,
  description = excluded.description,
  is_active = excluded.is_active,
  requires_signature = excluded.requires_signature,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Multiple HR staff should normally share role_key = 'hr' through profile_roles.
-- Do not create HR1/HR2/HR3 as separate workflow authorities unless the process itself differs.
