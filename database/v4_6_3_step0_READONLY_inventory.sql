-- =============================================================================
-- ReqGen v4.6.3 — STEP 0: READ-ONLY inventory (changes NOTHING)
--
-- Run this once in the Supabase SQL Editor, then use "Download CSV" on the
-- result and send the file back. It lists every table (with its row count and
-- columns), the triggers, the foreign keys, the finance functions' code, and
-- every subhead and IET account that still carries a figure. It is used to check the v4.6.3 reset and the
-- reconciliation against YOUR real database before anything is changed.
--
-- It contains no passwords, keys or personal details — only table structure
-- and the subhead / account figures.
-- =============================================================================
with tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
)
select '1 table' as section, t.table_name as name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.schema_name, t.table_name), false, true, '')))[1]::text as detail,
       (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end, ', ' order by a.attnum)
          from pg_attribute a where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped) as extra
from tables t
union all
select '2 trigger', c.relname, tg.tgname, pg_get_triggerdef(tg.oid)
from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not tg.tgisinternal
union all
select '3 foreign key', conrelid::regclass::text, conname, pg_get_constraintdef(oid)
from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace
union all
select '4 subhead', coalesce(s->>'code', '') || ' ' || coalesce(s->>'name', ''), 'id ' || (s->>'id'), s::text
from (select to_jsonb(x) as s from public.subheads x) q
where coalesce((s->>'approved_allocation')::numeric, 0) <> 0 or coalesce((s->>'expenditure')::numeric, 0) <> 0
   or coalesce((s->>'reserved_amount')::numeric, 0) <> 0 or coalesce((s->>'balance')::numeric, 0) <> 0
union all
select '5 iet account', coalesce(a->>'name', ''), 'id ' || (a->>'id'), a::text
from (select to_jsonb(x) as a from public.iet_accounts x) q
union all
select '6 function', p.proname, pg_get_function_identity_arguments(p.oid),
       case when p.prokind <> 'f' then null
            when pg_get_functiondef(p.oid) ~* '(subheads|iet_accounts|iet_bank_ledger|iet_account_transactions|finance_transactions|payment_vouchers|account_transfers)'
            then pg_get_functiondef(p.oid) end
from pg_proc p where p.pronamespace = 'public'::regnamespace
order by 1, 2, 3;
