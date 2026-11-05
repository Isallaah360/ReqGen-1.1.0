-- =====================================================================================
-- ReqGen v4.6.9 — Request Insight (read-only)
--
-- Adds ONE read-only function, public.reqgen_request_insight(request id), used by the new
-- "Request Insight" panel that the DG and the other approving officers see on a request.
--
--   * It reads only. It changes no table, no policy, no route and no request.
--   * It does NOT touch the routing engine (approve_request_step, reqgen_next_route_step,
--     build_request_route, reqgen_build_route_for_template, reqgen_save_department_route,
--     reqgen_actor_role_for_stage and the route tables are left exactly as they are).
--   * Only officers on that request's route may call it: the officer holding it now, an officer
--     who has already acted on it, or its assigned Account Officer. The requester, Registry and
--     everyone else are refused.
--   * Subhead balances are returned only when the officer is acting as a position that may see
--     balances (same list as the screens: DG, General Secretary, DOD, HOD, DIN Admin, Registrar,
--     HR Coordinator and HR Officers, Account Officers, Auditor). PD, PA to the DG, Registry,
--     Counter Signer and Staff never get them.
--
-- Safe to run more than once. Ends with an all-OK table.
-- =====================================================================================

create temp table if not exists v469_report (step text, item text, detail text, result text) on commit preserve rows;
truncate v469_report;

create or replace function public.reqgen_request_insight(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.requests%rowtype;
  k text;
  see_bal boolean;
  allowed boolean;
  title_key text;
  since timestamptz := now() - interval '12 months';
  sub jsonb := null;
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into r from public.requests where id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;

  allowed := r.created_by is distinct from me and (
       r.current_owner is not distinct from me
    or r.assigned_account_officer_id is not distinct from me
    or r.assigned_account_officer_user_id is not distinct from me
    or exists (select 1 from public.request_history h where h.request_id = r.id and h.action_by = me
               and lower(coalesce(h.action_type, '')) !~ '(submit|created)'));
  if not coalesce(allowed, false) then
    raise exception 'Request Insight is for the officers on this request''s route.';
  end if;

  k := regexp_replace(coalesce(public.reqgen_active_role_key(), 'staff'), '[0-9]+$', '');
  see_bal := k in ('dg', 'generalsecretary', 'dod', 'director', 'hod', 'dinadmin', 'registrar', 'hrcoordinator',
                   'hr', 'hrofficer', 'account', 'accounts', 'accountofficer', 'auditor', 'admin', 'superadmin')
             or k like 'hr%officer%';

  -- the first long word of the title, for "similar before"
  title_key := (select w from regexp_split_to_table(lower(coalesce(r.title, '')), '[^a-z0-9]+') w
                where length(w) >= 4 and w not in ('request', 'payment', 'purchase', 'leave', 'with', 'from', 'for', 'and', 'the')
                order by length(w) desc limit 1);

  if r.subhead_id is not null then
    select jsonb_build_object(
             'code', s.code, 'name', s.name,
             'used_this_year', (select count(*) from public.requests q where q.subhead_id = s.id and q.id <> r.id
                                  and q.created_at >= since and lower(coalesce(q.status, '')) !~ '(withdrawn|cancel|deleted|draft)'),
             'balances_shown', see_bal,
             'allocation', case when see_bal then s.approved_allocation end,
             'reserved', case when see_bal then s.reserved_amount end,
             'expenditure', case when see_bal then s.expenditure end,
             'available', case when see_bal then coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0) end)
      into sub
      from public.subheads s where s.id = r.subhead_id;
  end if;

  return jsonb_build_object(
    'request_no', r.request_no,
    'amount', r.amount,
    'balances_shown', see_bal,

    -- 1. Similar requests before (same department, same kind or same words in the title)
    'similar', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object('id', q.id, 'request_no', q.request_no, 'title', q.title, 'amount', q.amount,
                                  'status', q.status, 'stage', q.current_stage, 'created_at', q.created_at,
                                  'same_requester', q.created_by = r.created_by, 'same_subhead', q.subhead_id is not distinct from r.subhead_id and r.subhead_id is not null) x
          from public.requests q
         where q.id <> r.id and q.dept_id is not distinct from r.dept_id
           and lower(coalesce(q.status, '')) !~ '(draft|deleted)'
           and ( (r.subhead_id is not null and q.subhead_id = r.subhead_id)
              or (r.personal_category is not null and q.personal_category = r.personal_category)
              or (title_key is not null and lower(coalesce(q.title, '')) like '%' || title_key || '%')
              or lower(coalesce(q.title, '')) = lower(coalesce(r.title, '')) )
         order by q.created_at desc limit 8) t), '[]'::jsonb),

    -- 2. This subhead (balances only for positions allowed to see them)
    'subhead', sub,
    'subhead_recent', case when r.subhead_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object('id', q.id, 'request_no', q.request_no, 'title', q.title, 'amount', q.amount, 'status', q.status, 'created_at', q.created_at) x
          from public.requests q
         where q.subhead_id = r.subhead_id and q.id <> r.id and lower(coalesce(q.status, '')) !~ '(draft|deleted)'
         order by q.created_at desc limit 6) t), '[]'::jsonb) end,

    -- 3. Amount check: this amount against approved requests of the same kind in the last 12 months
    'amount_check', (
      select jsonb_build_object('count', count(*), 'average', round(avg(q.amount), 2), 'lowest', min(q.amount), 'highest', max(q.amount))
        from public.requests q
       where q.id <> r.id and q.created_at >= since and coalesce(q.amount, 0) > 0
         and lower(coalesce(q.status, '')) ~ '(approved|paid|complet)'
         and ( (r.subhead_id is not null and q.subhead_id = r.subhead_id)
            or (r.subhead_id is null and q.request_type is not distinct from r.request_type
                and q.personal_category is not distinct from r.personal_category and q.dept_id is not distinct from r.dept_id))),

    -- 4. The requester's last 12 months
    'requester', (
      select jsonb_build_object(
               'name', coalesce(r.requester_name, (select p.full_name from public.profiles p where p.id = r.created_by)),
               'count', count(*), 'total', coalesce(sum(q.amount), 0),
               'returned', count(*) filter (where exists (select 1 from public.request_history h where h.request_id = q.id and lower(coalesce(h.action_type, '')) ~ 'return')),
               'last_at', max(q.created_at))
        from public.requests q
       where q.created_by = r.created_by and q.id <> r.id and q.created_at >= since
         and lower(coalesce(q.status, '')) !~ '(draft|deleted)'),

    -- 5. Follow-up: the same requester asked for the same thing before (links to earlier months and years)
    'follow_up', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object('id', q.id, 'request_no', q.request_no, 'title', q.title, 'amount', q.amount, 'status', q.status,
                                  'created_at', q.created_at,
                                  'possible_duplicate', q.amount = r.amount and q.created_at >= r.created_at - interval '45 days'
                                                        and lower(coalesce(q.status, '')) !~ '(withdrawn|cancel|reject)') x
          from public.requests q
         where q.created_by = r.created_by and q.id <> r.id and q.created_at < r.created_at
           and lower(coalesce(q.status, '')) !~ '(draft|deleted)'
           and ( lower(coalesce(q.title, '')) = lower(coalesce(r.title, ''))
              or (title_key is not null and lower(coalesce(q.title, '')) like '%' || title_key || '%')
              or (r.subhead_id is not null and q.subhead_id = r.subhead_id and q.amount = r.amount) )
         order by q.created_at desc limit 6) t), '[]'::jsonb),

    -- 6. Time on route: each step of this request so far
    'route', coalesce((
      select jsonb_agg(jsonb_build_object('action', h.action_type, 'by_position', coalesce(h.actor_role_name, h.actor_role_key),
                                          'from_stage', h.from_stage, 'to_stage', h.to_stage, 'at', h.created_at) order by h.created_at)
        from public.request_history h where h.request_id = r.id), '[]'::jsonb),
    'created_at', r.created_at
  );
end;
$$;

revoke all on function public.reqgen_request_insight(uuid) from public, anon;
grant execute on function public.reqgen_request_insight(uuid) to authenticated;
insert into v469_report values ('1 insight', 'reqgen_request_insight', 'read-only; route officers only; balances by position', 'OK');

-- 2. Checks
insert into v469_report
select '2 check', 'function installed', count(*)::text, case when count(*) = 1 then 'OK' else 'CHECK' end
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'reqgen_request_insight';
insert into v469_report
select '2 check', 'it only reads (stable)', max(provolatile::text), case when bool_and(provolatile = 's') then 'OK' else 'CHECK' end
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'reqgen_request_insight';
insert into v469_report
select '2 check', 'anonymous visitors cannot call it',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'reqgen_request_insight';
insert into v469_report
select '2 check', 'routing engine untouched (still installed)', count(*)::text || ' of 5',
       case when count(*) >= 5 then 'OK' else 'CHECK' end
  from (select distinct proname from pg_proc where pronamespace = 'public'::regnamespace
          and proname in ('approve_request_step', 'reqgen_next_route_step', 'build_request_route',
                          'reqgen_build_route_for_template', 'reqgen_save_department_route')) f;

notify pgrst, 'reload schema';

select step, item, detail, result from v469_report order by step, item;
