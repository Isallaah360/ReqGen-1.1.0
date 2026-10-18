-- =============================================================================
-- ReqGen v4.6.5 — READ-ONLY check of the two system accounts
-- Run in the Supabase SQL Editor. It changes NOTHING; it only reads.
--
-- Answers: has the Super Admin account (ietreqgen@gmail.com) been created? Can it sign in?
-- Is it marked as the Super Admin? Does it hold the Super Admin position and have 2FA?
-- The same for the Developer account (info@barderians.com.ng), and who else currently
-- counts as Super Admin when acting as Super Admin.
-- =============================================================================
with sys(kind, email) as (
  values ('Super Admin', 'ietreqgen@gmail.com'), ('Developer', 'info@barderians.com.ng')
)
select
  s.kind as "account",
  s.email as "email",
  case when u.id is null then 'NOT CREATED — no sign-in exists for this email'
       when u.email_confirmed_at is null then 'created, email NOT confirmed'
       else 'created and confirmed' end as "sign-in",
  coalesce(to_char(u.last_sign_in_at at time zone 'Africa/Lagos', 'DD Mon YYYY HH24:MI'), 'never') as "last sign-in",
  case when p.id is null then (case when u.id is null then '—' else 'NO staff record (profile)' end)
       else coalesce(p.full_name, '') end as "staff record",
  coalesce(p.system_account, case when p.id is null then '—' else 'NOT MARKED' end) as "marked as",
  case when p.id is null then '—' when coalesce(p.is_active, true) then 'active' else 'DEACTIVATED' end as "status",
  coalesce((select string_agg(pr.role_name || case when coalesce(pr.is_active, true) then '' else ' (off)' end, ', ')
            from public.profile_roles pr where pr.profile_id = p.id), '—') as "positions",
  coalesce((select a.active_role_name from public.user_active_roles a where a.user_id = p.id), '—') as "acting as",
  case when u.id is null then '—'
       when exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified') then '2FA set'
       else '2FA NOT set' end as "2FA"
from sys s
left join auth.users u on lower(u.email) = s.email
left join public.profiles p on p.id = u.id

union all

select 'Also counts as Super Admin', coalesce(p.email, ''), 'holds the Super Admin position', '', coalesce(p.full_name, ''),
       coalesce(p.system_account, 'not a system account'), case when coalesce(p.is_active, true) then 'active' else 'DEACTIVATED' end,
       '', coalesce((select a.active_role_name from public.user_active_roles a where a.user_id = p.id), '—'), ''
from public.profiles p
where coalesce(p.system_account, '') not in ('superadmin', 'developer')
  and (public.pv_role_key(p.role) in ('admin', 'superadmin')
       or exists (select 1 from public.profile_roles pr where pr.profile_id = p.id and coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) in ('admin', 'superadmin')));
