-- =============================================================================
-- ReqGen v3.1.8 — Master Backup log
-- Run AFTER v3_1_7_registers_tracker_manual_pv.sql (rev 2). Safe to re-run.
-- Records every master backup download, preview and restore. Written only by
-- the server (service role); readable by Admin and the Auditor.
-- =============================================================================

set lock_timeout = '10s';

begin;

create table if not exists public.reqgen_backup_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('backup', 'preview', 'restore')),
  financial_year text,
  mode text,
  actor_id uuid,
  actor_name text,
  summary jsonb,
  created_at timestamptz not null default now()
);

alter table public.reqgen_backup_log enable row level security;

drop policy if exists reqgen_backup_log_read on public.reqgen_backup_log;
create policy reqgen_backup_log_read on public.reqgen_backup_log
  for select to authenticated
  using (public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor']));

revoke insert, update, delete on public.reqgen_backup_log from anon, authenticated;
grant select on public.reqgen_backup_log to authenticated;

commit;

select '1. Backup log table' as check_item,
       case when to_regclass('public.reqgen_backup_log') is not null then 'OK' else 'CHECK' end as status,
       '' as detail
union all
select '2. Only Admin / Auditor can read it',
       case when exists (select 1 from pg_policies where tablename = 'reqgen_backup_log' and policyname = 'reqgen_backup_log_read') then 'OK' else 'CHECK' end, ''
union all
select '3. v3.1.7 functions present (run v3.1.7 rev 2 first if CHECK)',
       case when to_regprocedure('public.reqgen_pv_tracker()') is not null
             and to_regprocedure('public.reqgen_print_register()') is not null then 'OK' else 'CHECK' end, '';
