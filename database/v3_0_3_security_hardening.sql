-- ============================================================================
-- ReqGen v3.0.3 — Security hardening (SAFE · idempotent · no data touched)
--
-- 1) Pins search_path = public on every SECURITY DEFINER function in the
--    public schema that does not already have one (your audit found 5:
--    submit_request_with_funds, reserve_request_funds, finalize_request_funds,
--    reject_request_and_restore, notify_user). This is Supabase's own
--    recommended fix. It changes the functions' CONFIGURATION only — not their
--    code, not their permissions, and no table data. Behaviour is unchanged
--    because these functions already work against the public schema.
-- 2) Enables realtime change notifications for public.requests so the
--    approval bell updates instantly (respects your existing RLS).
-- 3) Prints a verification table. Every row should say OK.
-- ============================================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c where c like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public', fn.signature);
    raise notice 'Pinned search_path on %', fn.signature;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
     ) then
    execute 'alter publication supabase_realtime add table public.requests';
    raise notice 'Realtime enabled for public.requests';
  end if;
end $$;

-- Verification
select 'SECURITY DEFINER functions without search_path' as check_item,
       case when count(*) = 0 then 'OK' else count(*)::text || ' remaining' end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c where c like 'search_path=%')
union all
select 'Realtime on public.requests',
       case when exists (select 1 from pg_publication_tables
                         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests')
            then 'OK' else 'NOT ENABLED' end;
