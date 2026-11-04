-- =====================================================================================
-- ReqGen v4.6.7 — Request queue trace (READ-ONLY)
--
-- Why: a submitted request shows in Registry but not in the HR Officer's queue.
-- This script only READS. It changes nothing, creates nothing, and is safe to run
-- as many times as you like. It does NOT touch the Routing Engine.
--
-- How to use (Supabase › SQL Editor):
--   1. In the "params" block below, put the request number (as printed on the
--      request, e.g. IET/HR/2026/0042) and the email of the officer who should
--      see it (e.g. Muhammad Alhassan's email).
--   2. Run. One table comes back, read it top to bottom. The last row (VERDICT)
--      says where the request is waiting and why the officer does not see it.
--   3. Send a screenshot of the whole table to Barderian Enterprises before any
--      change is made. Nothing is repaired automatically.
--
-- The app rule (lib/approvalQueue.ts, unchanged since v3.1.5): a request is
-- "waiting for you" only when requests.current_owner is YOU (or, at the Account
-- step with no owner, when you are its Account Officer). The position you are
-- acting as does not add or remove requests from that list.
-- =====================================================================================

with params as (
  select
    'PUT-REQUEST-NUMBER-HERE'::text   as request_no,     -- e.g. IET/HR/2026/0042
    'put.officer@email.here'::text    as officer_email   -- the officer who should see it
),
req as (
  select r.*
  from public.requests r, params p
  where upper(trim(r.request_no)) = upper(trim(p.request_no))
     or r.id::text = trim(p.request_no)
  order by r.created_at desc
  limit 1
),
officer as (
  select pr.id, pr.full_name, pr.email
  from public.profiles pr, params p
  where lower(pr.email) = lower(trim(p.officer_email))
  limit 1
),
owner as (
  select pr.id, pr.full_name, pr.email from public.profiles pr join req on pr.id = req.current_owner
),
route as (
  select br.step_order, br.stage, br.owner_id, br.if_vacant,
         (select full_name from public.profiles where id = br.owner_id) as owner_name
  from req,
  lateral public.reqgen_build_route_for_template(
    coalesce(req.route_template_id, public.reqgen_template_for_department(req.dept_id)),
    req.dept_id, req.request_type, req.personal_category) br
),
lines as (
  -- 1. The request
  select 10 as n, '1 Request' as section, 'Found' as item,
         coalesce((select request_no || ' · ' || coalesce(title, '') from req), 'NOT FOUND — check the request number in params') as detail
  union all
  select 11, '1 Request', 'Type',
         (select coalesce(request_type, '?') || coalesce(' / ' || personal_category, '') from req)
  union all
  select 12, '1 Request', 'Department',
         (select d.name from public.departments d join req on d.id = req.dept_id)
  union all
  select 13, '1 Request', 'Status · stage now',
         (select coalesce(status, '?') || ' · ' || coalesce(current_stage, '?') from req)
  union all
  select 14, '1 Request', 'Waiting with (current_owner)',
         coalesce((select full_name || ' <' || email || '>' from owner),
                  case when exists (select 1 from req where current_owner is null) then 'NOBODY (no owner set)' end)
  -- 2. The route the request follows (read from the engine, not changed)
  union all
  select 20 + coalesce(step_order, 0), '2 Route', 'Step ' || step_order || ' · ' || stage,
         coalesce(owner_name, 'vacant') || ' · if vacant: ' || coalesce(if_vacant, 'skip')
         || case when public.reqgen_key(stage) = public.reqgen_key((select current_stage from req)) then '   <== NOW' else '' end
  from route
  -- 3. The officer
  union all
  select 50, '3 Officer', 'Officer',
         coalesce((select full_name || ' <' || email || '>' from officer), 'NOT FOUND — check the email in params')
  union all
  select 51, '3 Officer', 'Positions held (profile_roles)',
         (select string_agg(coalesce(role_name, role_key), ', ' order by role_key)
          from public.profile_roles where profile_id = (select id from officer) and coalesce(is_active, true))
  union all
  select 52, '3 Officer', 'HR section permissions (not positions)',
         (select string_agg(section_key || ' (' || coalesce(permission_level::text, '-') || ')', ', ' order by section_key)
          from public.hr_officer_assignments where officer_id = (select id from officer) and coalesce(is_active, true))
  union all
  select 53, '3 Officer', 'Acting as now',
         (select coalesce(active_role_name, active_role_key) from public.user_active_roles where user_id = (select id from officer))
  union all
  select 54, '3 Officer', 'Owns which route steps of this department',
         (select string_agg(o.stage, ', ' order by o.stage) from public.reqgen_department_stage_officers o
          where o.user_id = (select id from officer) and o.dept_id = (select dept_id from req))
  union all
  select 55, '3 Officer', 'Institution settings naming this officer',
         (select string_agg(s.key, ', ' order by s.key) from public.app_settings s
          where s.value = (select id::text from officer) and s.key like '%\_USER\_ID' escape '\')
  union all
  select 56, '3 Officer', 'Marked away',
         (select case when a.is_away then 'YES' || coalesce(' until ' || a.away_until::date, '') else 'no' end
          from public.reqgen_officer_availability a where a.user_id = (select id from officer))
  -- 4. Last movements (newest first)
  union all
  select 70 + rn, '4 History', to_char(created_at, 'YYYY-MM-DD HH24:MI'),
         coalesce(action_type, '?') || ' · ' || coalesce(from_stage, '?') || ' -> ' || coalesce(to_stage, '?')
         || ' · by ' || coalesce(actor_name, '?') || ' as ' || coalesce(actor_role_name, actor_role_key, '?')
  from (select h.*, row_number() over (order by h.created_at desc) as rn
        from public.request_history h where h.request_id = (select id from req)) x
  where rn <= 8
  -- 5. Verdict
  union all
  select 99, '5 VERDICT', 'Result',
    case
      when not exists (select 1 from req) then 'Request not found. Fix the request number in params and run again.'
      when not exists (select 1 from officer) then 'Officer not found. Fix the email in params and run again.'
      when public.reqgen_key((select current_stage from req)) in ('completed', 'rejected', 'cancelled', 'deleted')
        then 'The request is closed (' || (select current_stage from req) || '). Closed requests never show in Approvals.'
      when exists (select 1 from req where status ilike '%returned for correction%')
        then 'The request was sent back to the requester. It waits in the requester''s My Requests, not in Approvals.'
      when exists (select 1 from req where current_owner = (select id from officer))
        then 'The request IS with this officer. It must show in their Approvals. If it does not, sign out and in again and send a screenshot.'
      when exists (select 1 from req where current_owner is null)
        then 'Nobody owns the request at the ' || coalesce((select current_stage from req), '?')
             || ' step. This is a routing gap: no officer is set for that step. Do NOT edit the request; report it.'
      else 'The request is waiting with ' || coalesce((select full_name from owner), 'another officer')
           || ' at the ' || coalesce((select current_stage from req), '?')
           || ' step, not with this officer. That is why it is not in their queue. Registry sees it because Registry tracks every movement. '
           || 'To change who receives NEW requests at that step, use Routing Engine › Routes (Official or Personal Requests view). Requests already moving keep their owner.'
    end
)
select section, item, coalesce(detail, '—') as detail
from lines
order by n;
