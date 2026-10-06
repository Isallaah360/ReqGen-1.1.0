-- =============================================================================
-- ReqGen v3.1.6 — READ-ONLY export for the Payment Voucher signing workflow
-- Changes NOTHING. Run in the Supabase SQL Editor, then use
-- "Download CSV" on the result and send the file back.
--
-- One result table: section | item | detail
--   A  voucher database functions (full source)
--   B  columns of the voucher / account tables
--   C  triggers on payment_vouchers
--   D  voucher status counts and the latest 5 vouchers (no bank numbers)
--   E  approval history of REQ-202608-908021 (why "Checked by" is empty)
--   F  route steps of that request's template
--   G  department <-> IET account links (for the manual voucher filter)
-- =============================================================================

with
a as (
  select 'A function' as section,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as item,
         pg_get_functiondef(p.oid) as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname ilike '%voucher%' or p.proname in ('approve_request_step', 'reject_request_step'))
),
b as (
  select 'B columns' as section,
         c.table_name as item,
         string_agg(c.column_name || ' ' || c.data_type, ', ' order by c.ordinal_position) as detail
  from information_schema.columns c
  where c.table_schema = 'public'
    and (c.table_name ilike '%voucher%' or c.table_name ilike 'iet_account%'
         or c.table_name in ('department_account_routing', 'account_officer_accounts', 'departments'))
  group by c.table_name
),
c as (
  select 'C trigger' as section,
         t.tgname as item,
         pg_get_triggerdef(t.oid) as detail
  from pg_trigger t
  where t.tgrelid = 'public.payment_vouchers'::regclass and not t.tgisinternal
),
d as (
  select 'D status count' as section,
         coalesce(v.status, '(null)') as item,
         count(*)::text as detail
  from public.payment_vouchers v
  group by v.status
  union all
  select 'D voucher', x.voucher_no, x.detail
  from (
    select v.voucher_no, v.created_at,
           (to_jsonb(v) - array['account_number','bank_account_number','cash_payee_phone']
            - array(select k from jsonb_object_keys(to_jsonb(v)) k where k ilike '%signature%'))::text as detail
    from public.payment_vouchers v
    order by v.created_at desc nulls last
    limit 5
  ) x
),
r as (
  select id, route_template_id, current_stage, status from public.requests where request_no = 'REQ-202608-908021' limit 1
),
e as (
  select 'E history' as section,
         to_char(h.created_at, 'YYYY-MM-DD HH24:MI') || ' ' || coalesce(h.action_type, '?') as item,
         'from=' || coalesce(h.from_stage, '?') || ' to=' || coalesce(h.to_stage, '?')
         || ' actor=' || coalesce(h.actor_name, '?') || ' role=' || coalesce(h.actor_role_key, '?')
         || ' signature=' || case when coalesce(h.signature_url, '') <> '' then 'yes' else 'NO' end as detail
  from public.request_history h join r on r.id = h.request_id
),
f as (
  select 'F route step' as section,
         s.route_kind || ' #' || s.step_order as item,
         s.stage || ' (if vacant: ' || coalesce(s.if_vacant, '?') || ')' as detail
  from public.reqgen_route_steps s join r on r.route_template_id = s.template_id
),
g as (
  select 'G dept-account link' as section,
         coalesce(d.name, '?') as item,
         (to_jsonb(dar) - 'id')::text as detail
  from public.department_account_routing dar
  left join public.departments d on d.id = dar.dept_id
)
select section, item, detail from a
union all select * from b
union all select * from c
union all select * from d
union all select * from e
union all select * from f
union all select * from g
order by 1, 2;
