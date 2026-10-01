-- ============================================================================
-- ReqGen v3.0.5 — Workflow engine export (READ-ONLY · changes nothing)
--
-- The routing a request actually follows is decided inside database
-- functions that are not in the code repository (submit, approve, reject…).
-- Before building the configurable Routing Engine, the developer must read
-- them exactly, so the new engine replaces their routing logic safely and
-- requests already in progress are not disturbed.
--
-- HOW TO USE: Supabase → SQL Editor → paste this whole file → Run →
-- Export CSV → send the file. (It may be long; that is expected.)
-- ============================================================================
select 'function' as kind, p.proname as name,
       pg_get_function_identity_arguments(p.oid) as detail,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and (
       p.proname ~* '(request|approv|reject|submit|route|routing|stage|workflow|owner|forward|return|reserve|fund|commit|notify|hr_fil|registry|registrar|dg|account_officer)'
  )

union all
select 'trigger', t.tgname, c.relname, pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
  and c.relname in ('requests', 'request_history', 'departments', 'payment_vouchers')

union all
select 'constraint', con.conname, rel.relname, pg_get_constraintdef(con.oid)
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and con.contype = 'c'
  and rel.relname in ('requests', 'request_history', 'departments')

union all
select 'column', c.table_name, c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public' and c.table_name in ('departments', 'app_settings', 'profile_roles', 'user_active_roles')

union all
select 'stage_in_use', coalesce(current_stage, '(null)'), coalesce(status, '(null)'), count(*)::text
from public.requests
group by current_stage, status

union all
select 'app_setting', key, '', coalesce(value, '')
from public.app_settings
where key ~* '(user_id|routing|route|gensec|dg|hr|registrar|din)'

order by 1, 2;
