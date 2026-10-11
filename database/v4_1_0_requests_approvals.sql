-- =============================================================================
-- ReqGen v4.1.0 — Requests and Approvals
-- Run in the Supabase SQL Editor AFTER the v4.1.0 code shows "Ready" on Vercel.
-- Adds three read-only helpers. Nothing is deleted, no routing is changed.
--   1. reqgen_department_subhead_names  — the subheads of a department (names only)
--   2. reqgen_subhead_live_check        — "available" / "not_enough" (never the balance)
--   3. reqgen_treated_by_me             — what the signed-in officer approved,
--                                          returned, rejected or signed
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v41_report (step text, item text, result text, status text);
truncate v41_report;

-- 1. subhead names for the New Request form (no money figures)
create or replace function public.reqgen_department_subhead_names(p_dept_id uuid)
returns table (id uuid, code text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.code::text, s.name::text
  from public.subheads s
  where auth.uid() is not null
    and s.dept_id = p_dept_id
    and coalesce(s.is_active, true)
  order by s.code nulls last, s.name;
$$;
revoke all on function public.reqgen_department_subhead_names(uuid) from public, anon;
grant execute on function public.reqgen_department_subhead_names(uuid) to authenticated;
insert into v41_report values ('1 live check', 'reqgen_department_subhead_names', 'subhead names only', 'OK');

-- 2. live budget check: the answer is a word, never the balance
create or replace function public.reqgen_subhead_live_check(p_subhead_id uuid, p_amount numeric)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then 'unknown'
    when s.id is null then 'unknown'
    when coalesce(p_amount, 0) <= 0 then 'unknown'
    when coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0) >= p_amount then 'available'
    else 'not_enough'
  end
  from (select 1) one
  left join public.subheads s on s.id = p_subhead_id and coalesce(s.is_active, true);
$$;
revoke all on function public.reqgen_subhead_live_check(uuid, numeric) from public, anon;
grant execute on function public.reqgen_subhead_live_check(uuid, numeric) to authenticated;
insert into v41_report values ('1 live check', 'reqgen_subhead_live_check', 'answers available / not_enough only', 'OK');

-- 3. Treated by Me (the officer's own decisions only)
create or replace function public.reqgen_treated_by_me(p_limit int default 500)
returns table (kind text, item_id uuid, item_no text, title text, amount numeric, action_type text, acted_as text, acted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select 'request'::text, r.id, r.request_no::text, r.title::text, r.amount::numeric,
           h.action_type::text, coalesce(h.actor_role_name, h.actor_role_key)::text, h.created_at
    from public.request_history h
    join public.requests r on r.id = h.request_id
    where h.action_by = auth.uid()
      and lower(coalesce(h.action_type, '')) !~ '(submit|created|attachment|edit)'
      and r.created_by is distinct from auth.uid()
    union all
    select 'voucher'::text, v.id, v.voucher_no::text, v.payee_name::text, coalesce(v.total_amount, v.amount)::numeric,
           h.action_type::text, h.actor_role::text, h.created_at
    from public.payment_voucher_history h
    join public.payment_vouchers v on v.id = h.voucher_id
    where h.action_by = auth.uid()
  ) t
  order by 8 desc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;
revoke all on function public.reqgen_treated_by_me(int) from public, anon;
grant execute on function public.reqgen_treated_by_me(int) to authenticated;
insert into v41_report values ('2 approvals', 'reqgen_treated_by_me', 'own decisions on requests and vouchers', 'OK');

-- 4. Verification
insert into v41_report
select '3 check', 'helpers installed', count(*)::text || ' of 3',
       case when count(*) = 3 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_department_subhead_names', 'reqgen_subhead_live_check', 'reqgen_treated_by_me');

insert into v41_report
select '3 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_department_subhead_names', 'reqgen_subhead_live_check', 'reqgen_treated_by_me');

commit;

select step as "step", item as "item", result as "result", status as "status" from v41_report order by step, item;
